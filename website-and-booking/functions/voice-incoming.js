// Cloudflare Pages Function — POST /voice-incoming   (Twilio webhook: the haloe voice number's "A call comes in")
// Rings the app for 20 seconds; if nobody answers it rings Halima's mobile (HALOE_FORWARD_TO) when set, otherwise
// a short message points the caller to WhatsApp. Calls are NOT recorded and there is no voicemail.
import { validTwilioSignature } from './_whatsapp.js';
import { VOICE_IDENTITY, twiml, xmlEsc } from './_voice.js';

export async function onRequestPost({ request, env }) {
  const params = new URLSearchParams(await request.text());
  const url = new URL(request.url); url.protocol = 'https:';
  if (!(await validTwilioSignature(env, url.toString(), params, request.headers.get('X-Twilio-Signature')))) return new Response('forbidden', { status: 403 });
  const ring = `<Dial timeout="20" callerId="${xmlEsc(params.get('From') || '')}"><Client>${VOICE_IDENTITY}</Client></Dial>`;
  const fallback = env.HALOE_FORWARD_TO
    ? `<Dial timeout="25" callerId="${xmlEsc(env.TWILIO_VOICE_NUMBER || '')}"><Number>${xmlEsc(env.HALOE_FORWARD_TO)}</Number></Dial>`
    : '';
  return twiml(ring + fallback + '<Say voice="Polly.Amy" language="en-GB">Sorry, we cannot take your call right now. Please send us a message on WhatsApp and we will reply as soon as we can.</Say>');
}
