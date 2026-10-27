/* haloe lightness motion: builds the faint falling-feather layer (see lightness.css).
   Skipped for reduced motion and Data Saver. Six feathers on desktop, four on phones. */
(function () {
  try {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    var c = navigator.connection; if (c && c.saveData) return;
  } catch (e) {}
  var layer = document.createElement('div'); layer.className = 'feather-layer'; layer.setAttribute('aria-hidden', 'true');
  var svg = '<svg viewBox="0 0 24 64" focusable="false"><path d="M12 2C21 14 21 42 12 62C3 42 3 14 12 2Z" fill="currentColor" opacity=".55"/><path d="M12 2C21 14 21 42 12 62C14 40 14 14 12 2Z" fill="currentColor" opacity=".35"/><path d="M12 4V62" stroke="currentColor" stroke-width="1" stroke-linecap="round" opacity=".8"/></svg>';
  var n = window.innerWidth < 700 ? 4 : 6;
  // Fixed, hand-picked spread so feathers never bunch up.
  var xs = [8, 24, 41, 58, 74, 90], sizes = [20, 26, 18, 24, 22, 28], dur = [38, 46, 34, 52, 42, 48], del = [-6, -22, -14, -34, -2, -28], drift = [70, -50, 60, -80, 40, -60], op = [.2, .16, .22, .15, .2, .17], sw = [6, 7.5, 5.5, 8, 6.5, 7];
  for (var i = 0; i < n; i++) {
    var f = document.createElement('span'); f.className = 'feather';
    f.style.setProperty('--x', xs[i] + '%'); f.style.setProperty('--s', sizes[i] + 'px'); f.style.setProperty('--d', dur[i] + 's');
    f.style.setProperty('--delay', del[i] + 's'); f.style.setProperty('--drift', drift[i] + 'px'); f.style.setProperty('--o', op[i]); f.style.setProperty('--sw', sw[i] + 's');
    f.innerHTML = svg; layer.appendChild(f);
  }
  function add() { document.body.appendChild(layer); }
  if (document.body) add(); else document.addEventListener('DOMContentLoaded', add);
})();
