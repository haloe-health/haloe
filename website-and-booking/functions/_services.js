// Server-side mirror of services-data.js — the browser-side pricing source of
// truth for book.html and hijama-manchester.html. Cloudflare Pages Functions
// run as ES modules and can't import a classic global-scope <script> file, so
// this catalogue is kept in step by hand — same pattern as _clinic.js for the
// Weekly Clinic Day constants. Change a price, treatment name or duration?
// Update services-data.js AND this file together.
//
// `min` is the session length in minutes — what a booking blocks in the
// calendar (parsed from services-data.js's `time`; for a package it is the
// length of ONE session — the first one, which is what gets booked). Since
// Sep 2026 create-checkout.js uses THIS figure for the slot hold, never a
// client-supplied duration.
export const SERVICES = {
  massage: [
    // TEST ONLY — remove before sustained live traffic
    { name: 'Test booking', price: 0.50, min: 45 },
    { name: 'Face Massage', price: 40, min: 45 },
    { name: 'Head Massage', price: 40, min: 45 },
    { name: 'Face & Head Massage', price: 70, min: 60 },
    { name: 'Head & Foot Massage', price: 60, min: 60 },
    { name: 'Back, Neck & Shoulders', price: 75, min: 60 },
    { name: 'Full Body Massage', price: 90, min: 75 },
  ],
  dry: [
    { name: 'Face Cupping', price: 50, min: 45 },
    { name: 'Head Cupping', price: 50, min: 45 },
    { name: 'Face & Head Cupping', price: 85, min: 60 },
    { name: 'Targeted Area / Sports Injury', price: 60, min: 60 },
    { name: 'Full Back', price: 80, min: 60 },
    { name: 'Full Body', price: 100, min: 60 },
    { name: 'Head, Scalp & Full Body', price: 115, min: 75 },
  ],
  wet: [
    { name: 'Head & Scalp', price: 70, min: 60 },
    { name: 'Targeted Area / Sports Injury', price: 80, min: 60 },
    { name: 'Full Back', price: 90, min: 60 },
    { name: 'Full Body', price: 120, min: 90 },
    { name: 'Head, Scalp & Full Body', price: 150, min: 105 },
  ],
  packages: [
    { name: 'Pain & Mobility', price: 340, min: 60 },
    { name: 'Breathe & Reset', price: 340, min: 60 },
    { name: 'Cycle Comfort', price: 340, min: 60 },
    { name: 'Stress & Sleep', price: 480, min: 60 },
    { name: 'Headache & Tension', price: 480, min: 60 },
    { name: 'Digestion & Comfort', price: 480, min: 60 },
    { name: 'Circulation & Energy', price: 600, min: 60 },
    { name: "Women's Cycle Care", price: 600, min: 60 },
  ],
};

// Same as services-data.js — ended Sep 2026, kept at 0 in step with that
// file. HALOE20 (functions/_discounts.js) is the only discount left,
// applied on top of this full price server-side in create-checkout.js.
const PROMO_DISCOUNT = 0;

export function netPrice(svc) {
  // Round at the pence level (see services-data.js for the rationale).
  return Math.round(svc.price * (1 - PROMO_DISCOUNT) * 100) / 100;
}

// Looks a treatment up by its exact display name, scoped to `category` when
// given. Four names are deliberately reused with different prices across dry
// and wet cupping (e.g. "Full Back" is £80 dry, £90 wet) — searching without
// a category silently returns whichever one is defined first in SERVICES
// (dry, since it comes before wet), undercharging every wet booking of a
// shared name. Both callers (create-checkout.js, apply-discount.js) must
// pass the category the client actually picked; when a category is given,
// the search is scoped to it and does NOT fall back to other categories on a
// miss, so a wrong/stale category can't silently resolve to a different
// treatment's price. Category-less lookup (the old behaviour) is kept only
// for callers that genuinely have no category, and callers should migrate
// off it.
export function findService(treatmentName, category) {
  if (category) {
    const list = SERVICES[category];
    if (!list) return null;
    return list.find(s => s.name === treatmentName) || null;
  }
  for (const list of Object.values(SERVICES)) {
    const svc = list.find(s => s.name === treatmentName);
    if (svc) return svc;
  }
  return null;
}
