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
  BLACK, GOLD, CREAM, MUTED, HAIRLINE,
  sendEmail, esc, emailButton, emailHeader, emailFooter, emailShell,
} from './_email.js';
import { confirmBooking } from './_bookings.js';

const FROM = 'haloe <halima@haloe.health>';
const HALIMA_EMAIL = 'halima@haloe.health';
// Our own intake form now lives on-site (replaces the old Google Form). The
// pre-session guide is no longer linked here — it is emailed after intake submit.
const INTAKE_URL = 'https://haloe.health/intake';

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
    const paymentType = md.paymentType || '';
    const date = md.date || '';
    const time = md.time || '';
    const location = md.location || '';
    const address = md.customerAddress || '';
    const notes = md.notes || '';

    const amountPence =
      typeof session.amount_total === 'number'
        ? session.amount_total
        : parseInt(md.amount || '0', 10);
    const amount = formatGBP(amountPence);
    const isDeposit = paymentType === 'deposit';
    const paymentLabel = isDeposit ? `${amount} deposit paid` : `${amount} — paid in full`;

    // Confirm the held slot so it converts from a temporary hold into a firm
    // booking that keeps blocking the time. Best-effort: if the row lapsed or the
    // DB is unbound, the notifications below must still go out.
    const bookingId = md.bookingId;
    if (bookingId && context.env.DB) {
      try {
        await confirmBooking(context.env.DB, Number(bookingId));
      } catch (err) {
        console.error('Failed to confirm booking slot:', err);
      }
    }

    const detail = { name, phone, email, treatment, date, time, location, address, amount, isDeposit, paymentLabel, notes };

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
    d.location ? `Location: ${d.location}` : null,
    d.address ? `Address: ${d.address}` : null,
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
function detailRow(label, value) {
  if (!value) return '';
  return `
    <tr>
      <td style="padding:13px 20px;border-top:1px solid ${HAIRLINE};color:${MUTED};font-size:11px;letter-spacing:1.5px;text-transform:uppercase;font-family:Arial,Helvetica,sans-serif;">${esc(label)}</td>
      <td align="right" style="padding:13px 20px;border-top:1px solid ${HAIRLINE};color:${CREAM};font-size:14px;text-align:right;font-family:Arial,Helvetica,sans-serif;">${esc(value)}</td>
    </tr>`;
}

/* ------------------------------------------------------------------ */
/* Email templates                                                     */
/* ------------------------------------------------------------------ */

