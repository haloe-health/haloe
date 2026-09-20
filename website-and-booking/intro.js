// haloe — page-load intro animation (logo zoom, Sep 2026).
// Replaces the old "bee flies to a nigella flower" intro. Self-contained:
// injects its own <style>/markup/behaviour into whatever page loads this
// script, so it can be shared via <script src="intro.js"> without
// duplicating markup per page (the same "one deliberate exception to inline
// CSS/JS" pattern services-data.js already uses on this site).
//
// Timeline (~1.8s total):
//   0.0-0.6s  the flower+wordmark lock-up fades and scales in (0.94 -> 1),
//             centred on screen, using the exact same alignment as the
//             site header's .brand lock-up (see COMPONENTS.md).
//   0.6-0.9s  hold.
//   0.9-1.6s  the whole lock-up scales up around the flower's yellow
//             hexagon until that hexagon fills the viewport, cross-fading
//             its fill from gold to cream as it grows.
//   1.6-1.8s  the (by-now solid cream) overlay fades out onto the page
//             underneath, which has been rendering the whole time.
//
// Plays once per browser session (sessionStorage "haloeIntroSeen"), respects
// prefers-reduced-motion (static lock-up for 400ms, then fade), is
// skippable (tap/click/Escape, or the Skip link), never blocks the page
// underneath, and hard-caps itself at 3s.
(function () {
  'use strict';

  var STORAGE_KEY = 'haloeIntroSeen';
  var alreadySeen = false;
  try {
    alreadySeen = sessionStorage.getItem(STORAGE_KEY) === '1';
  } catch (e) {
    alreadySeen = false; // storage unavailable — fail open and play the intro
  }
  if (alreadySeen) return; // don't render at all, so there's nothing to flash

  try { sessionStorage.setItem(STORAGE_KEY, '1'); } catch (e) {}
  // ^ set BEFORE playing, so a refresh mid-intro never replays it.

  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ------------------------------------------------------------------ //
  // Styles
  // ------------------------------------------------------------------ //
  var style = document.createElement('style');
  style.textContent = [
    '#haloeIntro{position:fixed;inset:0;z-index:9999;pointer-events:auto;background:#F5F0E8;',
      'display:flex;align-items:center;justify-content:center;overflow:hidden;',
      'opacity:1;transition:opacity .2s ease;}',
    '#haloeIntro.haloe-intro-out{opacity:0;}',
    '#haloeIntro:focus{outline:none;}',
    '#haloeIntroLockup{display:flex;align-items:center;gap:calc(1.17em * .35);font-size:clamp(2.75rem,9vw,5.5rem);',
      'opacity:0;transform:scale(.94);transition:opacity .6s ease,transform .6s ease;will-change:transform,opacity;}',
    '#haloeIntroLockup.in{opacity:1;transform:scale(1);}',
    '#haloeIntroLockup.zooming{transition:transform .7s cubic-bezier(.45,0,.55,1);}',
    '#haloeIntroIcon{height:1.17em;width:1.17em;display:block;transform:translateY(-.2918em);overflow:visible;}',
    '#haloeIntroIcon svg{display:block;height:100%;width:100%;}',
    '#haloeIntroWordmark{font-family:"Tan Ashford","Playfair Display",Georgia,serif;font-style:normal;',
      'font-weight:normal;font-size:1em;line-height:1;letter-spacing:.02em;color:#0D0D0D;}',
    '#haloeIntro.reduced #haloeIntroLockup{opacity:1;transform:scale(1);transition:none;}',
    '#haloeIntroSkip{position:fixed;z-index:10000;right:max(1.1rem,env(safe-area-inset-right,0px));',
      'bottom:max(1.1rem,env(safe-area-inset-bottom,0px));font-family:Poppins,Arial,sans-serif;font-size:.78rem;',
      'letter-spacing:.03em;color:#8a6a2c;opacity:.55;background:none;border:none;cursor:pointer;padding:.5rem .3rem;}',
    '#haloeIntroSkip:hover{opacity:.85;}',
    '#haloeIntroSkip:focus-visible{opacity:1;outline:2px solid #8a6a2c;outline-offset:3px;border-radius:2px;}',
  ].join('');
  document.head.appendChild(style);

  // ------------------------------------------------------------------ //
  // Markup
  // ------------------------------------------------------------------ //
  var overlay = document.createElement('div');
  overlay.id = 'haloeIntro';
  overlay.setAttribute('tabindex', '-1');
  overlay.setAttribute('role', 'img');
  overlay.setAttribute('aria-label', 'haloe');
  overlay.innerHTML =
    '<div id="haloeIntroLockup">' +
      '<span id="haloeIntroIcon"></span>' +
      '<span id="haloeIntroWordmark">haloe</span>' +
    '</div>' +
    '<button id="haloeIntroSkip" type="button">Skip</button>';
  document.body.appendChild(overlay);

  var lockup = document.getElementById('haloeIntroLockup');
  var iconSlot = document.getElementById('haloeIntroIcon');
  var skipBtn = document.getElementById('haloeIntroSkip');

  // ------------------------------------------------------------------ //
  // Scroll lock — compensate for the scrollbar disappearing so removing
  // the lock later causes no layout shift.
  // ------------------------------------------------------------------ //
  var scrollbarW = window.innerWidth - document.documentElement.clientWidth;
  var prevBodyOverflow = document.body.style.overflow;
  var prevBodyPadRight = document.body.style.paddingRight;
  document.body.style.overflow = 'hidden';
  if (scrollbarW > 0) document.body.style.paddingRight = scrollbarW + 'px';

  // ------------------------------------------------------------------ //
  // Finish / skip — fades the overlay out, removes it, restores scroll.
  // Idempotent: safe to call from a scheduled timer, a skip interaction, or
  // the hard cap without double-firing.
  // ------------------------------------------------------------------ //
  var finished = false;
  var timers = [];
  function clearTimers() {
    for (var i = 0; i < timers.length; i++) window.clearTimeout(timers[i]);
    timers.length = 0;
  }
  function finishNow() {
    if (finished) return;
    finished = true;
    clearTimers();
    overlay.classList.add('haloe-intro-out');
    window.setTimeout(function () {
      if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
      if (style.parentNode) style.parentNode.removeChild(style);
      document.body.style.overflow = prevBodyOverflow;
      document.body.style.paddingRight = prevBodyPadRight;
      // The focused element (the overlay or Skip link) is now detached;
      // browsers move focus back to <body> automatically at that point.
    }, 200);
  }

  overlay.addEventListener('click', finishNow);
  overlay.addEventListener('touchstart', finishNow, { passive: true });
  overlay.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ' || e.key === 'Spacebar') {
      e.preventDefault();
      finishNow();
    }
  });
  skipBtn.addEventListener('click', function (e) { e.stopPropagation(); finishNow(); });
  skipBtn.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' || e.key === ' ' || e.key === 'Spacebar') { e.preventDefault(); e.stopPropagation(); finishNow(); }
  });

  // Hard cap: whatever state the animation is in, never let it outlive this.
  timers.push(window.setTimeout(finishNow, 3000));

  overlay.focus();

  // ------------------------------------------------------------------ //
  // Reduced motion: skip the zoom choreography entirely.
  // ------------------------------------------------------------------ //
  if (reduced) {
    overlay.className = 'reduced';
    fetchAndMountIcon().then(function () {
      timers.push(window.setTimeout(finishNow, 400));
    }).catch(finishNow);
    return;
  }

  // ------------------------------------------------------------------ //
  // Full animation
  // ------------------------------------------------------------------ //
  fetchAndMountIcon().then(function (svgEl) {
    if (finished) return;

    // Phase 1 (0-0.6s): fade + scale in. Two rAFs so the initial
    // opacity:0/scale(.94) state has actually painted before the
    // transition-triggering class is added (otherwise the browser can
    // coalesce both states into one frame and the transition never runs).
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        if (finished) return;
        lockup.classList.add('in');
      });
    });

    // Phase 3 (0.9-1.6s): zoom into the yellow hexagon.
    timers.push(window.setTimeout(function () {
      if (finished) return;
      runZoom(svgEl);
    }, 900));

    // Phase 4 (1.6-1.8s) + cleanup.
    timers.push(window.setTimeout(finishNow, 1600));
  }).catch(function () {
    // Logo failed to load (offline edge case, etc.) — don't strand the
    // visitor behind a blank cream screen.
    finishNow();
  });

  // Fetches the real logo SVG (unedited on disk) and mounts a live, inline
  // copy into the icon slot so its yellow-hexagon <path> can be selected
  // and cross-faded, and its geometry read via getBBox(). Sized to fill the
  // 1.17em slot via width/height=100% (presentation only — the file's own
  // viewBox, and everything else about it, is untouched).
  function fetchAndMountIcon() {
    return fetch('/haloe-logo-flower.svg')
      .then(function (res) { if (!res.ok) throw new Error('logo fetch failed'); return res.text(); })
      .then(function (svgText) {
        iconSlot.innerHTML = svgText;
        var svgEl = iconSlot.querySelector('svg');
        svgEl.removeAttribute('width');
        svgEl.removeAttribute('height');
        svgEl.style.height = '100%';
        svgEl.style.width = '100%';
        return svgEl;
      });
  }

  // Computes the yellow hexagon's centre and size from the SVG's own
  // coordinates (getBBox() — live geometry, not a hand-measured guess, so
  // this stays correct if the mark or its lock-up sizing ever changes),
  // sets the lock-up's transform-origin to that exact point, then scales
  // the lock-up up until the hexagon covers the viewport, cross-fading the
  // hexagon's fill to cream over the same 0.7s.
  function runZoom(svgEl) {
    var yellow = svgEl.querySelector('path[fill="#fbb716"]');
    if (!yellow) { finishNow(); return; } // artwork changed unexpectedly — bail safely rather than zoom nowhere

    var hexBox = yellow.getBBox(); // SVG user-space (== the file's own 0-375ish viewBox coordinates)
    var svgRect = svgEl.getBoundingClientRect();
    var vbox = svgEl.viewBox.baseVal;
    var scaleToPx = svgRect.width / vbox.width; // svg is uniformly scaled (square viewBox, square box)

    var hexCenterPx = {
      x: svgRect.left + (hexBox.x + hexBox.width / 2 - vbox.x) * scaleToPx,
      y: svgRect.top + (hexBox.y + hexBox.height / 2 - vbox.y) * scaleToPx,
    };
    var hexDiameterPx = Math.max(hexBox.width, hexBox.height) * scaleToPx;

    var lockupRect = lockup.getBoundingClientRect();
    var originXPct = ((hexCenterPx.x - lockupRect.left) / lockupRect.width) * 100;
    var originYPct = ((hexCenterPx.y - lockupRect.top) / lockupRect.height) * 100;
    lockup.style.transformOrigin = originXPct + '% ' + originYPct + '%';

    // Scale until the hexagon's diameter covers the viewport diagonal (plus
    // a safety margin, since the hexagon isn't a perfect circle).
    var viewportDiagonal = Math.sqrt(window.innerWidth * window.innerWidth + window.innerHeight * window.innerHeight);
    var scale = (viewportDiagonal * 1.15) / hexDiameterPx;

    lockup.classList.add('zooming');
    // Force a reflow so the new (longer, eased) transition on .zooming is
    // committed before the transform target changes in the same tick.
    // eslint-disable-next-line no-unused-expressions
    lockup.offsetHeight;
    lockup.style.transform = 'scale(' + scale + ')';

    yellow.style.transition = 'fill .7s cubic-bezier(.45,0,.55,1)';
    yellow.style.fill = '#F5F0E8';
  }
})();
