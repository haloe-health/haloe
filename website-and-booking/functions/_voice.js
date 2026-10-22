// Twilio Voice helpers for in-app calling. The `_` prefix keeps this from becoming a route.
// Secrets (Cloudflare): TWILIO_ACCOUNT_SID, TWILIO_API_KEY_SID, TWILIO_API_KEY_SECRET, TWILIO_TWIML_APP_SID,
// TWILIO_VOICE_NUMBER (the haloe number clients see, E.164 e.g. +4416…), optional HALOE_FORWARD_TO (Halima's mobile,
// rung if the app isn't open). The one app identity is VOICE_IDENTITY: every admin device registers as it.
export const VOICE_IDENTITY = 'haloe-admin';
export const voiceConfigured = (env) => !!(env.TWILIO_ACCOUNT_SID && env.TWILIO_API_KEY_SID && env.TWILIO_API_KEY_SECRET && env.TWILIO_TWIML_APP_SID && env.TWILIO_VOICE_NUMBER);

const b64url = (buf) => { let s = ''; new Uint8Array(buf).forEach((b) => { s += String.fromCharCode(b); }); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); };
const enc = (o) => b64url(new TextEncoder().encode(JSON.stringify(o)));

/** Twilio Access Token (JWT, HS256 signed with the API key secret) with a Voice grant: outgoing via the TwiML app, incoming allowed. */
export async function voiceToken(env, ttlSeconds = 3600) {
  const now = Math.floor(Date.now() / 1000);
  const head = enc({ alg: 'HS256', typ: 'JWT', cty: 'twilio-fpa;v=1' });
  const body = enc({
    jti: `${env.TWILIO_API_KEY_SID}-${now}`, iss: env.TWILIO_API_KEY_SID, sub: env.TWILIO_ACCOUNT_SID, nbf: now, exp: now + ttlSeconds,
    grants: { identity: VOICE_IDENTITY, voice: { incoming: { allow: true }, outgoing: { application_sid: env.TWILIO_TWIML_APP_SID } } },
  });
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(env.TWILIO_API_KEY_SECRET), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${head}.${body}`));
  return `${head}.${body}.${b64url(sig)}`;
}

export const xmlEsc = (s) => String(s).replace(/[<>&"']/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' }[c]));
export const twiml = (inner) => new Response(`<?xml version="1.0" encoding="UTF-8"?><Response>${inner}</Response>`, { status: 200, headers: { 'Content-Type': 'text/xml' } });
