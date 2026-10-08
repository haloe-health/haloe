// Aftercare reminders + photo retention — run hourly by /aftercare-cron (Supabase pg_cron → pg_net).
// The `_` prefix keeps this file from becoming a route.
//
//   * Day 1 and Day 7 after a session is marked done: a short email via Resend (link to the app), plus a push to
//     the client's own devices if she has allowed them. Each (booking, day) is CLAIMED in aftercare_reminders
//     before sending, so an hourly run never sends twice; a failed email releases the claim so the next run retries.
//   * Never for test clients/bookings, never for a session that isn't marked done (done_at null), never for a booking
//     that isn't confirmed, and only 09:00–19:59 UK time (nobody gets a reminder at 3am).
//   * Photos older than their expires_at (90 days) are deleted through the Storage API (deleting storage rows with SQL
//     leaves the files behind), then the submission rows are removed.
//
// PRIVACY: reminders carry no health detail — the email says an aftercare note is waiting and links to the app; the
// push is a fixed generic line. Wording is the site's: marks usually fade within 14 days at most.
import { sbRequest } from './_supabase.js';
import { sendEmail, esc, emailShell, emailHeader, emailFooter, emailButton, heroRow } from './_email.js';
import { notifyClient } from './_push.js';

const FROM = 'haloe <halima@haloe.health>';
const HALIMA_EMAIL = 'halima@haloe.health';
const APP_URL = 'https://haloe.health/app';
export const REMINDER_DAYS = [1, 7];

const londonParts = (d) => {
  const f = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/London', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hourCycle: 'h23' }).formatToParts(d);
  const g = (t) => f.find((p) => p.type === t).value;
  return { date: `${g('year')}-${g('month')}-${g('day')}`, hour: Number(g('hour')) };
};
export const londonDate = (d) => londonParts(new Date(d)).date;
export const londonHour = (d) => londonParts(new Date(d)).hour;
/** Whole calendar days from `fromISO` to `toISO` (both YYYY-MM-DD, UK dates). */
export const daysBetween = (fromISO, toISO) => Math.round((Date.parse(toISO + 'T12:00:00Z') - Date.parse(fromISO + 'T12:00:00Z')) / 86400000);
const firstName = (n) => { const w = String(n || '').trim().split(/\s+/)[0] || ''; return w ? w.charAt(0).toUpperCase() + w.slice(1).toLowerCase() : ''; };

export function reminderEmail(name, day) {
  const hi = firstName(name) ? `Hi ${firstName(name)},` : 'Hello,';
  const eyebrow = day === 1 ? 'Aftercare · day 1' : 'Aftercare · day 7';
  const line = day === 1
    ? 'A quiet note from haloe, the morning after your session. Your aftercare guide for today is waiting in your haloe account. If a mark worries you at any point, you can send Halima a photo there.'
    : 'A week on from your session. Your aftercare note for day 7 is in your haloe account. Marks usually fade within 14 days at most. If a mark worries you, you can send Halima a photo there.';
  const html = emailShell(
    emailHeader() +
    heroRow(eyebrow, day === 1 ? 'Tomorrow, today' : 'A week on', '') +
    `<tr><td style="padding:4px 4px 18px;font-size:15px;line-height:1.6;color:#5a5247;">${esc(hi)}<br><br>${esc(line)}</td></tr>` +
    `<tr><td align="center" style="padding:0 0 20px;">${emailButton(APP_URL, 'Open my aftercare')}</td></tr>` +
    emailFooter(),
  );
  return { subject: day === 1 ? 'Your aftercare note · day 1' : 'Your aftercare note · day 7', html };
}

/**
 * Send one reminder email on demand, ONLY to a client flagged is_test (so it can't be used to mail a real client).
 * Used by tools/send-test-reminder.mjs through /aftercare-cron. Does not touch aftercare_reminders.
 */
export async function sendTestReminder(env, email, day) {
  if (!REMINDER_DAYS.includes(day)) return { ok: false, error: 'bad_day' };
  if (!env.RESEND_API_KEY) return { ok: false, error: 'email_not_configured' };
  const e = String(email || '').trim().toLowerCase();
  if (!e) return { ok: false, error: 'no_email' };
  const rows = await sbRequest(env, { path: `/rest/v1/clients?select=full_name,email,is_test&email=ilike.${encodeURIComponent(e)}&is_test=eq.true&limit=1`, method: 'GET' });
  if (!Array.isArray(rows) || !rows.length) return { ok: false, error: 'not_a_test_client' };
  const m = reminderEmail(rows[0].full_name, day);
  await sendEmail(env.RESEND_API_KEY, { from: FROM, to: [rows[0].email], reply_to: HALIMA_EMAIL, subject: m.subject, html: m.html });
  return { ok: true, sent_to: rows[0].email, day };
}

