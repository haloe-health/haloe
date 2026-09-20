// Dynamic start-time generation ("Calendly-style") — the single source of
// truth for opening hours and slot logic on the server. book.html carries a
// hand-kept copy of the HOURS table and generateSlots() (browser JS can't
// import this module — same pattern as _clinic.js / _services.js / _travel.js).
// Change the hours here AND in book.html's HOURS block together.
//
// Rules:
//   • Start times every SLOT_STEP_MIN from `first` to `last` inclusive.
//     The last start is bookable for ANY duration — there is no
//     "must finish by closing" rule.
//   • A start is offered only if [start, start + duration) doesn't overlap
//     an existing active booking that day. No prep/clean-up buffers.
//   • Same-day starts need at least MIN_NOTICE_MIN of notice.

// ---- Editable config -------------------------------------------------- //
// Per venue, per weekday (0 = Sunday … 6 = Saturday). `null` = closed.
// Times are 'HH:MM' 24-hour. Halima: edit these two tables (and the copy in
// book.html) to change opening hours.
export const HOURS = {
  clinic: {
    0: null,
    1: null,
    2: { first: '09:30', last: '19:30' }, // Tuesday — Milton Hall, Deansgate
    3: null,
    4: null,
    5: null,
    6: null,
  },
  mobile: {
    0: null,                              // Sunday — closed
    1: { first: '10:00', last: '20:00' },
    2: { first: '10:00', last: '20:00' },
    3: { first: '10:00', last: '20:00' },
    4: { first: '10:00', last: '20:00' },
    5: { first: '10:00', last: '20:00' },
    6: { first: '10:00', last: '20:00' },
  },
};

export const SLOT_STEP_MIN = 30;
export const MIN_NOTICE_MIN = 120;       // same-day bookings need 2 h notice

// How far ahead "next available date" searches before giving up.
export const NEXT_AVAILABLE_LOOKAHEAD_DAYS = 90;
// ------------------------------------------------------------------------ //

export function hhmmToMinutes(hhmm) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(hhmm || '').trim());
  if (!m) return null;
  return parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
}

// 570 -> '9:30 am' (the display format the rest of the booking flow uses).
export function minutesToLabel(min) {
  const h24 = Math.floor(min / 60);
  const mm = String(min % 60).padStart(2, '0');
  const period = h24 >= 12 ? 'pm' : 'am';
  let h12 = h24 % 12; if (h12 === 0) h12 = 12;
  return `${h12}:${mm} ${period}`;
}

// Weekday (0–6) of an ISO date string, without timezone drift.
export function weekdayOfISO(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

export function hoursFor(location, weekday) {
  const table = HOURS[location === 'clinic' ? 'clinic' : 'mobile'];
  return (table && table[weekday]) || null;
}

// The full start-time grid for a venue/weekday, in minutes from midnight.
// Empty when closed.
export function startGrid(location, weekday) {
  const h = hoursFor(location, weekday);
  if (!h) return [];
  const first = hhmmToMinutes(h.first);
  const last = hhmmToMinutes(h.last);
  if (first === null || last === null || last < first) return [];
  const out = [];
  for (let t = first; t <= last; t += SLOT_STEP_MIN) out.push(t);
  return out;
}

// Available start times (minutes) for one day.
//   location    'clinic' | 'mobile'
//   weekday     0–6
//   durationMin treatment length
//   busy        [{ s, e }] active bookings that day (minutes)
//   nowMin      minutes-from-midnight of "now" IF the day is today, else null.
//               Starts at or before nowMin + MIN_NOTICE_MIN are hidden.
export function generateSlots({ location, weekday, durationMin, busy = [], nowMin = null, minNoticeMin = MIN_NOTICE_MIN }) {
  const dur = Number(durationMin) > 0 ? Number(durationMin) : 60;
  return startGrid(location, weekday).filter((start) => {
    if (nowMin !== null && start < nowMin + minNoticeMin) return false;
    const end = start + dur;
    return !busy.some((b) => start < b.e && end > b.s);
  });
}

// Group a list of start minutes into the three UI buckets.
export function groupSlots(starts) {
  const groups = { morning: [], afternoon: [], evening: [] };
  starts.forEach((t) => {
    if (t < 12 * 60) groups.morning.push(t);
    else if (t < 17 * 60) groups.afternoon.push(t);
    else groups.evening.push(t);
  });
  return groups;
}

// "Now" in the business's timezone (Europe/London), as today's ISO date and
// minutes from midnight — Workers run in UTC, and BST would otherwise shift
// the same-day minimum-notice cut-off by an hour.
export function londonNow(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/London', hour12: false,
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
  }).formatToParts(date).reduce((o, p) => { o[p.type] = p.value; return o; }, {});
  const hour = parseInt(parts.hour, 10) % 24; // some engines print 24 for midnight
  return {
    todayISO: `${parts.year}-${parts.month}-${parts.day}`,
    nowMin: hour * 60 + parseInt(parts.minute, 10),
  };
}

export function addDaysISO(iso, days) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

// Server-side guard for create-checkout.js: is this start time one the
// wizard could legitimately have offered? Checks the grid and the same-day
// minimum notice only — overlap with other bookings is decided atomically by
// reserve_slot in Postgres, not here.
export function isOfferableStart({ location, dateISO, startMin, now = londonNow() }) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateISO || '')) return false;
  if (dateISO < now.todayISO) return false;
  if (!startGrid(location, weekdayOfISO(dateISO)).includes(startMin)) return false;
  if (dateISO === now.todayISO && startMin < now.nowMin + MIN_NOTICE_MIN) return false;
  return true;
}
