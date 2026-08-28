/* ==========================================================================
   FINISHER TRACK — seven frames cycling inside the single wide frame.

   The Film track's cycle dwells 3s on full-viewport photographs and crossfades
   for 900ms. This one dwells 500ms, which changes what the code has to worry
   about:

   1. IT WAITS BEFORE IT STARTS. At 500ms there is no time to fetch a frame
      between beats — the first pass through would stutter on whichever frames
      had not arrived, which is the pass everybody sees. So the loop does not
      begin until all seven have loaded and decoded. If that has not happened
      within 5s (a stalled request, a hostile network) it starts anyway rather
      than sitting on frame one forever.

   2. IT PAUSES ON HOVER. Seven Resolve pages at half a second each is a
      flick-through, not a slideshow — the moment someone wants to actually
      look at one, the pointer is already on it. Pointer over the frame stops
      the timer; leaving restarts it, from wherever it stopped.

   Everything else is the Film track's gating, for the same reasons: cycle only
   what is on screen, stop when the tab is hidden, and do not cycle at all
   under prefers-reduced-motion — a picture replaced twice a second is exactly
   what that setting is asking us not to do.
   ========================================================================== */
(function () {
  'use strict';

  var fig = document.querySelector('[data-fin-loop]');
  if (!fig) return;

  var frames = [].slice.call(fig.querySelectorAll('.trk-frame'));
  if (frames.length < 2) return;

  var DWELL   = 500;
  var PATIENCE = 5000;
  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  var idx = 0, timer = null, inView = false, hovered = false, ready = false;

  function show(n) {
    idx = (n + frames.length) % frames.length;
    for (var i = 0; i < frames.length; i++) {
      frames[i].classList.toggle('is-on', i === idx);
    }
  }

  function start() {
    if (timer || !ready || hovered || reduced.matches || !inView || document.hidden) return;
    timer = window.setInterval(function () { show(idx + 1); }, DWELL);
  }
  function stop() { if (timer) { window.clearInterval(timer); timer = null; } }

  /* ---- readiness ----
     `load` OR `error` counts as settled: a frame that 404s should not hold the
     other six hostage, it just flashes through as a blank. decode() is the
     part that matters — `complete` only says the bytes are in, and the first
     paint of an undecoded image is the jank we are trying to avoid. Its
     rejection is swallowed for the same reason. */
  function settled(img) {
    if (img.complete && img.naturalWidth) return Promise.resolve();
    return new Promise(function (res) {
      img.addEventListener('load', res, { once: true });
      img.addEventListener('error', res, { once: true });
    });
  }
  function decoded(img) {
    return img.decode ? img.decode().catch(function () {}) : Promise.resolve();
  }

  var imgs = frames.map(function (f) { return f.querySelector('img'); })
                   .filter(Boolean);
  var go = function () { if (!ready) { ready = true; start(); } };

  Promise.all(imgs.map(function (img) {
    return settled(img).then(function () { return decoded(img); });
  })).then(go);
  window.setTimeout(go, PATIENCE);

  /* ---- pause on hover ----
     pointerenter/leave rather than mouseenter/leave so a pen behaves like a
     mouse, and so a touch that lands on the frame pauses it too — on a phone
     pointerleave does not fire until the next tap elsewhere, which is the
     behaviour you want: tap to hold a page, tap away to release it. */
  fig.addEventListener('pointerenter', function () { hovered = true; stop(); });
  fig.addEventListener('pointerleave', function () { hovered = false; start(); });
  fig.addEventListener('pointercancel', function () { hovered = false; start(); });

  /* Only cycle what someone is looking at. */
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (es) {
      inView = es[es.length - 1].isIntersecting;
      if (inView) start(); else stop();
    }, { rootMargin: '-1px 0px' }).observe(fig);
  } else {
    inView = true; start();
  }
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) stop(); else start();
  });
  if (reduced.addEventListener) {
    reduced.addEventListener('change', function () { reduced.matches ? stop() : start(); });
  }

})();
