// Checks that a HALF- code (a single-use, 50%-off "gift" code made by the Codes screen's Half price tile) behaves like every other
// single-use code on the server — with NO redemption or checkout change:   node website-and-booking/tools/test-half-code.mjs
//  * validateDiscountCode accepts it and returns percent 50, type 'gift'; a used one is refused
//  * applyDiscount(…, 50) halves the treatment price
//  * cancelling a booking that used it releases the redemption exactly as it does for a GUEST- (100%) code
import { validateDiscountCode, applyDiscount, releaseRedemptionForCancelledBooking } from '../functions/_discounts.js';
const R = []; const check = (n, c, x) => R.push((c ? 'PASS ' : 'FAIL ') + n + (c ? '' : ' :: ' + JSON.stringify(x)));
console.error = () => {};

const CODES = {
  'HALF-7K3Q': { id: 5, code: 'HALF-7K3Q', type: 'gift', percent_off: 50, max_uses_total: 1, max_uses_per_customer: 1, first_time_only: false, valid_from: null, valid_until: null, period: null, allowed_email: null, active: true },
  'GUEST-ABCD': { id: 6, code: 'GUEST-ABCD', type: 'gift', percent_off: 100, max_uses_total: 1, max_uses_per_customer: 1, first_time_only: false, valid_from: null, valid_until: null, period: null, allowed_email: null, active: true },
};
let REDEMPTIONS, PATCHES;
const reset = () => { REDEMPTIONS = [{ id: 1, code_id: 5, booking_id: 11, status: 'confirmed' }, { id: 2, code_id: 6, booking_id: 12, status: 'confirmed' }]; PATCHES = []; };
reset();
globalThis.fetch = async (url, o = {}) => {
  const u = new URL(String(url)), method = o.method || 'GET', res = (j) => ({ ok: true, status: 200, json: async () => j, text: async () => (j === undefined ? '' : JSON.stringify(j)) });
  if (u.pathname.endsWith('/discount_codes')) {
    const code = u.searchParams.get('code'), id = u.searchParams.get('id');
    if (code) return res([CODES[decodeURIComponent(code).replace(/^eq\./, '')]].filter(Boolean));
    if (id) return res(Object.values(CODES).filter((c) => 'eq.' + c.id === id).map((c) => ({ type: c.type })));
  }
  if (u.pathname.endsWith('/code_redemptions')) {
    if (method === 'GET') {
      const bid = u.searchParams.get('booking_id'), cid = u.searchParams.get('code_id');
      let rows = REDEMPTIONS;
      if (bid) rows = rows.filter((r) => 'eq.' + r.booking_id === bid && r.status === 'confirmed');
      if (cid) rows = rows.filter((r) => 'eq.' + r.code_id === cid && ['reserved', 'confirmed'].includes(r.status));
      return res(rows);
    }
    if (method === 'PATCH') { const id = Number(u.searchParams.get('id').replace('eq.', '')); const r = REDEMPTIONS.find((x) => x.id === id); PATCHES.push([id, JSON.parse(o.body)]); if (r) Object.assign(r, JSON.parse(o.body)); return res(undefined); }
  }
  if (u.pathname.endsWith('/bookings')) return res([]);
  throw new Error('unexpected fetch ' + method + ' ' + url);
};
const env = { SUPABASE_URL: 'https://x.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'k' };
const now = Math.floor(Date.now() / 1000);

reset(); REDEMPTIONS.length = 0;                                                       // nothing used yet
const ok1 = await validateDiscountCode(env, 'HALF-7K3Q', 'a@example.invalid', '', now);
check('an unused HALF- code is accepted: percent 50, type gift', ok1.ok === true && ok1.percent === 50 && ok1.type === 'gift', ok1);
check('it halves the treatment price (£96 → £48, discount £48)', JSON.stringify(applyDiscount(9600, 50)) === JSON.stringify({ finalPence: 4800, discountPence: 4800 }) || (applyDiscount(9600, 50).finalPence === 4800 && applyDiscount(9600, 50).discountPence === 4800), applyDiscount(9600, 50));
check('a 50% price is not zero, so it goes through Stripe (only 100% takes the free path)', applyDiscount(9600, 50).finalPence > 0 && applyDiscount(9600, 100).finalPence === 0, 0);
reset();
const used = await validateDiscountCode(env, 'HALF-7K3Q', 'b@example.invalid', '', now);
check('once it has been used it is refused (single use) — the same rule as GUEST- codes', used.ok === false && used.reason === 'already_used', used);

reset();
await releaseRedemptionForCancelledBooking(env, 11);                                    // a booking that used HALF-7K3Q
check('cancelling a booking that used a HALF- code releases its redemption', REDEMPTIONS.find((r) => r.booking_id === 11).status === 'released' && PATCHES.length === 1, [REDEMPTIONS, PATCHES]);
const after = await validateDiscountCode(env, 'HALF-7K3Q', 'c@example.invalid', '', now);
check('after the release the HALF- code can be used again', after.ok === true, after);
reset();
await releaseRedemptionForCancelledBooking(env, 12);                                    // a booking that used GUEST-ABCD
check('…exactly as it does for a GUEST- code', REDEMPTIONS.find((r) => r.booking_id === 12).status === 'released' && PATCHES.length === 1 && JSON.stringify(PATCHES[0][1]) === '{"status":"released"}', [REDEMPTIONS, PATCHES]);

console.log = (...a) => process.stdout.write(a.join(' ') + '\n');
console.log(R.join('\n'));
console.log(`\n${R.length} checks — ${R.filter((r) => r.startsWith('PASS')).length} passed, ${R.filter((r) => r.startsWith('FAIL')).length} failed`);
process.exit(R.some((r) => r.startsWith('FAIL')) ? 1 : 0);
