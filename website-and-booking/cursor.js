// haloe -- DOM bee cursor that rotates to face the direction of travel, plus
// the dotted gold trail behind it. Supersedes the old CSS image-cursor for
// anyone who gets motion (see cursor.css, which stays in place as the
// fallback for touch and prefers-reduced-motion — this script simply never
// activates for them, so their native/CSS cursor is untouched).
//
// One rAF loop drives both the bee and the trail off the same smoothed
// position, so the dots always sit exactly where the bee has been rather
// than tracking a second, independently-eased position.
(function () {
  'use strict';

  // Desktop-pointer only (matches cursor.css's own gate) and never for anyone
  // who's asked for less motion — they keep the static image cursor instead.
  if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  var GOLD = '#C8A96E';

  // ---- bee ----
  var POS_LERP = 0.2;          // how quickly the drawn position eases toward the real pointer
  var ANGLE_LERP = 0.18;       // how quickly the heading eases toward the direction of travel
  var ANGLE_MIN_MOVE = 0.08;   // px of smoothed movement/frame below which we keep the last heading
  var HOTSPOT_X = 16, HOTSPOT_Y = 10; // same hotspot as cursor.css's bee cursor (head), in the 32px render

  // ---- trail ----
  var TRAIL_SPACING = 10;      // px between sampled points — evenly spaced regardless of pointer speed
  var TRAIL_MAX_POINTS = 20;
  var TRAIL_FADE_MS = 600;     // trail is fully gone this long after the cursor stops
  var TRAIL_MAX_RADIUS = 2.2;
  var TRAIL_MAX_OPACITY = 0.65;

  var HOVER_SELECTOR = 'a, button, [role="button"], input[type="submit"], .btn';
  var TEXT_SELECTOR = 'input[type="text"], input[type="email"], input[type="tel"], input[type="password"], ' +
    'input[type="search"], input[type="number"], input[type="date"], textarea, [contenteditable="true"]';

  // Hide the native/CSS cursor only once we're actually taking over — inline
  // style beats cursor.css's plain (non-!important) rule on the same
  // elements, but a directly-matched rule on a descendant (cursor.css's own
  // `input{cursor:text}`) still wins over this inherited value, so text
  // fields keep their native caret untouched.
  document.documentElement.style.cursor = 'none';
  document.body.style.cursor = 'none';

  var style = document.createElement('style');
  style.textContent =
    '#haloeCursorBee{position:fixed;top:0;left:0;width:0;height:0;pointer-events:none;z-index:2147483647;' +
      'transform-origin:0 0;will-change:transform;opacity:1;transition:opacity .12s ease;}' +
    '#haloeCursorBee.haloe-cursor-hidden{opacity:0;}' +
    '#haloeCursorBee svg{position:absolute;left:-' + HOTSPOT_X + 'px;top:-' + HOTSPOT_Y + 'px;width:32px;height:32px;' +
      'transition:transform .15s ease;}' +
    '#haloeCursorBee.haloe-cursor-hover svg{transform:scale(1.18) rotate(8deg);}' +
    '#haloeCursorTrail{position:fixed;top:0;left:0;width:100vw;height:100vh;pointer-events:none;z-index:2147483646;}';
  document.head.appendChild(style);

  var bee = document.createElement('div');
  bee.id = 'haloeCursorBee';
  bee.setAttribute('aria-hidden', 'true');
  bee.innerHTML =
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 30 30">' +
      '<ellipse cx="17" cy="15" rx="8" ry="5" fill="#C8A96E" fill-opacity=".3" stroke="#C8A96E" stroke-width=".9" transform="rotate(-16 17 15)"/>' +
      '<ellipse cx="13" cy="15" rx="8" ry="5" fill="#C8A96E" fill-opacity=".3" stroke="#C8A96E" stroke-width=".9" transform="rotate(16 13 15)"/>' +
      '<circle cx="15" cy="9" r="3.2" fill="#0D0D0D" stroke="#C8A96E" stroke-width=".9"/>' +
      '<line x1="13.5" y1="7" x2="10.5" y2="3.5" stroke="#C8A96E" stroke-width=".8"/>' +
      '<line x1="16.5" y1="7" x2="19.5" y2="3.5" stroke="#C8A96E" stroke-width=".8"/>' +
      '<path d="M15 12 C 9.5 13 8.5 19 10 24 C 11 27.5 19 27.5 20 24 C 21.5 19 20.5 13 15 12Z" fill="#0D0D0D" stroke="#C8A96E" stroke-width="1"/>' +
      '<path d="M9.6 16.4 C 12 17.4 18 17.4 20.4 16.4" stroke="#C8A96E" stroke-width="1.3" fill="none"/>' +
      '<path d="M10 20 C 12.5 21 17.5 21 20 20" stroke="#C8A96E" stroke-width="1.3" fill="none"/>' +
    '</svg>';
  document.documentElement.appendChild(bee);

  var canvas = document.createElement('canvas');
  canvas.id = 'haloeCursorTrail';
  canvas.setAttribute('aria-hidden', 'true');
  document.documentElement.appendChild(canvas);
  var ctx = canvas.getContext('2d');

  var dpr = 1;
  function resize() {
    dpr = window.devicePixelRatio || 1;
    canvas.width = window.innerWidth * dpr;
    canvas.height = window.innerHeight * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  resize();
  window.addEventListener('resize', resize);

  // ------------------------------------------------------------------ //
  // Pointer tracking
  // ------------------------------------------------------------------ //
  var rawX = window.innerWidth / 2, rawY = window.innerHeight / 2;
  var smoothX = rawX, smoothY = rawY;
  var prevSmoothX = rawX, prevSmoothY = rawY;
  var angleDeg = -90; // matches the bee's drawn orientation (nose up) before any movement
  var targetAngleDeg = angleDeg;
  var hasMoved = false;
  var windowHasPointer = false;
  var overText = false;

  function lerp(a, b, t) { return a + (b - a) * t; }
  function lerpAngle(a, b, t) {
    var diff = ((b - a + 180) % 360 + 360) % 360 - 180; // shortest signed distance, handles the ±180° wrap
    return a + diff * t;
  }

  function setHover(on) {
    bee.classList.toggle('haloe-cursor-hover', on);
  }
  function setOverText(on) {
    overText = on;
    updateVisibility();
  }
  function updateVisibility() {
    bee.classList.toggle('haloe-cursor-hidden', overText || !windowHasPointer);
  }

  function onMove(e) {
    rawX = e.clientX; rawY = e.clientY;
    if (!hasMoved) {
      hasMoved = true;
      smoothX = prevSmoothX = rawX;
      smoothY = prevSmoothY = rawY;
    }
    // elementFromPoint skips the bee/trail themselves (both pointer-events:
    // none), so this always resolves to the real element under the cursor.
    var el = document.elementFromPoint(rawX, rawY);
    var overTextEl = el && el.closest && el.closest(TEXT_SELECTOR);
    setOverText(!!overTextEl);
    setHover(!overTextEl && !!(el && el.closest && el.closest(HOVER_SELECTOR)));
  }
  window.addEventListener('mousemove', onMove, { passive: true });

  // mouseenter/mouseleave on document (not window) fire only on genuine
  // viewport-boundary crossings, since they don't bubble from children —
  // the standard technique for "did the pointer leave the window".
  document.addEventListener('mouseleave', function () { windowHasPointer = false; updateVisibility(); });
  document.addEventListener('mouseenter', function () { windowHasPointer = true; updateVisibility(); });

  // ------------------------------------------------------------------ //
  // Trail dots (canvas) — sampled off the same smoothed position the bee
  // itself is drawn at, not off raw mousemove events.
  // ------------------------------------------------------------------ //
  var trailPoints = []; // { x, y, t }
  var lastTrailX = null, lastTrailY = null;

  function sampleTrail(now) {
    if (lastTrailX !== null) {
      var dx = smoothX - lastTrailX, dy = smoothY - lastTrailY;
      if (Math.sqrt(dx * dx + dy * dy) < TRAIL_SPACING) return;
    }
    lastTrailX = smoothX; lastTrailY = smoothY;
    trailPoints.push({ x: smoothX, y: smoothY, t: now });
    if (trailPoints.length > TRAIL_MAX_POINTS) trailPoints.shift();
  }

  function drawTrail(now) {
    while (trailPoints.length && now - trailPoints[0].t > TRAIL_FADE_MS) trailPoints.shift();

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (var i = 0; i < trailPoints.length; i++) {
      var p = trailPoints[i];
      var frac = 1 - (now - p.t) / TRAIL_FADE_MS;
      if (frac <= 0) continue;
      var eased = frac * frac; // same quadratic falloff as the intro's trail dots
      ctx.beginPath();
      ctx.arc(p.x, p.y, TRAIL_MAX_RADIUS * (0.4 + 0.6 * eased), 0, Math.PI * 2);
      ctx.fillStyle = GOLD;
      ctx.globalAlpha = TRAIL_MAX_OPACITY * eased;
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  // ------------------------------------------------------------------ //
  // Main loop
  // ------------------------------------------------------------------ //
  function tick(now) {
    prevSmoothX = smoothX; prevSmoothY = smoothY;
    smoothX = lerp(smoothX, rawX, POS_LERP);
    smoothY = lerp(smoothY, rawY, POS_LERP);

    var dx = smoothX - prevSmoothX, dy = smoothY - prevSmoothY;
    if (Math.sqrt(dx * dx + dy * dy) >= ANGLE_MIN_MOVE) {
      targetAngleDeg = Math.atan2(dy, dx) * 180 / Math.PI;
    }
    angleDeg = lerpAngle(angleDeg, targetAngleDeg, ANGLE_LERP);

    bee.style.transform = 'translate3d(' + smoothX + 'px,' + smoothY + 'px,0) rotate(' + (angleDeg + 90) + 'deg)';

    sampleTrail(now);
    drawTrail(now);

    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
})();
