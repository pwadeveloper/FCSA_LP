/* ==========================================================================
   FILM TRACK — three cycling background frames, and a glitch on hover.

   TWO SEPARATE THINGS in one file because they share one piece of state: which
   frame is currently up. The cycle owns it; the glitch reads it.

   1. THE CYCLE. Three frames crossfade on a 2.5s dwell. The clip strip at the
      foot mirrors the index — the frame that is up shows in colour, the other
      two sit in greyscale — so the row doubles as an indicator instead of
      being three unrelated stills.

   2. THE CURSOR EFFECT is NOT here. hero-shader.js owns it: the same chromatic
      bloom the hero uses, pointed at this track's frame stack, reading the
      active index from window.filmCarousel below. One shader, two surfaces.
   ========================================================================== */
(function () {
  'use strict';

  var sec = document.querySelector('.trk--film');
  if (!sec) return;

  var frames = [].slice.call(sec.querySelectorAll('.trk-bg-frame'));
  var clips  = [].slice.call(sec.querySelectorAll('.trk-clip'));
  if (frames.length < 2) return;

  var DWELL   = 3000;
  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  var idx = 0, timer = null, inView = false;

  /* The cursor shader reads the active frame through this, exactly as it does
     on the hero via window.heroCarousel — one owner of the index, and the
     shader is told rather than polling the DOM. */
  var subs = [];
  window.filmCarousel = {
    onChange: function (fn) { subs.push(fn); fn(idx); },
    get index() { return idx; }
  };

  function show(n) {
    idx = (n + frames.length) % frames.length;
    for (var i = 0; i < frames.length; i++) {
      frames[i].classList.toggle('is-on', i === idx);
      if (clips[i]) clips[i].classList.toggle('is-on', i === idx);
    }
    for (var j = 0; j < subs.length; j++) subs[j](idx);
  }

  function start() {
    if (timer || reduced.matches || !inView || document.hidden) return;
    timer = window.setInterval(function () { show(idx + 1); }, DWELL);
  }
  function stop() { if (timer) { window.clearInterval(timer); timer = null; } }

  /* Only cycle what someone is looking at. A timer swapping full-viewport
     photographs in a section three screens away is work nobody sees. */
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (es) {
      inView = es[es.length - 1].isIntersecting;
      if (inView) start(); else stop();
    }, { rootMargin: '-1px 0px' }).observe(sec);
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
