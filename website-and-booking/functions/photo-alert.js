// Cloudflare Pages Function — POST /photo-alert   { submissionId }
//
// A client has uploaded photos for Halima (rows in photo_submissions + files in the private aftercare-photos bucket).
// The browser calls this with her Supabase session token. We confirm — AS HER, so row-level security applies — that
// the submission is hers, claim its one-time alert, then tell Halima by admin push and by email.
// Neither carries a name or any photo: "A client sent a photo", with a link that opens that client's brief in the app.
// A failure to alert never undoes the upload (the photos are saved; the client is told it was sent).
import { sbRequest } from './_supabase.js';
import { sendEmail, emailShell, emailHeader, emailFooter, emailButton, heroRow } from './_email.js';
import { pushPhotoSent } from './_push.js';

const PUBLISHABLE_KEY = 'sb_publishable_PSpC5w-1CWnduinWbjdsfA_VSRx7mSG';   // public by design (ships in /app)
const FROM = 'haloe <halima@haloe.health>';
const HALIMA_EMAIL = 'halima@haloe.health';
const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });

export async function onRequestPost({ request, env }) {
  const auth = request.headers.get('Authorization') || '';
  if (!auth.startsWith('Bearer ')) return json({ error: 'unauthorised' }, 401);
  const base = String(env.SUPABASE_URL || '').replace(/\/$/, '');
  if (!base) return json({ error: 'unavailable' }, 503);
  let id; try { id = Number((await request.json()).submissionId); } catch (e) { /* below */ }
  if (!Number.isInteger(id) || id <= 0) return json({ error: 'bad_request' }, 400);

  // Is this submission hers? (RLS: a client can only see her own rows.)
  const mine = await fetch(`${base}/rest/v1/photo_submissions?select=id,client_id,alerted_at&id=eq.${id}`, { headers: { apikey: env.SUPABASE_ANON_KEY || PUBLISHABLE_KEY, Authorization: auth } });
  if (!mine.ok) return json({ error: 'unauthorised' }, 401);
  const rows = await mine.json();
  if (!rows || !rows[0]) return json({ error: 'not_found' }, 404);
  const sub = rows[0];
  if (sub.alerted_at) return json({ ok: true, already: true });

  // Claim the one-time alert (a double-tap or retry can't alert twice).
  let claimed;
  try {
    claimed = await sbRequest(env, { path: `/rest/v1/photo_submissions?id=eq.${id}&alerted_at=is.null`, method: 'PATCH', prefer: 'return=representation', body: { alerted_at: new Date().toISOString() } });
  } catch (e) { console.error('photo-alert: claim failed:', e); return json({ error: 'failed' }, 502); }
  if (!Array.isArray(claimed) || !claimed.length) return json({ ok: true, already: true });

  let pushed = 0, emailed = false;
  try { const p = await pushPhotoSent(env, sub.client_id); pushed = (p && p.sent) || 0; } catch (e) { console.error('photo-alert: push failed:', e); }
  try {
    if (env.RESEND_API_KEY) {
      const link = `https://haloe.health/app/#/brief/c/${Number(sub.client_id)}`;
      await sendEmail(env.RESEND_API_KEY, {
        from: FROM, to: [HALIMA_EMAIL], subject: 'A client sent a photo',
        html: emailShell(emailHeader() + heroRow('Aftercare', 'A client sent a photo', 'Open the haloe app to see it.') +
          `<tr><td align="center" style="padding:6px 0 20px;">${emailButton(link, 'Open in haloe')}</td></tr>` + emailFooter()),
      });
      emailed = true;
    }
  } catch (e) { console.error('photo-alert: email failed:', e); }
  return json({ ok: true, pushed, emailed });
}
