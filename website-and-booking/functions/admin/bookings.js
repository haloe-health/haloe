// GET /admin/bookings — JSON data for the admin calendar. Gated by
// functions/admin/_middleware.js (Basic Auth), same as the page itself.

import { listBookings } from '../_bookings.js';

export async function onRequestGet(context) {
  if (!context.env.SUPABASE_URL || !context.env.SUPABASE_SERVICE_ROLE_KEY) {
    return new Response(JSON.stringify({ error: 'Supabase not configured' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const rows = await listBookings(context.env);
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
