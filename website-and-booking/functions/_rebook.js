// Rebook email — run hourly from runAftercare() (see _aftercare.js). The `_` prefix keeps this file from becoming a route.
//
// Who: a client who has had a confirmed session, has nothing booked (confirmed or awaiting a reschedule reply), and whose last
// session was REBOOK_MIN_DAYS to REBOOK_MAX_DAYS ago. REBOOK_MIN_DAYS is the same 14 days as the app's "Due to rebook" rule
// (REBOOK_AFTER_DAYS in app/index.html — keep equal); the upper limit stops a first run mailing everyone who ever visited.
// What: ONE short, calm email from Halima with a book button. No treatment, no health wording, nothing about the last session.
// Once only: claimed in rebook_emails per (client, last session date) before sending; a failed send releases the claim.
// Never: test clients/bookings, anyone opted out (clients.rebook_email_optout), anyone Halima already nudged on WhatsApp since
// their last session (rebook_nudges), outside 09:00-19:59 UK time. If the opt-out column can't be read, NOTHING is sent.
//
// REBOOK_EMAIL_MODE (Cloudflare variable): unset or "off" = do nothing; "dry" = work out who would get it and log the count only,
// send nothing; "live" = send. REBOOK_EMAIL_ONLY (optional, comma-separated emails): when set, only those addresses are emailed
// (used for the very first send so it goes to named people only).
import { sbRequest } from './_supabase.js';
import { sendEmail } from './_email.js';
import { reminderLayout, londonDate, londonHour, daysBetween } from './_aftercare.js';

const FROM = 'haloe <halima@haloe.health>';
const HALIMA_EMAIL = 'halima@haloe.health';
export const BOOK_URL = 'https://haloe.health/book';
export const REBOOK_MIN_DAYS = 14;
export const REBOOK_MAX_DAYS = 35;

const firstName = (n) => { const w = String(n || '').trim().split(/\s+/)[0] || ''; return w ? w.charAt(0).toUpperCase() + w.slice(1).toLowerCase() : ''; };
const lower = (x) => String(x || '').trim().toLowerCase();
const personKey = (b) => (b.client_id ? 'c/' + b.client_id : 'e/' + lower(b.customer_email));

/** The one email. Words live here only. */
export function rebookEmail(name) {
  const html = reminderLayout({
    eyebrow: 'Your next session',
    headline: 'Whenever you are ready',
    greeting: firstName(name) ? `Hi ${firstName(name)},` : 'Hello,',
    body: "It's been a little while since your last session. If you'd like to book your next one, you can choose a time below. Or reply to this email and I'll find a time that suits you.",
    note: "Not right now? Just reply \"no thanks\" and I won't email you about this again.",
    cta: { href: BOOK_URL, label: 'BOOK MY NEXT SESSION' },
  });
  return { subject: 'Your next session at haloe', html };
}

/**
 * Pure selection (no network), so it can be tested. Inputs:
 *   bookings   rows { id, client_id, customer_name, customer_email, booking_date, status, is_test }
 *   testIds    Set of client ids flagged is_test
 *   optedOut   Set of client ids with rebook_email_optout = true
 *   nudges     rows { client_id, client_email, sent_at } from rebook_nudges
 *   claimed    Set of "personKey|lastSessionDate" already emailed
 *   today      'YYYY-MM-DD' (UK)
 * Returns [{ key, name, email, last }].
 */
