// WhatsApp (Twilio) helpers for the app inbox. The `_` prefix keeps this from becoming a route.
// Needs Cloudflare secrets TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_WHATSAPP_FROM (e.g. whatsapp:+44…).

/** Any UK-style or international number → digits with country code, no '+': 07474 833643 → 447474833643. '' if unusable. */
export function normalisePhone(raw) {
  let d = String(raw || '').replace(/^whatsapp:/i, '').replace(/[^\d+]/g, '');
  if (d.startsWith('+')) d = d.slice(1);
  else if (d.startsWith('00')) d = d.slice(2);
  else if (d.startsWith('0')) d = '44' + d.slice(1);
  return /^\d{10,15}$/.test(d) ? d : '';
}
export const last10 = (p) => String(p || '').replace(/\D/g, '').slice(-10);

export const whatsappConfigured = (env) => !!(env.TWILIO_ACCOUNT_SID && env.TWILIO_AUTH_TOKEN && env.TWILIO_WHATSAPP_FROM);

/** Sends a free-form WhatsApp message. Returns { ok, sid, status, code, error } — never throws. */
export async function sendWhatsApp(env, phone, text) {
  if (!whatsappConfigured(env)) return { ok: false, code: 'not_configured' };
  const from = String(env.TWILIO_WHATSAPP_FROM).startsWith('whatsapp:') ? env.TWILIO_WHATSAPP_FROM : 'whatsapp:' + env.TWILIO_WHATSAPP_FROM;
  try {
    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${env.TWILIO_ACCOUNT_SID}/Messages.json`, {
      method: 'POST',
      headers: { Authorization: 'Basic ' + btoa(`${env.TWILIO_ACCOUNT_SID}:${env.TWILIO_AUTH_TOKEN}`), 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ From: from, To: 'whatsapp:+' + phone, Body: text }).toString(),
    });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) {
      // 63016 = outside the 24-hour window (WhatsApp only allows an approved template to start a conversation)
      return { ok: false, code: j.code === 63016 ? 'outside_window' : 'twilio_error', error: j.message || String(res.status) };
    }
    return { ok: true, sid: j.sid, status: j.status || 'queued' };
  } catch (e) {
    return { ok: false, code: 'network', error: String(e) };
  }
}

/** Twilio request signature: base64(HMAC-SHA1(authToken, url + each POST param name+value sorted by name)). */
export async function validTwilioSignature(env, url, params, signature) {
  if (!env.TWILIO_AUTH_TOKEN || !signature) return false;
  const data = url + [...params.keys()].sort().map((k) => k + params.get(k)).join('');
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(env.TWILIO_AUTH_TOKEN), { name: 'HMAC', hash: 'SHA-1' }, false, ['sign']);
  const mac = new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(data)));
  let bin = ''; mac.forEach((b) => { bin += String.fromCharCode(b); });
  const want = btoa(bin);
  if (want.length !== signature.length) return false;
  let diff = 0; for (let i = 0; i < want.length; i++) diff |= want.charCodeAt(i) ^ signature.charCodeAt(i);
  return diff === 0;
}
