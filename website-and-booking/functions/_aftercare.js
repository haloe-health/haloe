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
// PRIVACY: reminders carry no personal health detail — the email is the generic aftercare wording for that day (shared
// with the app, see ../aftercare-copy.js) and links to the app; the push is a fixed generic line.
import { sbRequest } from './_supabase.js';
import { sendEmail, esc, CREAM, GOLD, GOLD_DEEP, INK, BODY_TEXT, FONT, FONT_HEADING, FONT_HEADING_URL, LOGO_URL } from './_email.js';
import { notifyClient } from './_push.js';
import { AFTERCARE_COPY } from './_aftercare-copy.js';

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

/** Email headlines (NOT the app's stage names, which stay Today / Tomorrow / Day 3 / Day 7 / Day 14). */
const HEADLINE = { 1: 'The day after', 7: 'A week on' };

/**
 * ONE template for every aftercare reminder, so Day 1 and Day 7 cannot drift apart: only the eyebrow, headline and
 * paragraph differ. Calm and plain — no card, no inline-block, nothing a mail client can shrink-to-fit: one centred
 * 480px column (width 100%, max-width 480px) of table rows whose cells carry width="100%"; Outlook, which ignores
 * max-width, gets a fixed 480px table through the MSO conditionals. Colours are set three ways (bgcolor attribute,
 * inline style, and a gradient background Gmail's dark mode doesn't invert) plus the [data-ogsc]/[data-ogsb] overrides
 * Gmail uses for its dark mode, so the logo, the text and the gold button stay readable.
 */
const RULE = '#E4DCCB';
const cell = (inner, style = '', attrs = '') => `<tr><td width="100%" ${attrs} style="${style}">${inner}</td></tr>`;
const divider = (padding) => cell(`<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td width="100%" height="1" bgcolor="${RULE}" style="height:1px;font-size:0;line-height:0;background:${RULE};">&nbsp;</td></tr></table>`, `padding:${padding};`);
function reminderLayout({ eyebrow, headline, greeting, body, note }) {
  const bg = `background-color:${CREAM};background-image:linear-gradient(${CREAM},${CREAM});`;
  return `<!doctype html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light only">
<meta name="supported-color-schemes" content="light only">
<link href="https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600&display=swap" rel="stylesheet">
<style>
  @font-face { font-family: 'Tan Ashford'; src: url('${FONT_HEADING_URL}') format('woff2'); font-weight: normal; font-style: normal; }
  :root { color-scheme: light only; supported-color-schemes: light only; }
  body, table, td, p, a, div, span { font-family: ${FONT}; }
  /* Gmail dark mode (Android/iOS) rewrites colours through these attributes — pin ours */
  [data-ogsb] .bg-cream { background-color: ${CREAM} !important; background-image: linear-gradient(${CREAM},${CREAM}) !important; }
  [data-ogsc] .ink { color: ${INK} !important; }
  [data-ogsc] .body-text { color: ${BODY_TEXT} !important; }
  [data-ogsc] .gold-text { color: ${GOLD_DEEP} !important; }
  [data-ogsb] .btn-cell { background-color: ${GOLD} !important; background-image: linear-gradient(${GOLD},${GOLD}) !important; }
  [data-ogsc] .btn-text { color: ${INK} !important; }
</style>
</head>
<body class="bg-cream" bgcolor="${CREAM}" style="margin:0;padding:0;${bg}">
<table role="presentation" class="bg-cream" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${CREAM}" style="width:100%;border-collapse:collapse;${bg}">
<tr><td class="bg-cream" width="100%" align="center" bgcolor="${CREAM}" style="padding:0 16px;${bg}">
<!--[if mso]><table role="presentation" width="480" align="center" cellpadding="0" cellspacing="0" border="0"><tr><td><![endif]-->
<table role="presentation" width="100%" align="center" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:480px;margin:0 auto;border-collapse:collapse;">
${cell(`<img src="${LOGO_URL}" width="172" height="46" alt="haloe" style="display:block;margin:0 auto;width:172px;height:auto;border:0;outline:none;">`, 'padding:32px 0 0;', 'align="center"')}
${cell('HIJAMA &middot; WELLNESS &middot; MANCHESTER', `padding:12px 0 0;font-family:${FONT};font-size:11px;line-height:16px;letter-spacing:3px;color:${GOLD_DEEP};`, 'align="center" class="gold-text"')}
${divider('28px 0')}
${cell(esc(eyebrow.toUpperCase()), `padding:0 0 8px;font-family:${FONT};font-size:11px;line-height:16px;letter-spacing:2px;font-weight:600;color:${GOLD_DEEP};`, 'align="center" class="gold-text"')}
${cell(esc(headline), `padding:0 0 24px;font-family:${FONT_HEADING};font-size:28px;line-height:34px;font-weight:normal;color:${INK};`, 'align="center" class="ink"')}
${cell(`<p class="ink" style="margin:0 0 12px;font-family:${FONT};font-size:16px;line-height:24px;color:${INK};">${esc(greeting)}</p>
<p class="body-text" style="margin:0;font-family:${FONT};font-size:16px;line-height:27px;color:${BODY_TEXT};">${esc(body)}</p>
<p style="margin:20px 0 0;font-family:${FONT};font-size:15px;line-height:24px;color:#8a8174;">${esc(note)}</p>`, 'padding:0 32px;', 'align="left"')}
${cell(`<table role="presentation" align="center" cellpadding="0" cellspacing="0" border="0" style="margin:0 auto;border-collapse:separate;"><tr><td class="btn-cell" align="center" bgcolor="${GOLD}" style="border-radius:26px;background-color:${GOLD};background-image:linear-gradient(${GOLD},${GOLD});padding:15px 32px;"><a class="btn-text" href="${APP_URL}" style="display:block;color:${INK};text-decoration:none;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:16px;letter-spacing:2px;text-transform:uppercase;font-weight:bold;">OPEN MY AFTERCARE</a></td></tr></table>`, 'padding:32px 0;', 'align="center"')}
${divider('0 0 24px')}
${cell(`<div class="gold-text" style="font-family:${FONT};font-size:12px;line-height:18px;letter-spacing:1px;font-weight:600;color:${GOLD_DEEP};">From haloe</div><div class="body-text" style="font-family:${FONT};font-size:11px;line-height:16px;margin-top:8px;color:${BODY_TEXT};">Manchester</div>`, 'padding:0 0 28px;', 'align="center"')}
</table>
<!--[if mso]></td></tr></table><![endif]-->
</td></tr></table>
</body>
</html>`;
}

export function reminderEmail(name, day) {
  // The words are the app's: the stage for this day (Tomorrow / Day 7) plus the photo line, from the shared copy.
  const step = AFTERCARE_COPY.steps.find((s2) => s2.at === day);
  const html = reminderLayout({
    eyebrow: day === 1 ? 'Aftercare · day 1' : 'Aftercare · day 7',
    headline: HEADLINE[day],
    greeting: firstName(name) ? `Hi ${firstName(name)},` : 'Hello,',
    body: step.text,
    note: AFTERCARE_COPY.photoLine,
  });
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
