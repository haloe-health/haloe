// Cloudflare Pages Function → GET /availability?date=YYYY-MM-DD
//
// Returns the busy intervals for a date so the booking wizard can grey out slots
// that would overlap an existing booking. Read-only; safe to call freely.
//
// Response: { busy: [{ s: startMin, e: endMin }, ...] }
// The client owns the fixed slot list and its treatment durations, so it decides
// which of its slots overlap — this endpoint just reports what's taken.

import { busyIntervals, purgeExpiredHolds } from './_bookings.js';

export async function onRequestGet(context) {
  const url = new URL(context.request.url);
  const date = url.searchParams.get('date') || '';

  // Expect a plain ISO date. Anything else -> empty (fail open: never block booking).
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return json({ busy: [] });
  }

  if (!context.env.SUPABASE_URL || !context.env.SUPABASE_SERVICE_ROLE_KEY) {
    // Not configured — availability is simply unknown; don't block anyone.
    return json({ busy: [] });
  }

  try {
    const now = Math.floor(Date.now() / 1000);
    await purgeExpiredHolds(context.env, now);
    const busy = await busyIntervals(context.env, date, now);
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
