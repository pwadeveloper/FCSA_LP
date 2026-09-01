/* ==========================================================================
   THE FILM AND CONTENT SCHOOL
   ========================================================================== */

/* ==========================================================================
   LAUNCH GATE — do not ship dashed boxes to a live page.
   Set this false before launch. Every slot that still has no real <img> or
   <video> is removed from the DOM, and the layout closes up around it.
   Four real assets beat sixteen briefs.
   ========================================================================== */
var SHOW_MEDIA_PLACEHOLDERS = true;

(function () {
  'use strict';

  var root = document.documentElement;
  root.classList.add('js');

  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- 1. page-load sequence ---------- */
  requestAnimationFrame(function () {
    requestAnimationFrame(function () { root.classList.add('ready'); });
  });

  /* ---------- 1b. anchor landing ----------
     Loading with a hash scrolls using fallback-font metrics, then the real
     fonts swap in and every section shifts up to ~120px. The browser does not
     re-scroll, so you land on the wrong section. Re-aim once fonts settle. */
  function reaim() {
    if (!location.hash) return;
    var t;
    try { t = document.querySelector(location.hash); } catch (e) { return; }
    if (!t) return;
    t.scrollIntoView({ block: 'start', behavior: 'auto' });
  }

  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(function () {
      reaim();
      /* one more after layout settles, for slow connections */
      setTimeout(reaim, 120);
    });
  } else {
    window.addEventListener('load', reaim);
  }

  /* ---------- 1c. header: never gets a background, only gets smaller ----------
     The header floats over whatever is beneath it for the whole page. The only
     thing that changes is scale: full size at rest, compact past 120px.

     Scroll DISTANCE only. Not scroll direction, not which section is in view —
     the class is a pure function of scrollY, so the header height is always
     predictable from the scroll position alone. 120 down / 96 up is a dead band
     so parking on the threshold cannot flutter the 200ms transition.

     Nothing here reads --head-h; that token is gone. The header's height is
     derived in CSS from --head-pad-top + --head-mark-compact + --edge, so
     scroll-margin-top on the anchor targets cannot go stale when this fires. */
  var head = document.getElementById('site-head');
  if (head) {
    var COMPACT_ON = 120, COMPACT_OFF = 96;
    var compact = false, ticking = false;
    var apply = function () {
      ticking = false;
      var y = window.scrollY || window.pageYOffset || 0;
      if (!compact && y >= COMPACT_ON) { compact = true; head.classList.add('is-compact'); }
      else if (compact && y < COMPACT_OFF) { compact = false; head.classList.remove('is-compact'); }
    };
    var onScroll = function () {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(apply);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    apply();   /* restored scroll position on reload must not start at rest */
  }

  /* ---------- 1d. hero video: no autoplay below 1024px, none if reduced ---------- */
  var hv = document.querySelector('.hero-video');
  if (hv) {
    var wide = window.matchMedia('(min-width: 1024px)');
    var syncHero = function () {
      if (wide.matches && !reduced) { hv.play().catch(function () {}); }
      else { hv.pause(); }
    };
    syncHero();
    if (wide.addEventListener) wide.addEventListener('change', syncHero);
  }

  /* ---------- 1e. rest state / reel ----------
     Two states over one full-viewport section, and TWO ENTIRELY SEPARATE
     VIDEOS. Confusing them is the one thing that would make this section
     expensive.

     REST is BackgroundLoop: 9.6 seconds, silent, muted, decorative, and it
     starts on its own. PLAY is the reel: a minute with a music bed, which
     never starts without a press. Pressing stops and hides the loop before
     the reel is even given a URL; exiting unloads the reel and brings the
     loop back.

     THE LOOP IS CONSTRUCTED HERE, not shipped in the markup, because the
     brief's suppression rules are absolute — under 1024px, on Save-Data or
     2g/3g, and under prefers-reduced-motion there is to be no video element
     at all. An element that exists with a src is a fetch the browser is
     entitled to start on its own schedule; an element that was never created
     is a guarantee. In all three cases the poster in the markup is already
     the background and the section looks identical, just still.

     THE REEL, conversely, is in the markup but with preload="none" and NO
     src — a media element cannot preload what it has no URL for. The
     rendition is chosen at press time for two reasons: <source media> is
     read once at load and never re-evaluated by any shipping browser, and
     the connection is worth measuring when it is about to be used rather
     than during parse.

     THE REEL PLAYS WITH SOUND. That is a deliberate reversal of the loop
     next to it: this is a full-viewport takeover somebody explicitly asked
     for, not wallpaper they scrolled past, and the press is a real user
     gesture so autoplay policy allows audio. The native control bar carries
     the mute switch if they want it back.
  */
  (function stillReel() {
    var box = document.querySelector('[data-still]');
    if (!box) return;
    var vid   = box.querySelector('.still-video');
    var play  = box.querySelector('.still-play');
    var close = box.querySelector('.still-close');
    var veil  = box.querySelector('.still-veil');
    if (!vid || !play) return;

    var wideMq    = window.matchMedia('(min-width: 1024px)');
    var reducedMq = window.matchMedia('(prefers-reduced-motion: reduce)');

    /* Save-Data as a HEADER is not readable from script; navigator.connection
       .saveData is the client-side half of the same signal and is what a
       browser sets when the user turns the setting on. Both halves point at
       the same preference, so honouring this one honours the header. */
    function conn() {
      return navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    }
    function frugal() {
      var c = conn();
      return !!(c && (c.saveData === true || /^(slow-2g|2g|3g)$/.test(c.effectiveType || '')));
    }

    /* ---------- 3g IS NOT A REASON TO SEND NOTHING ----------
       The brief said suppress the loop on 2g, slow-2g and 3g. 3g turned out to
       be the wrong line, and it was suppressing the feature for the person who
       commissioned it: Chrome buckets anything over 270ms RTT as '3g'
       regardless of the actual technology, so a desktop reader on a 300ms /
       1.5Mbps link got the poster and no way to tell it was deliberate.

       Two facts make degrading better than suppressing here. The <1024px gate
       already means no phone ever loads this video, so the 3g branch only ever
       hits DESKTOP readers on a slow link — not the mobile-data audience the
       budget was written for. And the two renditions bracket exactly this
       case: 720p is 1.82Mbps, which would not fit a 1.5Mbps link anyway, while
       540p is 0.92Mbps, which fits comfortably. Sending the small file is both
       the kinder answer and the honest one.

       So: saveData and 2g/slow-2g still send nothing — a 1MB autoplay on a
       sub-0.4Mbps link is hopeless and asking for it is rude. 3g gets the
       small rendition. */
    function loopBlocked() {
      var c = conn();
      return !!(c && (c.saveData === true || /^(slow-2g|2g)$/.test(c.effectiveType || '')));
    }
    function loopThrifty() {
      var c = conn();
      return !!(c && c.effectiveType === '3g');
    }

    /* 720p below 1024px, on Save-Data, and on 2g/3g. Pushing 1080p into a
       900px-wide box is twice the bytes for pixels that box cannot show. */
    function thin() {
      return frugal() || !wideMq.matches;
    }

    var loaded = false;
    function load() {
      if (loaded) return;
      loaded = true;
      vid.src = box.getAttribute(thin() ? 'data-src-720' : 'data-src-1080');
    }

    /* ---------- the ambient loop ----------
       Three gates, all of which also mean "leave the poster showing". */
    var loop = null;
    var near  = false;            /* within lead distance — worth constructing */
    var shown = false;            /* actually on screen — worth decoding */

    function loopAllowed() {
      return wideMq.matches && !reducedMq.matches && !loopBlocked();
    }

    /* Rendition by DEVICE pixels, not CSS pixels. The <1024 rung in the brief
       has no consumer once the loop is suppressed below 1024 outright, so the
       small rung earns its place on the axis that is still live: a 1280-wide
       file is already an upscale into any full-viewport box on a retina
       screen, and 960 is only honest where the display cannot resolve the
       difference. dpr is capped at 2 because past that nothing on this page
       is being resolved anyway. */
    function loopSrc() {
      /* A slow link overrides the pixel maths: 540p at 0.92Mbps is the whole
         reason 3g is allowed to play at all. */
      if (loopThrifty()) return box.getAttribute('data-loop-540');
      var px = window.innerWidth * Math.min(window.devicePixelRatio || 1, 2);
      return box.getAttribute(px >= 1280 ? 'data-loop-720' : 'data-loop-540');
    }

    function makeLoop() {
      if (loop) return;
      var v = document.createElement('video');
      v.className = 'still-loop';
      /* Property AND attribute on the three that matter. The property is what
         the autoplay gate reads; the attribute is what iOS reads and what
         survives load(). defaultMuted is the one that keeps it muted across a
         reload of the resource — muted alone does not. */
      v.muted = true; v.defaultMuted = true; v.setAttribute('muted', '');
      v.loop = true;  v.setAttribute('loop', '');
      v.playsInline = true;
      v.setAttribute('playsinline', '');
      v.setAttribute('webkit-playsinline', '');
      v.preload = 'metadata';
      /* Decorative. It carries nothing the pull line over it does not say,
         and it must never be a tab stop or a PiP offer. */
      v.setAttribute('aria-hidden', 'true');
      v.tabIndex = -1;
      v.disablePictureInPicture = true;
      v.setAttribute('disablepictureinpicture', '');
      v.width = 1280; v.height = 720;
      /* No poster attribute: the <picture> underneath is already showing this
         exact frame in AVIF at a third of the JPEG's bytes. Fade in only once
         a real frame exists, so a decoder that paints black before its first
         frame cannot flash over the poster. */
      var ready = function () { v.classList.add('is-ready'); };
      v.addEventListener('loadeddata', ready);
      v.addEventListener('playing', ready);

      /* BELT AND BRACES ON THE LOOP, because `loop` is the one media attribute
         engines quietly drop. It is set as both property and attribute above,
         and Chromium honours it — measured here, the wrap costs a single frame
         (40.8ms against a 41.7ms median step). But honouring it requires the
         engine to be able to seek the resource back to zero, and WebKit will
         not seek a resource served by a host that answers 200 to a Range
         request instead of 206. `python3 -m http.server`, which is what this
         project is tested on and which README already flags, is exactly such a
         host: in Safari that combination gives a video that plays once and
         stops on its last frame.

         So do not rely on it alone. When the native loop is dropped the
         element fires `ended`, and this puts it back. Where the native loop
         works `ended` never fires and none of this ever runs. */
      v.addEventListener('ended', function () {
        if (!loop) return;
        try { v.currentTime = 0; } catch (e) {}
        var p = v.play();
        if (p && p.catch) p.catch(function () {});
      });

      /* IN THE DOM BEFORE IT GETS A URL. Resource selection on a detached
         media element is the path engines disagree about — WebKit in
         particular can finish selecting against an element that is not yet in
         a document and end up ignoring attributes set alongside the src, `loop`
         among them. Attached first, there is nothing to disagree about. */
      box.insertBefore(v, veil || vid);
      v.src = loopSrc();
      loop = v;
    }

    function dropLoop() {
      if (!loop) return;
      var v = loop;
      loop = null;
      v.pause();
      /* Same unload as the reel below: removeAttribute + load() drops the
         buffered bytes and cancels the fetch. src = '' would resolve the
         empty string against the document URL and re-request the page. */
      v.removeAttribute('src');
      v.load();
      if (v.parentNode) v.parentNode.removeChild(v);
    }

    function resume() {
      if (!loop || !shown || document.hidden) return;
      if (box.classList.contains('is-live')) return;
      /* metadata until here, auto from here. The brief's point was not to
         spend bytes ahead of need, and this line is the moment the need is
         established: every gate has passed and the section is on screen.
         Promoting here rather than off the `playing` event because `playing`
         is not guaranteed to fire on a first play that never had to wait for
         data — measured, it fired on some loads and not others, and a hint
         that only sometimes applies is worse than none.

         It buys the seam. Measured against a host that does NOT serve Range,
         the wrap stalled 242ms at preload="metadata" because the head of the
         file had been evicted and had to be fetched again. Holding the whole
         2MB once we are committed to it takes the worst step to 51ms. */
      loop.preload = 'auto';
      var p = loop.play();
      if (p && p.then) p.then(mark('playing'), blocked);
    }

    /* ---------- the failure that looks like success ----------
       A rejected play() used to be swallowed by an empty catch, and that is
       the one outcome indistinguishable from working: the element is in the
       DOM, `is-ready` has already fired off `loadeddata`, opacity is 1 — and
       what you are looking at is frame zero, held. The poster underneath IS
       frame zero, so a blocked autoplay and a suppressed loop and a healthy
       first paint all render the same pixels. That is why it was reported as
       "frozen on the first frame" rather than as an error: nothing anywhere
       said otherwise.

       Two things change. The state is written to the section as
       data-loop-state, so the answer is one glance in devtools instead of a
       guess. And a block is retried on the next real user gesture, which is
       precisely what lifts an autoplay block — the reader scrolls or clicks
       within a second or two of arriving, and the loop starts itself. */
    function mark(state) {
      return function () { box.setAttribute('data-loop-state', state); };
    }

    var gestureArmed = false;
    var GESTURES = ['pointerdown', 'keydown', 'touchstart', 'wheel'];

    function retryOnGesture() {
      gestureArmed = false;
      for (var i = 0; i < GESTURES.length; i++) {
        document.removeEventListener(GESTURES[i], retryOnGesture);
      }
      resume();
    }

    function blocked() {
      box.setAttribute('data-loop-state', 'blocked');
      if (gestureArmed) return;
      gestureArmed = true;
      for (var i = 0; i < GESTURES.length; i++) {
        document.addEventListener(GESTURES[i], retryOnGesture, { passive: true });
      }
    }

    function suspend() {
      if (loop) { loop.pause(); box.setAttribute('data-loop-state', 'paused'); }
    }

    function syncLoop() {
      if (!loopAllowed()) {
        dropLoop();
        /* Name the ACTUAL reason. "save-data" covered two very different
           causes, and the second one is the one that bites: Chrome is the only
           engine that implements navigator.connection, and it reports
           effectiveType '3g' on plenty of ordinary connections — measured on
           RTT, not on the technology. A reader on usable Wi-Fi can therefore
           be handed the poster forever while the attribute says something that
           sounds deliberate. Spell out which it was. */
        var c = conn();
        box.setAttribute('data-loop-state', 'suppressed:' +
          (!wideMq.matches      ? 'width'
           : reducedMq.matches  ? 'reduced-motion'
           : (c && c.saveData)  ? 'save-data'
           : 'effective-type-' + ((c && c.effectiveType) || 'unknown')));
        return;
      }
      if (near) { makeLoop(); resume(); }
    }

    if (wideMq.addEventListener) {
      wideMq.addEventListener('change', syncLoop);
      reducedMq.addEventListener('change', syncLoop);
    }
    /* A backgrounded tab keeps decoding video in some engines. Nothing is
       watching it, so stop. */
    document.addEventListener('visibilitychange', function () {
      if (document.hidden) suspend(); else resume();
    });

    /* TWO observers over the loop, because "worth downloading" and "worth
       decoding" are different distances and one rootMargin cannot be both.
       The lead observer runs 20% of a viewport early, so the first frame has
       a moment to decode behind the poster instead of arriving after the
       section does. The second is the viewport exactly: off screen is off,
       with no margin, because a loop nobody can see must not be holding a
       decoder open. Collapsing these into one observer is what makes a loop
       keep running while the reader sits on the hero. */
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (es) {
        near = es[es.length - 1].isIntersecting;
        if (near) syncLoop();
      }, { rootMargin: '20% 0px' }).observe(box);
      /* -1px, not 0. The hero above is exactly 100svh, so at the top of the
         page this section's first pixel row sits exactly ON the fold, and a
         zero-height intersection is one Chromium reports as intersecting.
         Left at 0 the loop plays, and buffers, for every reader who lands and
         does not scroll — with none of it on screen. Shrinking the root by a
         pixel means at least one row has to be genuinely inside the viewport,
         which is what "out of view" was meant to say. */
      new IntersectionObserver(function (es) {
        shown = es[es.length - 1].isIntersecting;
        if (shown) resume(); else suspend();
      }, { rootMargin: '-1px 0px' }).observe(box);
    } else {
      near = shown = true;
      syncLoop();
    }

    function enter() {
      load();
      /* Stop the wallpaper before the film starts. CSS takes it to opacity 0
         in the same class flip; this is what stops it decoding. */
      suspend();
      box.classList.add('is-live');
      if (close) close.hidden = false;
      /* Native controls from here, and no custom player. Scrub, volume,
         captions, PiP, AirPlay and the OS fullscreen affordance are all
         things the platform already does better than a bespoke bar. */
      vid.controls = true;
      vid.muted = false;
      vid.play().then(function () {
        vid.focus();
      }).catch(function () {
        /* Refused — rare off a real gesture, but a browser that will not
           start unmuted is worth one retry muted before giving the still
           back, because silent playback beats no playback. */
        vid.muted = true;
        vid.play().then(function () { vid.focus(); }).catch(exit);
      });
    }

    function exit() {
      if (!box.classList.contains('is-live')) return;
      box.classList.remove('is-live');
      if (close) close.hidden = true;
      vid.pause();
      vid.controls = false;
      /* Unload rather than just pause: removeAttribute + load() drops the
         buffered bytes and stops the network fetch. Setting src to '' would
         make the element resolve the empty string against the document URL
         and re-request the page itself. */
      vid.removeAttribute('src');
      vid.load();
      loaded = false;
      play.focus();
      resume();
    }

    play.addEventListener('click', enter);
    if (close) close.addEventListener('click', exit);

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' || e.key === 'Esc') exit();
    });

    /* Scrolled out of view: leave the play state entirely. Audio continuing
       from a section nobody can see is worse than losing your place in a
       57-second reel. Separate from the loop observer above — this one wants
       a quarter of the section gone before it acts, and no lead time. */
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (es) {
        if (!es[0].isIntersecting) exit();
      }, { threshold: 0.25 }).observe(box);
    }
  })();

  /* ---------- 1f. media slots ---------- */

  /* Strip empty slots when the launch gate is closed. A slot counts as filled
     only if it actually holds an <img> or <video>. */
  if (!SHOW_MEDIA_PLACEHOLDERS) {
    Array.prototype.forEach.call(document.querySelectorAll('.slot'), function (fig) {
      if (fig.querySelector('img, video')) return;
      fig.parentNode.removeChild(fig);
    });
    Array.prototype.forEach.call(document.querySelectorAll('.showcase-scroll, .prod-scroll'), function (w) {
      if (!w.querySelector('.slot')) {
        var sec = w.closest('section');
        if (sec) sec.parentNode.removeChild(sec);
      }
    });
  }

  /* Loop playback, wherever a real <video> lands.
     No autoplay below 1024px and none under prefers-reduced-motion — this
     audience is on mobile data. Those cases get the poster and a play button. */
  var wideMq = window.matchMedia('(min-width: 1024px)');
  /* :not(.trk-vid) — RE-APPLIED, and load-bearing. The Content Track's three
     clips are decorative, sit in an aria-hidden grid, and measure ~110px on a
     phone. Without this scope they each get a .slot-play button, and all three
     of the following are true at once: a keyboard-focusable control lives
     inside aria-hidden (which is the aria-hidden-focus violation), the button
     is 65x40 against a 44px floor, and sync() below runs
     `v.pause(); v.currentTime = 0` on elements content-track.js is
     simultaneously trying to play. content-track.js owns them. */
  var vids = document.querySelectorAll('.slot video:not(.trk-vid)');

  function wireSlotVideo(v) {
    var fig = v.closest('.slot');
    var box = v.closest('.slot-box') || fig;   /* the positioned ratio box */
    var btn = fig.querySelector('.slot-play');
    if (!btn) {
      btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'slot-play';
      box.appendChild(btn);
    }
    var label = function () {
      var playing = !v.paused && !v.ended;
      btn.textContent = playing ? 'Pause' : 'Play';
      btn.setAttribute('aria-label', (playing ? 'Pause' : 'Play') + ' this clip');
    };
    btn.addEventListener('click', function () {
      if (v.paused) { v.play().catch(function () {}); } else { v.pause(); }
      label();
    });
    v.addEventListener('play', label);
    v.addEventListener('pause', label);

    var sync = function () {
      var mayAutoplay = wideMq.matches && !reduced;
      fig.classList.toggle('has-control', !mayAutoplay);
      if (mayAutoplay) { v.play().catch(function () {}); }
      else { v.pause(); v.currentTime = 0; }
      label();
    };
    sync();
    if (wideMq.addEventListener) wideMq.addEventListener('change', sync);
  }

  Array.prototype.forEach.call(vids, wireSlotVideo);

  /* ---------- 2. section reveals ---------- */
  var reveals = document.querySelectorAll('.reveal');

  if (reduced || !('IntersectionObserver' in window)) {
    for (var i = 0; i < reveals.length; i++) reveals[i].classList.add('in');
  } else {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        e.target.classList.add('in');
        io.unobserve(e.target);
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });

    for (var j = 0; j < reveals.length; j++) io.observe(reveals[j]);
  }

  /* ---------- 3. timeline: blocks lay down left to right, once ---------- */
  var tl = document.getElementById('tl');

  if (tl) {
    var blocks = tl.querySelectorAll('.blk');

    /* stagger by column so it reads as a playhead, not a random pop */
    for (var b = 0; b < blocks.length; b++) {
      var col = parseInt(getComputedStyle(blocks[b]).gridColumnStart, 10);
      blocks[b].style.setProperty('--b', isNaN(col) ? b : col - 2);
    }

    if (reduced || !('IntersectionObserver' in window)) {
      /* reduced motion / no observer: straight to the finished state, and no
         will-change ever asked for. */
      tl.classList.add('tl-armed', 'tl-run', 'tl-done');
    } else {
      tl.classList.add('tl-armed');
      var tlio = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) {
          if (!e.isIntersecting) return;
          tl.classList.add('tl-run');
          tlio.disconnect();
          /* Longest block is column 13, so --b maxes at 11: 11 x 55ms of
             stagger plus the 500ms wipe = 1105ms. Release the compositor
             layers a beat after that. */
          window.setTimeout(function () { tl.classList.add('tl-done'); }, 1300);
        });
      }, { threshold: 0.15 });
      tlio.observe(tl);
    }
  }

  /* ---------- 4. FAQ: one open at a time ---------- */
  var qs = document.querySelectorAll('.faq .q');
  for (var q = 0; q < qs.length; q++) {
    qs[q].addEventListener('toggle', function () {
      if (!this.open) return;
      for (var k = 0; k < qs.length; k++) {
        if (qs[k] !== this) qs[k].removeAttribute('open');
      }
    });
  }

  /* ---------- 5. timeline scroll hint ---------- */
  var scroller = document.querySelector('.tl-scroll');
  var hint = document.querySelector('.tl-hint');
  if (scroller && hint) {
    scroller.addEventListener('scroll', function () {
      if (scroller.scrollLeft > 24) hint.style.opacity = '0';
    }, { passive: true });
  }

  /* ---------- 6. the application form is gone ----------
     Applying and paying were two forms on one page asking the same four
     questions, and the payment one is the one that does something. The handler
     and FORM_ENDPOINT went with it. pay.js owns the only form on the page. */
})();
