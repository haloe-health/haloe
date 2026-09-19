// Dotted gold trail behind the bee cursor (cursor.css) — a lightweight canvas
// overlay that echoes the trail the bee leaves in the page-load intro
// (intro.js's DOT_SPACING/FADE_WINDOW dots). Self-contained like intro.js, so
// it can be dropped into any of the six customer-facing pages with one
// <script src> tag rather than duplicating this per page.
(function () {
  'use strict';

  // Desktop-pointer only (matches cursor.css's own gate) and never for anyone
  // who's asked for less motion.
  if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  var GOLD = '#C8A96E';
  var SPACING = 10;      // px between sampled points — keeps dots evenly spaced regardless of mouse speed
  var MAX_POINTS = 20;
  var FADE_MS = 600;     // trail is fully gone this long after the cursor stops
  var MAX_RADIUS = 2.2;
  var MAX_OPACITY = 0.65;

  var canvas = document.createElement('canvas');
  canvas.setAttribute('aria-hidden', 'true');
  canvas.style.cssText = 'position:fixed;top:0;left:0;width:100vw;height:100vh;pointer-events:none;z-index:2147483646;';
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

  var points = []; // { x, y, t }
  var lastX = null, lastY = null;
  var running = false;

  function onMove(e) {
    var x = e.clientX, y = e.clientY;
    if (lastX !== null) {
      var dx = x - lastX, dy = y - lastY;
      if (Math.sqrt(dx * dx + dy * dy) < SPACING) return; // too close to the last sample — skip
    }
    lastX = x; lastY = y;
    points.push({ x: x, y: y, t: performance.now() });
    if (points.length > MAX_POINTS) points.shift();
    if (!running) { running = true; requestAnimationFrame(draw); }
  }
  window.addEventListener('mousemove', onMove, { passive: true });

  function draw(now) {
    // Drop points once they've fully aged out — keeps the array (and the
    // work per frame) bounded without a separate GC pass.
    while (points.length && now - points[0].t > FADE_MS) points.shift();

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    for (var i = 0; i < points.length; i++) {
      var p = points[i];
      var frac = 1 - (now - p.t) / FADE_MS; // 1 = fresh, 0 = about to vanish
      if (frac <= 0) continue;
      var eased = frac * frac; // same quadratic falloff as the intro's trail dots
      ctx.beginPath();
      ctx.arc(p.x, p.y, MAX_RADIUS * (0.4 + 0.6 * eased), 0, Math.PI * 2);
      ctx.fillStyle = GOLD;
      ctx.globalAlpha = MAX_OPACITY * eased;
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    if (points.length) {
      requestAnimationFrame(draw);
    } else {
      running = false; // idle until the next mousemove restarts the loop
    }
  }
})();
