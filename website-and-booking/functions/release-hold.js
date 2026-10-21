// POST /release-hold { ref } — called by book.html when the customer comes back
// from Stripe Checkout without paying (Stripe's cancel_url carries ?release=).
// Frees the pending slot hold and any reserved discount code immediately. The
// ref is signed in create-checkout.js, so it can't be forged. Only 'pending'
// bookings and 'reserved' redemptions move, so a paid booking is never touched.
// Always answers { ok: true } — a failure here only means the hold lapses by itself.
import { parseHoldRef, releaseBooking } from './_bookings.js';
import { releaseDiscountReservation } from './_discounts.js';

export async function onRequestPost(context) {
  try {
    const { ref } = await context.request.json();
    const parsed = await parseHoldRef(context.env, ref);
    if (parsed) {
      await releaseBooking(context.env, parsed.bookingId);
      if (parsed.redemptionId) await releaseDiscountReservation(context.env, parsed.redemptionId);
    }
  } catch (e) {
    console.error('release-hold failed:', e);
  }
  return new Response(JSON.stringify({ ok: true }), {
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}
