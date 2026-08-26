/* ==========================================================================
   HERO CAROUSEL

   Five frames, 7s dwell, 800ms opacity crossfade. Owns three things the rest
   of the page does not touch: which frame is on, how dense the scrim is, and
   whether anything is allowed to rotate at all.

   It publishes window.heroCarousel so hero-shader.js can follow the frame
   changes without either file importing the other. If hero-shader.js never
   loads, or throws, nothing here notices.

   THE SCRIM IS PART OF THE CAROUSEL, not a separate system. Three of the five
   images are light where the headline sits, so alpha has to move with the
   image. --scrim is set on .hero-scrim, which carries an 800ms transition on
   the registered @property, so the density eases across on exactly the same
   clock as the crossfade and never lags the picture.
   ========================================================================== */
(function () {
  'use strict';

  /* The 800ms crossfade lives entirely in CSS (--hero-fade on .hero); nothing
     here needs to know it, because nothing here animates. This file only
     decides WHEN the class flips. The dwell is the one timing JS owns.

     3s dwell against an 800ms crossfade leaves each image about 2.2s at full
     opacity. That is fast enough that a frame which has not finished decoding
     would show as a hole, so advance() refuses to move onto one — see below. */
  var DWELL = 3000;

  var media  = document.querySelector('.hero-media');
  var frames = document.querySelectorAll('.hero-frame');
  var scrim  = document.querySelector('.hero-scrim');
  var dotBox = document.getElementById('hero-dots');
  var hero   = document.querySelector('.hero');
  if (!media || frames.length < 2 || !hero) return;

  var dots = dotBox ? dotBox.querySelectorAll('.hero-dot') : [];

  /* ---------- what the connection will tolerate ----------
     Save-Data is an explicit "send me less" from the user; 2g is a measured
     fact about the link. Either one and the carousel does not exist: one
     image, no dots, no further requests. Rotating five 150KB frames at a
     stranger's expense is not a design decision we get to make for them. */
  var conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
  var thin = !!(conn && (conn.saveData === true ||
                         conn.effectiveType === '2g' ||
                         conn.effectiveType === 'slow-2g'));

  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var i = 0;
  var manifest = null;
  var timer = null;
  /* A set of reasons, not a boolean. Hover, focus and tab-hidden can overlap,
     and leaving one of them must not restart the clock while another holds. */
  var holds = Object.create(null);

  /* ---------- loading ----------
     Frames 2-5 ship with no src and no srcset at all, only data-*. They are
     all inside the viewport from the first paint, so loading="lazy" would have
     fetched every one of them straight away — the attribute means "near the
     viewport", and they are IN it. No src is the only thing that actually
     holds a request back. */
  function hydrate(n) {
    var f = frames[n];
    if (!f || f.dataset.on === '1') return;
    f.dataset.on = '1';
    Array.prototype.forEach.call(f.querySelectorAll('source'), function (s) {
      if (s.dataset.srcset) { s.srcset = s.dataset.srcset; delete s.dataset.srcset; }
    });
    var img = f.querySelector('img');
    if (!img) return;
    if (img.dataset.srcset) { img.srcset = img.dataset.srcset; delete img.dataset.srcset; }
    if (img.dataset.src)    { img.src    = img.dataset.src;    delete img.dataset.src; }
  }

  /* ---------- the manifest, read from the DOM ----------
     hero-manifest.json is the source of truth, but it is baked into the markup
     by tools/hero-derivatives.py as data-scrim / data-reach on each frame,
     and this reads THOSE. The fetch below is only a refresh for anyone editing
     the JSON without re-running the tool.

     It used to be fetch-first. That broke the moment anyone opened the page
     from disk: over file:// the fetch is blocked outright, so frames 2-n never
     got their density or their crop and every image rendered at frame 1's
     scrim. Attributes cost one request fewer and cannot fail. */
  function applyManifest(list) {
    manifest = list;
    var byId = Object.create(null);
    for (var k = 0; k < list.length; k++) byId[list[k].id] = list[k];
    /* Matched on data-hero, never on position. The manifest keeps entries that
       have been dropped from the page (usable:false) so the reason survives in
       the file, which means the two lists are different lengths and index
       alignment would be luck. */
    Array.prototype.forEach.call(frames, function (f) {
      var m = byId[f.dataset.hero];
      if (!m) return;
      var img = f.querySelector('img');
      if (img && m.pos) img.style.setProperty('--hero-pos', m.pos);
      f.dataset.scrim = String(m.scrim);
      if (m.reach != null) f.dataset.reach = String(m.reach);
    });
    paintScrim(i);
  }

  function paintScrim(n) {
    var f = frames[n];
    if (!f || !scrim) return;
    if (f.dataset.scrim) scrim.style.setProperty('--scrim', f.dataset.scrim);
    /* Reach and density are separate knobs: a bright image can need the wedge
       to travel further rather than to sit darker. Absent means 1. */
    scrim.style.setProperty('--scrim-reach', f.dataset.reach || '1');
  }

  /* ---------- the one state change ---------- */
  function show(n) {
    if (n === i) return;
    frames[i].classList.remove('is-on');
    frames[i].setAttribute('aria-hidden', 'true');
    frames[n].classList.add('is-on');
    frames[n].removeAttribute('aria-hidden');

    if (dots.length) {
      dots[i].classList.remove('is-on');
      dots[i].removeAttribute('aria-current');
      dots[n].classList.add('is-on');
      dots[n].setAttribute('aria-current', 'true');
    }

    i = n;
    paintScrim(n);

    /* One frame ahead, never five up front. The prefetch fires on ARRIVAL at
       a frame, so the next image has the full 7s dwell to come down the wire
       and is decoded by the time it is asked to paint. */
    hydrate((n + 1) % frames.length);

    if (window.heroCarousel && window.heroCarousel._cb) {
      try { window.heroCarousel._cb(n, frames[n]); } catch (e) {}
    }
  }

  /* ---------- the clock ----------
     A frame whose image has not decoded yet would crossfade to a hole, because
     an <img> with no bytes paints nothing and the black ground shows through.
     At a 3s dwell that is a live risk on a slow link, so the tick SKIPS rather
     than shows: it hydrates the frame, leaves the current one up, and tries
     again on the next beat. The carousel slows down on a slow connection
     instead of flashing. */
  function ready(n) {
    var img = frames[n] && frames[n].querySelector('img');
    return !!(img && img.complete && img.naturalWidth);
  }

  function tick() {
    var n = (i + 1) % frames.length;
    hydrate(n);
    if (!ready(n)) return;
    show(n);
  }

  function run() {
    if (timer || reduced || thin) return;
    for (var k in holds) if (holds[k]) return;
    timer = setInterval(tick, DWELL);
  }
  function halt() {
    if (timer) { clearInterval(timer); timer = null; }
  }
  function hold(reason, on) {
    holds[reason] = on;
    if (on) halt(); else run();
  }

  /* ---------- wiring ---------- */
  if (thin) {
    /* Nothing rotates, so a control that jumps between images the page will
       never fetch is a lie. Hide it outright rather than leave it inert. */
    if (dotBox) dotBox.hidden = true;
  } else {
    Array.prototype.forEach.call(dots, function (d) {
      d.addEventListener('click', function () {
        var n = parseInt(d.dataset.go, 10);
        if (isNaN(n)) return;
        hydrate(n);
        var go = function () {
          show(n);
          /* A manual jump earns a full dwell, not the tail of the old one. */
          if (timer) { halt(); run(); }
        };
        /* Asked for explicitly, so this one waits rather than skips — but it
           still will not paint a frame that has nothing to paint. */
        if (ready(n)) go();
        else {
          var img = frames[n].querySelector('img');
          if (img) img.addEventListener('load', go, { once: true });
        }
      });
    });

    /* Hover and focus-within both hold the clock: reading the subhead should
       not cost you the image you were looking at, and neither should tabbing
       onto a dot. focusin/focusout on .hero is :focus-within in JS — it is
       used rather than the CSS pseudo because the pause is behaviour, not
       paint, and has to survive on browsers that fire focus oddly. */
    hero.addEventListener('mouseenter', function () { hold('hover', true); });
    hero.addEventListener('mouseleave', function () { hold('hover', false); });
    hero.addEventListener('focusin',    function () { hold('focus', true); });
    hero.addEventListener('focusout',   function () { hold('focus', false); });

    /* A background tab must not burn 7s timers, and must not advance past
       four images while nobody is looking. */
    document.addEventListener('visibilitychange', function () {
      hold('hidden', document.hidden);
    });

    if (!reduced) {
      /* Only start once the LCP frame has actually painted. Starting the
         clock during load would put the second image's request in contention
         with the one that decides the LCP. */
      var first = frames[0].querySelector('img');
      var begin = function () { hydrate(1); run(); };
      if (!first || first.complete) begin();
      else first.addEventListener('load', begin, { once: true });
    }
  }

  /* ---------- published, read-only-ish, for the shader ---------- */
  window.heroCarousel = {
    frames: frames,
    reduced: reduced,
    thin: thin,
    get index() { return i; },
    get manifest() { return manifest; },
    onChange: function (cb) { this._cb = cb; }
  };

  /* Frame 1's scrim/pos are already in the HTML; this only has to be right
     for 2-5, so a failed fetch costs the per-image density but never the
     first paint. Nothing above depends on it resolving. */
  fetch('assets/media/hero/hero-manifest.json', { credentials: 'same-origin' })
    .then(function (r) { return r.ok ? r.json() : null; })
    .then(function (list) { if (list && list.length) applyManifest(list); })
    .catch(function () {});
})();
