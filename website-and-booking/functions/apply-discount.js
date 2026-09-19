// Cloudflare Pages Function — POST /apply-discount
//
// Live-validates a discount code on step 5 of book.html before checkout, so
// the customer sees a real discounted total (and a clear error) rather than
// finding out at the Stripe redirect. This is a preview only — create-checkout.js
// re-validates and recomputes the amount itself at payment time; this endpoint's
// response is never trusted for the actual charge.
import { validateDiscountCode, applyDiscount } from './_discounts.js';
import { findService, netPrice } from './_services.js';

export async function onRequestPost(context) {
  try {
    const { code, email, treatmentName, treatmentCategory } = await context.request.json();

    // Category-scoped — see the comment on findService() (_services.js):
    // four treatment names are reused across dry/wet cupping at different
    // prices, so a category-less lookup can silently price the wrong one.
    const svc = findService(treatmentName, treatmentCategory);
    if (!svc) {
      return new Response(JSON.stringify({ ok: false, error: 'unknown_treatment' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (!context.env.SUPABASE_URL || !context.env.SUPABASE_SERVICE_ROLE_KEY) {
      // Fail closed here (unlike slot reservation): a discount code that
      // can't be verified must never be silently accepted.
      return new Response(JSON.stringify({ ok: false, error: 'unavailable' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const now = Math.floor(Date.now() / 1000);
    const result = await validateDiscountCode(context.env, code, email, now);
    if (!result.ok) {
      return new Response(JSON.stringify({ ok: false, error: result.reason }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const originalAmountPence = netPrice(svc) * 100;
    const { discountPence, finalPence } = applyDiscount(originalAmountPence, result.percent);

    return new Response(JSON.stringify({
      ok: true,
      code: result.code,
      percent: result.percent,
      originalAmountPence,
      discountAmountPence: discountPence,
      finalAmountPence: finalPence,
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('apply-discount error:', err);
    return new Response(JSON.stringify({ ok: false, error: 'server_error' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
