// The Milton Hall arrival wording — the ONE place it lives.
//
// A plain classic script (no `export`), like aftercare-copy.js / clinic-rules.js: booking-confirmed.html loads it with
// <script src="/venue-copy.js"> and it defines VENUE_COPY on the global object; the Pages Functions import it for its side
// effect (functions/_venue-copy.js) so the confirmation email says exactly the same facts. Both texts are built from the
// same few facts below, so the address and the concierge can never drift apart. The room and floor are deliberately NOT
// given (brand document: the room number is never given in public — a client gives her name and asks for haloe).
// Change a fact here and nowhere else. Home visits never use any of this.
(function (g) {
  const f = { name: 'Milton Hall', street: '244 Deansgate', concierge: 'Musa' };
  g.VENUE_COPY = {
    facts: f,
    // "You're booked" page, step 2 "On the day" (clinic bookings only) — the short version.
    arrivalShort: `${f.name}, ${f.street}. Give your name to ${f.concierge} at the concierge desk and ask for haloe — he'll point you the way. Lift access is available.`,
    // Booking confirmation email, "Getting there" (clinic bookings only) — the full version.
    arrivalEmail: `${f.name} is at ${f.street}. When you arrive, ${f.concierge} at the concierge desk will be expecting you — just give your name and ask for haloe, and he'll point you the way. Take the lift, or if you'd rather, the wide baroque staircase is worth the climb. Please arrive five minutes early. The room sits behind a key-coded door, so if it's closed, take a seat and Halima will come and collect you.`,
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
