// Shared treatment catalogue + live pricing — the single source of truth for
// book.html and hijama-manchester.html, so the two price lists can't silently
// diverge from each other. Loaded via <script src="services-data.js">, since
// this site has no build step or module system; it defines SERVICES,
// PROMO_DISCOUNT and netPrice() as plain globals.
//
// `sessionMin` on a package is the length of ONE session (the first, which
// is what the calendar books). Single treatments get theirs parsed from
// `time`. functions/_services.js mirrors both as `min` — keep in step.
//
// index.html's booking widget keeps its own separate HB_SERVICES /
// HB_PROMO_DISCOUNT copy (see CLAUDE.md) — it predates this file and has its
// own quirks (badges, no desc on non-package items), so it wasn't folded in.
//
// The hidden £1 "Test Booking" treatment (book.html?treatment=test, for
// testing live Stripe payments cheaply) is deliberately NOT defined here —
// this file drives every public treatment list, and it must never appear in
// one. It lives only in book.html (injected at runtime, only behind that
// query param) and functions/_services.js (server-side pricing).
const SERVICES = {
  massage: [
{ name: 'Face Massage', time: '45 min', price: 40, desc: 'Gentle facial massage to relax and refresh.' },
    { name: 'Head Massage', time: '45 min', price: 40, desc: 'Soothing scalp and head massage to help you unwind.' },
    { name: 'Face & Head Massage', time: '1 hour', price: 70, desc: 'Face and scalp together, for deeper calm.' },
    { name: 'Head & Foot Massage', time: '1 hour', price: 60, desc: 'Head and feet, for head-to-toe ease.' },
    { name: 'Back, Neck & Shoulders', time: '1 hour', price: 75, desc: 'Eases everyday tension where you hold it most.' },
    { name: 'Full Body Massage', time: '1 hr 15 min', price: 90, desc: 'A slow, head-to-toe reset for tired muscles.' },
  ],
  dry: [
    { name: 'Face Cupping', time: '45 min', price: 50, desc: 'Gentle suction to lift and refresh the skin.' },
    { name: 'Head Cupping', time: '45 min', price: 50, desc: 'Light cupping across the scalp to help you unwind.' },
    { name: 'Face & Head Cupping', time: '1 hour', price: 85, desc: 'Face and scalp together, for a fuller reset.' },
    { name: 'Targeted Area / Sports Injury', time: '1 hour', price: 60, desc: 'Focused suction on tight, overworked muscles.' },
    { name: 'Full Back', time: '1 hour', price: 80, desc: 'Full-back cupping to release built-up tension.' },
    { name: 'Full Body', time: '1 hour', price: 100, desc: 'Whole-body cupping for all-over release.' },
    { name: 'Head, Scalp & Full Body', time: '1 hr 15 min', price: 115, desc: 'Scalp to sole — the complete dry-cupping session.' },
  ],
  wet: [
    { name: 'Head & Scalp', time: '1 hour', price: 70, desc: 'Traditional hijama (wet cupping) focused on the head and scalp.' },
    { name: 'Targeted Area / Sports Injury', time: '1 hour', price: 80, desc: 'Hijama, or wet cupping, on a specific area of tension.' },
    { name: 'Full Back', time: '1 hour', price: 90, desc: 'Full-back hijama (wet cupping), the most-requested session.' },
    { name: 'Full Body', time: '1 hr 30 min', price: 120, desc: 'Whole-body hijama, or wet cupping, for an all-over reset.' },
    { name: 'Head, Scalp & Full Body', time: '1 hr 45 min', price: 150, desc: 'The complete hijama (wet cupping) session, head to toe.' },
  ],
  packages: [
    { name: 'Pain & Mobility',     time: '4 sessions of 1 hr 15 min · over 8–12 wks', pkgMeta: '4 sessions · over 8–12 wks',  pkgDur: '1 hr 15 min', price: 340, sessionMin: 75, desc: 'Targeted cupping on areas of tension and restricted movement, over four sessions.' },
    { name: 'Breathe & Reset',     time: '4 sessions of 1 hr 15 min · over 16 wks',   pkgMeta: '4 sessions · over 16 wks',   pkgDur: '1 hr 15 min', price: 340, sessionMin: 75, desc: 'Four sessions on the chest, upper back and shoulders, spaced over the season.' },
    { name: 'Cycle Comfort',       time: '4 sessions of 1 hr 15 min · over ~3 cycles', pkgMeta: '4 sessions · over ~3 cycles', pkgDur: '1 hr 15 min', price: 340, sessionMin: 75, desc: 'Four sessions timed around your cycle — one per month, roughly three cycles.' },
    { name: 'Stress & Sleep',      time: '6 sessions of 1 hr 15 min · over 24 wks',   pkgMeta: '6 sessions · over 24 wks',   pkgDur: '1 hr 15 min', price: 480, sessionMin: 75, desc: 'Six evening-friendly sessions focused on the neck, shoulders and upper back.' },
    { name: 'Headache & Tension',  time: '6 sessions of 1 hr 15 min · over 14 wks',   pkgMeta: '6 sessions · over 14 wks',   pkgDur: '1 hr 15 min', price: 480, sessionMin: 75, desc: 'Six sessions across the head, neck and shoulders.' },
    { name: 'Digestion & Comfort', time: '6 sessions of 1 hr 15 min · over 24 wks',   pkgMeta: '6 sessions · over 24 wks',   pkgDur: '1 hr 15 min', price: 480, sessionMin: 75, desc: 'Six sessions focused on the abdomen and lower back.' },
    { name: 'Circulation & Energy',time: '8 sessions of 1 hr 15 min · over 18 wks',   pkgMeta: '8 sessions · over 18 wks',   pkgDur: '1 hr 15 min', price: 600, sessionMin: 75, desc: 'Eight full-body sessions over eighteen weeks.' },
    { name: "Women's Cycle Care",  time: '8 sessions of 1 hr 15 min · over 16 wks',   pkgMeta: '8 sessions · over 16 wks',   pkgDur: '1 hr 15 min', price: 600, sessionMin: 75, desc: "Eight sessions across the cycle — our most complete women's course." },
  ],
};

/* ---- Promotional discount ----
   Ended Sep 2026 — PROMO_DISCOUNT is 0, so netPrice() now just returns
   svc.price (the full list price) and every strikethrough disappears on its
   own. HALOE20 (see functions/_discounts.js) is the only discount left,
   applied on top of this full price rather than stacking with a promo.
   netPrice() is still the amount actually displayed and charged — nothing
   should read svc.price directly for money, in case a promo returns later. */
const PROMO_DISCOUNT = 0;

function netPrice(svc) {
  // Round at the pence level so sub-£1 prices (e.g. the 50p test treatment)
  // are preserved. For whole-pound prices (40, 75, …) the result is identical.
  return Math.round(svc.price * (1 - PROMO_DISCOUNT) * 100) / 100;
}
