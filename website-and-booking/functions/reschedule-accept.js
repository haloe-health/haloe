// Cloudflare Pages Function — POST /reschedule-accept
//
// A client taps "Accept" on a proposed new time in her haloe account (/app).
// The browser sends her Supabase session token; this Function calls the
// `accept_reschedule` database function AS HER (so the database decides she may
// only accept her own booking, only while it is pending, and only if the new
// time is still free), then emails Halima via Resend.
//
// The email carries the name, the new date/time and the treatment — nothing
// clinical, no reason for the move. Env: RESEND_API_KEY (to email),
// SUPABASE_URL (to reach the database). The publishable key below is public by
// design (it ships in /app); row-level security and the function's own checks
// are what protect the data.
import { sendEmail, esc, emailShell, emailHeader, emailFooter, heroRow, infoCard } from './_email.js';
import { CLINIC_VENUE_NAME } from './_clinic.js';

const PUBLISHABLE_KEY = 'sb_publishable_PSpC5w-1CWnduinWbjdsfA_VSRx7mSG';
const HALIMA_EMAIL = 'halima@haloe.health';
const FROM = 'haloe <halima@haloe.health>';

const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });

const fmtDay = (iso) => new Date(iso + 'T12:00:00Z').toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' });
const fmtTime = (m) => { const h = Math.floor(m / 60), mm = m % 60; return ((h + 11) % 12 + 1) + ':' + String(mm).padStart(2, '0') + (h < 12 ? 'am' : 'pm'); };
const fmtOriginal = (ts) => {
  if (!ts) return '';
  const d = new Date(ts);
  const day = d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'Europe/London' });
  const time = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', hour: 'numeric', minute: '2-digit', hour12: true }).format(d).replace(' ', '').toLowerCase();
  return `${day}, ${time}`;
};

export async function onRequestPost(context) {
  const { env, request } = context;
  const auth = request.headers.get('Authorization') || '';
  if (!auth.startsWith('Bearer ')) return json({ error: 'unauthorised' }, 401);
  const base = String(env.SUPABASE_URL || '').replace(/\/$/, '');
  if (!base) return json({ error: 'unavailable' }, 503);

  let bookingId;
  try { bookingId = Number((await request.json()).bookingId); } catch (e) { /* fall through */ }
  if (!Number.isInteger(bookingId) || bookingId <= 0) return json({ error: 'bad_request' }, 400);

  // Run the acceptance as the signed-in client (her token, not a service key).
  const res = await fetch(`${base}/rest/v1/rpc/accept_reschedule`, {
    method: 'POST',
    headers: { apikey: env.SUPABASE_ANON_KEY || PUBLISHABLE_KEY, Authorization: auth, 'Content-Type': 'application/json' },
    body: JSON.stringify({ p_booking: bookingId }),
  });
  if (!res.ok) {
    const text = await res.text();
    if (/time_taken/.test(text)) return json({ error: 'time_taken' }, 409);
    if (/not_pending/.test(text)) return json({ error: 'not_pending' }, 409);
    if (/not_found|forbidden/.test(text) || res.status === 401 || res.status === 403) return json({ error: 'not_found' }, 404);
    console.error('accept_reschedule failed:', res.status, text);
    return json({ error: 'failed' }, 502);
  }
  const b = await res.json();

  // Tell Halima. A failure here must never undo the acceptance.
  let emailed = false;
  try {
    if (env.RESEND_API_KEY) {
      const when = `${fmtDay(b.date)}, ${fmtTime(b.start_min)}`;
      const html = emailShell(
        emailHeader() +
        heroRow('Reschedule accepted', fmtDay(b.date), fmtTime(b.start_min)) +
        infoCard([
          { label: 'Client', value: b.name },
          { label: 'Treatment', value: b.treatment },
          { label: 'Where', value: b.location === 'clinic' ? CLINIC_VENUE_NAME : 'Home visit' },
          { label: 'Moved from', value: fmtOriginal(b.original_starts_at) },
        ]) +
        emailFooter(),
      );
      await sendEmail(env.RESEND_API_KEY, {
        from: FROM,
        to: [HALIMA_EMAIL],
        subject: `Reschedule accepted — ${b.name}, ${when}`,
        html,
      });
      emailed = true;
    } else {
      console.error('RESEND_API_KEY is not configured; reschedule accepted but no email sent');
    }
  } catch (err) {
    console.error('Failed to email Halima about the accepted reschedule:', err);
  }
  return json({ ok: true, date: b.date, start_min: b.start_min, emailed });
}
