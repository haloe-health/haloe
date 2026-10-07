// Cloudflare Pages Function — POST /intake-submit
//
// Receives the multi-step intake form (intake.html) as JSON, upserts the client
// and writes one intake_forms row into the Supabase Postgres database, then sends
// the "before your session" guide email via Resend.
//
// Storage was migrated from Cloudflare D1 to Supabase (Postgres) in Aug 2026.
// Writes go through Supabase's REST API (PostgREST) with the service-role key,
// which bypasses Row Level Security — so the tables stay locked to the public
// anon key while this server-side Function retains full write access. No SDK is
// used, matching the dependency-free style of the other Functions.
//
// There is intentionally NO GET handler — this data is never publicly readable.
// Only this POST writes it; viewing happens via the Supabase dashboard or a
// future protected admin page.
//
// Env (set in the Cloudflare Pages dashboard):
//   SUPABASE_URL               — e.g. https://thxunrygrrxcdjhgshjw.supabase.co
//   SUPABASE_SERVICE_ROLE_KEY  — service-role key (bypasses RLS; keep secret)
//   RESEND_API_KEY             — Resend API key for sending email

import {
  INK, BODY_TEXT, FONT, FONT_HEADING,
  sendEmail, esc, emailButton, emailHeader, emailFooter, emailShell,
} from './_email.js';
import { sbRequest } from './_supabase.js';
import { pushIntakeCompleted } from './_push.js';

