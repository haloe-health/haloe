// Aftercare sets (hijama + massage) and the Day 1 / Day 7 reminder emails:   node website-and-booking/tools/test-aftercare-sets.mjs
//  * the massage wording is exactly what Halima approved, five steps, safety line,
//  * the treatment chooses the set, and a massage booking NEVER gets hijama wording in an email,
//  * the reminder emails still go out for hijama bookings with the original wording.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const R = []; const check = (n, c, x) => R.push((c ? 'PASS ' : 'FAIL ') + n + (c ? '' : ' :: ' + JSON.stringify(x)));
const log = console.log; console.error = () => {}; console.log = () => {};
const { AFTERCARE_COPY: C } = await import('../functions/_aftercare-copy.js');
const { reminderEmail } = await import('../functions/_aftercare.js');
const MASSAGE = [
  'Your muscles have been worked, so you may feel relaxed, a little tender or tired. Drink water through the day and keep movement gentle. A warm shower is fine.',
  'Some tenderness or a heavy feeling in the areas we worked is common. Gentle walking and light stretching can help you feel looser. Avoid hard exercise for 24 hours.',
  'Most people feel lighter and more mobile by now. If any area still feels tight, keep up the water and gentle movement.',
  'How is your body feeling compared with before your session? Notice any change in tension, sleep or how easily you move.',
  "Regular sessions help tension stay away. If you'd like to book your next one, you can do it here.",
];
const SAFE = "If anything feels worrying or doesn't settle, message me, or speak to your GP.";
const m = C.sets.massage;
check('massage set: five steps at 0, 1, 3, 7, 14 labelled Today / Tomorrow / Day 3 / Day 7 / Day 14', m.steps.map((s) => s.at).join() === '0,1,3,7,14' && m.steps.map((s) => s.label).join() === 'Today,Tomorrow,Day 3,Day 7,Day 14', m.steps);
check('massage wording is exactly the approved text', m.steps.every((s, i) => s.text === MASSAGE[i]), m.steps.map((s) => s.text));
check('massage safety line is exactly the approved text', m.safety === SAFE, m.safety);
check('hijama steps use the same five days as massage', C.sets.hijama.steps.map((s) => s.at).join() === m.steps.map((s) => s.at).join(), 0);
check('original hijama wording unchanged (top-level steps = hijama set)', C.steps === C.sets.hijama.steps && C.steps[0].text.startsWith('Marks look dark or red'), 0);

const html = (t, day) => reminderEmail('Sophia Test', day, t).html;
const decode = (h) => h.replace(/&#39;|&#x27;/g, "'").replace(/&amp;/g, '&');
for (const day of [1, 7]) {
  const step = m.steps.find((s) => s.at === day).text;
  const mh = decode(html('30 minute massage', day));
  check(`Day ${day} email for a massage booking carries the massage step and the safety line`, mh.includes(step) && mh.includes(SAFE), 0);
  check(`Day ${day} email for a massage booking has NO hijama wording (marks, black seed oil, photo line)`, !C.sets.hijama.steps.some((s) => mh.includes(s.text)) && !mh.includes(C.photoLine) && !/black seed oil/i.test(mh), 0);
  const hh = decode(html('Full Back', day));
  const hstep = C.sets.hijama.steps.find((s) => s.at === day).text;
  check(`Day ${day} email for a hijama booking is unchanged: hijama step + photo line, no massage text`, hh.includes(hstep) && hh.includes(C.photoLine) && !hh.includes(step), 0);
  const uh = decode(reminderEmail('Sophia', day).html);
  check(`Day ${day} email with no treatment (older callers / unknown name) keeps the original wording`, uh.includes(hstep) && uh.includes(C.photoLine), 0);
  const bh = decode(html('Face Massage + Face Cupping', day));
  check(`Day ${day} email for a mixed booking carries both steps`, bh.includes(step) && bh.includes(hstep), 0);
}
check('subject lines unchanged', reminderEmail('x', 1, 'Face Massage').subject === 'Your aftercare note · day 1' && reminderEmail('x', 7, 'Face Massage').subject === 'Your aftercare note · day 7', 0);

log; console.log = log;
for (const l of R) console.log(l);
const bad = R.filter((l) => l.startsWith('FAIL')).length;
console.log(`\n${R.length} checks — ${R.length - bad} passed, ${bad} failed`);
process.exit(bad ? 1 : 0);
