// Shared booking/availability helpers for the Supabase-backed slot
// reservation system. The `_` prefix keeps this file from becoming a route.
//
// One table, public.bookings, lives in Supabase (Postgres), created once via
// supabase-bookings-schema.sql — there's no lazy CREATE TABLE step here, the
// way there was under D1. A row is written the moment a customer starts
// Stripe checkout, with status 'pending' and a hold that expires after
// HOLD_SECONDS. On payment the webhook flips it to 'confirmed'. Abandoned
// checkouts simply expire — the overlap check ignores pending rows whose
// hold has lapsed, so the slot frees itself.
//
// Migrated from Cloudflare D1 in Sep 2026. D1/SQLite serializes all writes,
// so a plain "INSERT...SELECT...WHERE NOT EXISTS" was atomic on its own.
// Postgres has real concurrent writers, so reserveSlot() below calls a
// Postgres function (reserve_slot, in the schema file) via Supabase's RPC
// endpoint instead of running the check and the insert as two separate
// REST calls — the function takes a transaction-scoped advisory lock keyed
// by booking_date, which closes the race a plain check-then-insert would
// reopen.

import { sbRequest } from './_supabase.js';

export const HOLD_SECONDS = 35 * 60; // 35 min — at or above Stripe's 30-min minimum session lifetime

// '6:00 pm' -> 1080 (minutes from midnight). Returns null if unparseable.
export function slotToMinutes(timeStr) {
  const m = /^(\d{1,2}):(\d{2})\s*(am|pm)$/i.exec(String(timeStr).trim());
  if (!m) return null;
  let h = parseInt(m[1], 10);
  const min = parseInt(m[2], 10);
  const pm = m[3].toLowerCase() === 'pm';
  if (h === 12) h = 0;          // 12:xx am -> 0, 12:xx pm -> 12 (after +12 below)
  if (pm) h += 12;
  return h * 60 + min;
}

// A treatment's `time` string ('45 min', '1 hour', '1 hr 45 min') -> minutes.
// Packages ('4 sessions · …') and anything unparseable fall back to 60 min,
// which is enough to block the immediate slot without guessing a session length.
export function durationToMinutes(timeStr) {
  const s = String(timeStr || '');
  const hr = /(\d+)\s*(?:hours?|hrs?|hr)\b/i.exec(s);
  const mn = /(\d+)\s*min/i.exec(s);
  const total = (hr ? parseInt(hr[1], 10) * 60 : 0) + (mn ? parseInt(mn[1], 10) : 0);
  return total > 0 ? total : 60;
}

// Best-effort cleanup of lapsed holds, so the table doesn't accumulate dead
// rows. Safe to skip — every query below already ignores expired pending rows.
export async function purgeExpiredHolds(env, now) {
  try {
    await sbRequest(env, {
      path: `/rest/v1/bookings?status=eq.pending&hold_expires_at=lt.${now}`,
      method: 'DELETE',
      prefer: 'return=minimal',
    });
  } catch (e) {
    console.error('purgeExpiredHolds failed:', e);
  }
}

// Active (blocking) bookings for a date: everything confirmed, plus pending
// holds that haven't lapsed. Returns [{ s: startMin, e: endMin }].
export async function busyIntervals(env, bookingDate, now) {
  const rows = await sbRequest(env, {
    path: `/rest/v1/bookings?select=start_min,end_min&booking_date=eq.${bookingDate}`
      + `&or=(status.eq.confirmed,and(status.eq.pending,hold_expires_at.gt.${now}))`,
    method: 'GET',
  });
  return (rows || []).map(r => ({ s: r.start_min, e: r.end_min }));
}

// Reserve a slot iff it doesn't overlap an active booking, via the
// reserve_slot Postgres function (see the file header for why this can't be
// a plain check-then-insert against Postgres). Returns the new row id, or
// null if the slot was already taken.
export async function reserveSlot(env, b, now) {
  const holdExpires = now + HOLD_SECONDS;
  const result = await sbRequest(env, {
    path: '/rest/v1/rpc/reserve_slot',
    method: 'POST',
    body: {
      p_booking_date: b.bookingDate,
      p_start_min: b.startMin,
      p_end_min: b.endMin,
      p_treatment: b.treatment || null,
      p_customer_name: b.name || null,
      p_customer_email: b.email || null,
      p_customer_phone: b.phone || null,
      p_location: b.location || null,
      p_address: b.address || null,
      p_amount_pence: Number.isFinite(b.amountPence) ? b.amountPence : null,
      p_hold_expires_at: holdExpires,
      p_now: now,
      p_discount_code: b.discountCode || null,
      p_discount_pence: Number.isFinite(b.discountPence) ? b.discountPence : null,
      p_travel_zone: b.travelZone || null,
      p_travel_pence: Number.isFinite(b.travelPence) ? b.travelPence : null,
    },
  });
  return result; // the function returns the new id, or null if the slot was taken
}

// Every active booking (confirmed, plus not-yet-lapsed pending holds), oldest
// first, for the admin calendar. Upcoming/past filtering happens client-side
// in the admin page so the toggle is instant with no re-fetch.
export async function listBookings(env) {
  const now = Math.floor(Date.now() / 1000);
  const rows = await sbRequest(env, {
    path: '/rest/v1/bookings?select=id,booking_date,start_min,end_min,treatment,customer_name,'
      + 'customer_email,customer_phone,location,address,amount_pence,status,hold_expires_at,created_at,'
      + 'discount_code,discount_pence,travel_zone,travel_pence'
      + `&or=(status.eq.confirmed,and(status.eq.pending,hold_expires_at.gt.${now}))`
      + '&order=booking_date.asc,start_min.asc',
    method: 'GET',
  });
  return rows || [];
}

export async function confirmBooking(env, bookingId) {
  await sbRequest(env, {
    path: `/rest/v1/bookings?id=eq.${bookingId}`,
    method: 'PATCH',
    prefer: 'return=minimal',
    body: { status: 'confirmed' },
  });
}

export async function releaseBooking(env, bookingId) {
  await sbRequest(env, {
    path: `/rest/v1/bookings?id=eq.${bookingId}&status=eq.pending`,
    method: 'DELETE',
    prefer: 'return=minimal',
  });
}
