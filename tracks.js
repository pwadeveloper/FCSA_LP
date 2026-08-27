/* ==========================================================================
   THE THREE TRACK SECTIONS — reveal on enter
   Each [data-trk] section reveals its pieces once, staggered, when it scrolls
   into view. No pin, no scroll hijack, no library: native scroll, and the CSS
   does the actual motion (.trk-anim + a per-element --i delay). Degrades to
   fully visible with no JS, no IntersectionObserver, or reduce-motion.
   ========================================================================== */
(function () {
  'use strict';
  var secs = document.querySelectorAll('[data-trk]');
  if (!secs.length) return;

  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduced || !('IntersectionObserver' in window)) {
    for (var i = 0; i < secs.length; i++) secs[i].classList.add('in');
    return;
  }

  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      if (!e.isIntersecting) return;
      e.target.classList.add('in');
      io.unobserve(e.target);           /* once */
    });
  }, { rootMargin: '0px 0px -12% 0px', threshold: 0.12 });

  for (var j = 0; j < secs.length; j++) io.observe(secs[j]);
})();
