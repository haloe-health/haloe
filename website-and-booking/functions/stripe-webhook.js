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

import {
  WHITE, INK, BODY_TEXT, GOLD_DEEP, HAIRLINE, FONT,
  sendEmail, esc, emailHeader, emailFooter, emailShell, heroRow, infoCard,
} from './_email.js';
import { confirmBooking } from './_bookings.js';
import { CLINIC_VENUE_ADDRESS } from './_clinic.js';

const FROM = 'haloe <halima@haloe.health>';
const HALIMA_EMAIL = 'halima@haloe.health';
// The intake form is deliberately NOT linked from this email. Halima speaks to
// each client on WhatsApp first and sends https://haloe.health/intake herself.
// The form is still live and still writes to D1 — only the automatic prompts
// were removed (this email, booking-confirmed.html, book.html, index.html).
// To restore, put back the paragraph + emailButton(INTAKE_URL, …) block and
// re-add emailButton to the ./_email.js import above.

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
    const bookingId = md.bookingId;
    if (bookingId && context.env.SUPABASE_URL && context.env.SUPABASE_SERVICE_ROLE_KEY) {
      try {
        await confirmBooking(context.env, Number(bookingId));
      } catch (err) {
        console.error('Failed to confirm booking slot:', err);
      }
    }

    const detail = { name, phone, email, treatment, date, time, location, venue, address, amount, paymentLabel, notes, originalAmountLabel, discountRowLabel, discountLabel, travelLabel, travelZone, travelPence };

    // WhatsApp notification to Halima. Sent before the email block and wrapped in
    // its own try/catch so it still fires if Resend is unconfigured or failing —
    // the two alert paths must not be able to take each other down.
    // No-ops until Twilio is configured.
    try {
      await sendWhatsAppNotification(context.env, detail);
    } catch (err) {
      console.error('Failed to send WhatsApp notification:', err);
    }

    const apiKey = context.env.RESEND_API_KEY;
    if (!apiKey) {
      console.error('RESEND_API_KEY is not configured; cannot send confirmation emails');
      return new Response('OK', { status: 200 });
    }

    // Send the customer confirmation (skip gracefully if we have no address)
    if (email) {
      try {
        await sendEmail(apiKey, {
          from: FROM,
          to: [email],
          reply_to: HALIMA_EMAIL,
          subject: 'Your haloe booking is confirmed',
          html: clientEmailHtml(detail),
        });
      } catch (err) {
        console.error('Failed to send client confirmation email:', err);
      }
    } else {
      console.error('No customer email on session; skipping client confirmation email');
    }

    // Notify Halima
    try {
      await sendEmail(apiKey, {
        from: FROM,
        to: [HALIMA_EMAIL],
        reply_to: email || HALIMA_EMAIL,
        subject: `New booking — ${name}`,
        html: halimaEmailHtml(detail),
      });
    } catch (err) {
      console.error('Failed to send Halima notification email:', err);
    }
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

/* ------------------------------------------------------------------ */
/* WhatsApp notification to Halima                                     */
/* ------------------------------------------------------------------ */

// Sends Halima a WhatsApp message the moment payment succeeds, via Twilio.
//
// Note this arrives from the Twilio business number, NOT the client's number —
// sending as the client is not possible and would be impersonation. The client's
// own number is included in the body so Halima can reply to them directly.
//
// Env vars (Cloudflare Pages dashboard, never in code):
//   TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_WHATSAPP_FROM, HALOE_WHATSAPP_TO
// If any are missing this logs and returns, so the webhook stays healthy.
async function sendWhatsAppNotification(env, d) {
  const sid = env.TWILIO_ACCOUNT_SID;
  const token = env.TWILIO_AUTH_TOKEN;
  const from = env.TWILIO_WHATSAPP_FROM;
  const to = env.HALOE_WHATSAPP_TO;

  if (!sid || !token || !from || !to) {
    console.log('Twilio not configured; skipping WhatsApp notification');
    return;
  }

  const body = [
    'New haloe booking — payment received',
    '',
    `Name: ${d.name}`,
    d.phone ? `Phone: ${d.phone}` : null,
    d.email ? `Email: ${d.email}` : null,
    `Treatment: ${d.treatment}`,
    d.date ? `Date: ${d.date}` : null,
    d.time ? `Time: ${d.time}` : null,
    `Location: ${locationLabel(d)}`,
    d.location === 'mobile' && d.address ? `Address: ${d.address}` : null,
    `Payment: ${d.paymentLabel}`,
    d.notes ? `Notes: ${d.notes}` : null,
  ]
    .filter(Boolean)
    .join('\n');

  const form = new URLSearchParams({ From: from, To: to, Body: body });

  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${btoa(`${sid}:${token}`)}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: form.toString(),
  });

  if (!res.ok) {
    console.error('Twilio error:', res.status, await res.text());
  }
}

/* ------------------------------------------------------------------ */
/* Email sending + formatting                                          */
/* ------------------------------------------------------------------ */

function formatGBP(pence) {
  const pounds = (Number(pence) || 0) / 100;
  return '£' + (Number.isInteger(pounds) ? String(pounds) : pounds.toFixed(2));
}

// A single label/value row for the details table.
// Uppercase any UK-postcode-looking token inside a free-text address, and
// normalise the gap to a single space — so "9, ol9 7qe" reads "9, OL9 7QE".
// Street names and other words are left untouched.
function upperPostcode(str) {
  if (!str) return str;
  return String(str).replace(
    /\b([A-Za-z]{1,2}[0-9][A-Za-z0-9]?)\s*([0-9][A-Za-z]{2})\b/g,
    (_, out, inc) => `${out.toUpperCase()} ${inc.toUpperCase()}`,
  );
}

