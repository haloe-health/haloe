// node tools/test-slots.js
// Tests for the dynamic slot generation logic in functions/_slots.js.
// Plain-node, no test framework needed.

import { generateSlots, startGrid, groupSlots } from '../functions/_slots.js';

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

// Summary
console.log(`\n${pass + fail} tests — ${pass} passed, ${fail} failed${fail ? ' ← FIX BEFORE SHIPPING' : ''}\n`);
if (fail) process.exit(1);
