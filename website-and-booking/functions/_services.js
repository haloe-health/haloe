// Server-side mirror of services-data.js — the browser-side pricing source of
// truth for book.html and hijama-manchester.html. Cloudflare Pages Functions
// run as ES modules and can't import a classic global-scope <script> file, so
// this catalogue is kept in step by hand — same pattern as _clinic.js for the
// Weekly Clinic Day constants. Change a price or treatment name? Update
// services-data.js AND this file together.
export const SERVICES = {
  massage: [
    { name: 'Face Massage', price: 40 },
    { name: 'Head Massage', price: 40 },
    { name: 'Face & Head Massage', price: 70 },
    { name: 'Head & Foot Massage', price: 60 },
    { name: 'Back, Neck & Shoulders', price: 75 },
    { name: 'Full Body Massage', price: 90 },
  ],
  dry: [
    { name: 'Face Cupping', price: 50 },
    { name: 'Head Cupping', price: 50 },
    { name: 'Face & Head Cupping', price: 85 },
    { name: 'Targeted Area / Sports Injury', price: 60 },
    { name: 'Full Back', price: 80 },
    { name: 'Full Body', price: 100 },
    { name: 'Head, Scalp & Full Body', price: 115 },
  ],
  wet: [
    { name: 'Head & Scalp', price: 70 },
    { name: 'Targeted Area / Sports Injury', price: 80 },
    { name: 'Full Back', price: 90 },
    { name: 'Full Body', price: 120 },
    { name: 'Head, Scalp & Full Body', price: 150 },
  ],
  packages: [
    { name: 'Pain & Mobility', price: 340 },
    { name: 'Breathe & Immunity', price: 340 },
    { name: 'Cycle Comfort', price: 340 },
    { name: 'Stress & Sleep', price: 480 },
    { name: 'Headache & Tension', price: 480 },
    { name: 'Digestion & Detox', price: 480 },
    { name: 'Circulation & Energy', price: 600 },
    { name: "Women's Hormonal Balance", price: 600 },
  ],
};

// Same as services-data.js — ended Sep 2026, kept at 0 in step with that
// file. HALOE20 (functions/_discounts.js) is the only discount left,
// applied on top of this full price server-side in create-checkout.js.
const PROMO_DISCOUNT = 0;

export function netPrice(svc) {
  return Math.round(svc.price * (1 - PROMO_DISCOUNT));
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