// Friendly display label for the enum stored in metadata[location].
function locationLabel(d) {
  return d.location === 'clinic' ? 'Clinic Day' : 'Home visit';
}

/* ------------------------------------------------------------------ */
/* Email templates                                                     */
/* ------------------------------------------------------------------ */

// Warm, premium, on-brand confirmation for the customer.
// COMPLIANCE: wellness/symptom language only — no claims to treat/cure/manage conditions.
function clientEmailHtml(d) {
  const clinicNote = d.location === 'clinic'
    ? `<p style="color:${INK};font-size:14px;font-weight:600;line-height:1.7;margin:0 0 6px;font-family:${FONT};">Getting there</p>
       <p style="color:${BODY_TEXT};font-size:14px;line-height:1.7;margin:0 0 8px;font-family:${FONT};">Milton Hall is at 244 Deansgate. When you arrive, Musa at the concierge desk will be expecting you — just give your name and he'll point you to Room 4 on the 3rd floor. Take the lift, or if you'd rather, the wide baroque staircase is worth the climb. Please arrive five minutes early. The room sits behind a key-coded door, so if it's closed, take a seat and Halima will come and collect you.</p>`
    : '';
  const cancellationNote = `<p style="color:${BODY_TEXT};font-size:12px;line-height:1.7;margin:0 0 6px;font-family:${FONT};">Free reschedule or full refund up to 48 hours before your session. Inside 48 hours, sessions are non-refundable but can be moved once. No-shows are charged in full.</p>`;

  const inner = `${emailHeader()}
              <!-- Intro -->
              <tr>
                <td style="padding:28px 4px 18px;">
                  <h1 style="color:${INK};font-size:22px;font-weight:600;margin:0 0 16px;font-family:${FONT_HEADING};">Your booking is confirmed</h1>
                  <p style="color:${INK};font-size:15px;line-height:1.75;margin:0 0 14px;font-family:${FONT};">Dear ${esc(d.name)},</p>
                  <p style="color:${BODY_TEXT};font-size:15px;line-height:1.75;margin:0;font-family:${FONT};">Thank you for booking with haloe. Your payment has been received and your appointment is reserved. We look forward to welcoming you for a calm, restorative session.</p>
                </td>
              </tr>
              ${heroRow(d.date, d.time, locationLabel(d))}
              ${infoCard([
                { label: 'Treatment', value: d.treatment },
                { label: 'Price', value: d.originalAmountLabel },
                { label: d.discountRowLabel, value: d.discountLabel },
                { label: 'Travel', value: d.travelLabel },
                { label: 'Total paid', value: d.amount, gold: true },
              ])}
              <!-- Clinic venue note -->
              ${clinicNote ? `<tr><td style="padding:4px 4px 14px;">${clinicNote}</td></tr>` : ''}
              <!-- Personal note + compliance -->
              <tr>
                <td style="padding:6px 4px 0;">
                  <p style="color:${INK};font-size:15px;line-height:1.75;margin:0 0 16px;font-family:${FONT};">Halima will be in touch personally on WhatsApp to confirm the final details, send your health form, and answer any questions you may have.</p>
                  ${cancellationNote}
                  <p style="color:${BODY_TEXT};font-size:12px;line-height:1.7;margin:0 0 6px;font-family:${FONT};">haloe offers complementary wellness therapy to support your general wellbeing, relaxation and everyday tension. It is not a substitute for medical advice, diagnosis or treatment.</p>
                </td>
              </tr>
              ${emailFooter()}`;

  return emailShell(inner);
}

// Plain, information-dense notification for Halima with everything she needs to follow up.
function halimaEmailHtml(d) {
  const travelZoneLabel = d.location === 'mobile'
    ? (d.travelZone === 'A' ? `Zone A — ${formatGBP(d.travelPence)}`
      : d.travelZone === 'B' ? `Zone B — ${formatGBP(d.travelPence)}`
      : d.travelZone === 'C' ? 'Zone C — travel TBC' : '')
    : '';

  const inner = `<tr>
                <td style="padding:0 0 16px;">
                  <div style="color:${GOLD_DEEP};font-size:12px;letter-spacing:2px;text-transform:uppercase;font-family:${FONT};font-weight:600;">New booking &middot; payment received</div>
                  <h1 style="color:${INK};font-size:20px;font-weight:600;margin:8px 0 0;font-family:${FONT_HEADING};">${esc(d.name)}</h1>
                </td>
              </tr>
              ${heroRow(d.date, d.time, locationLabel(d))}
              ${infoCard([
                { label: 'Treatment', value: d.treatment },
                { label: 'Price', value: d.originalAmountLabel },
                { label: d.discountRowLabel, value: d.discountLabel },
                { label: 'Travel', value: d.travelLabel },
                { label: 'Total paid', value: d.amount, gold: true },
              ])}
              ${infoCard([
                { label: 'Location', value: d.location === 'clinic' ? `${locationLabel(d)} — ${d.venue}` : locationLabel(d) },
                { label: 'Address', value: d.location === 'clinic' ? CLINIC_VENUE_ADDRESS : d.address },
                { label: 'Postcode zone', value: travelZoneLabel },
                { label: 'Phone', value: d.phone },
                { label: 'Email', value: d.email },
                { label: 'Notes', value: d.notes },
                { label: 'Travel note', value: d.travelZone === 'C' ? '⚠ Confirm travel cost with the client before the session' : '' },
              ])}
              <tr>
                <td style="padding:6px 2px 0;">
                  <p style="color:${BODY_TEXT};font-size:13px;line-height:1.7;margin:0;font-family:${FONT};">Reply to this email to reach ${esc(d.name)} directly${d.phone ? `, or message them on ${esc(d.phone)}` : ''}.</p>
                </td>
              </tr>`;
  return emailShell(inner);
}