/** One hourly pass. Returns a summary; never throws. */
export async function runAftercare(env, now = new Date()) {
  const out = { window: false, considered: 0, emailed: 0, pushed: 0, released: 0, skipped: 0, purged: 0, errors: 0 };
  try {
    const { date: today, hour } = londonParts(now);
    out.window = hour >= 9 && hour < 20;
    if (out.window) await sendReminders(env, now, today, out);
  } catch (err) { out.errors++; console.error('aftercare: reminders failed:', err); }
  try { out.purged = await purgeExpiredPhotos(env, now); } catch (err) { out.errors++; console.error('aftercare: photo purge failed:', err); }
  return out;
}

async function sendReminders(env, now, today, out) {
  const since = new Date(now.getTime() - 9 * 86400000).toISOString();
  const rows = await sbRequest(env, {
    path: `/rest/v1/bookings?select=id,client_id,customer_name,customer_email,done_at&status=eq.confirmed&is_test=eq.false&done_at=gte.${encodeURIComponent(since)}`,
    method: 'GET',
  });
  const due = (rows || []).map((b) => ({ b, day: daysBetween(londonDate(b.done_at), today) })).filter((x) => REMINDER_DAYS.includes(x.day));
  out.considered = due.length;
  if (!due.length) return;

  // never for test clients, even if the booking itself wasn't flagged
  const cids = [...new Set(due.map((x) => x.b.client_id).filter(Boolean))];
  const testIds = new Set();
  if (cids.length) {
    const cl = await sbRequest(env, { path: `/rest/v1/clients?select=id,is_test&id=in.(${cids.join(',')})`, method: 'GET' });
    for (const c of cl || []) if (c.is_test) testIds.add(c.id);
  }
  for (const { b, day } of due) {
    if (testIds.has(b.client_id) || !b.customer_email) { out.skipped++; continue; }
    // claim first: an already-claimed (booking, day) returns no row
    const claimed = await sbRequest(env, {
      path: '/rest/v1/aftercare_reminders?on_conflict=booking_id,day', method: 'POST',
      prefer: 'resolution=ignore-duplicates,return=representation', body: [{ booking_id: b.id, day }],
    });
    if (!Array.isArray(claimed) || !claimed.length) { out.skipped++; continue; }
    const release = async () => { out.released++; await sbRequest(env, { path: `/rest/v1/aftercare_reminders?booking_id=eq.${b.id}&day=eq.${day}`, method: 'DELETE', prefer: 'return=minimal' }).catch(() => {}); };
    if (!env.RESEND_API_KEY) { await release(); continue; }
    try {
      const m = reminderEmail(b.customer_name, day);
      await sendEmail(env.RESEND_API_KEY, { from: FROM, to: [b.customer_email], reply_to: HALIMA_EMAIL, subject: m.subject, html: m.html });
      out.emailed++;
    } catch (err) {
      out.errors++; console.error('aftercare: reminder email failed:', err);
      await release();
      continue;
    }
    const p = await notifyClient(env, b.client_id, { body: 'Your aftercare note for today', url: '/app/#/aftercare', tag: `aftercare-${b.id}-${day}` });
    out.pushed += (p && p.sent) || 0;
  }
}

/** Delete photos past their retention date. Files first (Storage API), then the rows. Returns how many submissions were purged. */
export async function purgeExpiredPhotos(env, now = new Date()) {
  const rows = await sbRequest(env, { path: `/rest/v1/photo_submissions?select=id,paths&expires_at=lt.${encodeURIComponent(now.toISOString())}&limit=100`, method: 'GET' });
  if (!rows || !rows.length) return 0;
  const paths = rows.flatMap((r) => r.paths || []);
  if (paths.length) await sbRequest(env, { path: '/storage/v1/object/aftercare-photos', method: 'DELETE', body: { prefixes: paths } });   // throws on failure → rows are kept and retried next hour
  await sbRequest(env, { path: `/rest/v1/photo_submissions?id=in.(${rows.map((r) => r.id).join(',')})`, method: 'DELETE', prefer: 'return=minimal' });
  return rows.length;
}
