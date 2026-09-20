// Cloudflare Pages Function → GET /availability?date=YYYY-MM-DD&location=clinic|mobile&duration=60
//
// Returns the bookable start times for a date, generated dynamically from the
// opening hours in _slots.js minus anything that would overlap an existing
// booking (given the treatment's duration), plus the next date that has at
// least one free slot. Read-only; safe to call freely.
//
// Response: {
//   slots: [570, 600, …],          // start minutes from midnight, ascending
//   busy:  [{ s, e }, …],          // active bookings that day (for the client's own re-check)
//   next:  'YYYY-MM-DD' | null     // next date AFTER `date` with ≥1 free slot (within lookahead)
// }
//
// Fail-open: if Supabase isn't configured or the lookup errors, the busy list
// is treated as empty so a lookup fault never blocks booking. The hours table
// itself is static config, so closed days still return no slots.

import { busyIntervalsRange, purgeExpiredHolds } from './_bookings.js';
import { generateSlots, weekdayOfISO, londonNow, addDaysISO, NEXT_AVAILABLE_LOOKAHEAD_DAYS } from './_slots.js';

export async function onRequestGet(context) {
  const url = new URL(context.request.url);
  const date = url.searchParams.get('date') || '';
  const location = url.searchParams.get('location') === 'clinic' ? 'clinic' : 'mobile';
  const duration = Number(url.searchParams.get('duration')) > 0 ? Number(url.searchParams.get('duration')) : 60;

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return json({ slots: [], busy: [], next: null });
  }

  const hasSupabase = Boolean(context.env.SUPABASE_URL && context.env.SUPABASE_SERVICE_ROLE_KEY);
  const now = Math.floor(Date.now() / 1000);
  const { todayISO, nowMin } = londonNow();

  let busy = [];
  let busyByDate = {};
  if (hasSupabase) {
    try {
      await purgeExpiredHolds(context.env, now);
      const rangeEnd = addDaysISO(date, NEXT_AVAILABLE_LOOKAHEAD_DAYS);
      busyByDate = await busyIntervalsRange(context.env, date, rangeEnd, now);
      busy = busyByDate[date] || [];
    } catch (err) {
      console.error('availability error:', err);
      busy = [];
      busyByDate = {};
    }
  }

  const slotsFor = (iso) => generateSlots({
    location,
    weekday: weekdayOfISO(iso),
    durationMin: duration,
    busy: busyByDate[iso] || [],
    nowMin: iso === todayISO ? nowMin : null,
  });

  const slots = slotsFor(date);

  // Next date after `date` with at least one free start (same venue, same
  // duration). Past dates are never offered.
  let next = null;
  for (let i = 1; i <= NEXT_AVAILABLE_LOOKAHEAD_DAYS; i++) {
    const iso = addDaysISO(date, i);
    if (iso < todayISO) continue;
    if (slotsFor(iso).length > 0) { next = iso; break; }
  }

  return json({ slots, busy, next });
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}
