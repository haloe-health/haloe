// node website-and-booking/tools/test-rebook.mjs — rebook email: who is picked, who never is, and what the email says.
import assert from 'node:assert/strict';
import { pickRebookTargets, rebookEmail, BOOK_URL } from '../functions/_rebook.js';

const today = '2026-11-10';
const b = (o) => ({ id: Math.random(), client_id: 1, customer_name: 'sophia khan', customer_email: 's@example.com', booking_date: '2026-10-20', status: 'confirmed', is_test: false, ...o });
const pick = (bookings, extra = {}) => pickRebookTargets({ bookings, today, ...extra });

// due: last session 21 days ago, nothing booked
assert.equal(pick([b({})]).length, 1, 'due client is picked');
// boundaries: 14 and 35 days in, 13 and 36 out
assert.equal(pick([b({ booking_date: '2026-10-27' })]).length, 1, '14 days');
assert.equal(pick([b({ booking_date: '2026-10-06' })]).length, 1, '35 days');
assert.equal(pick([b({ booking_date: '2026-10-28' })]).length, 0, '13 days is too soon');
assert.equal(pick([b({ booking_date: '2026-10-05' })]).length, 0, '36 days is past the window');
// already booked ahead (confirmed or awaiting a reschedule reply)
assert.equal(pick([b({}), b({ booking_date: '2026-11-17' })]).length, 0, 'has a future booking');
assert.equal(pick([b({}), b({ booking_date: '2026-11-17', status: 'reschedule_pending' })]).length, 0, 'reschedule pending counts as booked');
// cancelled / pending never count as a session
assert.equal(pick([b({ status: 'cancelled' })]).length, 0, 'cancelled is not a session');
// test, opted out, no email, already emailed, already nudged on WhatsApp
assert.equal(pick([b({ is_test: true })]).length, 0, 'test booking');
assert.equal(pick([b({})], { testIds: new Set([1]) }).length, 0, 'test client');
assert.equal(pick([b({})], { optedOut: new Set([1]) }).length, 0, 'opted out');
assert.equal(pick([b({ customer_email: '' })]).length, 0, 'no email');
assert.equal(pick([b({})], { claimed: new Set(['c/1|2026-10-20']) }).length, 0, 'already emailed for this session');
assert.equal(pick([b({})], { claimed: new Set(['c/1|2026-09-01']) }).length, 1, 'an older claim does not block a newer session');
assert.equal(pick([b({})], { nudges: [{ client_id: 1, sent_at: '2026-11-01T10:00:00Z' }] }).length, 0, 'already messaged on WhatsApp');
assert.equal(pick([b({})], { nudges: [{ client_id: 1, sent_at: '2026-10-01T10:00:00Z' }] }).length, 1, 'a nudge from before the last session does not count');
// allowlist
assert.equal(pick([b({})], { only: new Set(['someone@else.com']) }).length, 0, 'allowlist excludes others');
assert.equal(pick([b({})], { only: new Set(['s@example.com']) }).length, 1, 'allowlist includes listed email');
// one person with two past sessions is one target, using the latest
const two = pick([b({ booking_date: '2026-10-01' }), b({ booking_date: '2026-10-20' })]);
assert.equal(two.length, 1); assert.equal(two[0].last, '2026-10-20');

// the email
const m = rebookEmail('sophia khan');
assert.match(m.html, /Hi Sophia,/); assert.ok(m.html.includes(BOOK_URL)); assert.match(m.html, /no thanks/);
assert.ok(!/OPEN MY AFTERCARE|haloe\.health\/app/.test(m.html), 'no aftercare button leaks in');
assert.ok(!/hijama|cupping|massage|pain|period|cycle|treat|cure|unhurried/i.test(m.html.replace(/HIJAMA &middot; WELLNESS/, '')), 'no treatment or health wording');
assert.equal(rebookEmail('').html.includes('Hello,'), true);
console.log('rebook tests passed');
