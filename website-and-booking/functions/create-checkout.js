import { ensureBookingsTable, reserveSlot, releaseBooking, slotToMinutes, HOLD_SECONDS } from './_bookings.js';

export async function onRequestPost(context) {
  try {
    const { amount, treatmentName, paymentType, customerEmail, customerName, customerPhone, customerAddress, date, time, location, notes, bookingDate, durationMin } = await context.request.json();
    const secretKey = context.env.STRIPE_SECRET_KEY;
    const origin = new URL(context.request.url).origin;

    // --- Reserve the slot before taking payment (prevents double-booking) ---
    // Held as 'pending' for HOLD_SECONDS; the webhook confirms it on payment, and
    // an abandoned checkout's hold simply lapses. If the DB isn't bound, or the
    // time can't be parsed, we fail OPEN and let the booking proceed unreserved —
    // never block a paying customer over an availability bug.
    const db = context.env.DB;
    const now = Math.floor(Date.now() / 1000);
    const startMin = slotToMinutes(time);
    const duration = Number(durationMin) > 0 ? Number(durationMin) : 60;
    let bookingId = null;

    if (db && bookingDate && startMin !== null) {
      try {
        await ensureBookingsTable(db);
        bookingId = await reserveSlot(db, {
          bookingDate,
          startMin,
          endMin: startMin + duration,
          treatment: treatmentName,
          name: customerName,
          email: customerEmail,
          phone: customerPhone,
        }, now);

        if (bookingId === null) {
          // Someone else took it during checkout. Ask the client to pick again.
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

    const productName = paymentType === 'deposit'
      ? `Deposit — ${treatmentName}`
      : `Full payment — ${treatmentName}`;

    const description = paymentType === 'deposit'
      ? 'Non-refundable deposit to secure your booking. Remainder payable on the day.'
      : `Full payment for ${treatmentName} with haloe.`;

    const params = new URLSearchParams();
    params.append('payment_method_types[]', 'card');
    params.append('mode', 'payment');
    params.append('customer_email', customerEmail);
    params.append('line_items[0][price_data][currency]', 'gbp');
    params.append('line_items[0][price_data][product_data][name]', productName);
    params.append('line_items[0][price_data][product_data][description]', description);
    params.append('line_items[0][price_data][unit_amount]', String(amount));
    params.append('line_items[0][quantity]', '1');
    params.append('metadata[customerName]', customerName);
    params.append('metadata[customerPhone]', customerPhone || '');
    params.append('metadata[treatmentName]', treatmentName);
    params.append('metadata[paymentType]', paymentType);
    params.append('metadata[date]', date || '');
    params.append('metadata[time]', time || '');
    params.append('metadata[location]', location || '');
    params.append('metadata[customerAddress]', customerAddress || '');
    params.append('metadata[notes]', notes || '');
    if (bookingId !== null) params.append('metadata[bookingId]', String(bookingId));
    // Expire the Checkout Session in step with the slot hold, so an abandoned
    // payment and its reservation lapse together.
    params.append('expires_at', String(now + HOLD_SECONDS));
    const successParams = new URLSearchParams({
      type: paymentType,
      name: customerName || '',
      treatment: treatmentName || '',
      date: date || '',
      time: time || '',
      location: location || '',
      amount: String(amount),
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
      // Payment setup failed — free the slot we just held so it isn't stuck.
      if (db && bookingId !== null) {
        try { await releaseBooking(db, bookingId); } catch (e) { console.error('releaseBooking failed:', e); }
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
