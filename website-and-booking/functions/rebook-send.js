// Cloudflare Pages Function — POST /rebook-send   (admin only)
//
// The "Email" button on the app's Clients → Needs rebooking list. Body: { clientId?, email?, force? }. We verify the admin's
// Supabase token, find the person (a clients row, or failing that a booking with that email — an address that isn't one of
// our own clients/bookings is refused), then send the same calm rebook email as the automatic job (_rebook.js) and log it:
//   * rebook_nudges  — so the app shows "Emailed" and the weekly nudge count includes it (client_id, or client_email if there's no client row)
//   * rebook_emails  — the automatic job's "already emailed for this session" claim, so it never sends a second one
// Refuses (409 opted_out) anyone with clients.rebook_email_optout = true. Refuses (409 already_sent) a second email for the
// same last session unless force:true (the app asks Halima first). The email carries no health detail. Errors never leak details.
import { sbRequest } from './_supabase.js';
import { sendEmail } from './_email.js';
import { rebookEmail } from './_rebook.js';
import { londonDate } from './_aftercare.js';

const PUBLISHABLE_KEY = 'sb_publishable_PSpC5w-1CWnduinWbjdsfA_VSRx7mSG';   // public by design (ships in /app)
const FROM = 'haloe <halima@haloe.health>';
const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
const q = encodeURIComponent;
const lower = (x) => String(x || '').trim().toLowerCase();

export async function onRequestPost({ request, env }) {
  const auth = request.headers.get('Authorization') || '';
  if (!auth.startsWith('Bearer ')) return json({ error: 'unauthorised' }, 401);
  const base = String(env.SUPABASE_URL || '').replace(/\/$/, '');
  if (!base) return json({ error: 'unavailable' }, 503);
  if (!env.RESEND_API_KEY) return json({ error: 'email_not_configured' }, 503);

  const who = await fetch(`${base}/auth/v1/user`, { headers: { apikey: env.SUPABASE_ANON_KEY || PUBLISHABLE_KEY, Authorization: auth } });
  if (!who.ok) return json({ error: 'unauthorised' }, 401);
  const user = await who.json();
  if (!user || !user.id) return json({ error: 'unauthorised' }, 401);

  let body = {};
  try { body = await request.json(); } catch (e) { return json({ error: 'bad_request' }, 400); }
  const clientId = Number(body.clientId) || null, emailIn = lower(body.email), force = body.force === true;
  if (!clientId && !emailIn) return json({ error: 'bad_request' }, 400);

  try {
    const prof = await sbRequest(env, { path: `/rest/v1/profiles?select=role&id=eq.${q(user.id)}`, method: 'GET' });
    if (!prof || !prof[0] || prof[0].role !== 'admin') return json({ error: 'forbidden' }, 403);

    // who is it?
    let client = null;
    if (clientId) {
      const r = await sbRequest(env, { path: `/rest/v1/clients?select=id,full_name,email,rebook_email_optout&id=eq.${clientId}&limit=1`, method: 'GET' }).catch(() => null)
        || await sbRequest(env, { path: `/rest/v1/clients?select=id,full_name,email&id=eq.${clientId}&limit=1`, method: 'GET' });   // opt-out column not added yet
      client = r && r[0];
    } else {
      const r = await sbRequest(env, { path: `/rest/v1/clients?select=id,full_name,email,rebook_email_optout&email=ilike.${q(emailIn)}&limit=1`, method: 'GET' }).catch(() => []);
      client = r && r[0];
    }
    const email = lower(client ? client.email : emailIn);
    let name = client ? client.full_name : '';
    const bks = email ? await sbRequest(env, { path: `/rest/v1/bookings?select=customer_name,booking_date,status&customer_email=ilike.${q(email)}&order=booking_date.asc`, method: 'GET' }) : [];
    if (!client && !(bks && bks.length)) return json({ error: 'not_found' }, 404);   // never mail an address that isn't one of ours
    if (!email) return json({ error: 'no_email' }, 422);
    if (!name && bks && bks.length) name = bks[bks.length - 1].customer_name;
    if (client && client.rebook_email_optout) return json({ error: 'opted_out' }, 409);

    // the session this email follows (latest confirmed session before today) — also the automatic job's claim key
    const today = londonDate(new Date());
    const past = (bks || []).filter((b) => b.status === 'confirmed' && b.booking_date < today).map((b) => b.booking_date).sort();
    const last = past.length ? past[past.length - 1] : null;
    const key = client ? 'c/' + client.id : 'e/' + email;
    if (last && !force) {
      const done = await sbRequest(env, { path: `/rest/v1/rebook_emails?select=client_key&client_key=eq.${q(key)}&last_session=eq.${last}&limit=1`, method: 'GET' }).catch(() => []);
      if (done && done.length) return json({ error: 'already_sent' }, 409);
    }

    const m = rebookEmail(name);
    await sendEmail(env.RESEND_API_KEY, { from: FROM, to: [email], reply_to: 'halima@haloe.health', subject: m.subject, html: m.html });

    // log it (a logging failure must not make the app think the email didn't go out)
    await sbRequest(env, { path: '/rest/v1/rebook_nudges', method: 'POST', prefer: 'return=minimal', body: [{ client_id: client ? client.id : null, client_email: client ? null : email, sent_by: user.id }] })
      .catch((e) => console.error('rebook-send: nudge log failed:', e));
    if (last) await sbRequest(env, { path: '/rest/v1/rebook_emails?on_conflict=client_key,last_session', method: 'POST', prefer: 'resolution=ignore-duplicates,return=minimal', body: [{ client_key: key, last_session: last }] })
      .catch((e) => console.error('rebook-send: claim failed:', e));
    return json({ ok: true });
  } catch (e) {
    console.error('rebook-send failed:', e);
    return json({ error: 'failed' }, 502);
  }
}
