// Shared booking-confirmed notifications — the customer confirmation email,
// Halima's notification email, and her WhatsApp alert. Extracted from
// stripe-webhook.js (Sep 2026) so a £0 booking (a 100%-off gift/reward/
// competition code) can send the exact same notifications from
// create-checkout.js without going through Stripe at all — there's no
// webhook event for a booking Stripe never saw. The `_` prefix keeps this
// file from becoming a route.

import {
  INK, BODY_TEXT, GOLD_DEEP, FONT, FONT_HEADING,
  sendEmail, esc, emailHeader, emailFooter, emailShell, heroRow, infoCard,
} from './_email.js';
import { CLINIC_VENUE_ADDRESS } from './_clinic.js';

const FROM = 'haloe <halima@haloe.health>';
const HALIMA_EMAIL = 'halima@haloe.health';
// The intake form is deliberately NOT linked from this email — see the note
// this had in stripe-webhook.js before the Sep 2026 extraction.

export function formatGBP(pence) {
  const pounds = (Number(pence) || 0) / 100;
  return '£' + (Number.isInteger(pounds) ? String(pounds) : pounds.toFixed(2));
}

// Uppercase any UK-postcode-looking token inside a free-text address, and
// normalise the gap to a single space — so "9, ol9 7qe" reads "9, OL9 7QE".
export function upperPostcode(str) {
  if (!str) return str;
  return String(str).replace(
    /\b([A-Za-z]{1,2}[0-9][A-Za-z0-9]?)\s*([0-9][A-Za-z]{2})\b/g,
    (_, out, inc) => `${out.toUpperCase()} ${inc.toUpperCase()}`,
  );
}

function locationLabel(d) {
  return d.location === 'clinic' ? 'Clinic Day' : 'Home visit';
}

// Sends everything for a confirmed booking: Halima's WhatsApp alert, the
// customer's confirmation email, and Halima's notification email. Every step
// is best-effort and wrapped so one failing (missing env vars, a transient
// API error) never blocks the others — matches the original webhook's
// "must never throw" contract, since callers (the webhook, or create-checkout.js
// for a free booking) must always still return 200 / a success URL to the
// customer even if a notification silently fails.
//
// `d` fields: name, phone, email, treatment, date, time, location, venue,
// address, amount, paymentLabel, notes, originalAmountLabel, discountRowLabel,
// discountLabel, travelLabel, travelZone, travelPence, slotConflict.
export async function notifyBooking(env, d) {
  try {
    await sendWhatsAppNotification(env, d);
  } catch (err) {
    console.error('Failed to send WhatsApp notification:', err);
  }

  const apiKey = env.RESEND_API_KEY;
  if (!apiKey) {
    console.error('RESEND_API_KEY is not configured; cannot send confirmation emails');
    return;
  }

  if (d.email) {
    try {
      await sendEmail(apiKey, {
        from: FROM,
        to: [d.email],
        reply_to: HALIMA_EMAIL,
        subject: 'Your haloe booking is confirmed',
        html: clientEmailHtml(d),
      });
    } catch (err) {
      console.error('Failed to send client confirmation email:', err);
    }
  } else {
    console.error('No customer email on booking; skipping client confirmation email');
  }

  try {
    await sendEmail(apiKey, {
      from: FROM,
      to: [HALIMA_EMAIL],
      reply_to: d.email || HALIMA_EMAIL,
      subject: `${d.slotConflict ? '⚠ TIME CLASH — ' : ''}New booking — ${d.name}`,
      html: halimaEmailHtml(d),
    });
  } catch (err) {
    console.error('Failed to send Halima notification email:', err);
  }
}

/* ------------------------------------------------------------------ */
/* WhatsApp notification to Halima                                     */
/* ------------------------------------------------------------------ */

// Sends from the Twilio business number, NOT the client's number — sending
// as the client is not possible and would be impersonation. The client's own
// number is included in the body so Halima can reply to them directly.
// No-ops until Twilio is configured (TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN,
// TWILIO_WHATSAPP_FROM, HALOE_WHATSAPP_TO — Cloudflare Pages dashboard).
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
                  <h1 style="color:${INK};font-size:24px;font-weight:normal;margin:0 0 16px;font-family:${FONT_HEADING};">Your booking is confirmed</h1>
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
                  <h1 style="color:${INK};font-size:22px;font-weight:normal;margin:8px 0 0;font-family:${FONT_HEADING};">${esc(d.name)}</h1>
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
                { label: 'Time clash', value: d.slotConflict ? '⚠ This time overlaps another booking — the payment landed after the 10-minute hold lapsed. Check /admin and reschedule one of them.' : '' },
              ])}
              <tr>
                <td style="padding:6px 2px 0;">
                  <p style="color:${BODY_TEXT};font-size:13px;line-height:1.7;margin:0;font-family:${FONT};">Reply to this email to reach ${esc(d.name)} directly${d.phone ? `, or message them on ${esc(d.phone)}` : ''}.</p>
                </td>
              </tr>`;
  return emailShell(inner);
}
