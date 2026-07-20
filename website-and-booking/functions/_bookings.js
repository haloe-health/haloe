// Shared booking/availability helpers for the D1-backed slot reservation system.
// The `_` prefix keeps this file from becoming a route.
//
// One table, `bookings`, lives in the existing D1 database (`haloe-clients`, bound
// as DB). A row is written the moment a customer starts Stripe checkout, with
// status 'pending' and a hold that expires after HOLD_SECONDS. On payment the
// webhook flips it to 'confirmed'. Abandoned checkouts simply expire — the overlap
// check ignores pending rows whose hold has lapsed, so the slot frees itself.

export const HOLD_SECONDS = 35 * 60; // 35 min — at or above Stripe's 30-min minimum session lifetime

// Created lazily so there is no separate migration step to run against D1.
// CREATE TABLE IF NOT EXISTS is cheap and idempotent.
export async function ensureBookingsTable(db) {
  await db.batch([
    db.prepare(`CREATE TABLE IF NOT EXISTS bookings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      booking_date TEXT NOT NULL,
      start_min INTEGER NOT NULL,
      end_min INTEGER NOT NULL,
      treatment TEXT,
      customer_name TEXT,
      customer_email TEXT,
      customer_phone TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      stripe_session_id TEXT,
      hold_expires_at INTEGER,
      created_at INTEGER NOT NULL
    )`),
    db.prepare('CREATE INDEX IF NOT EXISTS idx_bookings_date ON bookings (booking_date)'),
  ]);
}

// '6:00 pm' -> 1080 (minutes from midnight). Returns null if unparseable.
export function slotToMinutes(timeStr) {
  const m = /^(\d{1,2}):(\d{2})\s*(am|pm)$/i.exec(String(timeStr).trim());
  if (!m) return null;
  let h = parseInt(m[1], 10);
  const min = parseInt(m[2], 10);
  const pm = m[3].toLowerCase() === 'pm';
  if (h === 12) h = 0;          // 12:xx am -> 0, 12:xx pm -> 12 (after +12 below)
  if (pm) h += 12;
  return h * 60 + min;
}

// A treatment's `time` string ('45 min', '1 hour', '1 hr 45 min') -> minutes.
// Packages ('4 sessions · …') and anything unparseable fall back to 60 min,
// which is enough to block the immediate slot without guessing a session length.
export function durationToMinutes(timeStr) {
  const s = String(timeStr || '');
  const hr = /(\d+)\s*(?:hours?|hrs?|hr)\b/i.exec(s);
  const mn = /(\d+)\s*min/i.exec(s);
  const total = (hr ? parseInt(hr[1], 10) * 60 : 0) + (mn ? parseInt(mn[1], 10) : 0);
  return total > 0 ? total : 60;
}

// Best-effort cleanup of lapsed holds, so the table doesn't accumulate dead rows.
// Safe to skip — the overlap query already ignores expired pending rows.
export async function purgeExpiredHolds(db, now) {
  try {
    await db
      .prepare(`DELETE FROM bookings WHERE status = 'pending' AND hold_expires_at < ?`)
      .bind(now)
      .run();
  } catch (e) {
    console.error('purgeExpiredHolds failed:', e);
  }
}

// Active (blocking) bookings for a date: everything confirmed, plus pending holds
// that haven't lapsed. Returns [{ s: startMin, e: endMin }].
export async function busyIntervals(db, bookingDate, now) {
  const { results } = await db
    .prepare(
      `SELECT start_min AS s, end_min AS e FROM bookings
       WHERE booking_date = ?
         AND (status = 'confirmed' OR (status = 'pending' AND hold_expires_at > ?))`
    )
    .bind(bookingDate, now)
    .all();
  return results || [];
}

// Atomically reserve a slot iff it doesn't overlap an active booking. The
// INSERT…SELECT…WHERE NOT EXISTS is evaluated as a single serialized write in
// D1/SQLite, so two racing requests can't both succeed. Returns the new row id,
// or null if the slot was already taken.
export async function reserveSlot(db, b, now) {
  const holdExpires = now + HOLD_SECONDS;
  const res = await db
    .prepare(
      `INSERT INTO bookings
         (booking_date, start_min, end_min, treatment, customer_name, customer_email, customer_phone, status, hold_expires_at, created_at)
       SELECT ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?
       WHERE NOT EXISTS (
         SELECT 1 FROM bookings x
         WHERE x.booking_date = ?
           AND x.start_min < ?
           AND x.end_min > ?
           AND (x.status = 'confirmed' OR (x.status = 'pending' AND x.hold_expires_at > ?))
       )`
    )
    .bind(
      b.bookingDate, b.startMin, b.endMin, b.treatment || null,
      b.name || null, b.email || null, b.phone || null,
      holdExpires, now,
      b.bookingDate, b.endMin, b.startMin, now
    )
    .run();

  if (!res.meta || res.meta.changes !== 1) return null; // lost the race — slot taken
  return res.meta.last_row_id;
}

export async function confirmBooking(db, bookingId) {
  await db
    .prepare(`UPDATE bookings SET status = 'confirmed' WHERE id = ?`)
    .bind(bookingId)
    .run();
}

export async function releaseBooking(db, bookingId) {
  await db
    .prepare(`DELETE FROM bookings WHERE id = ? AND status = 'pending'`)
    .bind(bookingId)
    .run();
}
