// GET /admin — the booking calendar. Gated by functions/admin/_middleware.js
// (Basic Auth); this Function only ever runs for an already-authenticated
// request. Inline CSS/JS, same hand-written-per-page convention as the rest
// of the site — this page just happens to be served from a Function instead
// of a static file, since it needs the auth middleware in front of it.
//
// Light theme (Sep 2026) — brand tokens mirror index.html's :root custom
// properties, and the list is one card per booking (mobile-first) instead of
// the old dense single-line rows.

export async function onRequestGet() {
  return new Response(HTML, {
    status: 200,
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}

const HTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="robots" content="noindex, nofollow">
<title>Admin — haloe</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>
  :root {
    --cream: #F5F0E8;
    --white: #FFFFFF;
    --ink: #0D0D0D;
    --body: #5a5247;
    --gold: #C8A96E;
    --gold-deep: #8a6a2c;
    --gold-soft: rgba(200,169,110,0.16);
    --hairline: rgba(13,13,13,0.08);
    --card-shadow: 0 8px 24px rgba(13,13,13,0.06);
    --red: #b3413a;
    --red-soft: rgba(179,65,58,0.08);
    --green: #3f8a5c;
    --green-soft: rgba(63,138,92,0.12);
    font-size: 87.5%;
  }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    background: var(--cream);
    color: var(--ink);
    font-family: 'Poppins', Arial, sans-serif;
    padding: 1.25rem;
    padding-bottom: 6rem;
  }
  h1 { font-size: 1.4rem; margin: 0 0 0.2rem; font-weight: 600; }
  .sub { color: var(--body); margin: 0 0 1.5rem; font-size: 0.85rem; }
  .toolbar {
    display: flex; flex-wrap: wrap; gap: 0.6rem; align-items: center;
    margin-bottom: 1.5rem;
  }
  .seg {
    display: inline-flex; background: var(--white); border: 1px solid var(--hairline);
    border-radius: 999px; padding: 3px; box-shadow: var(--card-shadow);
  }
  .seg button {
    background: none; border: none; color: var(--body); font-family: inherit;
    font-size: 0.8rem; padding: 0.4rem 0.9rem; border-radius: 999px; cursor: pointer;
  }
  .seg button.active { background: var(--gold); color: var(--ink); font-weight: 600; }
  .spacer { flex: 1; }
  .btn {
    background: var(--gold); color: var(--ink); border: none; border-radius: 999px;
    padding: 0.5rem 1.1rem; font-family: inherit; font-size: 0.8rem; font-weight: 600;
    cursor: pointer;
  }
  .btn:hover { background: #d4bb85; }
  .btn:disabled { opacity: 0.5; cursor: default; }
  .btn.ghost { background: var(--white); border: 1px solid var(--hairline); color: var(--ink); }
  .day-group { margin-bottom: 1.6rem; }
  .day-heading {
    font-size: 0.95rem; font-weight: 600; color: var(--gold-deep); margin: 0 0 0.7rem;
    padding-bottom: 0.4rem; border-bottom: 1px solid var(--hairline);
  }
  .cards { display: flex; flex-direction: column; gap: 0.6rem; }
  .card {
    background: var(--white); border-radius: 16px; box-shadow: var(--card-shadow);
    border: 1px solid var(--hairline); padding: 0.9rem 1rem;
  }
  .card.conflict { border-color: var(--red); background: var(--red-soft); }
  .card-top {
    display: flex; align-items: baseline; justify-content: space-between; gap: 0.6rem;
  }
  .card-time { font-weight: 700; font-size: 1.02rem; color: var(--ink); }
  .card-amount { font-weight: 700; font-size: 1.02rem; color: var(--gold-deep); }
  .card-name { font-weight: 600; font-size: 0.98rem; margin-top: 0.2rem; }
  .card-treatment { color: var(--body); font-size: 0.85rem; margin-top: 0.15rem; }
  .card-badges { display: flex; flex-wrap: wrap; gap: 0.4rem; margin-top: 0.6rem; }
  .badge {
    font-size: 0.74rem; padding: 0.2rem 0.6rem; border-radius: 999px;
    border: 1px solid var(--hairline); color: var(--body); background: var(--cream);
  }
  .badge.loc-clinic { color: var(--gold-deep); border-color: var(--gold); background: var(--gold-soft); }
  .badge.status-confirmed { background: var(--green-soft); color: var(--green); border-color: transparent; font-weight: 600; }
  .badge.status-pending { background: var(--gold-soft); color: var(--gold-deep); border-color: transparent; font-weight: 600; }
  .badge.discount { color: var(--gold-deep); border-color: var(--gold); }
  .badge.warn { color: var(--red); border-color: var(--red); background: transparent; font-weight: 600; }
  .card-address { color: var(--body); font-size: 0.8rem; margin-top: 0.5rem; }
  .card-actions { display: flex; gap: 0.5rem; margin-top: 0.7rem; }
  .card-actions a {
    color: var(--ink); text-decoration: none; border: 1px solid var(--hairline);
    border-radius: 999px; padding: 0.32rem 0.8rem; font-size: 0.78rem; background: var(--cream);
  }
  .card-actions a:hover { border-color: var(--gold); color: var(--gold-deep); }
  .empty { color: var(--body); padding: 2rem 0; text-align: center; }
  .toast {
    position: fixed; bottom: 1.5rem; left: 50%; transform: translateX(-50%);
    background: var(--gold); color: var(--ink); padding: 0.6rem 1.2rem;
    border-radius: 999px; font-weight: 600; font-size: 0.85rem; opacity: 0;
    pointer-events: none; transition: opacity 0.2s; box-shadow: var(--card-shadow);
  }
  .toast.show { opacity: 1; }
</style>
</head>
<body>

<h1>Bookings</h1>
<p class="sub">haloe admin — confirmed and held bookings</p>

<div class="toolbar">
  <div class="seg" id="seg-when">
    <button data-when="upcoming" class="active">Upcoming</button>
    <button data-when="past">Past</button>
    <button data-when="all">All</button>
  </div>
  <div class="seg" id="seg-loc">
    <button data-loc="all" class="active">All</button>
    <button data-loc="clinic">Clinic Day</button>
    <button data-loc="mobile">Mobile</button>
  </div>
  <div class="spacer"></div>
  <button class="btn ghost" id="refresh-btn">Refresh</button>
  <button class="btn" id="copy-btn">Copy today's clinic list</button>
</div>

<div id="list"></div>
<div class="toast" id="toast"></div>

<script>
let bookings = [];
let whenFilter = 'upcoming';
let locFilter = 'all';

async function load() {
  const listEl = document.getElementById('list');
  listEl.innerHTML = '<p class="empty">Loading…</p>';
  try {
    const res = await fetch('/admin/bookings');
    if (!res.ok) throw new Error('Request failed: ' + res.status);
    const data = await res.json();
    bookings = data.bookings || [];
    render();
  } catch (err) {
    listEl.innerHTML = '<p class="empty">Could not load bookings. ' + escapeHtml(String(err.message || err)) + '</p>';
  }
}

function minutesToLabel(min) {
  let h = Math.floor(min / 60);
  const m = min % 60;
  const ampm = h >= 12 ? 'pm' : 'am';
  h = h % 12; if (h === 0) h = 12;
  return h + ':' + String(m).padStart(2, '0') + ' ' + ampm;
}

function dateLabel(iso) {
  const [y, mo, d] = iso.split('-').map(Number);
  const dt = new Date(y, mo - 1, d);
  return dt.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

function todayISO() {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

function nowMinutesToday() {
  const d = new Date();
  return d.getHours() * 60 + d.getMinutes();
}

// UK mobile -> WhatsApp/tel-friendly international digits, e.g.
// "07700 900900" or "+44 7700 900900" -> "447700900900".
function normalizePhone(raw) {
  const digits = String(raw || '').replace(/\\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('44')) return digits;
  if (digits.startsWith('0')) return '44' + digits.slice(1);
  return digits;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

function money(pence) {
  if (pence === null || pence === undefined) return '—';
  return '£' + (pence / 100).toFixed(2);
}

function isPast(b) {
  const today = todayISO();
  if (b.booking_date < today) return true;
  if (b.booking_date > today) return false;
  return b.end_min <= nowMinutesToday();
}

function flagConflicts(rows) {
  // Overlap check per date — bookings the reservation system already blocked
  // won't collide, but this surfaces anything booked outside that path (the
  // homepage WhatsApp widget, or a manual entry).
  const byDate = {};
  rows.forEach(b => { (byDate[b.booking_date] = byDate[b.booking_date] || []).push(b); });
  const conflictIds = new Set();
  Object.values(byDate).forEach(list => {
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const a = list[i], c = list[j];
        if (a.start_min < c.end_min && a.end_min > c.start_min) {
          conflictIds.add(a.id); conflictIds.add(c.id);
        }
      }
    }
  });
  return conflictIds;
}

function render() {
  const filtered = bookings.filter(b => {
    if (locFilter !== 'all' && (b.location || 'mobile') !== locFilter) return false;
    if (whenFilter === 'upcoming' && isPast(b)) return false;
    if (whenFilter === 'past' && !isPast(b)) return false;
    return true;
  });

  const conflictIds = flagConflicts(bookings.filter(b => whenFilter === 'all' ? true : (whenFilter === 'upcoming' ? !isPast(b) : isPast(b))));

  const listEl = document.getElementById('list');
  if (filtered.length === 0) {
    listEl.innerHTML = '<p class="empty">No bookings match this view.</p>';
    return;
  }

  const byDate = {};
  filtered.forEach(b => { (byDate[b.booking_date] = byDate[b.booking_date] || []).push(b); });
  const dates = Object.keys(byDate).sort();
  if (whenFilter === 'past') dates.reverse();

  listEl.innerHTML = dates.map(date => {
    const cards = byDate[date].map(b => {
      const phone = normalizePhone(b.customer_phone);
      const isClinic = (b.location || 'mobile') === 'clinic';
      const conflict = conflictIds.has(b.id);
      const needsTravelConfirm = !isClinic && b.travel_zone === 'C';

      const locBadge = isClinic
        ? '<span class="badge loc-clinic">Clinic day</span>'
        : '<span class="badge">' + (
            b.travel_zone === 'A' ? 'Zone A · ' + money(b.travel_pence) :
            b.travel_zone === 'B' ? 'Zone B · ' + money(b.travel_pence) :
            b.travel_zone === 'C' ? 'Zone C · travel TBC' : 'Mobile'
          ) + '</span>';

      const statusBadge = '<span class="badge status-' + escapeHtml(b.status) + '">' +
        (b.status === 'confirmed' ? 'Paid' : 'Pending payment') + '</span>';

      const discountBadge = b.discount_code
        ? '<span class="badge discount">' + escapeHtml(b.discount_code) + '</span>'
        : '';

      const conflictBadge = conflict ? '<span class="badge warn">⚠ Overlaps another booking</span>' : '';
      const travelWarnBadge = needsTravelConfirm ? '<span class="badge warn">⚠ Confirm travel cost</span>' : '';

      const address = !isClinic && b.address ? '<p class="card-address">' + escapeHtml(b.address) + '</p>' : '';

      const actions = phone
        ? '<div class="card-actions"><a href="tel:+' + phone + '">Call</a><a href="https://wa.me/' + phone + '" target="_blank" rel="noopener">WhatsApp</a></div>'
        : '';

      return '<div class="card' + (conflict ? ' conflict' : '') + '">' +
        '<div class="card-top">' +
          '<span class="card-time">' + minutesToLabel(b.start_min) + '</span>' +
          '<span class="card-amount">' + money(b.amount_pence) + '</span>' +
        '</div>' +
        '<div class="card-name">' + escapeHtml(b.customer_name || 'Unknown') + '</div>' +
        '<div class="card-treatment">' + escapeHtml(b.treatment || '') + '</div>' +
        '<div class="card-badges">' + locBadge + statusBadge + discountBadge + conflictBadge + travelWarnBadge + '</div>' +
        address +
        actions +
      '</div>';
    }).join('');
    return '<div class="day-group"><p class="day-heading">' + dateLabel(date) + '</p><div class="cards">' + cards + '</div></div>';
  }).join('');
}

function copyTodaysClinicList() {
  const today = todayISO();
  const rows = bookings
    .filter(b => (b.location || 'mobile') === 'clinic' && b.booking_date === today && b.status === 'confirmed')
    .sort((a, b) => a.start_min - b.start_min);

  if (rows.length === 0) {
    showToast('No clinic bookings today');
    return;
  }

  const text = rows.map(b => minutesToLabel(b.start_min) + ' — ' + (b.customer_name || 'Unknown')).join('\\n');
  navigator.clipboard.writeText(text).then(() => {
    showToast('Copied ' + rows.length + ' booking' + (rows.length === 1 ? '' : 's'));
  }).catch(() => {
    showToast('Could not copy — clipboard access blocked');
  });
}

let toastTimer = null;
function showToast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2200);
}

document.getElementById('seg-when').addEventListener('click', e => {
  const btn = e.target.closest('button[data-when]');
  if (!btn) return;
  whenFilter = btn.dataset.when;
  document.querySelectorAll('#seg-when button').forEach(b => b.classList.toggle('active', b === btn));
  render();
});
document.getElementById('seg-loc').addEventListener('click', e => {
  const btn = e.target.closest('button[data-loc]');
  if (!btn) return;
  locFilter = btn.dataset.loc;
  document.querySelectorAll('#seg-loc button').forEach(b => b.classList.toggle('active', b === btn));
  render();
});
document.getElementById('refresh-btn').addEventListener('click', load);
document.getElementById('copy-btn').addEventListener('click', copyTodaysClinicList);

load();
</script>
</body>
</html>`;
