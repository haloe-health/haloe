import { reserveSlot, confirmBooking, releaseBooking, slotToMinutes, STRIPE_SESSION_SECONDS } from './_bookings.js';
import { isOfferableStart } from './_slots.js';
import { CLINIC_VENUE_NAME, CLINIC_VENUE_ADDRESS } from './_clinic.js';
import { findService, netPrice } from './_services.js';
import { validateDiscountCode, applyDiscount, reserveDiscountCode, confirmDiscountRedemption, releaseDiscountReservation } from './_discounts.js';
import { travelZoneFor, travelFeeFor } from './_travel.js';
import { notifyBooking, formatGBP, upperPostcode } from './_notify.js';

export async function onRequestPost(context) {
  try {
    const { treatmentName, treatmentCategory, customerEmail, customerName, customerPhone, customerAddress, date, time, location, notes, bookingDate, discountCode, travelPostcode } = await context.request.json();
    // location is 'clinic' | 'mobile'. Every booking is paid in full — there is
    // no deposit path.
    const venue = location === 'clinic' ? CLINIC_VENUE_NAME : '';

    // Price comes from the server-side catalogue, never the client — a
    // tampered request body must never be able to set its own amount.
    // treatmentCategory is required: four names are reused across dry/wet
    // cupping at different prices (see the comment on findService()) — a
    // category-less lookup would silently resolve to the wrong one.
    const svc = findService(treatmentName, treatmentCategory);
    if (!svc) {
      return new Response(JSON.stringify({ error: 'unknown_treatment' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    const originalAmount = Math.round(netPrice(svc) * 100); // pence — the TREATMENT price only
    const now = Math.floor(Date.now() / 1000);
    const hasSupabase = Boolean(context.env.SUPABASE_URL && context.env.SUPABASE_SERVICE_ROLE_KEY);

    // The discount is re-validated from scratch here — never trust that the
    // client's earlier /apply-discount check still holds. A code could have
    // expired, been deactivated, or been redeemed by the same email/phone in
    // another tab in the meantime. A code that fails re-validation rejects
    // the checkout outright (rather than silently charging full price)
    // rather than surprise a customer who saw a discounted total.
    //
    // Deliberately applied to `originalAmount` (the treatment price) alone,
    // before travelPence is computed or added anywhere below — a discount
    // code can never reach the travel fee, because the travel figure simply
    // doesn't exist yet at this point in the function.
    let treatmentAmount = originalAmount;
    let appliedCode = null;
    let appliedPercent = 0;
    let discountPenceApplied = 0;
    let discountRedemptionId = null;
    if (discountCode) {
      if (!hasSupabase) {
        return new Response(JSON.stringify({ error: 'discount_unavailable' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      const result = await validateDiscountCode(context.env, discountCode, customerEmail, customerPhone, now);
      if (!result.ok) {
        return new Response(JSON.stringify({ error: 'discount_invalid', reason: result.reason }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      const applied = applyDiscount(originalAmount, result.percent);
      treatmentAmount = applied.finalPence;
      discountPenceApplied = applied.discountPence;
      appliedCode = result.code;
      appliedPercent = result.percent;

      // Reserved the moment it passes validation — see the file header on
      // _discounts.js for why the INSERT itself is what actually prevents
      // two simultaneous bookings both using up a single-use code.
      discountRedemptionId = await reserveDiscountCode(context.env, {
        codeId: result.codeId,
        email: customerEmail,
        discountPence: discountPenceApplied,
        periodKey: result.periodKey,
      }, now);
      if (discountRedemptionId === null) {
        return new Response(JSON.stringify({ error: 'discount_invalid', reason: 'already_used' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    }

    // Travel fee — home visits only, zone computed server-side from the
    // postcode, never trusted from the client. Clinic Day bookings have a
    // fixed venue and never get a travel line. An unparseable postcode
    // (shouldn't happen — book.html validates the format before letting the
    // customer continue) falls back to Zone C rather than blocking payment.
    let travelZone = null;
    let travelPence = 0;
    if (location === 'mobile') {
      travelZone = travelZoneFor(travelPostcode) || 'C';
      travelPence = travelFeeFor(travelZone);
    }

    const totalAmount = treatmentAmount + travelPence;

    const secretKey = context.env.STRIPE_SECRET_KEY;
    const origin = new URL(context.request.url).origin;

    // --- Validate the start time against the opening hours (_slots.js) ---
    // The wizard generates its slots from the same table, so a start that
    // isn't on the grid (or is inside the same-day minimum notice) can only
    // come from a tampered or stale request. Rejected outright — this is
    // static config, so there's nothing to fail open over.
    const startMin = slotToMinutes(time);
    if (startMin === null || !isOfferableStart({ location: location === 'clinic' ? 'clinic' : 'mobile', dateISO: bookingDate, startMin })) {
      if (discountRedemptionId !== null) {
        try { await releaseDiscountReservation(context.env, discountRedemptionId); } catch (e) { console.error('releaseDiscountReservation failed:', e); }
      }
      return new Response(JSON.stringify({ error: 'slot_invalid' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // --- Reserve the slot before taking payment (prevents double-booking) ---
    // Held as 'pending' for HOLD_SECONDS (10 min); the webhook confirms it on
    // payment, and an abandoned checkout's hold simply lapses. The duration
    // comes from the server-side catalogue (`min` in _services.js), never
    // from the client. If Supabase isn't configured we fail OPEN and let the
    // booking proceed unreserved — never block a paying customer over an
    // availability bug.
    const duration = Number(svc.min) > 0 ? Number(svc.min) : 60;
    let bookingId = null;

    if (hasSupabase && bookingDate && startMin !== null) {
      try {
        bookingId = await reserveSlot(context.env, {
          bookingDate,
          startMin,
          endMin: startMin + duration,
          treatment: treatmentName,
          name: customerName,
          email: customerEmail,
          phone: customerPhone,
          location: location || 'mobile',
          address: location === 'clinic' ? `${venue} — ${CLINIC_VENUE_ADDRESS}` : customerAddress,
          amountPence: Number(totalAmount),
          discountCode: appliedCode,
          discountPence: discountPenceApplied,
          travelZone,
          travelPence,
        }, now);

        if (bookingId === null) {
          // Someone else took it during checkout. Ask the client to pick again.
          if (discountRedemptionId !== null) {
            try { await releaseDiscountReservation(context.env, discountRedemptionId); } catch (e) { console.error('releaseDiscountReservation failed:', e); }
          }
          return new Response(JSON.stringify({ error: 'slot_taken' }), {
            status: 409,
            headers: { 'Content-Type': 'application/json' },
          });
        }
      } catch (err) {
        console.error('Slot reservation failed (proceeding without hold):', err);
        bookingId = null;
      }
    }

    const venueAddress = location === 'clinic' ? `${venue} — ${CLINIC_VENUE_ADDRESS}` : customerAddress;

    // --- Free booking (a 100%-off gift/reward/competition code) ---
    // No Stripe involved at all — there's nothing to pay, and Stripe Checkout
    // doesn't take £0 sessions. Confirm the slot and the redemption straight
    // away and send the exact same notifications the webhook would send for a
    // paid booking (see _notify.js).
    if (totalAmount === 0) {
      let slotConflict = false;
      if (hasSupabase && bookingId !== null) {
        try {
          const result = await confirmBooking(context.env, bookingId);
          slotConflict = Boolean(result && result.conflict);
        } catch (err) {
          console.error('Failed to confirm free booking slot:', err);
        }
      }
      if (hasSupabase && discountRedemptionId !== null) {
        try { await confirmDiscountRedemption(context.env, discountRedemptionId, bookingId); } catch (err) { console.error('Failed to confirm discount redemption:', err); }
      }

      const detail = {
        name: customerName, phone: customerPhone, email: customerEmail,
        treatment: treatmentName, date, time, location: location || 'mobile', venue,
        address: upperPostcode(location === 'clinic' ? venueAddress : customerAddress),
        amount: formatGBP(0), paymentLabel: `${formatGBP(0)} — paid in full`, notes,
        originalAmountLabel: appliedCode ? formatGBP(originalAmount) : '',
        discountRowLabel: appliedCode ? `${appliedCode} discount` : '',
        discountLabel: appliedCode ? `−${formatGBP(discountPenceApplied)}` : '',
        travelLabel: location === 'mobile' ? (travelZone === 'C' ? 'Confirmed by WhatsApp before the session' : formatGBP(travelPence)) : '',
        travelZone: location === 'mobile' ? travelZone : '',
        travelPence: location === 'mobile' ? travelPence : 0,
        slotConflict,
      };
      await notifyBooking(context.env, detail);

      const successParams = new URLSearchParams({
        name: customerName || '', treatment: treatmentName || '', date: date || '', time: time || '',
        location: location || 'mobile', venue: venue || '', amount: '0', treatmentAmount: '0',
        ...(appliedCode ? { discountCode: appliedCode, discountAmount: String(discountPenceApplied), originalAmount: String(originalAmount) } : {}),
        ...(location === 'mobile' ? { travelZone, travelPence: '0' } : {}),
      });
      return new Response(JSON.stringify({ url: `${origin}/booking-confirmed.html?${successParams.toString()}` }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const productName = `Full payment — ${treatmentName}`;

    const discountNote = appliedCode ? ` ${appliedCode} applied: ${appliedPercent}% off the treatment price.` : '';
    const description = `Full payment for ${treatmentName} with haloe.${discountNote} Free reschedule or full refund up to 48 hours before your session. Inside 48 hours, sessions are non-refundable but can be moved once. No-shows are charged in full.`;

    const params = new URLSearchParams();
    params.append('payment_method_types[]', 'card');
    params.append('mode', 'payment');
    params.append('customer_email', customerEmail);
    params.append('line_items[0][price_data][currency]', 'gbp');
    params.append('line_items[0][price_data][product_data][name]', productName);
    params.append('line_items[0][price_data][product_data][description]', description);
    params.append('line_items[0][price_data][unit_amount]', String(treatmentAmount));
    params.append('line_items[0][quantity]', '1');
    // Travel is always its own line item for a home visit — never merged into
    // the treatment price, and never discounted (see the comment above where
    // treatmentAmount is computed). Zone C has no fixed fee, but still gets a
    // £0 line so it's itemised everywhere a real fee would be, rather than
    // silently missing.
    if (location === 'mobile') {
      const travelName = travelZone === 'A' ? 'Travel — Zone A (Oldham & nearby)'
        : travelZone === 'B' ? 'Travel — Zone B (Greater Manchester)'
        : 'Travel — confirmed by WhatsApp before your session';
      params.append('line_items[1][price_data][currency]', 'gbp');
      params.append('line_items[1][price_data][product_data][name]', travelName);
      params.append('line_items[1][price_data][product_data][description]', 'Home-visit travel fee. Never discounted by promotional codes.');
      params.append('line_items[1][price_data][unit_amount]', String(travelPence));
      params.append('line_items[1][quantity]', '1');
    }
    params.append('metadata[customerName]', customerName);
    params.append('metadata[customerPhone]', customerPhone || '');
    params.append('metadata[treatmentName]', treatmentName);
    params.append('metadata[date]', date || '');
    params.append('metadata[time]', time || '');
    params.append('metadata[location]', location || 'mobile');
    if (venue) params.append('metadata[venue]', venue);
    params.append('metadata[customerAddress]', customerAddress || '');
    params.append('metadata[notes]', notes || '');
    if (bookingId !== null) params.append('metadata[bookingId]', String(bookingId));
    if (appliedCode) {
      params.append('metadata[discountCode]', appliedCode);
      params.append('metadata[discountPence]', String(discountPenceApplied));
      params.append('metadata[originalAmountPence]', String(originalAmount));
      if (discountRedemptionId !== null) params.append('metadata[discountRedemptionId]', String(discountRedemptionId));
    }
    if (location === 'mobile') {
      params.append('metadata[travelZone]', travelZone);
      params.append('metadata[travelPence]', String(travelPence));
    }
    // The same figure Stripe is being charged (treatmentAmount + travelPence)
    // — a fallback for the webhook's "Total paid" if session.amount_total is
    // ever missing, so that fallback can't silently diverge from what the
    // customer actually paid.
    params.append('metadata[totalAmountPence]', String(totalAmount));
    // Stripe's minimum Checkout Session lifetime is 30 minutes — longer than
    // our 10-minute slot hold, unavoidably. A payment that lands after the
    // hold lapsed is still confirmed; the webhook flags any clash to Halima
    // (see confirmBooking in _bookings.js).
    params.append('expires_at', String(now + STRIPE_SESSION_SECONDS));
    const successParams = new URLSearchParams({
      name: customerName || '',
      treatment: treatmentName || '',
      date: date || '',
      time: time || '',
      location: location || 'mobile',
      venue: venue || '',
      amount: String(totalAmount),
      treatmentAmount: String(treatmentAmount),
      ...(appliedCode ? {
        discountCode: appliedCode,
        discountAmount: String(discountPenceApplied),
        originalAmount: String(originalAmount),
      } : {}),
      ...(location === 'mobile' ? {
        travelZone,
        travelPence: String(travelPence),
      } : {}),
    });
    params.append('success_url', `${origin}/booking-confirmed.html?${successParams.toString()}`);
    params.append('cancel_url', `${origin}/book.html`);

    const response = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${secretKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });

    const session = await response.json();

    if (!response.ok) {
      console.error('Stripe error:', session);
      // Payment setup failed — free the slot and the discount reservation we
      // just held so neither is stuck.
      if (hasSupabase && bookingId !== null) {
        try { await releaseBooking(context.env, bookingId); } catch (e) { console.error('releaseBooking failed:', e); }
      }
      if (hasSupabase && discountRedemptionId !== null) {
        try { await releaseDiscountReservation(context.env, discountRedemptionId); } catch (e) { console.error('releaseDiscountReservation failed:', e); }
      }
      return new Response(JSON.stringify({ error: session.error?.message || 'Stripe error' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ url: session.url }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (err) {
    console.error('Function error:', err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
