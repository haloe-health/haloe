// The aftercare wording — the ONE place it lives.
//
// A plain classic script (no `export`), like clinic-rules.js / services-data.js: the client app loads it with
// <script src="/aftercare-copy.js"> and it defines AFTERCARE_COPY on the global object; the Pages Functions import it for
// its side effect (functions/_aftercare-copy.js) so the Day 1 / Day 7 reminder emails use exactly the same sentences.
// Change the words here and nowhere else.
//
// Symptom language only: no condition names, no cures, no outcome promises.
(function (g) {
  g.AFTERCARE_COPY = {
    intro: 'Marks usually fade within 14 days at most.',
    // `at` = whole days since the session was marked done. One short paragraph per stage, no sub-labels.
    steps: [
      { at: 0,  label: 'Today',    sub: 'just after',  text: 'Marks look dark or red and the area may feel tender. Keep it clean, dry and covered. No swimming or saunas.' },
      { at: 1,  label: 'Tomorrow', sub: 'settling',    text: 'Some tenderness for a day or two is normal. Keep the area clean and dry for 24 to 48 hours, and keep applying the black seed oil as shown.' },
      { at: 3,  label: 'Day 3',    sub: 'settling',    text: 'Marks soften and change colour. Carry on as before.' },
      { at: 7,  label: 'Day 7',    sub: 'fading',      text: 'Marks are fading. They are not scars and they fade on their own. Nothing to do.' },
      { at: 14, label: 'Day 14',   sub: 'nearly gone', text: 'Marks should be gone or nearly gone.' },
    ],
    // Shown ONCE, under the timeline (not in every stage).
    photoLine: "Send me a photo if a mark worries you, isn't fading as you'd expect, or is still there at day 14.",
    blister: "A small blister can appear on or near a mark and is usually harmless. Don't pop it. Keep it clean and lightly covered, and send me a photo. If redness spreads, pain increases or you feel unwell, contact your GP or NHS 111.",
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
