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
    var scrim = q('.trk-scrim');
    var n     = q('[data-tf="n"]');
    var title = q('[data-tf="title"]');
    var sched = q('[data-tf="sched"]');
    var blks  = qa('[data-tf="blk"]');
    var clips = qa('.trk-clip');

    var tl = gsap.timeline({
      defaults: { ease: 'power3.out' },
      scrollTrigger: {
        trigger: section,
        start: 'top top',
        end: '+=200%',           /* the pinned scroll length the reveal plays over */
        pin: true,
        scrub: 0.8,
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
        Object.assign({ opacity: 1, duration: 0.55, ease: 'power3.out' }, vars.to), at);
    };

    /* THE PORTRAIT settles out of a slow push-in across the whole scrub, with a
       hair of vertical drift. It never reaches scale 1 — it stays overscanned
       (>=1.04) the entire time so the drift can never expose an edge. This runs
       the full length so the frame is always quietly moving under the copy. */
    tl.fromTo(media,
      { scale: 1.14, yPercent: -1.6 },
      { scale: 1.04, yPercent: 1.6, ease: 'none', duration: 1.8 }, 0);

    /* The frame is brightest first, then the scrim deepens as the copy lands on
       it — the picture reads before the type covers its dark side. */
    tl.fromTo(scrim, { opacity: 0.4 }, { opacity: 1, ease: 'power1.inOut', duration: 0.7 }, 0.15);

    /* Beat 1 — eyebrow + title. The title wipes up behind a mask AND lifts a
       little, so it assembles rather than just fading. The -6%/106% insets keep
       ascenders and descenders from ever clipping at rest. */
    rise(n, { from: { y: 26 }, to: { y: 0 } }, 0.20);
    tl.fromTo(title,
      { opacity: 0, yPercent: 12, clipPath: 'inset(0 0 106% 0)' },
      { opacity: 1, yPercent: 0, clipPath: 'inset(0 0 -6% 0)', ease: 'power4.out', duration: 0.7 }, 0.22);

    /* Beat 2 — schedule, top-right, slides in from its own corner. */
    rise(sched, { from: { y: -16, x: 14 }, to: { y: 0, x: 0 } }, 0.44);

    /* Beat 3 — the two copy blocks, one after the other. */
    rise(blks[0], { from: { y: 46 }, to: { y: 0 } }, 0.60);
    rise(blks[1], { from: { y: 46 }, to: { y: 0 } }, 0.78);

    /* Beat 4 — the clips deal in from the foot, staggered, with a touch of
       scale so they feel placed rather than faded. */
    tl.fromTo(clips,
      { opacity: 0, y: 72, scale: 0.94 },
      { opacity: 1, y: 0, scale: 1, ease: 'power3.out', duration: 0.6, stagger: 0.1 }, 1.02);

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
