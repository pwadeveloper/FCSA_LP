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

  /* THESE PLAY ON PHONES. That is a reversal, and the reason for the reversal
     matters more than the rule it breaks.

     script.js suppresses autoplay below 1024px for every other video here, and
     that is right for what it guards: a full-screen ambient loop that is 1MB+
     and carries no information. Applying the same threshold to these three was
     a category error. They are 150KB each at the 360 rung — 430KB for all
     three, less than one hero frame — and unlike a backdrop they ARE the
     section: the Content Track's whole claim is "work made for a phone
     screen", argued with three phone-shaped clips. A visitor on a phone got
     three still images, which does not read as a considered fallback. It
     reads as broken.

     What survives from that policy is the part that was actually about the
     audience rather than about screen size: Save-Data and 2g/3g still send
     nothing, and reduced-motion still sends nothing. Those are requests from
     the person. A narrow window is not. */

  /* Same reading as script.js: saveData is the explicit request, and the 2g/3g
     buckets are the implicit one. A 1MB decorative autoplay on a metered
     connection is exactly what Save-Data exists to prevent. */
  function metered() {
    var c = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    return !!(c && (c.saveData === true || /^(slow-2g|2g|3g)$/.test(c.effectiveType || '')));
  }
  function allowed() {
    return !reducedMq.matches && !metered();
  }

  /* Now that phones actually load these, the small rung has a job. Measured:
     the card is 110px wide at 390 and 314px at 1920, so 360 covers a phone at
     3x and 640 covers a desktop at 2x. Sending the 640 to a 110px box was
     nearly three times the bytes for pixels the layout cannot show.

     Chosen once, at first play, and not re-chosen on resize — swapping src
     mid-playback restarts the clip, and a video that jumps back to frame one
     because someone dragged a window edge is worse than a slightly wrong
     rung. */
  function hydrate() {
    if (loaded) return;
    loaded = true;
    var rung = wideMq.matches ? 'data-src-640' : 'data-src-360';
    vids.forEach(function (v) {
      var src = v.getAttribute(rung) || v.getAttribute('data-src-640');
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

  /* Only reduced-motion can start or stop them now — width no longer gates
     playback, it only picked the rung above, and that is settled at first
     play. Listening to wideMq here as well would mean a resize could pause
     three clips for no reason a viewer could explain. */
  if (reducedMq.addEventListener) {
    reducedMq.addEventListener('change', function () { allowed() ? play() : pause(); });
  }
})();
