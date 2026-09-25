// Cloudflare Pages Function — POST /stripe-webhook
//
// Receives Stripe webhook events. On `checkout.session.completed` it sends two
// branded emails via the Resend API: one warm confirmation to the customer, and
// one notification to Halima. There is no Stripe SDK in this environment, so the
// webhook signature is verified manually with Web Crypto (HMAC-SHA256).
//
// Env vars (set in the Cloudflare Pages dashboard, never in code):
//   STRIPE_WEBHOOK_SECRET  — the signing secret for this webhook endpoint (whsec_…)
//   RESEND_API_KEY         — Resend API key for sending email

import { confirmBooking } from './_bookings.js';
import { confirmDiscountRedemption } from './_discounts.js';
import { notifyBooking, formatGBP, upperPostcode } from './_notify.js';

export async function onRequestPost(context) {
  // --- Read the RAW body first (required for signature verification) ---
  const rawBody = await context.request.text();
  const sigHeader =
    context.request.headers.get('Stripe-Signature') ||
    context.request.headers.get('stripe-signature');

  // --- SECURITY: verify the Stripe webhook signature ---
  try {
    const secret = context.env.STRIPE_WEBHOOK_SECRET;
    if (!secret || !sigHeader) {
      console.error('Webhook rejected: missing signing secret or Stripe-Signature header');
      return new Response('Missing signature', { status: 400 });
    }

    const { t, signatures } = parseSignatureHeader(sigHeader);
    if (!t || signatures.length === 0) {
      console.error('Webhook rejected: malformed Stripe-Signature header');
      return new Response('Invalid signature', { status: 400 });
    }

    // Reject stale payloads. Without this a captured, still-validly-signed
    // webhook could be replayed forever, duplicating bookings and alerts.
    // Stripe's own libraries use the same 5-minute default tolerance.
    const ageSeconds = Math.abs(Math.floor(Date.now() / 1000) - Number(t));
    if (!Number.isFinite(ageSeconds) || ageSeconds > 300) {
      console.error('Webhook rejected: timestamp outside tolerance', t);
      return new Response('Invalid signature', { status: 400 });
    }

    const signedPayload = `${t}.${rawBody}`;
    const expected = await hmacSha256Hex(secret, signedPayload);
    const verified = signatures.some((sig) => constantTimeEqual(sig, expected));
    if (!verified) {
      console.error('Webhook rejected: signature mismatch');
      return new Response('Invalid signature', { status: 400 });
    }
  } catch (err) {
    console.error('Webhook signature verification error:', err);
    return new Response('Invalid signature', { status: 400 });
  }

  // --- Parse the event ---
  let event;
  try {
    event = JSON.parse(rawBody);
  } catch (err) {
    console.error('Webhook rejected: body is not valid JSON', err);
    return new Response('Invalid payload', { status: 400 });
  }

  // --- Only act on completed checkout sessions; ack everything else ---
  if (event?.type !== 'checkout.session.completed') {
    return new Response('Ignored', { status: 200 });
  }

  // --- Everything below must NEVER throw or return non-200 (avoid webhook retry storms) ---
  try {
    const session = event.data?.object || {};
    const md = session.metadata || {};

    const email =
      session.customer_email ||
      (session.customer_details && session.customer_details.email) ||
      '';
    const name = md.customerName || 'there';
    const phone = md.customerPhone || '';
    const treatment = md.treatmentName || 'Your treatment';
    const date = md.date || '';
    const time = md.time || '';
    const location = md.location || 'mobile';
    const venue = md.venue || '';
    const address = upperPostcode(md.customerAddress || '');
    const notes = md.notes || '';

    // session.amount_total is the authoritative figure — exactly what Stripe
    // charged. The fallback reads metadata[totalAmountPence], the same
    // treatmentAmount + travelPence figure create-checkout.js computed and
    // sent to Stripe as line items, so "Total paid" can never diverge from
    // the Treatment/Discount/Travel rows below, which are built from that
    // same metadata.
    const amountPence =
      typeof session.amount_total === 'number'
        ? session.amount_total
        : parseInt(md.totalAmountPence || '0', 10);
    const amount = formatGBP(amountPence);
    const paymentLabel = `${amount} — paid in full`;
    // Every booking is paid in full — there is no deposit path.

    // Discount code, if one was applied — create-checkout.js only sets these
    // metadata fields when a code passed its final, server-side re-validation.
    // It's always computed against the treatment price alone (see the
    // comment in create-checkout.js) — travelPence below is never part of
    // originalAmountPence/discountPence, so it can never be discounted.
    const discountCode = md.discountCode || '';
    const discountPence = parseInt(md.discountPence || '0', 10);
    const originalAmountPence = parseInt(md.originalAmountPence || '0', 10);
    const originalAmountLabel = discountCode ? formatGBP(originalAmountPence) : '';
    // Matches booking-confirmed.html's row exactly: "{code} discount" / "−£x.xx"
    // (a single, real minus sign — not an em dash followed by a hyphen).
    const discountRowLabel = discountCode ? `${discountCode} discount` : '';
    const discountLabel = discountCode ? `−${formatGBP(discountPence)}` : '';

    // Travel fee — home visits only; create-checkout.js never sets these for
    // a Clinic Day booking. Zone C has no fixed fee, so it reads as a note
    // rather than an amount.
    const travelPence = location === 'mobile' ? parseInt(md.travelPence || '0', 10) : 0;
    const travelZone = location === 'mobile' ? (md.travelZone || '') : '';
    const travelLabel = location === 'mobile'
      ? (travelZone === 'C' ? 'Confirmed by WhatsApp before the session' : formatGBP(travelPence))
      : '';

    // Confirm the held slot so it converts from a temporary hold into a firm
    // booking that keeps blocking the time. Best-effort: if the row lapsed or
    // Supabase isn't configured, the notifications below must still go out.
    //
    // The slot hold is only 10 minutes but Stripe keeps the Checkout Session
    // open for 30, so a customer who paid late may have had their time
    // re-booked by someone else in between. confirmBooking() reports that as
    // `conflict`; the booking is still confirmed (they've paid) and Halima's
    // email is flagged so she can sort it out with the two clients.
    const bookingId = md.bookingId;
    let slotConflict = false;
    if (bookingId && context.env.SUPABASE_URL && context.env.SUPABASE_SERVICE_ROLE_KEY) {
      try {
        const result = await confirmBooking(context.env, Number(bookingId));
        slotConflict = Boolean(result && result.conflict);
      } catch (err) {
        console.error('Failed to confirm booking slot:', err);
      }
    }

    // Flip the discount-code redemption from 'reserved' to 'confirmed' —
    // create-checkout.js reserves it before Stripe the same way it reserves
    // the slot. Best-effort: a discount code is never the thing that should
    // block a paid customer's confirmation from going out.
    const redemptionId = md.discountRedemptionId;
    if (redemptionId && context.env.SUPABASE_URL && context.env.SUPABASE_SERVICE_ROLE_KEY) {
      try {
        await confirmDiscountRedemption(context.env, Number(redemptionId), bookingId ? Number(bookingId) : null);
      } catch (err) {
        console.error('Failed to confirm discount redemption:', err);
      }
    }

    const detail = { name, phone, email, treatment, date, time, location, venue, address, amount, paymentLabel, notes, originalAmountLabel, discountRowLabel, discountLabel, travelLabel, travelZone, travelPence, slotConflict };
    await notifyBooking(context.env, detail);
  } catch (err) {
    // Log, but still acknowledge so Stripe does not retry indefinitely
    console.error('Error handling checkout.session.completed:', err);
  }

  return new Response('OK', { status: 200 });
}

/* ------------------------------------------------------------------ */
/* Signature helpers                                                   */
/* ------------------------------------------------------------------ */

// Parse a Stripe-Signature header: "t=12345,v1=abc,v1=def" -> { t, signatures: [abc, def] }
function parseSignatureHeader(header) {
  let t = '';
  const signatures = [];
  for (const part of header.split(',')) {
    const idx = part.indexOf('=');
    if (idx === -1) continue;
    const key = part.slice(0, idx).trim();
    const value = part.slice(idx + 1).trim();
    if (key === 't') t = value;
    else if (key === 'v1') signatures.push(value);
  }
  return { t, signatures };
}

// HMAC-SHA256 of `payload` keyed by `secret`, returned as a lowercase hex string.
async function hmacSha256Hex(secret, payload) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sigBuffer = await crypto.subtle.sign('HMAC', key, enc.encode(payload));
  const bytes = new Uint8Array(sigBuffer);
  let hex = '';
  for (let i = 0; i < bytes.length; i++) {
    hex += bytes[i].toString(16).padStart(2, '0');
  }
  return hex;
}

// Constant-time string comparison (avoids leaking match position via timing).
function constantTimeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) {
    return false;
  }
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

