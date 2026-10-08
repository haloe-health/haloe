// Milton Hall lock-up rule — the ONE place to change it.
//
// The clinic (Tuesdays) locks up at CLOSING_TIME and the key isn't held by Halima, so every Milton Hall session must be
// completely finished — treatment plus a tidy-up — before then. A session is valid only if
//
//      start + treatment duration + TIDY_UP_MIN  <=  closing time
//
// Home visits are unaffected (this applies to the Milton Hall clinic only).
//
// This file is a plain classic script (no `export`), like services-data.js: browsers load it with
// <script src="clinic-rules.js"> (book.html, the haloe app) and it defines  CLINIC_RULES  on the global object.
// The Pages Functions import it for its side effect (functions/_clinic.js) and read the same global — so book.html, the
// availability API, checkout and the admin app can never disagree. Change the two numbers below and nowhere else.
(function (g) {
  var RULES = {
    CLOSING_TIME: '21:00',   // lock-up
    TIDY_UP_MIN: 15,         // tidy-up buffer after every Milton Hall session
  };
  RULES.closingMin = (function (t) { var p = String(t).split(':'); return (+p[0]) * 60 + (+p[1]); })(RULES.CLOSING_TIME);

  /** Minutes-from-midnight at which Halima is fully out: start + treatment + tidy-up. */
  RULES.finishMin = function (startMin, durationMin) { return startMin + durationMin + RULES.TIDY_UP_MIN; };
  /** True if a Milton Hall session starting at startMin (minutes) with this real treatment length finishes by closing. */
  RULES.fits = function (startMin, durationMin) { return RULES.finishMin(startMin, durationMin) <= RULES.closingMin; };
  /** The latest start (minutes) that still fits for this treatment length. */
  RULES.latestStart = function (durationMin) { return RULES.closingMin - RULES.TIDY_UP_MIN - durationMin; };

  g.CLINIC_RULES = RULES;
})(typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : this));
