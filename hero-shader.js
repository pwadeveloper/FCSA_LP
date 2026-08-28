/* ==========================================================================
   HERO CURSOR SHADER — chromatic bloom

   A WebGL canvas over the <picture> stack, under the scrim and under every
   piece of type. The <picture> is never hidden and never removed: the canvas
   is drawn on top of it, and if anything at all goes wrong the canvas is
   pulled and what remains is the plain image. There is no code path in this
   file that can leave a blank hero.

   No library. The whole thing is one quad, one program and one texture unit
   per frame; three.js would be ~150KB of parser and scene graph to draw two
   triangles, against a 500KB page budget.
   ========================================================================== */
(function () {
  'use strict';

  /* ---------- 1. THE GUARDS ----------
     Every one of these is a reason NOT to start. They are checked before a
     context is requested, before a texture is decoded, before anything at all
     is put on the GPU — the cheapest failure is the one that never begins. */

  /* No cursor, nothing to follow. A touch equivalent would be a different
     effect wearing this one's name, so there isn't one. */
  if (window.matchMedia('(pointer: coarse)').matches) return;
  if (!window.matchMedia('(min-width: 1024px)').matches) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  var conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
  if (conn && (conn.saveData === true ||
               conn.effectiveType === '2g' ||
               conn.effectiveType === 'slow-2g')) return;


  /* ======================================================================
     THE TUNED CONSTANTS — chromatic bloom.

     CALIBRATED ON hero-05-hilltop, which is the brightest, coolest and
     lowest-contrast of the five, and which carries a heavy scrim
     (--scrim 0.79). All three facts push the same way: they let a LARGER
     separation read as texture rather than as a defect.

     The other four images are darker with harder specular edges, where the
     same fringe lands on a high-contrast boundary instead of on open sky and
     reads considerably more strongly. If you change or add a hero image,
     re-check against these numbers rather than assuming they carry over.
     Per-image tuning, if it is ever wanted, belongs in hero-manifest.json
     next to --scrim, not here.
     ====================================================================== */
  var SEPARATION  = 0.0388;  /* RGB split at the cursor, in texture UV units */
  var CENTRE_BIAS = 1.9;     /* pow() on proximity: pulls the split inward */
  var RADIUS      = 0.71;    /* smoothstep falloff, aspect-corrected */
  var GAIN        = 0.78;    /* peak uAmount; the rise/decay ramps 0 -> GAIN */

  var FPS_CAP  = 30;                 /* ambient, not a game. 60 is wasted battery */
  var FRAME_MS = 1000 / FPS_CAP;
  var LERP     = 0.08;               /* raw pointer coordinates twitch */
  var RISE_MS  = 220;                /* uAmount 0 -> GAIN while the pointer moves */
  var DECAY_MS = 600;                /* uAmount -> 0 once it stops */
  var IDLE_MS  = 90;                 /* no pointer event for this long = stopped */
  var FADE_MS  = 800;                /* in-shader crossfade, matches the carousel */

  /* ---------- 2. THE SHADERS ---------- */

  var VERT = [
    'attribute vec2 aPos;',
    'varying vec2 vUv;',
    'void main(){',
    /* vUv.y counts DOWN from the top so it matches CSS, the pointer, and the
       texture's own row order — no flipY on upload, no sign juggling later. */
    '  vUv = vec2(aPos.x * 0.5 + 0.5, 0.5 - aPos.y * 0.5);',
    '  gl_Position = vec4(aPos, 0.0, 1.0);',
    '}'
  ].join('\n');

  /* ---------- THE SHADER ----------
     Chromatic bloom: no displacement of any kind. The three channels are
     sampled along the radial line running from the cursor through the pixel,
     red pushed outward and blue pulled inward, so the fringe always points
     away from the cursor the way a real lens aberration does. Green is never
     offset, which is what keeps luminance and therefore the type contrast
     underneath completely unchanged.

     There is no uTime. The output is a pure function of cursor position, so
     a still cursor is a still frame — the RAF stops outright rather than
     redrawing an identical image, which is worth more battery than the fps
     cap is. */
  /* GLSL ES 1.00 will not implicitly convert an int literal to a float, so a
     constant that happens to be whole (RADIUS = 1) would emit "1" and fail to
     compile against a float operand. Force a decimal point. */
  function glsl(n) {
    var t = String(n);
    return t.indexOf('.') === -1 && t.indexOf('e') === -1 ? t + '.0' : t;
  }

  var FRAG = [
    'precision mediump float;',
    'uniform sampler2D uTex;      // the frame on screen',
    'uniform sampler2D uTexB;     // the frame coming in',
    'uniform float uMix;          // 0..1 crossfade between them',
    'uniform vec2  uMouse;        // 0..1, lerped',
    'uniform vec2  uRes;',
    'uniform float uAmount;       // 0..GAIN master, decays when idle',
    'uniform vec2  uCover;        // cover-fit scale',
    'uniform vec2  uOffset;       // cover-fit offset, frame on screen',
    'uniform vec2  uOffsetB;      // cover-fit offset, frame coming in',
    'varying vec2 vUv;',
    '',
    /* dir and sep are computed once in main and handed in, so the crossfade
       costs a second texture fetch rather than a second lot of maths. */
    'vec3 fx(sampler2D tex, vec2 off, vec2 dir, float sep){',
    '  vec2 uv = vUv * uCover + off;',
    '  float r = texture2D(tex, uv + dir * sep).r;',
    '  float g = texture2D(tex, uv).g;',
    '  float b = texture2D(tex, uv - dir * sep).b;',
    '  return vec3(r, g, b);',
    '}',
    '',
    'void main(){',
    '  vec2 d = vUv - uMouse;',
    /* Aspect-correct the distance so the falloff is a circle on screen and
       not an ellipse. It has to be undone again for dir, below. */
    '  d.x *= uRes.x / uRes.y;',
    /* The brief originally wrote this as smoothstep(R, 0.0, x) — an inverted
       smoothstep with edge0 > edge1, which GLSL ES 1.00 leaves UNDEFINED.
       SwiftShader returns 0 for it, which collapses the effect to a plain
       texture fetch. 1.0 - smoothstep(0.0, R, x) is the same curve, defined
       everywhere. */
    '  float prox = 1.0 - smoothstep(0.0, ' + glsl(RADIUS) + ', length(d));',
    '  float L = length(d);',
    /* normalize() is undefined at the origin, and the origin is exactly where
       the cursor sits, so it is guarded rather than assumed. */
    '  vec2 dir = L > 1e-4 ? d / L : vec2(0.0);',
    '  dir.x /= (uRes.x / uRes.y);',
    /* pow() on proximity biases the split toward the centre without touching
       the radius: the fringe stays tight around the cursor while the falloff
       itself still reaches all the way out to RADIUS. */
    '  float sep = ' + glsl(SEPARATION) + ' * prox * uAmount' +
    '            * pow(max(prox, 0.0), ' + glsl(CENTRE_BIAS) + ');',
    '  vec3 c = fx(uTex, uOffset, dir, sep);',
    '  if (uMix > 0.0) c = mix(c, fx(uTexB, uOffsetB, dir, sep), uMix);',
    '  gl_FragColor = vec4(c, 1.0);',
    '}'
  ].join('\n');

  /* ---------- 3. BOOT, LATE AND POLITELY ----------
     Four gates, then idle. The brief asked for two (hero image load, then
     requestIdleCallback); the other two came out of measuring what the LCP on
     this page actually is.

     It is not the hero. Chrome excludes an image that covers the whole
     viewport from largest-contentful-paint candidacy and reads it as a
     background, so the largest counted paint is the header mark — which
     lands after the hero image, not before it. Gating on the hero image
     alone therefore proves nothing about the LCP at all.

     So: hero image loaded, window loaded, fonts settled (the webfont swap
     re-lays-out around the mark and can emit a fresh LCP entry after load has
     already fired), and then the LCP metric itself quiet for LCP_QUIET_MS.
     The last one is the only gate that watches the real signal rather than a
     proxy for it, and it is self-tuning: a slow page waits longer.

     None of them can hang the effect. load always fires, fonts.ready always
     settles, the quiet poll gives up after 8s, and the idle callback carries a
     2s timeout.

     HONEST LIMIT: largest-contentful-paint is not final until the page is
     hidden or the user interacts, so "after the LCP" is not a state any script
     can wait for with certainty. These four gates are the closest a page can
     get; they are not a proof of ordering. */
  function whenIdle(fn) {
    if (window.requestIdleCallback) window.requestIdleCallback(fn, { timeout: 2000 });
    else setTimeout(fn, 400);
  }

  var LCP_QUIET_MS = 600;
  /* Seeded to NOW, not 0. At 0 the first poll computes a huge "time since the
     last entry", reads that as quiet, and starts before the first LCP entry
     has even been dispatched — the gate would pass precisely because nothing
     had happened yet. Seeding to now makes the floor a real one. */
  var lastLcp = performance.now(), lcpObs = null;
  try {
    lcpObs = new PerformanceObserver(function () { lastLcp = performance.now(); });
    lcpObs.observe({ type: 'largest-contentful-paint', buffered: true });
  } catch (e) { lcpObs = null; }

  function whenLcpQuiet(fn) {
    if (!lcpObs) return fn();
    var waited = 0;
    (function poll() {
      var since = performance.now() - lastLcp;
      if (since >= LCP_QUIET_MS || waited > 8000) {
        try { lcpObs.disconnect(); } catch (e) {}
        lcpObs = null;
        return fn();
      }
      waited += 200;
      setTimeout(poll, 200);
    })();
  }

  /* ---------- 3b. ONE SHADER, TWO SURFACES ----------
     Everything above this line is shared: the guards, the tuned constants, the
     GLSL, and a single LCP observer. Everything below is per-surface, so the
     same effect can be pointed at the hero's <picture> stack and at the Film
     track's frame stack without a second copy of the shader existing.

     cfg.media  the positioned box the canvas is inserted into
     cfg.frame  the stacked frames it reads textures from
     cfg.scrim  inserted BEFORE this, so the scrim stays on top of the effect
     cfg.cls    canvas class
     cfg.api    window.<name> for the QA handle
     cfg.carousel  window.<name> exposing onChange, so the shader learns which
                   frame is up from whoever owns the cycling */
  function run(cfg) {
    var media  = document.querySelector(cfg.media);
    var scrim  = cfg.scrim ? document.querySelector(cfg.scrim) : null;
    var frames = document.querySelectorAll(cfg.frame);
    if (!media || !frames.length) return;

  function gate(fn) {
    var left = 3;
    var done = function () { if (--left === 0) whenLcpQuiet(function () { whenIdle(fn); }); };

    var lcpImg = frames[0].querySelector('img');
    if (!lcpImg || lcpImg.complete) done();
    else lcpImg.addEventListener('load', done, { once: true });

    if (document.readyState === 'complete') done();
    else window.addEventListener('load', done, { once: true });

    /* Safari has no largest-contentful-paint entry type, so on Safari the
       three gates above are the whole of it — which is why fonts is one. */
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(done, done);
    else done();
  }
  gate(boot);

  /* ---------- 4. THE THING ITSELF ---------- */
  function boot() {
    var canvas, gl, prog, uni, texA, texB, raf = null, dead = false;
    var srcA = null, srcB = null;

    var mouse = { x: 0.5, y: 0.45 }, target = { x: 0.5, y: 0.45 }, pinned = false;
    var amount = 0, mix = 0, last = 0, lastMove = -1e9, drawn = 0;
    var offA = [0, 0], offB = [0, 0], cover = [1, 1];
    var visible = true, onScreen = true;

    function destroy() {
      if (dead) return;
      dead = true;
      if (raf) cancelAnimationFrame(raf);
      raf = null;
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('resize', onResize);
      document.removeEventListener('visibilitychange', onVis);
      try { if (gl) { var e = gl.getExtension('WEBGL_lose_context'); if (e) e.loseContext(); } } catch (err) {}
      if (canvas && canvas.parentNode) canvas.parentNode.removeChild(canvas);
      canvas = gl = null;
      /* The <picture> underneath was never touched. This is a no-op for the
         user beyond the effect stopping. */
    }

    try {
      canvas = document.createElement('canvas');
      canvas.className = cfg.cls;
      canvas.setAttribute('aria-hidden', 'true');

      var opts = { alpha: false, antialias: false, depth: false, stencil: false,
                   premultipliedAlpha: false, powerPreference: 'low-power',
                   preserveDrawingBuffer: false };
      gl = canvas.getContext('webgl', opts) || canvas.getContext('experimental-webgl', opts);
      if (!gl) { destroy(); return; }

      prog = link(gl, VERT, FRAG);
      if (!prog) { destroy(); return; }

      var buf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 3,-1, -1,3]), gl.STATIC_DRAW);
      var aPos = gl.getAttribLocation(prog, 'aPos');
      gl.enableVertexAttribArray(aPos);
      gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

      gl.useProgram(prog);
      uni = {};
      ['uTex','uTexB','uMix','uMouse','uRes','uAmount','uCover','uOffset','uOffsetB']
        .forEach(function (n) { uni[n] = gl.getUniformLocation(prog, n); });
      gl.uniform1i(uni.uTex, 0);
      gl.uniform1i(uni.uTexB, 1);

      texA = mkTex(gl);
      texB = mkTex(gl);

      canvas.addEventListener('webglcontextlost', function (e) { e.preventDefault(); destroy(); });
    } catch (err) {
      destroy();
      return;
    }

    /* ---------- textures ---------- */
    function mkTex(g) {
      var t = g.createTexture();
      g.bindTexture(g.TEXTURE_2D, t);
      /* The frames are non-power-of-two, so WebGL1 allows exactly this:
         CLAMP_TO_EDGE and a non-mipmapped filter. It is also what we want on
         its own terms — the tear and the warp push uv past the edge, and
         CLAMP smears the edge pixel instead of wrapping the far side in. */
      g.texParameteri(g.TEXTURE_2D, g.TEXTURE_WRAP_S, g.CLAMP_TO_EDGE);
      g.texParameteri(g.TEXTURE_2D, g.TEXTURE_WRAP_T, g.CLAMP_TO_EDGE);
      g.texParameteri(g.TEXTURE_2D, g.TEXTURE_MIN_FILTER, g.LINEAR);
      g.texParameteri(g.TEXTURE_2D, g.TEXTURE_MAG_FILTER, g.LINEAR);
      g.texImage2D(g.TEXTURE_2D, 0, g.RGB, 1, 1, 0, g.RGB, g.UNSIGNED_BYTE,
                   new Uint8Array([0, 0, 0]));
      return t;
    }

    /* Returns false instead of throwing. texImage2D THROWS on a tainted image,
       and the everyday way to taint one is to open the page from disk: over
       file:// Chrome treats every image as cross-origin, so this is not an
       edge case, it is what happens the first time anyone double-clicks
       index.html. It used to throw past the caller with the canvas already in
       the DOM, leaving an orphan element and a half-built shader. */
    function upload(tex, unit, img) {
      try {
        gl.activeTexture(gl.TEXTURE0 + unit);
        gl.bindTexture(gl.TEXTURE_2D, tex);
        /* No UNPACK_FLIP_Y: row 0 of the image lands at v=0, which is the top,
           which is where vUv.y = 0 is. Everything counts down from the top. */
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, img);
        return true;
      } catch (err) {
        return false;
      }
    }

    /* ---------- object-fit: cover, replicated exactly ----------
       Get this wrong and the image stretches. The canvas covers the <picture>
       completely, so any mismatch reads as the hero being subtly the wrong
       shape rather than as a bug. Same maths CSS uses: scale the shorter axis
       down in UV space, then slide it by the object-position fraction. */
    function coverFor(img, posStr) {
      var cw = canvas.width, ch = canvas.height;
      var iw = img.naturalWidth || 1, ih = img.naturalHeight || 1;
      var ca = cw / ch, ia = iw / ih;
      var sx = 1, sy = 1;
      if (ca > ia) sy = ia / ca; else sx = ca / ia;
      var p = parsePos(posStr);
      return { cover: [sx, sy], offset: [(1 - sx) * p[0], (1 - sy) * p[1]] };
    }

    function parsePos(s) {
      var m = /(-?[\d.]+)%\s+(-?[\d.]+)%/.exec(s || '');
      return m ? [parseFloat(m[1]) / 100, parseFloat(m[2]) / 100] : [0.6, 0.45];
    }

    function posOf(frame) {
      var img = frame.querySelector('img');
      if (!img) return '';
      return img.style.getPropertyValue('--hero-pos') ||
             getComputedStyle(img).objectPosition || '';
    }

    function imgOf(frame) {
      var img = frame.querySelector('img');
      return (img && img.complete && img.naturalWidth) ? img : null;
    }

    /* ---------- sizing ---------- */
    function onResize() {
      if (dead) return;
      if (!window.matchMedia('(min-width: 1024px)').matches ||
          window.matchMedia('(pointer: coarse)').matches) { destroy(); return; }
      var dpr = Math.min(window.devicePixelRatio || 1, 2);
      var r = media.getBoundingClientRect();
      var w = Math.max(1, Math.round(r.width * dpr));
      var h = Math.max(1, Math.round(r.height * dpr));
      if (canvas.width === w && canvas.height === h) return;
      canvas.width = w; canvas.height = h;
      gl.viewport(0, 0, w, h);
      recompute();
      wake();
    }

    function recompute() {
      if (srcA) { var a = coverFor(srcA, posOf(frames[idxA])); cover = a.cover; offA = a.offset; }
      if (srcB) { var b = coverFor(srcB, posOf(frames[idxB])); offB = b.offset; }
    }

    /* ---------- input ---------- */
    function onMove(e) {
      var r = media.getBoundingClientRect();
      target.x = (e.clientX - r.left) / r.width;
      target.y = (e.clientY - r.top) / r.height;
      lastMove = performance.now();
      wake();
    }

    function onVis() { visible = !document.hidden; visible ? wake() : sleep(); }

    /* ---------- the loop ----------
       Capped at 30fps, and stopped outright the moment there is nothing
       moving: no pointer activity, no crossfade, uAmount at zero and the
       lerped cursor settled. An ambient effect that spins a RAF over a still
       frame forever is just a battery leak with a nice look. */
    function sleep() { if (raf) { cancelAnimationFrame(raf); raf = null; } }
    function wake() {
      if (dead || raf || !visible || !onScreen) return;
      last = performance.now();
      raf = requestAnimationFrame(loop);
    }

    function loop(now) {
      raf = requestAnimationFrame(loop);
      var dt = now - last;
      if (dt < FRAME_MS - 1) return;
      last = now;

      mouse.x += (target.x - mouse.x) * LERP;
      mouse.y += (target.y - mouse.y) * LERP;

      if (pinned) lastMove = now;
      var moving = (now - lastMove) < IDLE_MS;
      /* Ramps to GAIN, not to 1. Keeping GAIN here rather than folding it
         into SEPARATION keeps the two separable: how strong the effect is,
         against how hard it is driven. */
      amount = moving ? Math.min(GAIN, amount + GAIN * dt / RISE_MS)
                      : Math.max(0, amount - GAIN * dt / DECAY_MS);

      if (mixing) {
        mix = Math.min(1, mix + dt / FADE_MS);
        if (mix >= 1) settle();
      }

      draw(now);

      var settled = Math.abs(target.x - mouse.x) < 0.002 &&
                    Math.abs(target.y - mouse.y) < 0.002;
      if (!moving && amount === 0 && !mixing && settled) sleep();
    }

    function draw(now) {
      drawn++;
      gl.useProgram(prog);
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, texA);
      gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, texB);
      gl.uniform1f(uni.uAmount, amount);
      gl.uniform1f(uni.uMix, mix);
      gl.uniform2f(uni.uMouse, mouse.x, mouse.y);
      gl.uniform2f(uni.uRes, canvas.width, canvas.height);
      gl.uniform2f(uni.uCover, cover[0], cover[1]);
      gl.uniform2f(uni.uOffset, offA[0], offA[1]);
      gl.uniform2f(uni.uOffsetB, offB[0], offB[1]);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }

    /* ---------- carousel handoff ---------- */
    var idxA = 0, idxB = 0, mixing = false;

    function settle() {
      /* B has fully arrived: it becomes A, and the pair goes quiet again. */
      var t = texA; texA = texB; texB = t;
      offA = offB; offB = offA.slice();   /* B now holds A's image, so A's offset */
      srcA = srcB; idxA = idxB;
      mix = 0; mixing = false;
      gl.uniform1i(uni.uTex, 0);
      gl.uniform1i(uni.uTexB, 1);
      upload(texA, 0, srcA);
      upload(texB, 1, srcA);
    }

    function goTo(n) {
      var f = frames[n];
      if (!f) return;
      var img = imgOf(f);
      if (!img) {
        /* Not decoded yet. Leave A on screen and pick it up on load rather
           than crossfading to a 1x1 black texture — and re-check the index,
           because the carousel may have moved on again while we waited. */
        var pending = f.querySelector('img');
        if (pending) pending.addEventListener('load', function () {
          if (!dead && window.heroCarousel && window.heroCarousel.index === n) goTo(n);
        }, { once: true });
        return;
      }
      srcB = img; idxB = n;
      if (!upload(texB, 1, img)) { destroy(); return; }
      recompute();
      mix = 0; mixing = true;
      wake();
    }

    /* ---------- start ----------
       Order matters: the first texture upload has to SUCCEED before the canvas
       is allowed into the DOM. Doing it the other way round is how a tainted
       image (file://) left a dead canvas sitting on top of the hero. If the
       upload fails there is no canvas, and the <picture> underneath is simply
       what you see — which is the whole contract of this file. */
    var first = imgOf(frames[0]);
    if (!first) { destroy(); return; }
    srcA = srcB = first; idxA = idxB = 0;

    try {
      canvas.style.visibility = 'hidden';
      media.insertBefore(canvas, scrim || null);
      onResize();
      if (!upload(texA, 0, first) || !upload(texB, 1, first)) { destroy(); return; }
      canvas.style.visibility = '';
    } catch (err) {
      destroy();
      return;
    }

    window.addEventListener('pointermove', onMove, { passive: true });
    window.addEventListener('resize', onResize, { passive: true });
    document.addEventListener('visibilitychange', onVis);

    /* Off screen is off. A hero scrolled past has no business holding a RAF. */
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (es) {
        onScreen = es[0].isIntersecting;
        onScreen ? wake() : sleep();
      }, { threshold: 0 }).observe(media);
    }

    if (window[cfg.carousel]) window[cfg.carousel].onChange(function (n) { goTo(n); });

    requestAnimationFrame(function () { if (canvas) canvas.classList.add('is-live'); });
    wake();

    window[cfg.api] = {
      destroy: destroy,
      /* Used only by the screenshot harness: park the cursor and hold the
         effect at full strength so a still frame shows what motion looks like. */
      _state: function () {
        return { drawn: drawn, raf: !!raf, visible: visible, onScreen: onScreen,
                 uAmount: gl.getUniform(prog, uni.uAmount),
                 uMouse: Array.from(gl.getUniform(prog, uni.uMouse) || []),
                 uRes: Array.from(gl.getUniform(prog, uni.uRes) || []),
                 cover: cover, offA: offA, offB: offB, mix: mix, amount: amount,
                 canvas: [canvas.width, canvas.height],
                 media: [media.getBoundingClientRect().width, media.getBoundingClientRect().height],
                 nat: [srcA.naturalWidth, srcA.naturalHeight],
                 src: srcA.currentSrc.split('/').pop(),
                 pos: posOf(frames[idxA]) };
      },
      _pin: function (x, y) {
        target.x = mouse.x = x; target.y = mouse.y = y;
        amount = GAIN; pinned = true; lastMove = performance.now();
        wake();
        return true;
      },
      _unpin: function () { pinned = false; },
      /* QA only: re-read the live <img> into the texture. The shader normally
         learns about a new image from the carousel; this is for harnesses that
         swap an <img> src directly. */
      _reload: function () {
        var img = imgOf(frames[idxA]);
        if (!img) return false;
        srcA = srcB = img;
        upload(texA, 0, img); upload(texB, 1, img);
        recompute(); wake();
        return true;
      }
    };
  }
  }

  /* The hero, exactly as before. */
  run({ media: '.hero-media', frame: '.hero-frame', scrim: '.hero-scrim',
        cls: 'hero-fx', api: 'heroShader', carousel: 'heroCarousel' });

  /* The Film track. Same effect, same constants, same guards — the frames are
     photographs of the same kind behind type of the same kind. The canvas goes
     under .trk-scrim so the contrast work still lands on top of the effect. */
  run({ media: '.trk--film .trk-bg', frame: '.trk--film .trk-bg-frame',
        scrim: '.trk--film .trk-scrim',
        cls: 'trk-fx', api: 'filmShader', carousel: 'filmCarousel' });

  /* ---------- shader plumbing ---------- */
  function compile(gl, type, src) {
    var s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      if (window.console) console.warn('[hero-shader]', gl.getShaderInfoLog(s));
      gl.deleteShader(s);
      return null;
    }
    return s;
  }

  function link(gl, vs, fs) {
    var v = compile(gl, gl.VERTEX_SHADER, vs);
    var f = compile(gl, gl.FRAGMENT_SHADER, fs);
    if (!v || !f) return null;
    var p = gl.createProgram();
    gl.attachShader(p, v); gl.attachShader(p, f); gl.linkProgram(p);
    gl.deleteShader(v); gl.deleteShader(f);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
      if (window.console) console.warn('[hero-shader]', gl.getProgramInfoLog(p));
      return null;
    }
    return p;
  }
})();
