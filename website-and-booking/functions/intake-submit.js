// Cloudflare Pages Function — POST /intake-submit
//
// Receives the multi-step intake form (intake.html) as JSON, upserts the client
// and writes one intake_forms row into the haloe-clients D1 database, then sends
// the "before your session" guide email via Resend.
//
// There is intentionally NO GET handler — this data is never publicly readable.
// Only this POST writes it; viewing happens via wrangler or a future protected
// admin page.
//
// Bindings / env (set in the Cloudflare Pages dashboard):
//   DB              — D1 database binding (haloe-clients)
//   RESEND_API_KEY  — Resend API key for sending email

import {
  BLACK, GOLD, CREAM, MUTED, HAIRLINE,
  sendEmail, esc, emailButton, emailHeader, emailFooter, emailShell,
} from './_email.js';

const FROM = 'haloe <halima@haloe.health>';
const HALIMA_EMAIL = 'halima@haloe.health';
const GUIDE_URL = 'https://haloe.health/before-your-session';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function onRequestPost(context) {
  try {
    // --- Parse JSON body ---
    let data;
    try {
      data = await context.request.json();
    } catch (err) {
      return json({ error: 'Invalid request.' }, 400);
    }
    if (!data || typeof data !== 'object') {
      return json({ error: 'Invalid request.' }, 400);
    }

    // --- Honeypot: a filled "website" field means a bot. Ack silently (200) so
    //     bots can't tell their submission was dropped. Never written to the DB. ---
    if (typeof data.website === 'string' && data.website.trim() !== '') {
      return json({ ok: true }, 200);
    }

    // --- Validation: name, email format, and the five required consents ---
    const fullName = str(data.full_name);
    const email = str(data.email).toLowerCase();
    if (!fullName) return json({ error: 'Please enter your full name.' }, 400);
    if (!EMAIL_RE.test(email)) return json({ error: 'Please enter a valid email address.' }, 400);

    const consents = [
      'consent_accurate_info',
      'consent_complementary',
      'consent_treatment',
      'consent_notify_changes',
      'consent_data_storage',
    ];
    for (const c of consents) {
      if (!truthy(data[c])) {
        return json({ error: 'Please tick all required consent boxes.' }, 400);
      }
    }

    const db = context.env.DB;
    if (!db) {
      console.error('intake-submit: D1 binding "DB" is not configured');
      return json({ error: 'Server is not configured. Please message me on Instagram.' }, 500);
    }

    // --- Upsert client by email (parameterised; never string-concatenated) ---
    const phone = str(data.phone);
    const dob = str(data.date_of_birth);

    let clientId;
    const existing = await db
      .prepare('SELECT id FROM clients WHERE email = ?')
      .bind(email)
      .first();

    if (existing && existing.id) {
      clientId = existing.id;
    } else {
      const insertClient = await db
        .prepare('INSERT INTO clients (full_name, email, phone, date_of_birth) VALUES (?, ?, ?, ?)')
        .bind(fullName, email, phone, dob)
        .run();
      clientId = insertClient.meta.last_row_id;
    }

    // --- Insert the intake form row (every answer mapped to its column) ---
    const cols = [
      'client_id',
      'area_postcode', 'package', 'emergency_contact_name', 'emergency_contact_phone', 'gp_name',
      'age_confirmed',
      'has_conditions', 'medical_conditions', 'takes_medication', 'current_medications',
      'has_allergies', 'allergies', 'had_hijama_before', 'main_concern',
      'is_pregnant', 'breastfeeding', 'takes_blood_thinners', 'bleeding_disorder', 'diabetes_status',
      'chemo_or_radiotherapy', 'has_anaemia', 'infectious_condition', 'recent_surgery',
      'blood_pressure', 'skin_condition', 'pacemaker_epilepsy', 'safety_notes',
      'before_after_ack',
      'consent_accurate_info', 'consent_complementary', 'consent_treatment',
      'consent_notify_changes', 'consent_data_storage',
      'photo_consent', 'signature_name', 'signature_date',
    ];
    const values = [
      clientId,
      orNull(data.area_postcode), orNull(data.package), orNull(data.emergency_contact_name),
      orNull(data.emergency_contact_phone), orNull(data.gp_name),
      orNull(data.age_confirmed),
      orNull(data.has_conditions), orNull(data.medical_conditions), orNull(data.takes_medication),
      orNull(data.current_medications), orNull(data.has_allergies), orNull(data.allergies),
      orNull(data.had_hijama_before), orNull(data.main_concern),
      orNull(data.is_pregnant), orNull(data.breastfeeding), orNull(data.takes_blood_thinners),
      orNull(data.bleeding_disorder), orNull(data.diabetes_status), orNull(data.chemo_or_radiotherapy),
      orNull(data.has_anaemia), orNull(data.infectious_condition), orNull(data.recent_surgery),
      orNull(data.blood_pressure), orNull(data.skin_condition), orNull(data.pacemaker_epilepsy),
      orNull(data.safety_notes),
      truthy(data.before_after_ack) ? 1 : 0,
      truthy(data.consent_accurate_info) ? 1 : 0,
      truthy(data.consent_complementary) ? 1 : 0,
      truthy(data.consent_treatment) ? 1 : 0,
      truthy(data.consent_notify_changes) ? 1 : 0,
      truthy(data.consent_data_storage) ? 1 : 0,
      orNull(data.photo_consent), orNull(data.signature_name), orNull(data.signature_date),
    ];
    const placeholders = cols.map(() => '?').join(', ');
    await db
      .prepare(`INSERT INTO intake_forms (${cols.join(', ')}) VALUES (${placeholders})`)
      .bind(...values)
      .run();

    // --- The record is saved; the email is best-effort from here on. ---
    try {
      const apiKey = context.env.RESEND_API_KEY;
      if (!apiKey) {
        console.error('intake-submit: RESEND_API_KEY not configured; skipping guide email');
      } else {
        await sendEmail(apiKey, {
          from: FROM,
          to: [email],
          reply_to: HALIMA_EMAIL,
          subject: 'Your haloe session — how to prepare',
          html: guideEmailHtml(fullName),
        });
      }
    } catch (err) {
      console.error('intake-submit: failed to send guide email (record was saved):', err);
    }

    return json({ ok: true }, 200);
  } catch (err) {
    console.error('intake-submit: unexpected error:', err);
    return json({ error: 'Something went wrong. Please try again.' }, 500);
  }
}

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

