// node tools/test-slots.js
// Tests for the dynamic slot generation logic in functions/_slots.js.
// Plain-node, no test framework needed.

import { generateSlots, startGrid, groupSlots } from '../functions/_slots.js';
import { resolveCart, formatDuration } from '../functions/_services.js';
import { applyDiscount } from '../functions/_discounts.js';

let pass = 0, fail = 0;
function ok(label, expr) {
  if (expr) { pass++; console.log(`  ✓  ${label}`); }
  else       { fail++; console.error(`  ✗  FAIL: ${label}`); }
}
function eq(label, a, b) {
  if (JSON.stringify(a) === JSON.stringify(b)) { pass++; console.log(`  ✓  ${label}`); }
  else { fail++; console.error(`  ✗  FAIL: ${label}\n       got:  ${JSON.stringify(a)}\n       want: ${JSON.stringify(b)}`); }
}

// ── Clinic grid: 9:30–19:30 every 30 min ──────────────────────────────────
const CLINIC_DAY = 2; // Tuesday
const MOBILE_DAY = 4; // Thursday

console.log('\nClinic grid (empty Tuesday)');
const clinicGrid = startGrid('clinic', CLINIC_DAY);
// 9:30 = 570 min, 19:30 = 1170 min, step 30 → (1170-570)/30 + 1 = 21 slots
eq('count 21', clinicGrid.length, 21);
eq('first 9:30 (570)', clinicGrid[0], 570);
eq('last 19:30 (1170)', clinicGrid[clinicGrid.length - 1], 1170);

console.log('\nSlot availability — empty Tuesday, any duration');
const slotsEmpty = generateSlots({ location: 'clinic', weekday: CLINIC_DAY, durationMin: 60 });
eq('21 slots when empty', slotsEmpty.length, 21);
ok('9:30 offered', slotsEmpty.includes(570));
ok('19:30 offered (last-start rule)', slotsEmpty.includes(1170));

console.log('\nWith 10:00–11:00 booked (600–660), 1 h treatment');
const busy1 = [{ s: 600, e: 660 }]; // 10:00–11:00
const slots1 = generateSlots({ location: 'clinic', weekday: CLINIC_DAY, durationMin: 60, busy: busy1 });
// 9:30 → end 10:30 → overlaps busy 600–660? 570+60=630 > 600 → yes, removed
// 10:00 → end 11:00 → overlaps exactly → yes, removed
// 10:30 → end 11:30 → start 630 < 660 → yes, removed
// 11:00 → end 12:00 → start 660 not < 660 → FREE
ok('9:30 removed (end overlaps busy)', !slots1.includes(570));
ok('10:00 removed (starts in busy)', !slots1.includes(600));
ok('10:30 removed (overlaps busy end)', !slots1.includes(630));
ok('11:00 available', slots1.includes(660));
ok('19:30 still available', slots1.includes(1170));
eq('18 slots remain', slots1.length, 18);

console.log('\nWith same 10:00–11:00 booked, 1 h 30 treatment');
const slots2 = generateSlots({ location: 'clinic', weekday: CLINIC_DAY, durationMin: 90, busy: busy1 });
// 9:30 → end 11:00 → overlaps 600–660? 570+90=660 > 600 → yes, removed
// 10:00 → 600+90=690 > 600 → removed
// 10:30 → 630+90=720 > 600 → removed
// 11:00 → 660+90=750, does NOT overlap (660 < 660 is false) → FREE
ok('9:30 removed (1h30)', !slots2.includes(570));
ok('10:00 removed (1h30)', !slots2.includes(600));
ok('10:30 removed (1h30)', !slots2.includes(630));
ok('11:00 available (1h30)', slots2.includes(660));
ok('19:30 still available (1h30)', slots2.includes(1170));
eq('18 slots remain (1h30)', slots2.length, 18);

