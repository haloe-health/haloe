// Shared travel-fee logic for home-visit (mobile) bookings — distance-based,
// per the haloe brand document (18 Oct 2026): the fee is set in bands by
// miles from Halima's start point. Clinic Day bookings never get a travel
// fee (fixed venue). The `_` prefix keeps this file from becoming a route.
//
// Mirrored in book.html only as DISPLAY text (the browser asks /travel-quote
// for the real figure, so the bands live in exactly one place — here).

// Where Halima travels from. Only a postcode is stored; its coordinates are
// looked up at runtime so no exact location sits in the code.
export const TRAVEL_ORIGIN_POSTCODE = 'M3 7FJ';

// Straight-line distance understates a taxi journey, so it is scaled up
// before the bands are applied. Change this one number to tune it.
export const ROAD_FACTOR = 1.25;

// Bands by (adjusted) miles. `zone` is the code stored on the booking.
// Beyond the last band there is no fixed fee: zone 'Q', £0 online, and
// Halima quotes by WhatsApp before the session.
export const TRAVEL_BANDS = [
  { zone: 'A', maxMiles: 4,  pence: 2000, label: 'Up to 4 miles' },
  { zone: 'B', maxMiles: 8,  pence: 3500, label: '4–8 miles' },
  { zone: 'C', maxMiles: 12, pence: 5000, label: '8–12 miles' },
  { zone: 'D', maxMiles: 16, pence: 7000, label: '12–16 miles' },
];
export const TRAVEL_QUOTE_ZONE = 'Q';
export const TRAVEL_MIN_PENCE = TRAVEL_BANDS[0].pence;

const EARTH_RADIUS_MILES = 3958.8;

// Same tolerance as the old zone parser: "M37FJ" and "m3 7fj" both pass.
export function normalisePostcode(raw) {
  const cleaned = String(raw || '').toUpperCase().replace(/\s+/g, '');
  if (cleaned.length < 5 || cleaned.length > 7) return null;
  if (!/^[A-Z]{1,2}\d[A-Z\d]?\d[A-Z]{2}$/.test(cleaned)) return null;
  return cleaned.slice(0, -3) + ' ' + cleaned.slice(-3);
}

export function haversineMiles(a, b) {
  const rad = d => d * Math.PI / 180;
  const dLat = rad(b.lat - a.lat), dLon = rad(b.lon - a.lon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_MILES * Math.asin(Math.sqrt(h));
}

// Band for a straight-line distance (the road factor is applied here).
// Returns { zone, pence, miles } — zone 'Q' / pence 0 beyond the last band.
export function bandForStraightMiles(straightMiles) {
  const miles = straightMiles * ROAD_FACTOR;
  const band = TRAVEL_BANDS.find(b => miles <= b.maxMiles);
  return band
    ? { zone: band.zone, pence: band.pence, miles }
    : { zone: TRAVEL_QUOTE_ZONE, pence: 0, miles };
}

export function travelFeeFor(zone) {
  const band = TRAVEL_BANDS.find(b => b.zone === zone);
  return band ? band.pence : 0;
}

export function travelLabelFor(zone) {
  const band = TRAVEL_BANDS.find(b => b.zone === zone);
  return band ? band.label : 'By quote';
}

// postcodes.io: free, no key. Bulk lookup so origin + customer is one call.
// Returns { [normalised postcode]: {lat, lon} | null } or null if the
// service itself couldn't be reached.
async function lookup(postcodes, fetchImpl = fetch) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 5000);
  try {
    const res = await fetchImpl('https://api.postcodes.io/postcodes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ postcodes }),
      signal: ctl.signal,
    });
    if (!res.ok) return null;
    const data = await res.json();
    const out = {};
    postcodes.forEach((p, i) => {
      const r = data.result && data.result[i] && data.result[i].result;
      out[p] = r && typeof r.latitude === 'number' ? { lat: r.latitude, lon: r.longitude } : null;
    });
    return out;
  } catch (_) {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

let originCache = null; // survives within a warm Worker instance

// Full quote for a customer postcode.
//   { valid:false }                         — not a real/known postcode
//   { valid:true, zone, pence, miles }      — priced band, or zone 'Q'
//   { valid:true, zone:'Q', pence:0, miles:null, lookupFailed:true }
//     — the lookup service was unreachable: never block a paying customer;
//       Halima confirms travel by WhatsApp, same as an out-of-range postcode.
export async function travelQuote(postcode, fetchImpl = fetch) {
  const pc = normalisePostcode(postcode);
  if (!pc) return { valid: false };
  const need = originCache ? [pc] : [TRAVEL_ORIGIN_POSTCODE, pc];
  const found = await lookup(need, fetchImpl);
  if (!found) return { valid: true, zone: TRAVEL_QUOTE_ZONE, pence: 0, miles: null, lookupFailed: true };
  if (!originCache && found[TRAVEL_ORIGIN_POSTCODE]) originCache = found[TRAVEL_ORIGIN_POSTCODE];
  const dest = found[pc];
  if (!dest) return { valid: false };
  if (!originCache) return { valid: true, zone: TRAVEL_QUOTE_ZONE, pence: 0, miles: null, lookupFailed: true };
  const q = bandForStraightMiles(haversineMiles(originCache, dest));
  return { valid: true, ...q };
}

export function _resetOriginCacheForTests() { originCache = null; }
