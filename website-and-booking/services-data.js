// Shared treatment catalogue + live pricing — the single source of truth for
// book.html and hijama-manchester.html, so the two price lists can't silently
// diverge from each other. Loaded via <script src="services-data.js">, since
// this site has no build step or module system; it defines SERVICES,
// PROMO_DISCOUNT and netPrice() as plain globals.
//
// index.html's booking widget keeps its own separate HB_SERVICES /
// HB_PROMO_DISCOUNT copy (see CLAUDE.md) — it predates this file and has its
// own quirks (badges, no desc on non-package items), so it wasn't folded in.
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
    { name: 'Head & Scalp', time: '1 hour', price: 70, desc: 'Traditional hijama focused on the head and scalp.' },
    { name: 'Targeted Area / Sports Injury', time: '1 hour', price: 80, desc: 'Hijama on a specific area of tension.' },
    { name: 'Full Back', time: '1 hour', price: 90, desc: 'Full-back hijama, the most-requested session.' },
    { name: 'Full Body', time: '1 hr 30 min', price: 120, desc: 'Whole-body hijama for an all-over reset.' },
    { name: 'Head, Scalp & Full Body', time: '1 hr 45 min', price: 150, desc: 'The complete hijama session, head to toe.' },
  ],
  packages: [
    { name: 'Pain & Mobility', time: '4 sessions · 8–12 wks', price: 340, desc: 'Targeted cupping to support ease of movement and tension relief.' },
    { name: 'Breathe & Immunity', time: '4 sessions · 16 wks', price: 340, desc: 'Supports respiratory wellness and immune resilience.' },
    { name: 'Cycle Comfort', time: '4 sessions · ~3 cycles', price: 340, desc: 'Focused on menstrual comfort and hormonal balance.' },
    { name: 'Stress & Sleep', time: '6 sessions · 24 wks', price: 480, desc: 'Designed to ease tension and support restful sleep patterns.' },
    { name: 'Headache & Tension', time: '6 sessions · 14 wks', price: 480, desc: 'Head, neck and shoulder focus for tension headache relief.' },
    { name: 'Digestion & Detox', time: '6 sessions · 24 wks', price: 480, desc: 'Supporting digestive comfort and overall wellbeing.' },
    { name: 'Circulation & Energy', time: '8 sessions · 18 wks', price: 600, desc: 'Full circulation support for vitality and energy levels.' },
    { name: "Women's Hormonal Balance", time: '8 sessions · 16 wks', price: 600, desc: 'Comprehensive hormonal wellness support across the cycle.' },
  ],
};

/* ---- Promotional discount ----
   Every entry in SERVICES keeps its FULL price, so it can be shown struck
   through. netPrice() is the amount actually displayed and charged — nothing
   should read svc.price directly for money.

   To end the promotion, set PROMO_DISCOUNT to 0. The strikethroughs disappear
   and full prices are charged again; no other line needs touching.

   Every price is a multiple of 5, so a 20% cut lands on a whole pound in each
   case (£75 -> £60, £115 -> £92, £340 -> £272). Math.round is belt-and-braces
   for any future price that isn't. */
const PROMO_DISCOUNT = 0.20;

function netPrice(svc) {
  return Math.round(svc.price * (1 - PROMO_DISCOUNT));
}
