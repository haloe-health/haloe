// Cloudflare Pages Function — POST /voice-token   (admin only)
// Gives the app a short-lived Twilio Voice access token so it can place and receive calls in the browser.
// 503 { error: 'not_configured' } until the Twilio Voice secrets are set — the app then falls back to the phone dialler.
import { sbRequest } from './_supabase.js';
import { voiceConfigured, voiceToken } from './_voice.js';

const PUBLISHABLE_KEY = 'sb_publishable_PSpC5w-1CWnduinWbjdsfA_VSRx7mSG';   // public by design (ships in /app)
const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });

export async function onRequestPost({ request, env }) {
  const auth = request.headers.get('Authorization') || '';
  if (!auth.startsWith('Bearer ')) return json({ error: 'unauthorised' }, 401);
  const base = String(env.SUPABASE_URL || '').replace(/\/$/, '');
  if (!base) return json({ error: 'unavailable' }, 503);
  const who = await fetch(`${base}/auth/v1/user`, { headers: { apikey: env.SUPABASE_ANON_KEY || PUBLISHABLE_KEY, Authorization: auth } });
  if (!who.ok) return json({ error: 'unauthorised' }, 401);
  const user = await who.json();
  if (!user || !user.id) return json({ error: 'unauthorised' }, 401);
  let rows;
  try { rows = await sbRequest(env, { path: `/rest/v1/profiles?select=role&id=eq.${encodeURIComponent(user.id)}`, method: 'GET' }); }
  catch (e) { return json({ error: 'failed' }, 502); }
  if (!rows || !rows[0] || rows[0].role !== 'admin') return json({ error: 'forbidden' }, 403);
  if (!voiceConfigured(env)) return json({ error: 'not_configured' }, 503);
  return json({ token: await voiceToken(env) });
}
