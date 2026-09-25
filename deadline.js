/* ==========================================================================
   REGISTRATION DEADLINE — the countdown, the sticky bar, the first-visit
   notice, and the line in the pay section.

   ONE DATE, READ FROM THE DOM. The <time datetime> on .regbar-date in
   index.html is the only value here; nothing in this file hard-codes a
   deadline. Four things are computed from it and they cannot disagree with
   each other, because there is nothing for them to disagree with.

   EVERYTHING SWITCHES OFF BY ITSELF. Past the deadline the bar never shows,
   the notice never opens, and the pay section says registration has closed
   instead of counting down to a date in the past. Nobody has to remember to
   take this down on the 11th — which matters, because the person who would
   have to remember is the person who will be teaching that week.
   ========================================================================== */
(function () {
  'use strict';

  var timeEl = document.querySelector('[data-reg-deadline]');
  if (!timeEl) return;

  var end = new Date(timeEl.getAttribute('datetime')).getTime();
  /* An unparseable date must not leave a bar counting NaN across the bottom of
     the page. Bail and the page is exactly as it was before this file. */
  if (!end || isNaN(end)) return;

  var bar      = document.querySelector('[data-regbar]');
  var dlg      = document.getElementById('kickoff');
  var mirror   = document.querySelector('[data-reg-mirror]');
  var leftEl   = mirror && mirror.querySelector('[data-reg-left]');
  var clocks   = [].slice.call(document.querySelectorAll('[data-reg-clock]'));
  var root     = document.documentElement;

  var SEEN = 'fcsa.kickoff.seen';      /* localStorage   — once per browser */
  var HIDE = 'fcsa.regbar.hidden';     /* sessionStorage — once per visit   */

  /* Storage throws outright in a locked-down private window, and reads can
     come back empty for reasons that have nothing to do with this visitor. A
     storage failure costs them the notice, never the page. */
  function get(store, k) {
    try { return window[store].getItem(k); } catch (e) { return null; }
  }
  function set(store, k, v) {
    try { window[store].setItem(k, v); } catch (e) {}
  }

  function left() { return end - Date.now(); }
  function open() { return left() > 0; }

  /* ---------- the clock ----------
     Days, hours and minutes, and seconds only inside the last day. A seconds
     column ticking for a fortnight is a timer that has to be repainted sixty
     times a minute to tell you nothing new; inside 24 hours it is the whole
     point. The interval below changes with it. */
  function pad(n) { return (n < 10 ? '0' : '') + n; }

  function paintClock() {
    var ms = Math.max(0, left());
    var d = Math.floor(ms / 86400000);
    var h = Math.floor(ms % 86400000 / 3600000);
    var m = Math.floor(ms % 3600000 / 60000);
    var sec = Math.floor(ms % 60000 / 1000);
    var fine = ms < 86400000;

    clocks.forEach(function (c) {
      var q = function (sel) { return c.querySelector(sel); };
      if (q('[data-reg-d]')) q('[data-reg-d]').textContent = pad(d);
      if (q('[data-reg-h]')) q('[data-reg-h]').textContent = pad(h);
      if (q('[data-reg-m]')) q('[data-reg-m]').textContent = pad(m);
      if (q('[data-reg-s]')) q('[data-reg-s]').textContent = pad(sec);
      /* Under a day the days column is a permanent "00" taking up room that
         the seconds want. They swap rather than stack. */
      var dw = q('[data-reg-d]') && q('[data-reg-d]').parentNode;
      if (dw) dw.hidden = fine;
      if (q('[data-reg-s-wrap]')) q('[data-reg-s-wrap]').hidden = !fine;
    });
    return fine;
  }

  /* ---------- the line in the pay section ----------
     The sentence beside it is prose and names the date. This half is the only
     part that moves, and after the deadline it stops being a countdown and
     starts being a statement of fact. */
  function paintMirror() {
    if (!leftEl) return;
    if (!open()) {
      leftEl.textContent = 'Registration has now closed — talk to us before paying.';
      return;
    }
    /* FLOOR, to agree with the clock. Ceil read "16 days left" beside a bar
       showing 15d 04h, and two numbers for the same thing on one page is the
       kind of small contradiction that makes a reader distrust both. Floor is
       also the conservative half of the rounding: it never tells somebody they
       have more time than they do. */
    var days = Math.floor(left() / 86400000);
    leftEl.textContent = days === 0 ? 'Today is the last day.'
                       : days === 1 ? '1 day left.'
                       : days + ' days left.';
  }

  /* ---------- tick ----------
     One timer, rescheduled rather than a fixed interval, so the cheap cadence
     and the fine one are the same code path. Paused while the tab is hidden:
     a backgrounded countdown is work nobody can see, on a battery somebody
     owns, and the first thing on return is a repaint anyway. */
  var timer = null;
  function stop() { if (timer) { window.clearTimeout(timer); timer = null; } }

  function tick() {
    stop();
    var fine = paintClock();
    paintMirror();
    if (!open()) { retire(); return; }
    if (document.hidden) return;
    timer = window.setTimeout(tick, fine ? 1000 : 30000);
  }

  /* The deadline passing WHILE SOMEONE IS ON THE PAGE is rare and is still
     handled: the bar leaves, the notice cannot open, and the pay line rewrites
     itself. It costs four lines and it is the difference between a page that
     expires and a page that has to be redeployed to stop lying. */
  function retire() {
    stop();
    if (bar) { bar.classList.remove('is-in'); bar.hidden = true; }
    root.classList.remove('has-regbar');
    if (dlg && dlg.open) dlg.close();
  }

  document.addEventListener('visibilitychange', function () {
    if (document.hidden) stop(); else tick();
  });

  /* ---------- the sticky bar ---------- */
  function showBar() {
    if (!bar || !open()) return;
    if (get('sessionStorage', HIDE)) return;

    bar.hidden = false;
    /* Measured, not assumed: the bar stacks differently on a narrow phone and
       the footer's extra padding is derived from whatever it actually is. Read
       after unhiding and before the transform lands. */
    root.style.setProperty('--regbar-h', bar.offsetHeight + 'px');
    root.classList.add('has-regbar');
    /* Two frames: one for [hidden] to come off and the start transform to be
       the element's real style, one for the change to .is-in to animate from
       it. A single frame slides nothing. */
    requestAnimationFrame(function () {
      requestAnimationFrame(function () { bar.classList.add('is-in'); });
    });
  }

  /* NOT ON THE HERO. The hero is the one screen with a job of its own, and a
     bar across the bottom of it is the page interrupting its own opening
     line. It arrives once the hero is behind you — by which point the visitor
     is reading rather than arriving, and a deadline is useful instead of
     pushy. */
  var hero = document.querySelector('.hero');
  if (bar && hero && 'IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (es) {
      if (es[es.length - 1].isIntersecting) return;
      io.disconnect();
      showBar();
    }, { threshold: 0 });
    io.observe(hero);
  } else {
    showBar();
  }

  if (bar) {
    var x = bar.querySelector('[data-reg-dismiss]');
    if (x) {
      x.addEventListener('click', function () {
        bar.classList.remove('is-in');
        root.classList.remove('has-regbar');
        /* SESSION storage, not local. Dismissing is "not now", not "never" —
           a deadline that a visitor silenced permanently on their first visit
           would be missing on the day it matters. It returns next visit. */
        set('sessionStorage', HIDE, '1');
        window.setTimeout(function () { bar.hidden = true; }, 420);
      });
    }
    /* Pressing "Pay now" has taken them where the bar was pointing, so the bar
       has made its case and stops asking for the rest of the visit. */
    var cta = bar.querySelector('.regbar-cta');
    if (cta) cta.addEventListener('click', function () { set('sessionStorage', HIDE, '1'); });
  }

  /* ---------- first visit ---------- */
  function announce() {
    if (!dlg || typeof dlg.showModal !== 'function') return;
    if (!open()) return;
    if (get('localStorage', SEEN)) return;
    /* Arriving straight at #pay means they are already doing the thing this
       notice exists to ask for. Interrupting that to ask for it is the kind of
       modal people close without reading. */
    if (window.location.hash === '#pay') { set('localStorage', SEEN, '1'); return; }

    set('localStorage', SEEN, '1');
    dlg.showModal();
    var h = document.getElementById('ko-h');
    if (h) h.focus();
  }

  if (dlg) {
    [].slice.call(dlg.querySelectorAll('[data-ko-close]')).forEach(function (b) {
      b.addEventListener('click', function () { dlg.close(); });
    });
    /* A click on ::backdrop reports the <dialog> itself as the target — the
       backdrop is a pseudo-element with no node of its own to be one. */
    dlg.addEventListener('click', function (e) { if (e.target === dlg) dlg.close(); });
    var koCta = dlg.querySelector('[data-ko-cta]');
    if (koCta) koCta.addEventListener('click', function () { dlg.close(); });
  }

  tick();

  /* AFTER THE PAGE HAS OPENED, not during. script.js runs a load sequence and
     hero.js starts a carousel; a modal thrown up on top of both makes the
     first second of the site look like a fight between two things. 1.2s is
     long enough for that to settle and short enough to still read as part of
     arriving rather than as an interruption. */
  if (document.readyState === 'complete') window.setTimeout(announce, 1200);
  else window.addEventListener('load', function () { window.setTimeout(announce, 1200); });
})();
