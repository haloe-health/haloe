// node website-and-booking/tools/test-travel.mjs
import assert from 'node:assert/strict';
import { normalisePostcode, haversineMiles, bandForStraightMiles, travelQuote, travelFeeFor, _resetOriginCacheForTests, ROAD_FACTOR } from '../functions/_travel.js';

assert.equal(normalisePostcode('m37fj'), 'M3 7FJ');
assert.equal(normalisePostcode('nope'), null);

// Band edges use ROAD-adjusted miles (straight × ROAD_FACTOR).
const s = m => bandForStraightMiles(m / ROAD_FACTOR);
assert.deepEqual([s(0.5).zone, s(0.5).pence], ['A', 2000]);
assert.equal(s(4).zone, 'A');
assert.deepEqual([s(4.01).zone, s(4.01).pence], ['B', 3500]);
assert.equal(s(8).zone, 'B');
assert.deepEqual([s(8.01).zone, s(8.01).pence], ['C', 5000]);
assert.deepEqual([s(12.01).zone, s(12.01).pence], ['D', 7000]);
assert.deepEqual([s(16).zone, s(16).pence], ['D', 7000]);
assert.deepEqual([s(16.01).zone, s(16.01).pence], ['Q', 0]);
assert.equal(travelFeeFor('Q'), 0);

// ~1 degree of latitude is ~69 miles.
assert.ok(Math.abs(haversineMiles({ lat: 53, lon: -2 }, { lat: 54, lon: -2 }) - 69) < 1);

// Mocked postcodes.io: origin, a near point, a far point, unknown, outage.
const ORIGIN = { latitude: 53.4875, longitude: -2.2600 };
const mock = table => async (_url, opts) => {
  const { postcodes } = JSON.parse(opts.body);
  return { ok: true, json: async () => ({ result: postcodes.map(p => ({ query: p, result: table[p] || null })) }) };
};
const table = {
  'M3 7FJ': ORIGIN,
  'M3 4BQ': { latitude: 53.4795, longitude: -2.2500 },   // Deansgate, ~0.8mi
  'OL1 1AA': { latitude: 53.5400, longitude: -2.1100 },  // Oldham, ~6.6mi straight
  'SK9 1AA': { latitude: 53.3400, longitude: -2.2300 },  // ~10.3mi straight
};
_resetOriginCacheForTests();
let q = await travelQuote('M3 4BQ', mock(table));
assert.deepEqual([q.valid, q.zone, q.pence], [true, 'A', 2000]);
q = await travelQuote('OL1 1AA', mock(table));
assert.equal(q.zone, 'C'); // 6.6 × 1.25 ≈ 8.3 road miles
q = await travelQuote('SK9 1AA', mock(table));
assert.equal(q.zone, 'D'); // ≈ 12.9 road miles
q = await travelQuote('ZZ9 9ZZ', mock(table));
assert.equal(q.valid, false);
// Outage never blocks: quote zone, £0.
_resetOriginCacheForTests();
q = await travelQuote('M3 4BQ', async () => { throw new Error('down'); });
assert.deepEqual([q.valid, q.zone, q.pence, q.lookupFailed], [true, 'Q', 0, true]);
console.log('travel tests passed');
