/* ==========================================================================
   TRACK 1 — FILM PRODUCTION: pinned scrollytelling
   GSAP ScrollTrigger over a Lenis-smoothed scroll. This file is only fetched
   at >=1024 with motion allowed (the loader in index.html gates it), so it may
   assume it is on desktop — but it still guards every dependency and re-checks
   the media query through gsap.matchMedia, so resizing below 1024 (or turning
   Reduce Motion on) cleanly tears the pin and Lenis down and leaves the plain
   CSS layout. Nothing here is required for the content to be readable.
   ========================================================================== */
(function () {
  'use strict';

  var section = document.querySelector('[data-trk-film]');
  if (!section) return;
  if (!window.gsap || !window.ScrollTrigger || !window.Lenis) return;  // libs blocked → static section

  gsap.registerPlugin(ScrollTrigger);

  /* One Lenis instance for the whole page, created only while the pin is live.
     Kept in this scope so the matchMedia cleanup can destroy it. */
  var lenis = null;
  var rafFn = null;

  function startLenis() {
    if (lenis) return;
    lenis = new Lenis({ lerp: 0.1, smoothWheel: true, wheelMultiplier: 1 });
    /* Drive ScrollTrigger off Lenis, and Lenis off GSAP's ticker, so the two
       share one rAF loop instead of fighting over the scroll position. */
    lenis.on('scroll', ScrollTrigger.update);
    rafFn = function (time) { lenis.raf(time * 1000); };
    gsap.ticker.add(rafFn);
    gsap.ticker.lagSmoothing(0);
  }

  function stopLenis() {
    if (!lenis) return;
    gsap.ticker.remove(rafFn);
    gsap.ticker.lagSmoothing(500, 33);   // restore GSAP's default
    lenis.destroy();
    lenis = null; rafFn = null;
  }

  var q  = function (s) { return section.querySelector(s); };
  var qa = function (s) { return section.querySelectorAll(s); };

  /* Enable the pin + reveal only on a wide viewport with motion allowed.
     gsap.matchMedia reverts everything inside (inline styles, the pin spacer,
     the timeline) the moment the query stops matching. */
  var mm = gsap.matchMedia();

  mm.add('(min-width: 1024px) and (prefers-reduced-motion: no-preference)', function () {
    startLenis();

    var media = q('[data-tf="media"]');
    var n     = q('[data-tf="n"]');
    var title = q('[data-tf="title"]');
    var sched = q('[data-tf="sched"]');
    var blks  = qa('[data-tf="blk"]');
    var clips = qa('.trk-clip');

    var tl = gsap.timeline({
      defaults: { ease: 'power2.out' },
      scrollTrigger: {
        trigger: section,
        start: 'top top',
        end: '+=185%',           /* the pinned scroll length the reveal plays over */
        pin: true,
        scrub: 0.7,
        anticipatePin: 1,
        invalidateOnRefresh: true
      }
    });

    /* Everything is an explicit fromTo, never .from(): a scrubbed timeline of
       chained .from() tweens with immediateRender captures the wrong end value
       (the already-applied start of a prior tween) and the piece stays hidden
       at progress 1. fromTo pins both ends, so the reveal is deterministic.

       opacity (not autoAlpha) so the copy stays in the accessibility tree the
       whole way through — legible to a screen reader before it scrolls in, and
       never visibility:hidden. */
    var rise = function (el, vars, at) {
      tl.fromTo(el,
        Object.assign({ opacity: 0 }, vars.from),
        Object.assign({ opacity: 1, duration: 0.5 }, vars.to), at);
    };

    /* The portrait eases out of a gentle push-in across the whole scrub. */
    tl.fromTo(media, { scale: 1.12 }, { scale: 1, ease: 'none', duration: 1.28 }, 0);

    rise(n,       { from: { y: 24 },        to: { y: 0 } }, 0.02);
    rise(title,   { from: { yPercent: 45 }, to: { yPercent: 0 } }, 0.02);
    rise(sched,   { from: { y: -18 },       to: { y: 0 } }, 0.14);
    rise(blks[0], { from: { y: 42 },        to: { y: 0 } }, 0.30);
    rise(blks[1], { from: { y: 42 },        to: { y: 0 } }, 0.46);
    tl.fromTo(clips, { opacity: 0, y: 64 }, { opacity: 1, y: 0, duration: 0.5, stagger: 0.07 }, 0.64);

    return function () {         /* cleanup when the query stops matching */
      tl.scrollTrigger && tl.scrollTrigger.kill();
      tl.kill();
      stopLenis();
    };
  });

  /* A late web-font swap or image decode changes element heights; keep the pin
     math honest. ScrollTrigger throttles its own refresh, so this is cheap. */
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(function () { ScrollTrigger.refresh(); });
  }
  window.addEventListener('load', function () { ScrollTrigger.refresh(); });
})();
