// node website-and-booking/tools/test-rebook-send.mjs — /rebook-send with a faked Supabase + Resend (no network).
import assert from 'node:assert/strict';
import { onRequestPost } from '../functions/rebook-send.js';

let db, calls;
const resp = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
globalThis.fetch = async (url, init = {}) => {
  url = String(url); const method = (init.method || 'GET').toUpperCase(); calls.push({ url, method, body: init.body });
  if (url.includes('/auth/v1/user')) return db.user ? resp({ id: 'u1' }) : resp({}, 401);
  if (url.includes('api.resend.com')) return resp({ id: 'e1' });
  if (url.includes('/rest/v1/profiles')) return resp([{ role: db.role }]);
  if (url.includes('/rest/v1/clients')) return resp(db.clients);
  if (url.includes('/rest/v1/bookings')) return resp(db.bookings);
  if (url.includes('/rest/v1/rebook_emails') && method === 'GET') return resp(db.claims);
  return resp([]);   // inserts
};
const env = { SUPABASE_URL: 'https://x.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'k', RESEND_API_KEY: 'r' };
const send = (body, headers = { Authorization: 'Bearer t' }) => onRequestPost({ env, request: new Request('https://haloe.health/rebook-send', { method: 'POST', headers, body: JSON.stringify(body) }) });
const fresh = (o = {}) => { calls = []; db = { user: true, role: 'admin', clients: [{ id: 7, full_name: 'sophia khan', email: 's@example.com', rebook_email_optout: false }], bookings: [{ customer_name: 'sophia khan', booking_date: '2020-01-01', status: 'confirmed' }], claims: [], ...o }; };
const emailed = () => calls.some((c) => c.url.includes('api.resend.com'));

fresh(); assert.equal((await send({ clientId: 7 }, {})).status, 401, 'no token');
fresh({ user: false }); assert.equal((await send({ clientId: 7 })).status, 401, 'bad token');
fresh({ role: 'client' }); let r = await send({ clientId: 7 }); assert.equal(r.status, 403, 'a client cannot use it'); assert.ok(!emailed());
fresh(); r = await send({}); assert.equal(r.status, 400, 'needs someone');
fresh({ clients: [], bookings: [] }); r = await send({ email: 'stranger@example.com' }); assert.equal(r.status, 404, 'unknown address refused'); assert.ok(!emailed());
fresh({ clients: [{ id: 7, full_name: 'sophia', email: 's@example.com', rebook_email_optout: true }] }); r = await send({ clientId: 7 }); assert.equal(r.status, 409); assert.equal((await r.json()).error, 'opted_out'); assert.ok(!emailed());
fresh({ claims: [{ client_key: 'c/7' }] }); r = await send({ clientId: 7 }); assert.equal(r.status, 409); assert.equal((await r.json()).error, 'already_sent'); assert.ok(!emailed());
fresh({ claims: [{ client_key: 'c/7' }] }); r = await send({ clientId: 7, force: true }); assert.equal(r.status, 200, 'force sends again'); assert.ok(emailed());
// normal send: emails the client's address, logs the nudge and the claim
fresh(); r = await send({ clientId: 7 }); assert.equal(r.status, 200);
const mail = JSON.parse(calls.find((c) => c.url.includes('api.resend.com')).body);
assert.deepEqual(mail.to, ['s@example.com']); assert.equal(mail.reply_to, 'halima@haloe.health'); assert.match(mail.html, /Hi Sophia,/);
assert.ok(calls.some((c) => c.url.includes('/rest/v1/rebook_nudges') && c.method === 'POST' && JSON.parse(c.body)[0].client_id === 7), 'nudge logged');
assert.ok(calls.some((c) => c.url.includes('/rest/v1/rebook_emails') && c.method === 'POST'), 'claim written so the automatic job skips them');
// booking-only person (no clients row) is allowed, logged by email
fresh({ clients: [] }); r = await send({ email: 'S@Example.com' }); assert.equal(r.status, 200);
assert.ok(calls.some((c) => c.url.includes('/rest/v1/rebook_nudges') && JSON.parse(c.body)[0].client_email === 's@example.com'));
console.log('rebook-send tests passed');
