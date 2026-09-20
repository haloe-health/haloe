// POST /admin/cancel  { id }  — cancel a booking from the admin calendar.
// Gated by functions/admin/_middleware.js (Basic Auth), same as the page.
//
// Flips the row to status 'cancelled', which frees the time immediately —
// the availability queries only count confirmed rows and live holds. This
// does NOT refund anything; Halima refunds in the Stripe dashboard.

import { cancelBooking } from '../_bookings.js';

export async function onRequestPost(context) {
  if (!context.env.SUPABASE_URL || !context.env.SUPABASE_SERVICE_ROLE_KEY) {
    return json({ error: 'Supabase not configured' }, 500);
  }
  let id;
  try {
    ({ id } = await context.request.json());
  } catch (e) {
    return json({ error: 'bad_request' }, 400);
  }
  if (!Number.isInteger(Number(id)) || Number(id) <= 0) return json({ error: 'bad_request' }, 400);

  try {
    const found = await cancelBooking(context.env, Number(id));
    if (!found) return json({ error: 'not_found' }, 404);
    return json({ ok: true });
  } catch (err) {
    console.error('admin/cancel failed:', err);
    return json({ error: 'Failed to cancel booking' }, 500);
  }
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}