function json(obj, status) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

// Trim a value to a string ('' for null/undefined/non-string-ish).
function str(v) {
  if (v == null) return '';
  return String(v).trim();
}

// Trimmed string, or null when empty — keeps optional blanks out of the DB.
function orNull(v) {
  const s = str(v);
  return s === '' ? null : s;
}

// Accept 1 / '1' / true / 'Yes' as truthy (consent checkboxes + acks).
function truthy(v) {
  return v === 1 || v === true || v === '1' || v === 'Yes' || v === 'yes';
}

/* ------------------------------------------------------------------ */
/* Email template — pre-session guide                                 */
/* ------------------------------------------------------------------ */

// COMPLIANCE: wellness/symptom language only — no claims to treat/cure conditions.
function guideEmailHtml(fullName) {
  const first = String(fullName || '').trim().split(/\s+/)[0];
  const greeting = first ? `Dear ${esc(first)},` : 'Hello,';

  const inner = `${emailHeader()}
              <!-- Intro -->
              <tr>
                <td style="padding:30px 4px 4px;">
                  <h1 style="color:${CREAM};font-size:22px;font-weight:normal;margin:0 0 18px;font-family:Georgia,'Times New Roman',serif;">Your form is in — thank you</h1>
                  <p style="color:${CREAM};font-size:15px;line-height:1.75;margin:0 0 16px;font-family:Arial,Helvetica,sans-serif;">${greeting}</p>
                  <p style="color:${MUTED};font-size:15px;line-height:1.75;margin:0 0 16px;font-family:Arial,Helvetica,sans-serif;">Thank you for completing your intake form — that's everything I need, and you're all set for your session.</p>
                  <p style="color:${MUTED};font-size:15px;line-height:1.75;margin:0 0 22px;font-family:Arial,Helvetica,sans-serif;">Before you come, please take a couple of minutes to read your short pre-session guide. It walks you through exactly what to expect on the day and how to prepare so you feel completely at ease.</p>
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
                  <p style="color:${CREAM};font-size:15px;line-height:1.75;margin:0 0 16px;font-family:Arial,Helvetica,sans-serif;">I look forward to seeing you. — Halima &middot; @haloe_hijama</p>
                  <p style="color:${MUTED};font-size:12px;line-height:1.7;margin:0 0 6px;font-family:Arial,Helvetica,sans-serif;">Hijama at haloe is a complementary wellness therapy. It supports how you feel and does not diagnose, treat or replace medical care. Please continue any medication prescribed by your doctor and speak to your GP about any health concern.</p>
                </td>
              </tr>
              ${emailFooter()}`;

  return emailShell(inner);
}
