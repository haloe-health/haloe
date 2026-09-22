// Shared discount-code validation — used by both apply-discount.js (the
// live "Apply" check on step 5) and create-checkout.js (which re-validates
// from scratch at payment time; a code accepted a minute earlier could have
// expired, been deactivated, or just been redeemed by the same email in a
// second tab — for codes that are single-use). The `_` prefix keeps this
// file from becoming a route.
//
// Codes live in Supabase's discount_codes table (supabase-discounts-schema.sql)
// rather than being hardcoded here, so Halima can add more later — a SQL
// insert, no deploy — the same reasoning as the bookings table itself.

import { sbRequest } from './_supabase.js';

// Looks up `rawCode` (case-insensitive — upper-cased before lookup, and
// codes are always stored upper-cased) and checks it against `email`.
// Returns { ok:true, code, percent } or { ok:false, reason }, where reason
// is one of: missing_code, missing_email, invalid_code, expired, already_used.
export async function validateDiscountCode(env, rawCode, email, now) {
  const code = String(rawCode || '').trim().toUpperCase();
  if (!code) return { ok: false, reason: 'missing_code' };

  const rows = await sbRequest(env, {
    path: `/rest/v1/discount_codes?code=eq.${encodeURIComponent(code)}&select=code,percent,expires_at,single_use_per_email,active&limit=1`,
    method: 'GET',
  });
  const row = (rows || [])[0];
  if (!row || !row.active) return { ok: false, reason: 'invalid_code' };
  if (row.expires_at && now > row.expires_at) return { ok: false, reason: 'expired' };

  // Per-code switch, OFF for HALOE20 (see supabase-discounts-schema.sql): the
  // launch offer is "20% off all treatments", so it applies to every booking a
  // customer makes while it runs, not just their first. The branch stays for
  // any future code that does want one redemption per person.
  if (row.single_use_per_email) {
    const normalizedEmail = String(email || '').trim().toLowerCase();
    if (!normalizedEmail) return { ok: false, reason: 'missing_email' };

    // One redemption per customer email — checked against completed
    // (paid) bookings only. A pending hold that lapsed was never a real
    // booking, so it shouldn't block a genuine retry.
    const used = await sbRequest(env, {
      path: `/rest/v1/bookings?select=id&status=eq.confirmed&discount_code=eq.${encodeURIComponent(row.code)}`
        + `&customer_email=ilike.${encodeURIComponent(normalizedEmail)}&limit=1`,
      method: 'GET',
    });
    if (used && used.length > 0) return { ok: false, reason: 'already_used' };
  }

  return { ok: true, code: row.code, percent: row.percent };
}

// Applies a validated percent-off to an amount already in pence, rounding to
// the nearest penny.
export function applyDiscount(amountPence, percent) {
  const discountPence = Math.round(amountPence * (percent / 100));
  return { discountPence, finalPence: amountPence - discountPence };
}