const FROM = 'haloe <halima@haloe.health>';
const HALIMA_EMAIL = 'halima@haloe.health';
const GUIDE_URL = 'https://haloe.health/before-your-session';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const SIGNATURE_BUCKET = 'signatures';
const SIGNATURE_MAX_B64 = 700000; // ~500KB of PNG; a real signature is ~10-40KB

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

    const supabaseUrl = str(context.env.SUPABASE_URL).replace(/\/$/, '');
    const serviceKey = context.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !serviceKey) {
      console.error('intake-submit: SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not configured');
      return json({ error: 'Server is not configured. Please message me on Instagram.' }, 500);
    }

    // --- Upsert client by email, in one call ---
    // PostgREST upsert: on_conflict=email + Prefer: resolution=merge-duplicates
    // inserts a new client or updates the existing one (matched on the unique
    // email column), and returns the row so we can read its id back.
    const phone = str(data.phone);
    const dob = str(data.date_of_birth);

    const clientRows = await sbRequest(context.env, {
      path: '/rest/v1/clients?on_conflict=email',
      method: 'POST',
      prefer: 'resolution=merge-duplicates,return=representation',
      body: [{ full_name: fullName, email, phone: orNull(phone), date_of_birth: orNull(dob) }],
    });
    const clientId = Array.isArray(clientRows) && clientRows[0] && clientRows[0].id;
    if (!clientId) {
      throw new Error('Supabase upsert returned no client id');
    }

    // --- Insert the intake form row (every answer mapped to its column) ---
    // Text answers via orNull (blank -> null); the acks/consents as booleans.
    const intakeRow = {
      client_id: clientId,
      area_postcode: orNull(data.area_postcode),
      package: orNull(data.package),
      emergency_contact_name: orNull(data.emergency_contact_name),
      emergency_contact_phone: orNull(data.emergency_contact_phone),
      gp_name: orNull(data.gp_name),
      age_confirmed: orNull(data.age_confirmed),
      has_conditions: orNull(data.has_conditions),
      medical_conditions: orNull(data.medical_conditions),
      takes_medication: orNull(data.takes_medication),
      current_medications: orNull(data.current_medications),
      has_allergies: orNull(data.has_allergies),
      allergies: orNull(data.allergies),
      had_hijama_before: orNull(data.had_hijama_before),
      main_concern: orNull(data.main_concern),
      is_pregnant: orNull(data.is_pregnant),
      breastfeeding: orNull(data.breastfeeding),
      takes_blood_thinners: orNull(data.takes_blood_thinners),
      bleeding_disorder: orNull(data.bleeding_disorder),
      diabetes_status: orNull(data.diabetes_status),
      chemo_or_radiotherapy: orNull(data.chemo_or_radiotherapy),
      has_anaemia: orNull(data.has_anaemia),
      infectious_condition: orNull(data.infectious_condition),
      recent_surgery: orNull(data.recent_surgery),
      blood_pressure: orNull(data.blood_pressure),
      skin_condition: orNull(data.skin_condition),
      pacemaker_epilepsy: orNull(data.pacemaker_epilepsy),
      safety_notes: orNull(data.safety_notes),
      before_after_ack: truthy(data.before_after_ack),
      consent_accurate_info: truthy(data.consent_accurate_info),
      consent_complementary: truthy(data.consent_complementary),
      consent_treatment: truthy(data.consent_treatment),
      consent_notify_changes: truthy(data.consent_notify_changes),
      consent_data_storage: truthy(data.consent_data_storage),
      photo_consent: orNull(data.photo_consent),
      signature_name: orNull(data.signature_name),
      signature_date: orNull(data.signature_date),
    };
    const intakeRows = await sbRequest(context.env, {
      path: '/rest/v1/intake_forms',
      method: 'POST',
      prefer: 'return=representation',
      body: [intakeRow],
    });
    const intakeId = Array.isArray(intakeRows) && intakeRows[0] && intakeRows[0].id;

    // --- Drawn signature -> private Storage bucket (best effort) ---
    // The intake row above is the legal record and is already saved, so a
    // storage problem (or the signature_path migration not being applied yet)
    // must never lose it. The typed name and date are stored regardless.
    let signatureSaved = null;
    const sigBytes = decodeSignaturePng(data.signature_png);
    if (sigBytes && intakeId) {
      try {
        const objectPath = `${intakeId}.png`;
        const up = await fetch(`${supabaseUrl}/storage/v1/object/${SIGNATURE_BUCKET}/${objectPath}`, {
          method: 'POST',
          headers: {
            apikey: serviceKey,
            Authorization: `Bearer ${serviceKey}`,
            'Content-Type': 'image/png',
            'x-upsert': 'true',
          },
          body: sigBytes,
        });
        if (!up.ok) throw new Error(`storage upload responded ${up.status}: ${await up.text()}`);
        await sbRequest(context.env, {
          path: `/rest/v1/intake_forms?id=eq.${intakeId}`,
          method: 'PATCH',
          prefer: 'return=minimal',
          body: { signature_path: `${SIGNATURE_BUCKET}/${objectPath}` },
        });
        signatureSaved = true;
      } catch (err) {
        signatureSaved = false;
        console.error(`intake-submit: signature for intake ${intakeId} NOT saved (record was saved):`, err);
      }
    }

    // --- Lock-screen alert to the admin's devices (best effort). The form and signature are already saved, so a push
    //     problem can never fail the submission or lose the client's data. The push says only that an intake arrived
    //     (and "needs a look" if an Act-on-this rule fires) — never a name or any health detail. ---
    try {
      await pushIntakeCompleted(context.env, { clientId, intake: intakeRow, clientPhone: phone });
    } catch (err) {
      console.error('intake-submit: push alert failed (record was saved):', err);
    }

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

    return json({ ok: true, signature_saved: signatureSaved }, 200);
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

// A PNG data URL from the signature pad -> bytes, or null if it isn't a
// sane, size-capped PNG. Never throws: a bad signature just isn't stored.
function decodeSignaturePng(v) {
  const prefix = 'data:image/png;base64,';
  if (typeof v !== 'string' || !v.startsWith(prefix)) return null;
  const b64 = v.slice(prefix.length);
  if (!b64 || b64.length > SIGNATURE_MAX_B64) return null;
  try {
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    const magic = [0x89, 0x50, 0x4e, 0x47];
    return magic.every((b, i) => bytes[i] === b) ? bytes : null;
  } catch (e) {
    return null;
  }
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
