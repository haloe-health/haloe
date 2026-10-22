// Cloudflare Pages Function — POST /voice-outgoing   (Twilio webhook: the TwiML App's "Voice request URL")
// Twilio calls this when the app places a call. We check the signature, check the number belongs to a CLIENT on file
// (so this can't be used to dial anyone else), then connect the call showing the haloe number. Calls are NOT recorded.
import { sbRequest } from './_supabase.js';
import { validTwilioSignature } from './_whatsapp.js';
import { VOICE_IDENTITY, twiml, xmlEsc } from './_voice.js';
import { last10 } from './_whatsapp.js';

export async function onRequestPost({ request, env }) {
  const params = new URLSearchParams(await request.text());
  const url = new URL(request.url); url.protocol = 'https:';
  if (!(await validTwilioSignature(env, url.toString(), params, request.headers.get('X-Twilio-Signature')))) return new Response('forbidden', { status: 403 });
  if (params.get('From') !== 'client:' + VOICE_IDENTITY) return twiml('<Say>Sorry, that call is not allowed.</Say><Hangup/>');
  const to = String(params.get('To') || '').replace(/[^\d+]/g, '');
  if (!/^\+\d{10,15}$/.test(to)) return twiml('<Say>Sorry, that number is not valid.</Say><Hangup/>');
  try {
    const all = await sbRequest(env, { path: '/rest/v1/clients?select=phone&phone=not.is.null', method: 'GET' });
    if (!(all || []).some((c) => last10(c.phone) === last10(to))) return twiml('<Say>Sorry, that number is not a client.</Say><Hangup/>');
  } catch (e) {
    console.error('voice-outgoing: client lookup failed:', e);
    return twiml('<Say>Sorry, something went wrong.</Say><Hangup/>');
  }
  return twiml(`<Dial callerId="${xmlEsc(env.TWILIO_VOICE_NUMBER)}" answerOnBridge="true"><Number>${xmlEsc(to)}</Number></Dial>`);
}
