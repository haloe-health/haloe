// Cloudflare Pages Function — POST /whatsapp-send   (admin only)
//
// The app's Inbox sends a WhatsApp message to a client through the Twilio business number and records it.
// Body: { phone, text }. Anyone who isn't a signed-in admin gets 401/403 and nothing is sent.
// Free-form text only works within 24 hours of the client's last message (WhatsApp rule); outside it we answer
// 409 { error: 'outside_window' } and the app tells Halima to message from her own phone.
import { sbRequest } from './_supabase.js';
import { normalisePhone, last10, sendWhatsApp, whatsappConfigured } from './_whatsapp.js';

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

  if (!whatsappConfigured(env)) return json({ error: 'not_configured' }, 503);
  let input; try { input = await request.json(); } catch (e) { return json({ error: 'bad_request' }, 400); }
  const phone = normalisePhone(input.phone), text = String(input.text || '').trim().slice(0, 1500);
  if (!phone || !text) return json({ error: 'bad_request' }, 400);

  // WhatsApp only lets us send free text within 24 hours of the client's last message. Twilio accepts the request
  // anyway and fails it later, so check here instead and tell Halima straight away.
  try {
    const last = await sbRequest(env, { path: `/rest/v1/whatsapp_messages?select=created_at&direction=eq.in&phone=eq.${phone}&order=created_at.desc&limit=1`, method: 'GET' });
    if (!last || !last[0] || Date.now() - new Date(last[0].created_at).getTime() > 24 * 3600 * 1000) return json({ error: 'outside_window' }, 409);
  } catch (e) { console.error('whatsapp-send: window check failed:', e); return json({ error: 'failed' }, 502); }

  const sent = await sendWhatsApp(env, phone, text);
  if (!sent.ok) {
    console.error('whatsapp-send failed:', sent.code, sent.error);
    return json({ error: sent.code }, sent.code === 'outside_window' ? 409 : 502);
  }
  let clientId = null;
  try {
    const all = await sbRequest(env, { path: '/rest/v1/clients?select=id,phone&phone=not.is.null', method: 'GET' });
    const hit = (all || []).find((c) => last10(c.phone) === last10(phone)); if (hit) clientId = hit.id;
    const saved = await sbRequest(env, {
      path: '/rest/v1/whatsapp_messages', method: 'POST', prefer: 'return=representation',
      body: { phone, client_id: clientId, direction: 'out', body: text, twilio_sid: sent.sid, status: sent.status },
    });
    return json({ ok: true, message: saved && saved[0] });
  } catch (e) {
    console.error('whatsapp-send: saved to WhatsApp but not to the database:', e);
    return json({ ok: true, message: null });
  }
}
