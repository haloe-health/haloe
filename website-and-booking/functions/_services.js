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

// Mirrors book.html's hidden ?test=1 £1 treatment (SERVICES.massage.unshift
// in book.html) so the live Stripe test flow still prices correctly once the
// amount is validated server-side. Remove alongside that block when testing
// is done.
export const TEST_SERVICE = { name: 'TEST — £1 (do not book)', price: 1 };

// One-off £1 LIVE-mode test booking — mirrors book.html's SERVICES.__livetest
// (reachable only via ?treatment=test1, not shown in the picker). Remove
// alongside that block, and its handling in applyDeepLink(), once live
// testing is done.
export const LIVE_TEST_SERVICE = { name: 'Test booking (£1)', price: 1 };

// Same 20% promotional discount as services-data.js — keep PROMO_DISCOUNT in
// step with that file. Dry, wet and package prices are already whole pounds
// after the cut; Math.round is belt-and-braces for any future price that isn't.
const PROMO_DISCOUNT = 0.20;

export function netPrice(svc) {
  return Math.round(svc.price * (1 - PROMO_DISCOUNT));
}

// Looks a treatment up by its exact display name across every category —
// the only input the client sends that identifies price. Returns null for an
// unrecognised name rather than guessing.
export function findService(treatmentName) {
  if (treatmentName === TEST_SERVICE.name) return TEST_SERVICE;
  if (treatmentName === LIVE_TEST_SERVICE.name) return LIVE_TEST_SERVICE;
  for (const list of Object.values(SERVICES)) {
    const svc = list.find(s => s.name === treatmentName);
    if (svc) return svc;
  }
  return null;
}
