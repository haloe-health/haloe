// GET /admin/bookings — JSON data for the admin calendar. Gated by
// functions/admin/_middleware.js (Basic Auth), same as the page itself.

import { ensureBookingsTable, listBookings } from '../_bookings.js';

export async function onRequestGet(context) {
  const db = context.env.DB;
  if (!db) {
    return new Response(JSON.stringify({ error: 'DB not bound' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    await ensureBookingsTable(db);
    const rows = await listBookings(db);
    return new Response(JSON.stringify({ bookings: rows }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
    });
  } catch (err) {
    console.error('admin/bookings failed:', err);
    return new Response(JSON.stringify({ error: 'Failed to load bookings' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
