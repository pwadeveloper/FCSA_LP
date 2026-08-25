/* ==========================================================================
   THE FILM AND CONTENT SCHOOL

   Swap this for a real endpoint when one is chosen — Formspree, Tally,
   Google Form or a Netlify function. The form posts FormData by POST and
   expects any 2xx as success, which is what all three accept.
   Leave as null and the form validates, then reports that it isn't wired
   yet rather than pretending to send.
   ========================================================================== */
var FORM_ENDPOINT = null; /* e.g. 'https://formspree.io/f/xxxxxxxx' */

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

  /* ---------- 1c. header: transparent only while the media is behind it ----------
     Watching .hero-media rather than the hero section covers both layouts: on
     desktop the media is inset:0 so its bottom is the hero's bottom; on mobile
     it is the 4:5 block, so the header goes solid as soon as that scrolls by
     and stops colliding with the headline underneath. */
  var head = document.getElementById('site-head');
  var media = document.querySelector('.hero-media');
  if (head && media && 'IntersectionObserver' in window) {
    var headH = function () {
      return parseInt(getComputedStyle(document.documentElement)
        .getPropertyValue('--head-h'), 10) || 76;
    };
    var mkObserver = function () {
      return new IntersectionObserver(function (entries) {
        head.classList.toggle('is-solid', !entries[0].isIntersecting);
      }, { rootMargin: '-' + headH() + 'px 0px 0px 0px', threshold: 0 });
    };
    var mo = mkObserver();
    mo.observe(media);
    /* --head-h changes at the 1024 breakpoint, so rebuild the observer */
    var wideMq = window.matchMedia('(min-width: 1024px)');
    if (wideMq.addEventListener) {
      wideMq.addEventListener('change', function () {
        mo.disconnect(); mo = mkObserver(); mo.observe(media);
      });
    }
  } else if (head) {
    head.classList.add('is-solid');
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
