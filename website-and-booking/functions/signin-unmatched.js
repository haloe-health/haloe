// Cloudflare Pages Function — POST /signin-unmatched
//
// A signed-in person whose email matches no client record (the app's "We can't find your details yet" screen) calls this
// with her Supabase session token. We confirm — from the token itself, never from anything she sends — who she is and
// that she really is unmatched, then record her EMAIL AND DATE ONLY in unlinked_signins and tell the admin with one
// quiet push: "A sign-in needs matching". At most one alert per email per (UK) day. Nothing about any other account is
// ever returned: the response is always the same small { ok: true }.
import { sbRequest } from './_supabase.js';
import { pushUnlinkedSignIn } from './_push.js';

const PUBLISHABLE_KEY = 'sb_publishable_PSpC5w-1CWnduinWbjdsfA_VSRx7mSG';   // public by design (ships in /app)
const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
const ukDate = (d = new Date()) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/London', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);

export async function onRequestPost({ request, env }) {
  const auth = request.headers.get('Authorization') || '';
  if (!auth.startsWith('Bearer ')) return json({ error: 'unauthorised' }, 401);
  const base = String(env.SUPABASE_URL || '').replace(/\/$/, '');
  if (!base || !env.SUPABASE_SERVICE_ROLE_KEY) return json({ error: 'unavailable' }, 503);
  const anon = env.SUPABASE_ANON_KEY || PUBLISHABLE_KEY;
  try {
    // Who is this? (the token says — not the request body)
    const who = await fetch(`${base}/auth/v1/user`, { headers: { apikey: anon, Authorization: auth } });
    if (!who.ok) return json({ error: 'unauthorised' }, 401);
    const user = await who.json();
    const email = String((user && user.email) || '').trim().toLowerCase();
    if (!user || !user.id || !email) return json({ ok: true });

    // Is she really unmatched? Ask AS HER, so row-level security applies: no linked profile, no client row visible.
    const h = { apikey: anon, Authorization: auth };
    const [pRes, cRes] = await Promise.all([
      fetch(`${base}/rest/v1/profiles?select=role,client_id&id=eq.${encodeURIComponent(user.id)}`, { headers: h }),
      fetch(`${base}/rest/v1/clients?select=id&limit=1`, { headers: h }),
    ]);
    if (!pRes.ok || !cRes.ok) return json({ ok: true });
    const prof = (await pRes.json())[0] || null, mine = await cRes.json();
    if ((prof && (prof.role === 'admin' || prof.client_id)) || (Array.isArray(mine) && mine.length)) return json({ ok: true });   // matched (or the admin): nothing to record

    const today = ukDate();
    // Record the sighting (email + date only). A repeat only refreshes last_seen_at.
    await sbRequest(env, { path: '/rest/v1/unlinked_signins?on_conflict=email', method: 'POST', prefer: 'resolution=ignore-duplicates,return=minimal', body: [{ email }] });
    await sbRequest(env, { path: `/rest/v1/unlinked_signins?email=eq.${encodeURIComponent(email)}`, method: 'PATCH', prefer: 'return=minimal', body: { last_seen_at: new Date().toISOString() } });
    // One alert per email per day: only the request that wins this conditional update sends the push.
    const claimed = await sbRequest(env, {
      path: `/rest/v1/unlinked_signins?email=eq.${encodeURIComponent(email)}&dismissed_at=is.null&or=(last_alert_on.is.null,last_alert_on.lt.${today})`,   // a dismissed email never alerts again
      method: 'PATCH', prefer: 'return=representation', body: { last_alert_on: today },
    });
    if (Array.isArray(claimed) && claimed.length) {
      try { await pushUnlinkedSignIn(env); } catch (e) { console.error('signin-unmatched: push failed:', e); }
    }
  } catch (err) { console.error('signin-unmatched: failed:', err); }
  return json({ ok: true });                                  // always the same answer
}
