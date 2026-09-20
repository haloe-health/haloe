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
//   0.9-1.6s  the flower icon scales up around its own yellow hexagon
//             until that hexagon fills the viewport (the wordmark fades
//             out as this starts — see "Why the icon is detached" below),
//             cross-fading the hexagon's fill from gold to cream as it
//             grows.
//   1.6-1.8s  the (by-now solid cream) overlay fades onto the page
//             underneath, which has been rendering the whole time.
//
// Plays once per browser session (sessionStorage "haloeIntroSeen"), respects
// prefers-reduced-motion (static lock-up for 400ms, then fade), is
// skippable (tap/click/Escape, or the Skip link), never blocks the page
// underneath, and hard-caps itself at 3s.
//
// Font: the wordmark is real text in the self-hosted Tan Ashford font
// (index.html preloads it), not baked into an image — ensureFontReady()
// below additionally waits on document.fonts.ready (capped, so a slow/
// failed font fetch can't hang the intro) before anything is revealed, so
// the lock-up never flashes a fallback font.
//
// Why the icon is detached from the lock-up for the zoom: a naive
// `transform: scale()` on the small, already-laid-out icon (or its flex
// parent) gets promoted to its own compositor layer, which is rasterised
// ONCE at that small on-screen size — the 60-100x scale this zoom needs
// then stretches that small bitmap, which is what caused the reported
// pixelation. runZoom() instead gives the icon its full FINAL pixel size
// up front (so the SVG rasterises crisp at target resolution immediately),
// visually shrinks it back down to the current on-screen size with an
// initial `transform: scale(1/zoomFactor)`, then animates that transform
// up to `scale(1)` — the layer is always at-or-above native resolution,
// never stretched beyond it.
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
    // Resting lock-up: cropped to the flower's own ink (see fetchAndMountIcon
    // below) — height:1.17em/-0.2918em/overflow:hidden here match the site
    // header's .brand-icon fix exactly (same measured cap-height box, now
    // actually filled by the honeycomb instead of mostly padding). Reset to
    // overflow:visible + the svg back at 100%/100% happens at the top of
    // runZoom(), before any of its geometry math runs, so the zoom animation
    // itself (which reads this element's rect) is completely unaffected —
    // the crop is purely a phase-1/2 resting-state visual, never present
    // during the zoom.
    '#haloeIntroIcon{height:1.17em;width:1.17em;display:flex;align-items:center;justify-content:center;overflow:hidden;transform:translateY(-.2918em);}',
    '#haloeIntroIcon svg{display:block;height:140.85%;width:140.85%;flex:none;}',
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
  var wordmark = document.getElementById('haloeIntroWordmark');
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

  // index.html already <link rel="preload">s the font, which starts the
  // fetch as early as possible; this additionally waits (capped, so a
  // slow/broken font fetch can't hang the intro) for it to actually be
  // ready, so the lock-up is never revealed mid-swap from a fallback font.
  function ensureFontReady() {
    try {
      return Promise.race([
        document.fonts.load("1em 'Tan Ashford'").then(function () { return document.fonts.ready; }),
        new Promise(function (res) { window.setTimeout(res, 1200); }),
      ]);
    } catch (e) {
      return Promise.resolve();
    }
  }

  // ------------------------------------------------------------------ //
  // Reduced motion: skip the zoom choreography entirely.
  // ------------------------------------------------------------------ //
  if (reduced) {
    overlay.className = 'reduced';
    Promise.all([fetchAndMountIcon(), ensureFontReady()]).then(function () {
      timers.push(window.setTimeout(finishNow, 400));
    }).catch(finishNow);
    return;
  }

  // ------------------------------------------------------------------ //
  // Full animation
  // ------------------------------------------------------------------ //
  Promise.all([fetchAndMountIcon(), ensureFontReady()]).then(function (results) {
    if (finished) return;
    var svgEl = results[0];

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
  // and cross-faded, and its geometry read via getBBox(). Left at the
  // 140.85%/flex-centred crop from the #haloeIntroIcon svg{} rule above
  // (presentation only, via width/height removal so nothing fights that CSS
  // — the file's own viewBox, and everything else about it, is untouched);
  // runZoom() resets this to a plain 100% fill before it does anything else.
  function fetchAndMountIcon() {
    return fetch('/haloe-logo-flower.svg')
      .then(function (res) { if (!res.ok) throw new Error('logo fetch failed'); return res.text(); })
      .then(function (svgText) {
        iconSlot.innerHTML = svgText;
        var svgEl = iconSlot.querySelector('svg');
        svgEl.removeAttribute('width');
        svgEl.removeAttribute('height');
        return svgEl;
      });
  }

  // Zooms the icon into its own yellow hexagon until that hexagon covers
  // the viewport, cross-fading the hexagon's fill to cream over the same
  // 0.7s. See the file-header comment for why the icon is detached to
  // position:fixed and given its full final pixel size up front, instead
  // of just scaling the small, already-laid-out element (which is what
  // produced the pixelation this replaces).
  function runZoom(svgEl) {
    var yellow = svgEl.querySelector('path[fill="#fbb716"]');
    if (!yellow) { finishNow(); return; } // artwork changed unexpectedly — bail safely rather than zoom nowhere

    // Undo the resting-state crop (see fetchAndMountIcon/the #haloeIntroIcon
    // CSS above) before any geometry is read below — everything from here on
    // was written and tested against a plain 100%-fill icon, and re-deriving
    // it for a cropped/oversized svg isn't worth the risk to logic that's
    // already been debugged once for pixelation. This reset and the
    // transform:scale(1/zoomFactor) jump below both happen before the single
    // forced reflow a few lines down, so nothing paints in between — no
    // visible pop.
    iconSlot.style.overflow = 'visible';
    svgEl.style.height = '100%';
    svgEl.style.width = '100%';

    // The hexagon's centre and size, as fractions (0-1) of the icon's own
    // box — computed from the SVG's own coordinates (getBBox()/viewBox),
    // not a hand-measured guess, so this stays correct at any lock-up size.
    var hexBox = yellow.getBBox();
    var vbox = svgEl.viewBox.baseVal;
    var fracX = (hexBox.x + hexBox.width / 2 - vbox.x) / vbox.width;
    var fracY = (hexBox.y + hexBox.height / 2 - vbox.y) / vbox.height;
    var hexDiameterFrac = Math.max(hexBox.width, hexBox.height) / vbox.width;

    // Where the hexagon's centre actually sits on screen right now (post
    // phase-1, at the icon's small, laid-out size) — this point must not
    // move for the rest of the animation.
    var iconRect = iconSlot.getBoundingClientRect();
    var hexScreenX = iconRect.left + fracX * iconRect.width;
    var hexScreenY = iconRect.top + fracY * iconRect.height;
    var hexDiameterPxNow = hexDiameterFrac * iconRect.width;

    // Scale until the hexagon's diameter covers the viewport diagonal (plus
    // a safety margin, since the hexagon isn't a perfect circle).
    var viewportDiagonal = Math.sqrt(window.innerWidth * window.innerWidth + window.innerHeight * window.innerHeight);
    var zoomFactor = (viewportDiagonal * 1.15) / hexDiameterPxNow;
    var finalSize = iconRect.width * zoomFactor; // the icon's native, full-resolution pixel size

    // The wordmark isn't part of the zoomed element any more — fade it out
    // rather than let it sit static while the icon grows past it.
    wordmark.style.transition = 'opacity .3s ease';
    wordmark.style.opacity = '0';

    // Detach from the flex flow and give it its FULL final size immediately
    // (the SVG rasterises crisp at that size right away), positioned so the
    // hexagon's centre lands exactly on hexScreenX/Y — then an initial
    // transform shrinks the whole thing back down to look identical to the
    // small, pre-zoom icon.
    iconSlot.style.position = 'fixed';
    iconSlot.style.margin = '0';
    iconSlot.style.width = finalSize + 'px';
    iconSlot.style.height = finalSize + 'px';
    iconSlot.style.left = (hexScreenX - fracX * finalSize) + 'px';
    iconSlot.style.top = (hexScreenY - fracY * finalSize) + 'px';
    iconSlot.style.transformOrigin = (fracX * 100) + '% ' + (fracY * 100) + '%';
    iconSlot.style.willChange = 'transform';
    iconSlot.style.transform = 'scale(' + (1 / zoomFactor) + ')';

    // Force a reflow so the browser commits the large-box / small-transform
    // state above (rasterising the layer at finalSize) before the
    // transition below starts.
    // eslint-disable-next-line no-unused-expressions
    iconSlot.offsetHeight;

    iconSlot.style.transition = 'transform .7s cubic-bezier(.45,0,.55,1)';
    iconSlot.style.transform = 'scale(1)';

    yellow.style.transition = 'fill .7s cubic-bezier(.45,0,.55,1)';
    yellow.style.fill = '#F5F0E8';
  }
})();
