/* ==========================================================================
   CONTENT TRACK — three 9:16 clips, looping.

   The clips carry no src in the markup. This file decides whether to fetch
   them at all, and then plays them only while the section is on screen.

   WHY THE GATE IS A FETCH GATE AND NOT JUST A PLAY GATE. Three autoplaying
   videos is three simultaneous decodes. On a mid-range phone that is the
   difference between a section that scrolls and one that stutters, and on a
   metered connection it is a megabyte of decoration nobody asked for. So on
   mobile, under save-data, on 2g/3g, or under prefers-reduced-motion, no src
   is ever assigned and no byte is ever requested — the posters stand in, and
   the section still reads exactly as intended.

   That threshold (>=1024, not reduced, not metered) is the same one script.js
   already applies to every other video on this page. One policy, not two.
   ========================================================================== */
(function () {
  'use strict';

  var sec = document.querySelector('.trk--content');
  if (!sec) return;

  var vids = [].slice.call(sec.querySelectorAll('.trk-vid'));
  if (!vids.length) return;

  var wideMq    = window.matchMedia('(min-width: 1024px)');
  var reducedMq = window.matchMedia('(prefers-reduced-motion: reduce)');
  var inView = false, loaded = false;

  /* Same reading as script.js: saveData is the explicit request, and the 2g/3g
     buckets are the implicit one. A 1MB decorative autoplay on a metered
     connection is exactly what Save-Data exists to prevent. */
  function metered() {
    var c = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    return !!(c && (c.saveData === true || /^(slow-2g|2g|3g)$/.test(c.effectiveType || '')));
  }
  function allowed() {
    return wideMq.matches && !reducedMq.matches && !metered();
  }

  /* One rung, chosen once. The card measures 249px at 1440 and 314px at 1920,
     so 640 covers a 2x display and 360 covers everything below the autoplay
     threshold — which never loads anyway, and is kept only so the attribute
     is not a lie about what exists. */
  function hydrate() {
    if (loaded) return;
    loaded = true;
    vids.forEach(function (v) {
      var src = v.getAttribute('data-src-640');
      if (src) v.src = src;
    });
  }

  function play() {
    if (!allowed() || !inView || document.hidden) return;
    hydrate();
    vids.forEach(function (v) {
      var p = v.play();
      /* A rejected play() is not swallowed. It happens — a browser can refuse
         even a muted autoplay — and the honest response is to leave the poster
         showing rather than a frozen first frame pretending to be a still. */
      if (p && p.catch) {
        p.catch(function () { v.classList.add('is-blocked'); });
      }
    });
  }
  function pause() {
    vids.forEach(function (v) { if (!v.paused) v.pause(); });
  }

  /* Only decode what someone is looking at. Three loops running in a section
     three screens away is work nobody sees, on a battery somebody owns. */
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (es) {
      inView = es[es.length - 1].isIntersecting;
      if (inView) play(); else pause();
    }, { rootMargin: '200px 0px' }).observe(sec);
  } else {
    inView = true; play();
  }

  document.addEventListener('visibilitychange', function () {
    if (document.hidden) pause(); else play();
  });

  /* Crossing the threshold either way is handled: widening the window starts
     them, narrowing or asking for reduced motion stops them. */
  [wideMq, reducedMq].forEach(function (mq) {
    if (mq.addEventListener) {
      mq.addEventListener('change', function () { allowed() ? play() : pause(); });
    }
  });
})();
