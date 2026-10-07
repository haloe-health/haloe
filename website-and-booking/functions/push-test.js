// Cloudflare Pages Function — POST /push-test   (admin only)
//
// "Send test alert" in the app's Settings. The browser sends the admin's Supabase session token and,
// optionally, this device's push endpoint. We verify the token, confirm the account is an admin, then send
// a test push to that admin's own device(s) only. Anyone else gets 401/403 and nothing is sent.
import { sbRequest } from './_supabase.js';
import { notifyAdmins } from './_push.js';

const PUBLISHABLE_KEY = 'sb_publishable_PSpC5w-1CWnduinWbjdsfA_VSRx7mSG';   // public by design (ships in /app)
const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });

export async function onRequestPost({ request, env }) {
  const auth = request.headers.get('Authorization') || '';
  if (!auth.startsWith('Bearer ')) return json({ error: 'unauthorised' }, 401);
  const base = String(env.SUPABASE_URL || '').replace(/\/$/, '');
  if (!base) return json({ error: 'unavailable' }, 503);

  // Who is this? (Supabase validates the token.)
  const who = await fetch(`${base}/auth/v1/user`, { headers: { apikey: env.SUPABASE_ANON_KEY || PUBLISHABLE_KEY, Authorization: auth } });
  if (!who.ok) return json({ error: 'unauthorised' }, 401);
  const user = await who.json();
  if (!user || !user.id) return json({ error: 'unauthorised' }, 401);

  // Admin only.
  let rows;
  try { rows = await sbRequest(env, { path: `/rest/v1/profiles?select=role&id=eq.${encodeURIComponent(user.id)}`, method: 'GET' }); }
  catch (e) { console.error('push-test: profile lookup failed:', e); return json({ error: 'failed' }, 502); }
  if (!rows || !rows[0] || rows[0].role !== 'admin') return json({ error: 'forbidden' }, 403);

  let endpoint;
  try { endpoint = (await request.json()).endpoint; } catch (e) { /* body optional */ }
  const r = await notifyAdmins(env, { kind: 'test', body: 'Test alert · it works', url: '/app/#/settings', tag: 'test', userId: user.id, endpoint: typeof endpoint === 'string' ? endpoint : undefined });
  if (r.skipped === 'vapid_not_configured') return json({ error: 'not_configured' }, 503);
  return json({ ok: true, ...r });
}
