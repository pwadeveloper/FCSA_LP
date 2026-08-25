/* ==========================================================================
   THE FILM AND CONTENT SCHOOL

   Swap this for a real endpoint when one is chosen — Formspree, Tally,
   Google Form or a Netlify function. The form posts FormData by POST and
   expects any 2xx as success, which is what all three accept.
   Leave as null and the form validates, then reports that it isn't wired
   yet rather than pretending to send.
   ========================================================================== */
var FORM_ENDPOINT = null; /* e.g. 'https://formspree.io/f/xxxxxxxx' */

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

  /* ---------- 1e. media slots ---------- */

  /* Strip empty slots when the launch gate is closed. A slot counts as filled
     only if it actually holds an <img> or <video>. */
  if (!SHOW_MEDIA_PLACEHOLDERS) {
    Array.prototype.forEach.call(document.querySelectorAll('.slot'), function (fig) {
      if (fig.querySelector('img, video')) return;
      var host = fig.parentNode;
      fig.parentNode.removeChild(fig);
      /* drop a wrapper that exists only to hold slots */
      if (host && /slot-pair|why-media/.test(host.className) && !host.querySelector('.slot')) {
        host.parentNode.removeChild(host);
      }
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
  var vids = document.querySelectorAll('.slot video');

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
      tl.classList.add('tl-armed', 'tl-run');
    } else {
      tl.classList.add('tl-armed');
      var tlio = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) {
          if (!e.isIntersecting) return;
          tl.classList.add('tl-run');
          tlio.disconnect();
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

  /* ---------- 6. application form ---------- */
  var form = document.getElementById('apply-form');
  if (!form) return;

  var msg = document.getElementById('form-msg');
  var btn = form.querySelector('button[type="submit"]');

  function fieldOf(el) { return el.closest('.f'); }

  function showErr(name, text) {
    var slot = form.querySelector('.err[data-for="' + name + '"]');
    if (!slot) return;
    slot.textContent = text;
    slot.hidden = false;
    var wrap = slot.closest('.f');
    if (wrap) wrap.classList.add('has-err');
  }

  function clearErrs() {
    form.querySelectorAll('.err').forEach(function (e) { e.hidden = true; e.textContent = ''; });
    form.querySelectorAll('.has-err').forEach(function (e) { e.classList.remove('has-err'); });
    if (msg) { msg.hidden = true; msg.removeAttribute('data-state'); }
  }

  function validate() {
    var bad = [];
    var v = function (id) { var el = form.querySelector('#' + id); return el ? el.value.trim() : ''; };

    if (!v('f-name')) bad.push(['f-name', 'Please enter your name.']);
    if (!v('f-phone')) bad.push(['f-phone', 'We need a phone or WhatsApp number.']);

    var email = v('f-email');
    if (!email) bad.push(['f-email', 'Please enter your email.']);
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) bad.push(['f-email', 'That email does not look right.']);

    if (!v('f-track')) bad.push(['f-track', 'Choose a track, or "Not sure yet".']);
    if (!form.querySelector('input[name="laptop"]:checked')) bad.push(['laptop', 'Please answer this.']);
    if (!form.querySelector('input[name="camera"]:checked')) bad.push(['camera', 'Please answer this.']);
    if (!form.querySelector('input[name="consent"]:checked')) bad.push(['consent', 'Please agree before sending.']);

    return bad;
  }

  form.addEventListener('submit', function (ev) {
    ev.preventDefault();
    clearErrs();

    var bad = validate();
    if (bad.length) {
      bad.forEach(function (pair) { showErr(pair[0], pair[1]); });
      var first = form.querySelector('.has-err input, .has-err select, .has-err textarea');
      if (first) first.focus({ preventScroll: false });
      return;
    }

    if (!FORM_ENDPOINT) {
      msg.textContent = 'This form is not connected yet. Set FORM_ENDPOINT at the top of script.js.';
      msg.setAttribute('data-state', 'err');
      msg.hidden = false;
      return;
    }

    btn.disabled = true;
    var label = btn.textContent;
    btn.textContent = 'Sending…';

    fetch(FORM_ENDPOINT, {
      method: 'POST',
      body: new FormData(form),
      headers: { Accept: 'application/json' }
    })
      .then(function (res) {
        if (!res.ok) throw new Error(res.status);
        form.reset();
        msg.textContent = "Application sent. We'll be in touch on WhatsApp.";
        msg.hidden = false;
      })
      .catch(function () {
        msg.textContent = 'That didn’t send. Check your connection and try again.';
        msg.setAttribute('data-state', 'err');
        msg.hidden = false;
      })
      .finally(function () {
        btn.disabled = false;
        btn.textContent = label;
      });
  });

  /* clear a field's error as soon as it is corrected */
  form.addEventListener('input', function (ev) {
    var f = ev.target.closest ? ev.target.closest('.f') : null;
    if (!f || !f.classList.contains('has-err')) return;
    f.classList.remove('has-err');
    var slot = f.querySelector('.err');
    if (slot) { slot.hidden = true; slot.textContent = ''; }
  });
})();
