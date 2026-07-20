// Cloudflare Pages Function → GET /availability?date=YYYY-MM-DD
//
// Returns the busy intervals for a date so the booking wizard can grey out slots
// that would overlap an existing booking. Read-only; safe to call freely.
//
// Response: { busy: [{ s: startMin, e: endMin }, ...] }
// The client owns the fixed slot list and its treatment durations, so it decides
// which of its slots overlap — this endpoint just reports what's taken.

import { ensureBookingsTable, busyIntervals, purgeExpiredHolds } from './_bookings.js';

export async function onRequestGet(context) {
  const url = new URL(context.request.url);
  const date = url.searchParams.get('date') || '';

  // Expect a plain ISO date. Anything else -> empty (fail open: never block booking).
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return json({ busy: [] });
  }

  const db = context.env.DB;
  if (!db) {
    // No database bound — availability is simply unknown; don't block anyone.
    return json({ busy: [] });
  }

  try {
    await ensureBookingsTable(db);
    const now = Math.floor(Date.now() / 1000);
    await purgeExpiredHolds(db, now);
    const busy = await busyIntervals(db, date, now);
    return json({ busy });
  } catch (err) {
    console.error('availability error:', err);
    // Fail open: a lookup error must never stop someone booking.
    return json({ busy: [] });
  }
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}
