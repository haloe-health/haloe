// Cloudflare Pages Function — POST /whatsapp-incoming   (Twilio webhook, not a browser route)
//
// Twilio calls this when a client replies on the haloe WhatsApp number. We check Twilio's signature, store the message
// (linked to the client by phone number when one matches) and send the admin a generic push — no name, no text.
// Set it in Twilio → the WhatsApp sender → "When a message comes in" = https://haloe.health/whatsapp-incoming
import { sbRequest } from './_supabase.js';
import { notifyAdmins } from './_push.js';
import { normalisePhone, last10, validTwilioSignature } from './_whatsapp.js';

const twiml = () => new Response('<?xml version="1.0" encoding="UTF-8"?><Response/>', { status: 200, headers: { 'Content-Type': 'text/xml' } });

export async function onRequestPost({ request, env }) {
  const params = new URLSearchParams(await request.text());
  // Twilio signs the exact public URL it called.
  const url = new URL(request.url); url.protocol = 'https:';
  if (!(await validTwilioSignature(env, url.toString(), params, request.headers.get('X-Twilio-Signature')))) {
    return new Response('forbidden', { status: 403 });
  }
  const phone = normalisePhone(params.get('From'));
  const body = String(params.get('Body') || '').trim() || (Number(params.get('NumMedia')) > 0 ? '[Photo or attachment — open WhatsApp to see it]' : '');
  const sid = params.get('MessageSid');
  if (!phone || !body) return twiml();
  try {
    let clientId = null;
    const all = await sbRequest(env, { path: '/rest/v1/clients?select=id,phone&phone=not.is.null', method: 'GET' });
    const hit = (all || []).find((c) => last10(c.phone) === last10(phone));
    if (hit) clientId = hit.id;
    await sbRequest(env, {
      path: '/rest/v1/whatsapp_messages?on_conflict=twilio_sid', method: 'POST', prefer: 'resolution=ignore-duplicates,return=minimal',
      body: { phone, client_id: clientId, direction: 'in', body, twilio_sid: sid, status: 'received' },
    });
    await notifyAdmins(env, { kind: 'message', body: 'New WhatsApp message', url: '/app/#/inbox/' + phone, tag: 'wa-' + phone });
  } catch (e) {
    console.error('whatsapp-incoming failed:', e);   // still answer 200 so Twilio doesn't retry-storm
  }
  return twiml();
}
