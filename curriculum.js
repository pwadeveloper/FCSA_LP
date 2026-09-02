/* ==========================================================================
   CURRICULUM — the modal, the track filter, and the mobile sheet drag.

   WHY <dialog> AND NOT A DIV. Four things a modal has to get right are free
   here and are all fiddly by hand: it goes in the top layer so no z-index on
   the page can cover it, ::backdrop paints without an extra element, Escape
   fires `cancel`, and the rest of the document goes inert — which is the part
   hand-rolled modals almost always miss. A focus trap written here would be a
   worse copy of one the browser already ships.

   WHAT IS NOT FREE, and is therefore below: the page behind still scrolls
   under a modal dialog, the sheet has two rest heights and is dragged between
   them, and neither the filter nor the "opened from the Film track, so start
   on Film" behaviour is anything the element knows about.

   NO <dialog> SUPPORT — the three buttons are removed rather than left to do
   nothing, and the <noscript> block in index.html has already turned the
   markup into an ordinary section. Same outcome by two different routes: the
   curriculum is readable either way, and a button that does nothing when
   pressed never ships.
   ========================================================================== */
(function () {
  'use strict';

  var dlg = document.getElementById('curriculum');
  if (!dlg) return;

  var openers = [].slice.call(document.querySelectorAll('[data-curr-open]'));

  /* Feature-detect the METHOD, not the element. Every browser parses <dialog>
     into an HTMLElement; only the ones that implement it have showModal, and
     showModal is the whole reason this is a dialog. */
  if (typeof dlg.showModal !== 'function') {
    openers.forEach(function (b) {
      var wrap = b.closest('.trk-cta') || b;
      wrap.parentNode.removeChild(wrap);
    });
    return;
  }

  var sheet    = dlg.querySelector('.curr-sheet');
  var body     = dlg.querySelector('[data-curr-scroll]');
  var grab     = dlg.querySelector('[data-curr-grab]');
  var heading  = document.getElementById('curr-h');
  var tabs     = [].slice.call(dlg.querySelectorAll('[data-curr-track]'));
  var phases   = [].slice.call(dlg.querySelectorAll('.curr-phase'));
  var closers  = [].slice.call(dlg.querySelectorAll('[data-curr-close]'));

  var wideMq    = window.matchMedia('(min-width: 1024px)');
  var reducedMq = window.matchMedia('(prefers-reduced-motion: reduce)');
  var lastOpener = null;

  /* ---------- the track filter ---------- */

  /* Every phase carries data-tracks. The shared ones list all three, so "film"
     matches the twelve-week spine AND the Film block, and hides only the other
     two tracks' blocks. Whole-word matching, or "content" would also match
     nothing while "fin" would match "finisher" — cheap to get wrong. */
  function filter(track) {
    phases.forEach(function (ph) {
      var list = ' ' + (ph.getAttribute('data-tracks') || '') + ' ';
      ph.hidden = !(track === 'all' || list.indexOf(' ' + track + ' ') !== -1);
    });
    tabs.forEach(function (t) {
      var on = t.getAttribute('data-curr-track') === track;
      t.classList.toggle('is-on', on);
      t.setAttribute('aria-checked', on ? 'true' : 'false');
      /* Roving tabindex: a radiogroup is ONE tab stop, and arrowing moves
         within it. Four separate stops would make Tab walk the filter instead
         of reaching the list. */
      t.tabIndex = on ? 0 : -1;
    });
    if (body) body.scrollTop = 0;
  }

  tabs.forEach(function (t, i) {
    t.addEventListener('click', function () { filter(t.getAttribute('data-curr-track')); });
    t.addEventListener('keydown', function (e) {
      var d = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1
            : e.key === 'ArrowLeft'  || e.key === 'ArrowUp'   ? -1 : 0;
      if (!d) return;
      e.preventDefault();
      var next = tabs[(i + d + tabs.length) % tabs.length];
      filter(next.getAttribute('data-curr-track'));
      next.focus();
    });
  });

  /* ---------- the sheet's two rest heights ---------- */

  var PEEK = 0.68, FULL = 0.96;   /* fractions of the viewport */
  var expanded = false;

  function vh() { return window.innerHeight; }
  function setH(px) { sheet.style.setProperty('--curr-h', px + 'px'); }

  function snap(toFull) {
    expanded = !!toFull;
    setH(Math.round(vh() * (expanded ? FULL : PEEK)));
  }

  /* "Scrollable, but it gets taller." Reaching for the content is itself the
     request for more room, so the first scroll off the top expands the sheet
     rather than making someone find the handle to do it by hand. Once. */
  if (body) {
    body.addEventListener('scroll', function () {
      if (!wideMq.matches && !expanded && body.scrollTop > 8) snap(true);
    }, { passive: true });
  }

  /* ---------- the drag ----------
     Pointer events, not touch events: one code path covers finger, stylus and
     a desktop mouse on a narrow window, and setPointerCapture means a drag
     that leaves the handle still tracks instead of sticking. */
  if (grab) {
    var startY = 0, startH = 0, liveH = 0, dragging = false;

    grab.addEventListener('pointerdown', function (e) {
      if (wideMq.matches) return;        /* nothing to drag: the panel is the window */
      dragging = true;
      startY = e.clientY;
      startH = liveH = sheet.getBoundingClientRect().height;
      dlg.classList.add('is-dragging');
      /* Capture is an optimisation, not a requirement — it keeps a drag
         tracking after the finger leaves the 28px handle. It throws on a
         pointer the browser no longer considers active, which is a race
         nothing here can prevent and nothing here needs to survive: without
         it the drag still works, it just ends early if you slide off. */
      try { grab.setPointerCapture(e.pointerId); } catch (err) {}
    });

    grab.addEventListener('pointermove', function (e) {
      if (!dragging) return;
      /* Up is negative in client coordinates and taller is positive here, so
         the sign flips. Clamped at the top so the sheet cannot be thrown past
         its own max-height and rubber-band on release. */
      var h = startH + (startY - e.clientY);
      liveH = Math.max(0, Math.min(h, vh() * FULL));
      setH(liveH);
    });

    function release(e) {
      if (!dragging) return;
      dragging = false;
      dlg.classList.remove('is-dragging');
      if (grab.hasPointerCapture && grab.hasPointerCapture(e.pointerId)) {
        try { grab.releasePointerCapture(e.pointerId); } catch (err) {}
      }
      /* THE DECISION USES THE TRACKED HEIGHT, NOT A LAYOUT READ. Removing
         .is-dragging on the line above re-arms the height transition, so
         measuring the sheet here is measuring something that may already be
         animating somewhere else — and a dismiss gesture that sometimes does
         not dismiss is the worst kind of bug to own. liveH is what the finger
         actually asked for. */
      var h = liveH;
      /* Three outcomes, and the close threshold is deliberately generous:
         dragging a sheet downward is how a phone user dismisses one, and
         making them find the × after committing to that gesture is the kind
         of thing that reads as the page fighting back. */
      if (h < vh() * PEEK * 0.55) { close(); return; }
      snap(h > vh() * (PEEK + FULL) / 2);
    }
    grab.addEventListener('pointerup', release);
    grab.addEventListener('pointercancel', release);
  }

  /* ---------- scroll lock ----------
     A modal dialog goes in the top layer, but the document underneath keeps
     its scrollbar and keeps responding to the wheel. Hiding the overflow fixes
     that and costs a layout shift on any platform with a classic scrollbar —
     the page gets the scrollbar's width back and everything jumps sideways —
     so the width is measured and handed back as padding. Overlay scrollbars
     (macOS, iOS, Android) measure 0 and nothing is added.

     This is also the page's documented width invariant, which says
     documentElement.scrollWidth must equal clientWidth at every breakpoint. A
     naive overflow:hidden keeps that true; it is the visible jump it gets
     wrong, and this is what stops it. */
  var root = document.documentElement;
  var prevOverflow = '', prevPad = '';

  function lock() {
    var gap = window.innerWidth - root.clientWidth;
    prevOverflow = root.style.overflow;
    prevPad = root.style.paddingRight;
    root.style.overflow = 'hidden';
    if (gap > 0) root.style.paddingRight = gap + 'px';
  }
  function unlock() {
    root.style.overflow = prevOverflow;
    root.style.paddingRight = prevPad;
  }

  /* ---------- open / close ---------- */

  function open(track, opener) {
    lastOpener = opener || null;
    filter(track || 'all');
    expanded = false;
    /* Cleared rather than set: the rest height belongs to the stylesheet
       (68svh, which knows about mobile browser chrome in a way innerHeight
       does not) and only the drag has any business writing pixels here. */
    sheet.style.removeProperty('--curr-h');
    if (body) body.scrollTop = 0;
    lock();
    dlg.showModal();
    /* The heading, not the close button. showModal would otherwise land on the
       × — so the first thing announced is a way out of a panel nobody has been
       told the name of yet. */
    if (heading) heading.focus();
  }

  function close() {
    if (dlg.open) dlg.close();
  }

  /* One handler for every route out — the ×, Escape, and the backdrop — so
     unlocking the page cannot be forgotten on one of them. `close` fires for
     all three, because Escape on a modal dialog dispatches cancel and then
     close, and dlg.close() is what the other two call. */
  dlg.addEventListener('close', function () {
    unlock();
    dlg.classList.remove('is-dragging');
    sheet.style.removeProperty('--curr-h');
    if (lastOpener) { lastOpener.focus(); lastOpener = null; }
  });

  closers.forEach(function (b) { b.addEventListener('click', close); });

  /* A click on ::backdrop reports the <dialog> itself as the target, because
     the backdrop is a pseudo-element and has no node of its own to be one.
     Anything inside the sheet reports the sheet or deeper, so this is the
     whole test. */
  dlg.addEventListener('click', function (e) { if (e.target === dlg) close(); });

  openers.forEach(function (b) {
    b.addEventListener('click', function () {
      open(b.getAttribute('data-curr-open'), b);
    });
  });

  /* Turning a phone sideways, or crossing 1024 with a window edge, changes
     what a viewport fraction is worth. A pixel height written by an earlier
     drag is stale the moment that happens, so it is dropped and the stylesheet
     takes the height back. */
  function reset() {
    if (!dlg.open) return;
    expanded = false;
    sheet.style.removeProperty('--curr-h');
  }
  window.addEventListener('resize', reset);
  if (wideMq.addEventListener) wideMq.addEventListener('change', reset);

  /* Reduced motion: the sheet still has two heights, it just stops sliding
     between them. Handled here rather than in CSS because .is-dragging already
     owns that transition and two rules fighting over it is how you get a sheet
     that animates during a drag. */
  if (reducedMq.matches) sheet.style.transition = 'none';
})();
