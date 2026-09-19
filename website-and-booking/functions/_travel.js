// Shared travel-fee logic for home-visit (mobile) bookings — zone-based on
// the postcode the customer enters. Clinic Day bookings never get a travel
// fee (fixed venue, no travel). The `_` prefix keeps this file from
// becoming a route.
//
// Mirrored in book.html (browser JS can't import this module) — same
// reasoning as _clinic.js/_services.js duplicating their constants there.
// Keep the two in step if the zones or fees ever change.

export const TRAVEL_ZONE_A_PENCE = 1500; // £15 — Oldham & nearby
export const TRAVEL_ZONE_B_PENCE = 3500; // £35 — rest of Greater Manchester
// Zone C has no fixed fee — allowed, but the amount is confirmed by Halima
// over WhatsApp before the session, and the booking is flagged in /admin.

// OL postcodes with a district number of 16 or below.
const ZONE_A_OL_MAX_DISTRICT = 16;
// Specific M districts closer to Oldham than the rest of the M area.
const ZONE_A_M_DISTRICTS = new Set([9, 24, 35, 40, 43]);
// Every other M/SK/BL/WN/WA postcode is Zone B.
const ZONE_B_AREAS = new Set(['M', 'SK', 'BL', 'WN', 'WA']);

// Splits a UK postcode into its outward code's area letters and district
// number, tolerant of missing/extra whitespace and lower case. The inward
// code (last 3 characters: one digit + two letters) is fixed-length, so
// slicing from the right recovers the outward code even without a space —
// "OL97QE" and "OL9 7QE" both parse to { area:'OL', district:9 }.
// Returns null if the string isn't a plausible UK postcode.
export function parseOutwardCode(raw) {
  const cleaned = String(raw || '').toUpperCase().replace(/\s+/g, '');
  if (cleaned.length < 5 || cleaned.length > 7) return null;
  const inward = cleaned.slice(-3);
  const outward = cleaned.slice(0, -3);
  if (!/^[0-9][A-Z]{2}$/.test(inward)) return null;
  const m = /^([A-Z]{1,2})(\d{1,2})[A-Z]?$/.exec(outward);
  if (!m) return null;
  return { area: m[1], district: parseInt(m[2], 10) };
}

// 'A' | 'B' | 'C', or null if the postcode can't be parsed at all.
export function travelZoneFor(postcode) {
  const parsed = parseOutwardCode(postcode);
  if (!parsed) return null;
  const { area, district } = parsed;
  if (area === 'OL' && district >= 1 && district <= ZONE_A_OL_MAX_DISTRICT) return 'A';
  if (area === 'M' && ZONE_A_M_DISTRICTS.has(district)) return 'A';
  if (ZONE_B_AREAS.has(area)) return 'B';
  return 'C';
}

// Pence to charge online for a zone. Zone C (and an unrecognised/null zone)
// charges nothing online — Halima confirms the real cost by WhatsApp.
export function travelFeeFor(zone) {
  if (zone === 'A') return TRAVEL_ZONE_A_PENCE;
  if (zone === 'B') return TRAVEL_ZONE_B_PENCE;
  return 0;
}
