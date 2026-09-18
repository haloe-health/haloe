// GET /admin — the booking calendar. Gated by functions/admin/_middleware.js
// (Basic Auth); this Function only ever runs for an already-authenticated
// request. Inline CSS/JS, same hand-written-per-page convention as the rest
// of the site — this page just happens to be served from a Function instead
// of a static file, since it needs the auth middleware in front of it.

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
    --gold: #C8A96E;
    --black: #0D0D0D;
    --surface: #1C1C1E;
    --surface2: #232325;
    --hairline: rgba(255,255,255,0.10);
    --cream: #F5F0E8;
    --dim: #9B9B9F;
    --red: #E5736A;
    font-size: 87.5%;
  }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    background: var(--black);
    color: var(--cream);
    font-family: 'Poppins', Arial, sans-serif;
    padding: 1.5rem;
    padding-bottom: 6rem;
  }
  h1 { font-size: 1.4rem; margin: 0 0 0.2rem; }
  .sub { color: var(--dim); margin: 0 0 1.5rem; font-size: 0.85rem; }
  .toolbar {
    display: flex; flex-wrap: wrap; gap: 0.6rem; align-items: center;
    margin-bottom: 1.5rem;
  }
  .seg {
    display: inline-flex; background: var(--surface); border: 1px solid var(--hairline);
    border-radius: 999px; padding: 3px;
  }
  .seg button {
    background: none; border: none; color: var(--dim); font-family: inherit;
    font-size: 0.8rem; padding: 0.4rem 0.9rem; border-radius: 999px; cursor: pointer;
  }
  .seg button.active { background: var(--gold); color: var(--black); font-weight: 600; }
  .spacer { flex: 1; }
  .btn {
    background: var(--gold); color: var(--black); border: none; border-radius: 999px;
    padding: 0.5rem 1.1rem; font-family: inherit; font-size: 0.8rem; font-weight: 600;
    cursor: pointer;
  }
  .btn:disabled { opacity: 0.5; cursor: default; }
  .btn.ghost { background: none; border: 1px solid var(--hairline); color: var(--cream); }
  .day-group { margin-bottom: 1.6rem; }
  .day-heading {
    font-size: 0.95rem; font-weight: 600; color: var(--gold); margin: 0 0 0.6rem;
    padding-bottom: 0.4rem; border-bottom: 1px solid var(--hairline);
  }
  .row {
    display: flex; flex-wrap: wrap; align-items: center; gap: 0.3rem 1rem;
    background: var(--surface); border: 1px solid var(--hairline); border-radius: 12px;
    padding: 0.8rem 1rem; margin-bottom: 0.5rem;
  }
  .row.conflict { border-color: var(--red); background: rgba(229,115,106,0.08); }
  .row .time { font-weight: 600; min-width: 5.2rem; }
  .row .name { font-weight: 600; min-width: 9rem; }
  .row .meta { color: var(--dim); font-size: 0.82rem; }
  .row .loc { font-size: 0.78rem; padding: 0.15rem 0.55rem; border-radius: 999px; border: 1px solid var(--hairline); }
  .row .loc.clinic { color: var(--gold); border-color: var(--gold); }
  .row .amount { font-weight: 600; }
  .row .status { font-size: 0.75rem; padding: 0.15rem 0.55rem; border-radius: 999px; }
  .row .status.confirmed { background: rgba(120,200,140,0.15); color: #8FD6A3; }
  .row .status.pending { background: rgba(200,169,110,0.15); color: var(--gold); }
  .row .conflict-flag { color: var(--red); font-size: 0.78rem; font-weight: 600; }
  .row .actions { display: flex; gap: 0.5rem; margin-left: auto; }
  .row .actions a {
    color: var(--cream); text-decoration: none; border: 1px solid var(--hairline);
    border-radius: 999px; padding: 0.3rem 0.7rem; font-size: 0.78rem;
  }
  .row .actions a:hover { border-color: var(--gold); color: var(--gold); }
  .empty { color: var(--dim); padding: 2rem 0; text-align: center; }
  .toast {
    position: fixed; bottom: 1.5rem; left: 50%; transform: translateX(-50%);
    background: var(--gold); color: var(--black); padding: 0.6rem 1.2rem;
    border-radius: 999px; font-weight: 600; font-size: 0.85rem; opacity: 0;
    pointer-events: none; transition: opacity 0.2s;
  }
  .toast.show { opacity: 1; }
  @media (max-width: 600px) {
    .row .name { min-width: 100%; order: -1; }
    .row .actions { margin-left: 0; }
  }
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
    const rows = byDate[date].map(b => {
      const phone = normalizePhone(b.customer_phone);
      const isClinic = (b.location || 'mobile') === 'clinic';
      const conflict = conflictIds.has(b.id);
      return '<div class="row' + (conflict ? ' conflict' : '') + '">' +
        '<span class="time">' + minutesToLabel(b.start_min) + '</span>' +
        '<span class="name">' + escapeHtml(b.customer_name || 'Unknown') + '</span>' +
        '<span class="meta">' + escapeHtml(b.treatment || '') + '</span>' +
        '<span class="loc' + (isClinic ? ' clinic' : '') + '">' + (isClinic ? 'Clinic Day' : 'Mobile') + '</span>' +
        '<span class="meta">' + escapeHtml(b.address || '') + '</span>' +
        '<span class="amount">' + money(b.amount_pence) + '</span>' +
        '<span class="status ' + escapeHtml(b.status) + '">' + (b.status === 'confirmed' ? 'Paid' : 'Pending payment') + '</span>' +
        (conflict ? '<span class="conflict-flag">⚠ Overlaps another booking</span>' : '') +
        '<span class="actions">' +
          (phone ? '<a href="tel:+' + phone + '">Call</a><a href="https://wa.me/' + phone + '" target="_blank" rel="noopener">WhatsApp</a>' : '') +
        '</span>' +
      '</div>';
    }).join('');
    return '<div class="day-group"><p class="day-heading">' + dateLabel(date) + '</p>' + rows + '</div>';
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
