// GET /admin/send-preview-emails — ONE-OFF utility, gated by admin/_middleware.js
// (Basic Auth). Sends sample-data previews of the three transactional emails
// (customer confirmation, owner "New booking", intake pre-session guide) to
// halima@haloe.health so the new light-theme redesign can be checked in real
// inboxes (Gmail/Apple Mail/Outlook). No booking or Stripe charge is created —
// every value below is fabricated sample data, and nothing is written to
// Supabase. DELETE THIS FILE once the preview has been reviewed.

import {
  INK, BODY_TEXT, GOLD_DEEP, FONT, FONT_HEADING,
  sendEmail, esc, emailButton, emailHeader, emailFooter, emailShell, heroRow, infoCard,
} from '../_email.js';
import { CLINIC_VENUE_ADDRESS } from '../_clinic.js';

const FROM = 'haloe <halima@haloe.health>';
const PREVIEW_TO = 'iamhalimayasmin@gmail.com';
const GUIDE_URL = 'https://haloe.health/before-your-session';

function formatPenceGBP(pence) {
  const pounds = pence / 100;
  return '£' + (Number.isInteger(pounds) ? String(pounds) : pounds.toFixed(2));
}

export async function onRequestGet(context) {
  const apiKey = context.env.RESEND_API_KEY;
  if (!apiKey) {
    return new Response('RESEND_API_KEY is not configured.', { status: 500 });
  }

  // Self-consistent sample figures — Total paid is always derived from these
  // same three numbers (price - discount + travel), exactly like
  // create-checkout.js/stripe-webhook.js do from the real metadata.
  const treatmentPence = 9000;   // £90
  const discountPence = 1800;    // HALOE20, 20% off £90
  const clinicTravelPence = 0;   // no travel fee on Clinic Day
  const mobileTravelPence = 1500; // Zone A

  function buildSample(overrides) {
    const travelPence = overrides.travelPence || 0;
    const totalPence = treatmentPence - discountPence + travelPence;
    return {
      name: 'Aisha Rahman',
      phone: '07123 456789',
      email: PREVIEW_TO,
      treatment: 'Full Back',
      date: 'Tuesday, 6 October 2026',
      time: '2:00 pm',
      venue: 'Milton Hall',
      address: '',
      notes: 'First session, a little nervous.',
      originalAmountLabel: formatPenceGBP(treatmentPence),
      discountRowLabel: 'HALOE20 discount',
      discountLabel: '−' + formatPenceGBP(discountPence),
      amount: formatPenceGBP(totalPence),
      ...overrides,
    };
  }

  const clientSample = buildSample({
    location: 'clinic',
    travelLabel: '',
    travelZone: '',
    travelPence: clinicTravelPence,
  });

  const halimaSample = buildSample({
    location: 'mobile',
    venue: '',
    address: '12 Ashfield Road, Oldham, OL9 7QE',
    travelLabel: formatPenceGBP(mobileTravelPence),
    travelZone: 'A',
    travelPence: mobileTravelPence,
  });

function formatGBP(pence) {
  const pounds = (Number(pence) || 0) / 100;
  return '£' + (Number.isInteger(pounds) ? String(pounds) : pounds.toFixed(2));
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
              ])}
              <tr>
                <td style="padding:6px 2px 0;">
                  <p style="color:${BODY_TEXT};font-size:13px;line-height:1.7;margin:0;font-family:${FONT};">Reply to this email to reach ${esc(d.name)} directly${d.phone ? `, or message them on ${esc(d.phone)}` : ''}.</p>
                </td>
              </tr>`;
  return emailShell(inner);
}
function guideEmailHtml(fullName) {
  const first = String(fullName || '').trim().split(/\s+/)[0];
  const greeting = first ? `Dear ${esc(first)},` : 'Hello,';

  const inner = `${emailHeader()}
              <!-- Intro -->
              <tr>
                <td style="padding:30px 4px 4px;">
                  <h1 style="color:${INK};font-size:24px;font-weight:normal;margin:0 0 18px;font-family:${FONT_HEADING};">Your form is in — thank you</h1>
                  <p style="color:${INK};font-size:15px;line-height:1.75;margin:0 0 16px;font-family:${FONT};">${greeting}</p>
                  <p style="color:${BODY_TEXT};font-size:15px;line-height:1.75;margin:0 0 16px;font-family:${FONT};">Thank you for completing your intake form — that's everything I need, and you're all set for your session.</p>
                  <p style="color:${BODY_TEXT};font-size:15px;line-height:1.75;margin:0 0 22px;font-family:${FONT};">Before you come, please take a couple of minutes to read your short pre-session guide. It walks you through exactly what to expect on the day and how to prepare so you feel completely at ease.</p>
                </td>
              </tr>
              <!-- Guide button -->
              <tr>
                <td align="center" style="padding:0 4px 26px;">
                  ${emailButton(GUIDE_URL, 'Read your pre-session guide')}
                </td>
              </tr>
              <!-- Sign-off + compliance -->
              <tr>
                <td style="padding:4px 4px 0;">
                  <p style="color:${INK};font-size:15px;line-height:1.75;margin:0 0 16px;font-family:${FONT};">I look forward to seeing you. — Halima &middot; @haloe.health</p>
                  <p style="color:${BODY_TEXT};font-size:12px;line-height:1.7;margin:0 0 6px;font-family:${FONT};">Hijama at haloe is a complementary wellness therapy. It supports how you feel and does not diagnose, treat or replace medical care. Please continue any medication prescribed by your doctor and speak to your GP about any health concern.</p>
                </td>
              </tr>
              ${emailFooter()}`;

  return emailShell(inner);
}

  const results = {};
  try {
    await sendEmail(apiKey, {
      from: FROM,
      to: [PREVIEW_TO],
      reply_to: FROM,
      subject: '[PREVIEW] Your haloe booking is confirmed',
      html: clientEmailHtml(clientSample),
    });
    results.client = 'sent';
  } catch (err) {
    results.client = 'failed: ' + err.message;
  }

  try {
    await sendEmail(apiKey, {
      from: FROM,
      to: [PREVIEW_TO],
      reply_to: FROM,
      subject: '[PREVIEW] New booking — Aisha Rahman',
      html: halimaEmailHtml(halimaSample),
    });
    results.halima = 'sent';
  } catch (err) {
    results.halima = 'failed: ' + err.message;
  }

  try {
    await sendEmail(apiKey, {
      from: FROM,
      to: [PREVIEW_TO],
      reply_to: FROM,
      subject: '[PREVIEW] Your haloe session — how to prepare',
      html: guideEmailHtml('Aisha Rahman'),
    });
    results.guide = 'sent';
  } catch (err) {
    results.guide = 'failed: ' + err.message;
  }

  return new Response(JSON.stringify(results, null, 2), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}