console.log('\nSame-day minimum notice');
// Pretend nowMin = 570 (09:30); notice = 120 min → cutoff 690 (11:30)
// Slots 570–690 should be hidden
const slotsNotice = generateSlots({ location: 'clinic', weekday: CLINIC_DAY, durationMin: 60, nowMin: 570 });
ok('9:30 hidden (within notice)', !slotsNotice.includes(570));
ok('11:00 hidden (within notice)', !slotsNotice.includes(660));
ok('11:30 shown (exactly at cutoff)', slotsNotice.includes(690));
ok('19:30 still offered', slotsNotice.includes(1170));

console.log('\nClosed day');
const sunGrid = startGrid('clinic', 0); // clinic is closed on Sundays
eq('clinic closed on Sunday', sunGrid.length, 0);
const sunSlots = generateSlots({ location: 'clinic', weekday: 0, durationMin: 60 });
eq('no slots on closed day', sunSlots.length, 0);

console.log('\nMobile grid (Thursday)');
const mobGrid = startGrid('mobile', MOBILE_DAY);
// 10:00 = 600, 20:00 = 1200, (1200-600)/30+1 = 21 slots
eq('mobile: 21 slots', mobGrid.length, 21);
eq('mobile: first 10:00 (600)', mobGrid[0], 600);
eq('mobile: last 20:00 (1200)', mobGrid[mobGrid.length - 1], 1200);

console.log('\nGrouping');
const { morning, afternoon, evening } = groupSlots([570, 690, 780, 840, 900, 1020, 1170]);
// 570=9:30 (morning), 690=11:30, 780=13:00 (afternoon), ...
eq('morning contains 9:30 and 11:30', morning, [570, 690]);
// 1020 = 17:00 → t >= 17*60 is true → evening bucket
eq('afternoon contains 13:00–16:30', afternoon, [780, 840, 900]);
eq('evening contains 17:00 and 19:30', evening, [1020, 1170]);

// ── Verification output for Tue 6 Oct (empty) ─────────────────────────────
console.log('\nVerification: Tue 6 Oct — empty, any duration (21 slots)');
const tue6Oct = generateSlots({ location: 'clinic', weekday: 2, durationMin: 60 });
console.log('  ' + tue6Oct.map(m => {
  const h24 = Math.floor(m/60), mm = String(m%60).padStart(2,'0');
  const p = h24 >= 12 ? 'pm' : 'am';
  let h12 = h24 % 12; if (!h12) h12 = 12;
  return `${h12}:${mm} ${p}`;
}).join('  '));
eq('21 slots', tue6Oct.length, 21);

// With 10:00 Full Back booked (60 min) → 9:30, 10:00, 10:30 removed (18 slots)
console.log('\nVerification: Tue 6 Oct — 10:00 Full Back (60 min) booked');
const withFullBack = generateSlots({ location: 'clinic', weekday: 2, durationMin: 60, busy: [{ s: 600, e: 660 }] });
console.log('  ' + withFullBack.map(m => {
  const h24 = Math.floor(m/60), mm = String(m%60).padStart(2,'0');
  const p = h24 >= 12 ? 'pm' : 'am';
  let h12 = h24 % 12; if (!h12) h12 = 12;
  return `${h12}:${mm} ${p}`;
}).join('  '));
eq('18 slots after 1h booking', withFullBack.length, 18);
ok('First available is 11:00', withFullBack[0] === 660);

// ── Multi-treatment bookings ──────────────────────────────────────────────
console.log('\nMulti-treatment: resolveCart');
const two = resolveCart([{ name: 'Face Massage', category: 'massage' }, { name: 'Head Massage', category: 'massage' }]);
ok('two treatments resolve', two.ok);
eq('combined price £80 (8000p)', two.totalPence, 8000);
eq('combined duration 90 min', two.totalMin, 90);
eq('duration label', formatDuration(two.totalMin), '1 hr 30 min');