export function pickRebookTargets({ bookings, testIds = new Set(), optedOut = new Set(), nudges = [], claimed = new Set(), today, only = null }) {
  const byPerson = new Map();
  for (const b of bookings) {
    if (b.is_test || (b.client_id && testIds.has(b.client_id)) || !b.customer_email) continue;
    const k = personKey(b);
    if (!byPerson.has(k)) byPerson.set(k, []);
    byPerson.get(k).push(b);
  }
  const out = [];
  for (const [key, rows] of byPerson) {
    const live = rows.filter((b) => b.status === 'confirmed' || b.status === 'reschedule_pending');
    if (live.some((b) => b.booking_date >= today)) continue;                 // already has something booked
    const past = live.filter((b) => b.booking_date < today && b.status === 'confirmed').map((b) => b.booking_date).sort();
    if (!past.length) continue;
    const last = past[past.length - 1], days = daysBetween(last, today);
    if (days < REBOOK_MIN_DAYS || days > REBOOK_MAX_DAYS) continue;
    const who = rows[rows.length - 1];
    if (who.client_id && optedOut.has(who.client_id)) continue;
    if (only && !only.has(lower(who.customer_email))) continue;
    if (claimed.has(key + '|' + last)) continue;
    const nudged = nudges.some((n) => (n.client_id ? 'c/' + n.client_id : 'e/' + lower(n.client_email)) === key && londonDate(n.sent_at) >= last);
    if (nudged) continue;                                                      // Halima already messaged them on WhatsApp
    out.push({ key, name: who.customer_name, email: who.customer_email, last });
  }
  return out;
}

export async function runRebookEmails(env, now = new Date()) {
  const out = { mode: 'off', due: 0, sent: 0, released: 0, errors: 0 };
  const mode = lower(env.REBOOK_EMAIL_MODE);
  if (mode !== 'dry' && mode !== 'live') return out;
  out.mode = mode;
  const today = londonDate(now), hour = londonHour(now);
  if (hour < 9 || hour >= 20) { out.mode += ':outside_hours'; return out; }

  const since = new Date(now.getTime() - (REBOOK_MAX_DAYS + 10) * 86400000).toISOString().slice(0, 10);
  const bookings = await sbRequest(env, {
    path: `/rest/v1/bookings?select=id,client_id,customer_name,customer_email,booking_date,status,is_test&is_test=eq.false&or=(status.eq.confirmed,status.eq.reschedule_pending)&booking_date=gte.${since}&order=booking_date.asc`,
    method: 'GET',
  });
  const cids = [...new Set((bookings || []).map((b) => b.client_id).filter(Boolean))];
  const testIds = new Set(), optedOut = new Set();
  if (cids.length) {
    // fail closed: if the opt-out column isn't there yet, this throws and nothing is sent
    const cl = await sbRequest(env, { path: `/rest/v1/clients?select=id,is_test,rebook_email_optout&id=in.(${cids.join(',')})`, method: 'GET' });
    for (const c of cl || []) { if (c.is_test) testIds.add(c.id); if (c.rebook_email_optout) optedOut.add(c.id); }
  }
  const nudges = (await sbRequest(env, { path: `/rest/v1/rebook_nudges?select=client_id,client_email,sent_at&sent_at=gte.${encodeURIComponent(since)}`, method: 'GET' })) || [];
  const sent = (await sbRequest(env, { path: `/rest/v1/rebook_emails?select=client_key,last_session&last_session=gte.${since}`, method: 'GET' })) || [];
  const claimed = new Set(sent.map((r) => r.client_key + '|' + r.last_session));
  const only = env.REBOOK_EMAIL_ONLY ? new Set(String(env.REBOOK_EMAIL_ONLY).split(',').map(lower).filter(Boolean)) : null;

  const targets = pickRebookTargets({ bookings: bookings || [], testIds, optedOut, nudges, claimed, today, only });
  out.due = targets.length;
  if (mode === 'dry' || !env.RESEND_API_KEY) return out;

  for (const t of targets) {
    const claim = await sbRequest(env, {
      path: '/rest/v1/rebook_emails?on_conflict=client_key,last_session', method: 'POST',
      prefer: 'resolution=ignore-duplicates,return=representation', body: [{ client_key: t.key, last_session: t.last }],
    });
    if (!Array.isArray(claim) || !claim.length) continue;
    try {
      const m = rebookEmail(t.name);
      await sendEmail(env.RESEND_API_KEY, { from: FROM, to: [t.email], reply_to: HALIMA_EMAIL, subject: m.subject, html: m.html });
      out.sent++;
    } catch (err) {
      out.errors++; out.released++; console.error('rebook: email failed:', err);
      await sbRequest(env, { path: `/rest/v1/rebook_emails?client_key=eq.${encodeURIComponent(t.key)}&last_session=eq.${t.last}`, method: 'DELETE', prefer: 'return=minimal' }).catch(() => {});
    }
  }
  return out;
}