// Warm, premium, on-brand confirmation for the customer.
// COMPLIANCE: wellness/symptom language only — no claims to treat/cure/manage conditions.
function clientEmailHtml(d) {
  const depositNote = d.isDeposit
    ? `<p style="color:${MUTED};font-size:13px;line-height:1.7;margin:0 0 8px;font-family:Arial,Helvetica,sans-serif;">Your deposit secures your appointment. The remaining balance is payable on the day.</p>`
    : '';

  const inner = `${emailHeader()}
              <!-- Intro -->
              <tr>
                <td style="padding:30px 4px 4px;">
                  <h1 style="color:${CREAM};font-size:22px;font-weight:normal;margin:0 0 18px;font-family:Georgia,'Times New Roman',serif;">Your booking is confirmed</h1>
                  <p style="color:${CREAM};font-size:15px;line-height:1.75;margin:0 0 16px;font-family:Arial,Helvetica,sans-serif;">Dear ${esc(d.name)},</p>
                  <p style="color:${MUTED};font-size:15px;line-height:1.75;margin:0 0 22px;font-family:Arial,Helvetica,sans-serif;">Thank you for booking with haloe. Your payment has been received and your appointment is reserved. We look forward to welcoming you for a calm, restorative session in a relaxing, women-only space.</p>
                </td>
              </tr>
              <!-- Details card -->
              <tr>
                <td style="padding:0 0 24px;">
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:separate;border:1px solid ${HAIRLINE};border-radius:14px;overflow:hidden;background:#15120D;">
                    <tr>
                      <td style="padding:18px 20px 16px;">
                        <div style="color:${CREAM};font-size:18px;font-family:Georgia,'Times New Roman',serif;">${esc(d.treatment)}</div>
                        <div style="color:${GOLD};font-size:13px;letter-spacing:1px;margin-top:6px;font-family:Arial,Helvetica,sans-serif;">${esc(d.paymentLabel)}</div>
                      </td>
                    </tr>
                    ${detailRow('Date', d.date)}
                    ${detailRow('Time', d.time)}
                    ${detailRow('Location', d.location)}
                    ${detailRow('Amount paid', d.amount)}
                  </table>
                </td>
              </tr>
              <!-- Deposit note -->
              ${depositNote ? `<tr><td style="padding:0 4px 18px;">${depositNote}</td></tr>` : ''}
              <!-- Intake form -->
              <tr>
                <td style="padding:4px 4px 8px;">
                  <p style="color:${MUTED};font-size:15px;line-height:1.75;margin:0 0 18px;font-family:Arial,Helvetica,sans-serif;">Before your appointment, please take a moment to complete your health intake form so Halima can prepare and tailor your session to you:</p>
                </td>
              </tr>
              <tr>
                <td align="center" style="padding:0 4px 26px;">
                  ${emailButton(INTAKE_URL, 'Complete your intake form')}
                </td>
              </tr>
              <!-- Personal note + compliance -->
              <tr>
                <td style="padding:4px 4px 0;">
                  <p style="color:${CREAM};font-size:15px;line-height:1.75;margin:0 0 16px;font-family:Arial,Helvetica,sans-serif;">Halima will be in touch personally to confirm the final details and answer any questions you may have.</p>
                  <p style="color:${MUTED};font-size:12px;line-height:1.7;margin:0 0 6px;font-family:Arial,Helvetica,sans-serif;">haloe offers complementary wellness therapy to support your general wellbeing, relaxation and everyday tension. It is not a substitute for medical advice, diagnosis or treatment.</p>
                </td>
              </tr>
              ${emailFooter()}`;

  return emailShell(inner);
}

// Plain, information-dense notification for Halima with everything she needs to follow up.
function halimaEmailHtml(d) {
  return `<!doctype html>
<html>
  <body style="margin:0;padding:0;background:${BLACK};">
    <div style="background:${BLACK};padding:28px 16px;font-family:Arial,Helvetica,sans-serif;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
        <tr>
          <td align="center">
            <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="width:480px;max-width:100%;border-collapse:collapse;">
              <tr>
                <td style="padding:0 0 16px;">
                  <div style="color:${GOLD};font-size:12px;letter-spacing:2px;text-transform:uppercase;">New booking &middot; payment received</div>
                  <h1 style="color:${CREAM};font-size:20px;font-weight:normal;margin:8px 0 0;">${esc(d.name)}</h1>
                </td>
              </tr>
              <tr>
                <td>
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:separate;border:1px solid ${HAIRLINE};border-radius:12px;overflow:hidden;background:#15120D;">
                    ${detailRow('Treatment', d.treatment)}
                    ${detailRow('Payment', d.paymentLabel)}
                    ${detailRow('Amount', d.amount)}
                    ${detailRow('Date', d.date)}
                    ${detailRow('Time', d.time)}
                    ${detailRow('Location', d.location)}
                    ${detailRow('Address', d.address)}
                    ${detailRow('Name', d.name)}
                    ${detailRow('Phone', d.phone)}
                    ${detailRow('Email', d.email)}
                    ${detailRow('Notes', d.notes)}
                  </table>
                </td>
              </tr>
              <tr>
                <td style="padding:18px 2px 0;">
                  <p style="color:${MUTED};font-size:13px;line-height:1.7;margin:0;">Reply to this email to reach ${esc(d.name)} directly${d.phone ? `, or message them on ${esc(d.phone)}` : ''}.</p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </div>
  </body>
</html>`;
}