const wetTwo = resolveCart([{ name: 'Full Back', category: 'wet' }, { name: 'Head & Scalp', category: 'wet' }]);
eq('wet pair priced per category (£90 + £70 = 16000p)', wetTwo.totalPence, 16000);
eq('wet pair 120 min', wetTwo.totalMin, 120);
const crossCat = resolveCart([{ name: 'Full Back', category: 'dry' }, { name: 'Full Back', category: 'wet' }]);
eq('same name in dry + wet are two distinct treatments (£80 + £90)', crossCat.totalPence, 17000);

const single = resolveCart([{ name: 'Full Back', category: 'wet' }]);
eq('single treatment unchanged: £90, 60 min', [single.totalPence, single.totalMin], [9000, 60]);
eq('duplicate is collapsed', resolveCart([{ name: 'Face Massage', category: 'massage' }, { name: 'Face Massage', category: 'massage' }]).items.length, 1);
eq('unknown treatment rejected', resolveCart([{ name: 'Nope', category: 'massage' }]).error, 'unknown_treatment');
eq('wrong category rejected (no fallback)', resolveCart([{ name: 'Face Massage', category: 'wet' }]).error, 'unknown_treatment');
eq('empty cart rejected', resolveCart([]).error, 'no_treatments');
eq('package cannot be combined', resolveCart([{ name: 'Cycle Comfort', category: 'packages' }, { name: 'Face Massage', category: 'massage' }]).error, 'package_not_combinable');
ok('a package alone is fine', resolveCart([{ name: 'Cycle Comfort', category: 'packages' }]).ok);

console.log('\nMulti-treatment: HALOE20 on the combined total');
const d = applyDiscount(two.totalPence, 20);
eq('20% off £80 = £16 off, £64 to pay', [d.discountPence, d.finalPence], [1600, 6400]);

console.log('\nMulti-treatment: slots fit the COMBINED duration (Face + Head Massage = 90 min)');
// 10:00–11:00 booked (600–660)
const slotsTwo = generateSlots({ location: 'clinic', weekday: CLINIC_DAY, durationMin: two.totalMin, busy: busy1 });
ok('9:30 removed (would run to 11:00, into the booking)', !slotsTwo.includes(570));
ok('11:00 offered (starts as the booking ends)', slotsTwo.includes(660));
// 11:00–12:00 booked: a lone 45 min treatment fits at 10:00 (ends 10:45); the pair (90 min) does not
const busy11 = [{ s: 660, e: 720 }];
ok('a lone 45 min treatment fits at 10:00', generateSlots({ location: 'clinic', weekday: CLINIC_DAY, durationMin: 45, busy: busy11 }).includes(600));
ok('the 90 min pair does NOT fit at 10:00', !generateSlots({ location: 'clinic', weekday: CLINIC_DAY, durationMin: two.totalMin, busy: busy11 }).includes(600));
ok('the 90 min pair fits at 9:30 (ends 11:00 exactly)', generateSlots({ location: 'clinic', weekday: CLINIC_DAY, durationMin: two.totalMin, busy: busy11 }).includes(570));
// 12:00–12:30 booked: a 90 min session can't start 10:30–12:00, but 45 min can start 11:00 → 11:45
const busyNoon = [{ s: 720, e: 750 }];
const s90 = generateSlots({ location: 'mobile', weekday: MOBILE_DAY, durationMin: 90, busy: busyNoon });
const s45 = generateSlots({ location: 'mobile', weekday: MOBILE_DAY, durationMin: 45, busy: busyNoon });
ok('mobile: 90 min cannot start 11:00 (runs into 12:00 booking)', !s90.includes(660));
ok('mobile: 45 min can start 11:00', s45.includes(660));
ok('mobile: 90 min can start 12:30', s90.includes(750));
ok('mobile: last start 20:00 still offered (no closing rule)', s90.includes(1200));
ok('mobile: 10:30 offered for 90 min (ends 12:00 exactly)', s90.includes(630));

// Summary
console.log(`\n${pass + fail} tests — ${pass} passed, ${fail} failed${fail ? ' ← FIX BEFORE SHIPPING' : ''}\n`);
if (fail) process.exit(1);
