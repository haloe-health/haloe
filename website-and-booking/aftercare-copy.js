// The aftercare wording — the ONE place it lives.
//
// A plain classic script (no `export`), like clinic-rules.js / services-data.js: the client app loads it with
// <script src="/aftercare-copy.js"> and it defines AFTERCARE_COPY on the global object; the Pages Functions import it for
// its side effect (functions/_aftercare-copy.js) so the Day 1 / Day 7 reminder emails use exactly the same sentences.
// Change the words here and nowhere else.
//
// Two sets, chosen by the treatment that was booked (kindsOf below): HIJAMA (cupping — the original wording) and MASSAGE
// (written and approved by Halima, Oct 2026). Same five steps in both (at = whole days since the session was marked done).
// Symptom language only: no condition names, no cures, no outcome promises.
(function (g) {
  const hijama = {
    intro: 'Marks usually fade within 14 days at most.',
    steps: [
      { at: 0,  label: 'Today',    sub: 'just after',  text: 'Marks look dark or red and the area may feel tender. Keep it clean, dry and covered. No swimming or saunas.' },
      { at: 1,  label: 'Tomorrow', sub: 'settling',    text: 'Some tenderness for a day or two is normal. Keep the area clean and dry for 24 to 48 hours, and keep applying the black seed oil as shown.' },
      { at: 3,  label: 'Day 3',    sub: 'settling',    text: 'Marks soften and change colour. Carry on as before.' },
      { at: 7,  label: 'Day 7',    sub: 'fading',      text: 'Marks are fading. They are not scars and they fade on their own. Nothing to do.' },
      { at: 14, label: 'Day 14',   sub: 'nearly gone', text: 'Marks should be gone or nearly gone.' },
    ],
  };
  const massage = {
    intro: '',
    steps: [
      { at: 0,  label: 'Today',    sub: 'just after',    text: 'Your muscles have been worked, so you may feel relaxed, a little tender or tired. Drink water through the day and keep movement gentle. A warm shower is fine.' },
      { at: 1,  label: 'Tomorrow', sub: 'settling',      text: 'Some tenderness or a heavy feeling in the areas we worked is common. Gentle walking and light stretching can help you feel looser. Avoid hard exercise for 24 hours.' },
      { at: 3,  label: 'Day 3',    sub: 'settling',      text: 'Most people feel lighter and more mobile by now. If any area still feels tight, keep up the water and gentle movement.' },
      { at: 7,  label: 'Day 7',    sub: 'checking in',   text: 'How is your body feeling compared with before your session? Notice any change in tension, sleep or how easily you move.' },
      { at: 14, label: 'Day 14',   sub: 'next session',  text: "Regular sessions help tension stay away. If you'd like to book your next one, you can do it here." },
    ],
    // Shown under every massage step.
    safety: "If anything feels worrying or doesn't settle, message me, or speak to your GP.",
  };

  // Which set(s) a booking uses. Pass the stored treatment label ("A + B" for several treatments) or one treatment name.
  // 'massage' | 'hijama' for a known treatment; packages are a mix, so both. A name that matches nothing returns no kind and
  // the caller falls back to the original hijama wording (the status quo for unknown names) — never a guess in either direction.
  const MASSAGE = ['Face Massage', 'Head Massage', 'Face & Head Massage', 'Head & Foot Massage', 'Back, Neck & Shoulders', 'Full Body Massage'];
  const CUPPING = ['Face Cupping', 'Head Cupping', 'Face & Head Cupping', 'Targeted Area / Sports Injury', 'Full Back', 'Full Body', 'Head, Scalp & Full Body', 'Head & Scalp'];
  const PACKAGES = ['Pain & Mobility', 'Breathe & Reset', 'Cycle Comfort', 'Stress & Sleep', 'Headache & Tension', 'Digestion & Comfort', 'Circulation & Energy', "Women's Cycle Care", "Women's Hormonal Balance"];
  const kindsOf = (label) => {
    const out = [];
    String(label || '').split(' + ').map((x) => x.trim()).filter(Boolean).forEach((n) => {
      const ks = PACKAGES.includes(n) ? ['hijama', 'massage'] : MASSAGE.includes(n) || /massage/i.test(n) ? ['massage'] : CUPPING.includes(n) || /cupping|hijama/i.test(n) ? ['hijama'] : [];
      ks.forEach((k) => { if (!out.includes(k)) out.push(k); });
    });
    return out;
  };

  g.AFTERCARE_COPY = {
    // The hijama set stays at the top level too (older callers: intro, steps).
    intro: hijama.intro,
    steps: hijama.steps,
    sets: { hijama, massage },
    kindsOf,
    // Shown ONCE, under the hijama timeline (not in every stage). Not shown to a massage-only client.
    photoLine: "Send me a photo if a mark worries you, isn't fading as you'd expect, or is still there at day 14.",
    blister: "A small blister can appear on or near a mark and is usually harmless. Don't pop it. Keep it clean and lightly covered, and send me a photo. If redness spreads, pain increases or you feel unwell, contact your GP or NHS 111.",
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
