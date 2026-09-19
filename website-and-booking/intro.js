// haloe — page-load intro animation (bee flies to the nigella flower).
// Self-contained: injects its own <style>/markup/behaviour into whatever
// page loads this script, so it can be shared via <script src="intro.js">
// across entry pages without duplicating ~200 lines of SVG per page (the
// same "one deliberate exception to inline CSS/JS" pattern services-data.js
// already uses on this site).
//
// Plays once per browser session (sessionStorage "haloeIntroSeen"), respects
// prefers-reduced-motion, is skippable (tap/click/Escape/Enter/Space, or the
// Skip link), never blocks the page underneath, and hard-caps itself at 4s.
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
  var isNarrow = window.matchMedia('(max-width: 600px), (orientation: portrait) and (max-width: 900px)').matches;

  // ------------------------------------------------------------------ //
  // Styles
  // ------------------------------------------------------------------ //
  var style = document.createElement('style');
  style.textContent = [
    '#haloeIntro{position:fixed;inset:0;z-index:9999;pointer-events:auto;background:#0D0D0D;overflow:hidden;',
      'opacity:1;transition:opacity .3s ease;}',
    '#haloeIntro.haloe-intro-out{opacity:0;}',
    '#haloeIntro:focus{outline:none;}',
    '#haloeIntroStage{position:absolute;top:0;left:0;transform-origin:0 0;}',
    '#haloeIntroFlower{position:absolute;width:0;height:0;}',
    '#haloeIntroFlower svg{position:absolute;overflow:visible;}',
    '#haloeIntroBee{position:absolute;top:0;left:0;width:34px;height:34px;margin:-17px 0 0 -17px;}',
    '#haloeIntroBee svg{overflow:visible;}',
    '#haloeIntroTrailSvg{position:absolute;top:0;left:0;overflow:visible;}',
    '.haloe-intro-wing{transform-origin:15px 15px;animation:haloeFlutter .6s ease-in-out infinite alternate;}',
    '.haloe-intro-wing.r{animation-delay:.15s;}',
    '@keyframes haloeFlutter{from{transform:scaleY(1) rotate(0deg);}to{transform:scaleY(.85) rotate(2deg);}}',
    '#haloeIntro.run .haloe-intro-wing{animation:haloeFlutter .6s ease-in-out infinite alternate, haloeWingFold .3s ease-out forwards;animation-delay:0s,2.7s;}',
    '@keyframes haloeWingFold{to{transform:scaleY(.5) rotate(18deg);opacity:.7;}}',
    '#haloeIntro.run #haloeIntroBeeWrap{animation:haloeBeeSettle .4s ease-out both;animation-delay:2.7s;transform-origin:50% 50%;}',
    '@keyframes haloeBeeSettle{0%{transform:scale(1,1);}55%{transform:scale(1.04,.96);}100%{transform:scale(1,1);}}',
    '#haloeIntroFlowerHead{transform-box:fill-box;}',
    '#haloeIntro.run #haloeIntroFlowerHead{animation:haloeFlowerSway .4s ease-out;animation-delay:2.7s;}',
    '@keyframes haloeFlowerSway{0%{transform:rotate(0deg) scale(1);}35%{transform:rotate(1.8deg) scale(1.02);}70%{transform:rotate(-.8deg) scale(.995);}100%{transform:rotate(0deg) scale(1);}}',
    '#haloeIntroFlower svg{opacity:0;}',
    '#haloeIntro.run #haloeIntroFlower svg{animation:haloeFlowerIn .35s cubic-bezier(.2,.8,.3,1) forwards;animation-delay:.05s;}',
    '@keyframes haloeFlowerIn{from{opacity:0;transform:translateY(6px) scale(.94);}to{opacity:1;transform:translateY(0) scale(1);}}',
    '#haloeIntro.run #haloeIntroTrailDots{animation:haloeTrailFadeOut .5s ease forwards;animation-delay:2.7s;}',
    '@keyframes haloeTrailFadeOut{to{opacity:0;}}',
    '#haloeIntro.reduced #haloeIntroFlower svg,#haloeIntro.reduced #haloeIntroBee{opacity:1;}',
    '#haloeIntro.reduced{animation:haloeSimpleFade .32s ease forwards;animation-delay:.35s;}',
    '@keyframes haloeSimpleFade{to{opacity:0;}}',
    '#haloeIntroSkip{position:fixed;z-index:10000;right:max(1.1rem,env(safe-area-inset-right,0px));',
      'bottom:max(1.1rem,env(safe-area-inset-bottom,0px));font-family:Poppins,Arial,sans-serif;font-size:.78rem;',
      'letter-spacing:.03em;color:#C8A96E;opacity:.55;background:none;border:none;cursor:pointer;padding:.5rem .3rem;}',
    '#haloeIntroSkip:hover{opacity:.85;}',
    '#haloeIntroSkip:focus-visible{opacity:1;outline:2px solid #C8A96E;outline-offset:3px;border-radius:2px;}',
  ].join('');
  document.head.appendChild(style);

  // ------------------------------------------------------------------ //
  // Geometry — desktop (landscape) vs a shorter, narrower mobile variant.
  // Both use the same flower/bee artwork; only the design-space size, the
  // flight path, and the flower's anchor point differ.
  // ------------------------------------------------------------------ //
  var DESIGN_W = isNarrow ? 400 : 1200;
  var DESIGN_H = 800;
  var FLOWER_ANCHOR = isNarrow ? { left: 200, top: 460 } : { left: 600, top: 420 };
  var FLOWER_SCALE = isNarrow ? 0.8 : 1;

  // Desktop: one large loop (r=75), tangent-matched at entry/exit, then a
  // smooth S into the flower centre.
  var PATH_DESKTOP =
    'M -60 -40 C 150 -60 425 280 425 250' +
    ' C 425 208.58 391.42 175 350 175 C 308.58 175 275 208.58 275 250' +
    ' C 275 291.42 308.58 325 350 325 C 391.42 325 425 291.42 425 250' +
    ' C 425 210 470 190 500 220 C 540 250 620 290 600 338';

  // Mobile: same shape (top-left entry, one loop, gentle S), scaled down
  // and re-authored for a 400×800 portrait design space so nothing clips
  // on a narrow phone.
  var PATH_MOBILE =
    'M -20 -20 C 60 -30 212 250 212 220' +
    ' C 212 196.8 193.2 178 170 178 C 146.8 178 128 196.8 128 220' +
    ' C 128 243.2 146.8 262 170 262 C 193.2 262 212 243.2 212 220' +
    ' C 212 195 255 230 240 280 C 225 330 210 350 200 394';

  var PATH_D = isNarrow ? PATH_MOBILE : PATH_DESKTOP;

  // ------------------------------------------------------------------ //
  // Markup
  // ------------------------------------------------------------------ //
  var overlay = document.createElement('div');
  overlay.id = 'haloeIntro';
  overlay.setAttribute('tabindex', '-1');
  overlay.setAttribute('role', 'img');
  overlay.setAttribute('aria-label', 'haloe — loading');
  overlay.innerHTML =
    '<div id="haloeIntroStage">' +
      '<svg id="haloeIntroTrailSvg" viewBox="0 0 ' + DESIGN_W + ' ' + DESIGN_H + '" width="' + DESIGN_W + '" height="' + DESIGN_H + '">' +
        '<path id="haloeIntroPathRef" d="' + PATH_D + '" fill="none" stroke="none"/>' +
        '<g id="haloeIntroTrailDots"></g>' +
      '</svg>' +
      '<div id="haloeIntroFlower" style="left:' + FLOWER_ANCHOR.left + 'px;top:' + FLOWER_ANCHOR.top + 'px;">' +
        '<svg viewBox="0 0 140 230" fill="none" style="left:' + (-70 * FLOWER_SCALE) + 'px;top:' + (-160 * FLOWER_SCALE) + 'px;width:' + (140 * FLOWER_SCALE) + 'px;height:' + (230 * FLOWER_SCALE) + 'px;">' +
          '<defs>' +
            '<path id="haloeIntroPetalOuter" d="M 66 72 C 64 50 65 32 70 19 C 75 32 76 50 74 72 C 72 76 68 76 66 72 Z"/>' +
            '<path id="haloeIntroPetalInner" d="M 67.4 72 C 66.4 56 67 42 70 31 C 73 42 73.6 56 72.6 72 C 71.3 75.2 68.7 75.2 67.4 72 Z"/>' +
          '</defs>' +
          '<g id="haloeIntroFlowerHead">' +
            '<g fill="#F5F0E8" stroke="#C8A96E" stroke-width="1.1">' +
              '<use href="#haloeIntroPetalOuter" transform="rotate(0 70 78)"/><use href="#haloeIntroPetalOuter" transform="rotate(30 70 78)"/>' +
              '<use href="#haloeIntroPetalOuter" transform="rotate(60 70 78)"/><use href="#haloeIntroPetalOuter" transform="rotate(90 70 78)"/>' +
              '<use href="#haloeIntroPetalOuter" transform="rotate(120 70 78)"/><use href="#haloeIntroPetalOuter" transform="rotate(150 70 78)"/>' +
              '<use href="#haloeIntroPetalOuter" transform="rotate(180 70 78)"/><use href="#haloeIntroPetalOuter" transform="rotate(210 70 78)"/>' +
              '<use href="#haloeIntroPetalOuter" transform="rotate(240 70 78)"/><use href="#haloeIntroPetalOuter" transform="rotate(270 70 78)"/>' +
              '<use href="#haloeIntroPetalOuter" transform="rotate(300 70 78)"/><use href="#haloeIntroPetalOuter" transform="rotate(330 70 78)"/>' +
            '</g>' +
            '<g fill="#F5F0E8" stroke="#C8A96E" stroke-width="1.1" opacity=".97">' +
              '<use href="#haloeIntroPetalInner" transform="rotate(15 70 78)"/><use href="#haloeIntroPetalInner" transform="rotate(45 70 78)"/>' +
              '<use href="#haloeIntroPetalInner" transform="rotate(75 70 78)"/><use href="#haloeIntroPetalInner" transform="rotate(105 70 78)"/>' +
              '<use href="#haloeIntroPetalInner" transform="rotate(135 70 78)"/><use href="#haloeIntroPetalInner" transform="rotate(165 70 78)"/>' +
              '<use href="#haloeIntroPetalInner" transform="rotate(195 70 78)"/><use href="#haloeIntroPetalInner" transform="rotate(225 70 78)"/>' +
              '<use href="#haloeIntroPetalInner" transform="rotate(255 70 78)"/><use href="#haloeIntroPetalInner" transform="rotate(285 70 78)"/>' +
              '<use href="#haloeIntroPetalInner" transform="rotate(315 70 78)"/><use href="#haloeIntroPetalInner" transform="rotate(345 70 78)"/>' +
            '</g>' +
            '<g stroke="#C8A96E" stroke-width="1">' +
              '<circle cx="70" cy="78" r="5.4" fill="#0D0D0D"/><circle cx="76" cy="78" r="4" fill="#0D0D0D"/>' +
              '<circle cx="73" cy="72.8" r="4" fill="#0D0D0D"/><circle cx="67" cy="72.8" r="4" fill="#0D0D0D"/>' +
              '<circle cx="64" cy="78" r="4" fill="#0D0D0D"/><circle cx="67" cy="83.2" r="4" fill="#0D0D0D"/>' +
              '<circle cx="73" cy="83.2" r="4" fill="#0D0D0D"/>' +
            '</g>' +
            '<g stroke="#C8A96E" stroke-width=".9" fill="none" opacity=".9">' +
              '<path d="M79,78 Q104.1,85 132,78"/><path d="M77.79,82.5 Q94.47,84.04 108.1,100"/>' +
              '<path d="M74.5,85.79 Q80.99,111.03 101,131.7"/><path d="M70,87 Q77,102.2 70,122"/>' +
              '<path d="M65.5,85.79 Q46.89,104.03 39,131.7"/><path d="M62.21,82.5 Q52.54,96.16 31.9,100"/>' +
              '<path d="M61,78 Q35.9,71 8,78"/><path d="M62.21,73.5 Q45.54,71.96 31.9,56"/>' +
              '<path d="M65.5,70.21 Q59.01,44.97 39,24.3"/><path d="M70,69 Q63,53.8 70,34"/>' +
              '<path d="M74.5,70.21 Q93.11,51.97 101,24.3"/><path d="M77.79,73.5 Q87.47,59.84 108.1,56"/>' +
            '</g>' +
          '</g>' +
          '<line x1="70" y1="88" x2="70" y2="228" stroke="#0D0D0D" stroke-width="1.6"/>' +
        '</svg>' +
      '</div>' +
      '<div id="haloeIntroBee">' +
        '<svg viewBox="0 0 30 30">' +
          '<g id="haloeIntroBeeWrap">' +
            '<ellipse class="haloe-intro-wing r" cx="17" cy="15" rx="8" ry="5" fill="#C8A96E" fill-opacity=".3" stroke="#C8A96E" stroke-width=".9" transform="rotate(-16 17 15)"/>' +
            '<ellipse class="haloe-intro-wing l" cx="13" cy="15" rx="8" ry="5" fill="#C8A96E" fill-opacity=".3" stroke="#C8A96E" stroke-width=".9" transform="rotate(16 13 15)"/>' +
            '<circle cx="15" cy="9" r="3.2" fill="#0D0D0D" stroke="#C8A96E" stroke-width=".9"/>' +
            '<line x1="13.5" y1="7" x2="10.5" y2="3.5" stroke="#C8A96E" stroke-width=".8"/>' +
            '<line x1="16.5" y1="7" x2="19.5" y2="3.5" stroke="#C8A96E" stroke-width=".8"/>' +
            '<path d="M15 12 C 9.5 13 8.5 19 10 24 C 11 27.5 19 27.5 20 24 C 21.5 19 20.5 13 15 12Z" fill="#0D0D0D" stroke="#C8A96E" stroke-width="1"/>' +
            '<path d="M9.6 16.4 C 12 17.4 18 17.4 20.4 16.4" stroke="#C8A96E" stroke-width="1.3" fill="none"/>' +
            '<path d="M10 20 C 12.5 21 17.5 21 20 20" stroke="#C8A96E" stroke-width="1.3" fill="none"/>' +
          '</g>' +
        '</svg>' +
      '</div>' +
    '</div>' +
    '<button id="haloeIntroSkip" type="button">Skip</button>';
  document.body.appendChild(overlay);

  var stage = document.getElementById('haloeIntroStage');
  var bee = document.getElementById('haloeIntroBee');
  var trailDotsPath = document.getElementById('haloeIntroPathRef');
  var trailDotGroup = document.getElementById('haloeIntroTrailDots');
  var flowerDiv = document.getElementById('haloeIntroFlower');
  var flowerSvgEl = flowerDiv.querySelector('svg');
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
  // Cover-fit scaling: fixed design space, scaled+centred to fill the
  // real viewport (same technique as object-fit:cover) so the path never
  // distorts at any aspect ratio.
  // ------------------------------------------------------------------ //
  function fitStage() {
    var s = Math.max(window.innerWidth / DESIGN_W, window.innerHeight / DESIGN_H);
    var w = DESIGN_W * s, h = DESIGN_H * s;
    var x = (window.innerWidth - w) / 2;
    var y = (window.innerHeight - h) / 2;
    stage.style.transform = 'translate(' + x + 'px,' + y + 'px) scale(' + s + ')';
  }
  fitStage();
  window.addEventListener('resize', fitStage);

  // ------------------------------------------------------------------ //
  // Landing point — the flower's actual centre, read from its live CSS
  // position (and its own scale, if the mobile variant shrinks it), so a
  // repositioned/rescaled flower still gets a correctly-landed bee.
  // ------------------------------------------------------------------ //
  function computeLandingPoint() {
    var flowerLeft = parseFloat(getComputedStyle(flowerDiv).left) || 0;
    var flowerTop = parseFloat(getComputedStyle(flowerDiv).top) || 0;
    var svgLeft = parseFloat(getComputedStyle(flowerSvgEl).left) || 0;
    var svgTop = parseFloat(getComputedStyle(flowerSvgEl).top) || 0;
    var svgWidth = parseFloat(getComputedStyle(flowerSvgEl).width) || 140;
    var scale = svgWidth / 140;
    return { x: flowerLeft + svgLeft + 70 * scale, y: flowerTop + svgTop + 78 * scale };
  }
  var BASE_LANDING = isNarrow ? { x: 200, y: 394 } : { x: 600, y: 338 };
  (function applyLandingPoint() {
    var target = computeLandingPoint();
    var dx = target.x - BASE_LANDING.x, dy = target.y - BASE_LANDING.y;
    if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) return;
    var d = trailDotsPath.getAttribute('d');
    var lastC = d.lastIndexOf('C');
    var head = d.slice(0, lastC);
    var nums = d.slice(lastC + 1).trim().split(/[\s,]+/).map(Number);
    nums[2] += dx; nums[3] += dy;
    nums[4] += dx; nums[5] += dy;
    trailDotsPath.setAttribute('d', head + 'C ' + nums.join(' '));
  })();
  var trailTotalLen = trailDotsPath.getTotalLength();

  // ------------------------------------------------------------------ //
  // Trail dots — a fixed-spacing pool of small circles sampled off the
  // same path, each faded by how far behind the bee it currently sits (a
  // short trailing window, not the whole flown path staying lit).
  // ------------------------------------------------------------------ //
  var SVG_NS = 'http://www.w3.org/2000/svg';
  var DOT_SPACING = 14, DOT_RADIUS = 1.6, FADE_WINDOW = 210, TRAIL_MAX_OPACITY = .72;
  var dotCount = Math.ceil(trailTotalLen / DOT_SPACING);
  var dotEls = [];
  for (var di = 0; di <= dotCount; di++) {
    var c = document.createElementNS(SVG_NS, 'circle');
    c.setAttribute('r', DOT_RADIUS);
    c.setAttribute('fill', '#C8A96E');
    c.setAttribute('opacity', '0');
    trailDotGroup.appendChild(c);
    dotEls.push(c);
  }

  // ------------------------------------------------------------------ //
  // Flight
  // ------------------------------------------------------------------ //
  var FLIGHT_MS = 2700;
  var flightRAF = null;
  var finished = false;

  function makeCubicBezierEase(p1x, p1y, p2x, p2y) {
    function a(x1, x2) { return 1 - 3 * x2 + 3 * x1; }
    function b(x1, x2) { return 3 * x2 - 6 * x1; }
    function c(x1) { return 3 * x1; }
    function bezX(t) { return ((a(p1x, p2x) * t + b(p1x, p2x)) * t + c(p1x)) * t; }
    function bezY(t) { return ((a(p1y, p2y) * t + b(p1y, p2y)) * t + c(p1y)) * t; }
    function slopeX(t) { return 3 * a(p1x, p2x) * t * t + 2 * b(p1x, p2x) * t + c(p1x); }
    function tForX(x) {
      var t = x;
      for (var i = 0; i < 8; i++) {
        var s = slopeX(t);
        if (Math.abs(s) < 1e-6) break;
        t -= (bezX(t) - x) / s;
      }
      return t;
    }
    return function (x) { return bezY(tForX(x)); };
  }
  var flightEase = makeCubicBezierEase(.45, 0, .55, 1);

  function lerpAngle(a, b, t) {
    var diff = ((b - a + 180) % 360 + 360) % 360 - 180;
    return a + diff * t;
  }
  var lastAngleDeg = null;

  function driveFlight(startTime, timestamp) {
    if (finished) return;
    var elapsed = timestamp - startTime;
    var t = Math.max(0, Math.min(1, elapsed / FLIGHT_MS));
    var p = flightEase(t);
    var len = p * trailTotalLen;

    var pt = trailDotsPath.getPointAtLength(len);
    var aheadLen = Math.min(len + 3, trailTotalLen);
    var ptAhead = trailDotsPath.getPointAtLength(aheadLen);
    var targetAngle = Math.atan2(ptAhead.y - pt.y, ptAhead.x - pt.x) * 180 / Math.PI;
    if (lastAngleDeg === null) lastAngleDeg = targetAngle;
    lastAngleDeg = lerpAngle(lastAngleDeg, targetAngle, 0.15);

    bee.style.transform = 'translate(' + pt.x + 'px,' + pt.y + 'px) rotate(' + (lastAngleDeg + 90) + 'deg)';

    var lastActiveIdx = Math.min(dotCount, Math.floor(len / DOT_SPACING));
    for (var i = 0; i <= lastActiveIdx; i++) {
      var dLen = i * DOT_SPACING;
      var behind = len - dLen;
      if (behind > FADE_WINDOW) { dotEls[i].setAttribute('opacity', '0'); continue; }
      var dp = trailDotsPath.getPointAtLength(dLen);
      var frac = 1 - behind / FADE_WINDOW;
      var op = TRAIL_MAX_OPACITY * frac * frac;
      dotEls[i].setAttribute('cx', dp.x);
      dotEls[i].setAttribute('cy', dp.y);
      dotEls[i].setAttribute('opacity', op.toFixed(2));
    }

    if (t < 1) {
      flightRAF = requestAnimationFrame(function (ts) { driveFlight(startTime, ts); });
    } else {
      flightRAF = null;
    }
  }

  // ------------------------------------------------------------------ //
  // Finish / skip — fades the overlay out, removes it, restores scroll.
  // Idempotent: safe to call from the timeout, a skip interaction, or the
  // 4s hard cap without double-firing.
  // ------------------------------------------------------------------ //
  function finishNow() {
    if (finished) return;
    finished = true;
    if (flightRAF) { cancelAnimationFrame(flightRAF); flightRAF = null; }
    window.clearTimeout(hardCapTimer);
    overlay.classList.add('haloe-intro-out');
    window.setTimeout(function () {
      if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
      if (style.parentNode) style.parentNode.removeChild(style);
      document.body.style.overflow = prevBodyOverflow;
      document.body.style.paddingRight = prevBodyPadRight;
      window.removeEventListener('resize', fitStage);
      // The focused element (the overlay or Skip link) is now detached;
      // browsers move focus back to <body> automatically at that point.
    }, 300);
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
  var hardCapTimer = window.setTimeout(finishNow, 4000);

  overlay.focus();

  // ------------------------------------------------------------------ //
  // Go
  // ------------------------------------------------------------------ //
  if (reduced) {
    overlay.className = 'reduced';
    var landing = computeLandingPoint();
    bee.style.transform = 'translate(' + landing.x + 'px,' + landing.y + 'px) rotate(0deg)';
    window.setTimeout(finishNow, 670);
  } else {
    overlay.className = 'run';
    flightRAF = requestAnimationFrame(function (ts) { driveFlight(ts, ts); });
    window.setTimeout(finishNow, 3300);
  }
})();
