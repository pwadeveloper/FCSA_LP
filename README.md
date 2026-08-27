# TFCS.AFRIC — The Film & Content School Africa

Static single-page site. No framework, no build step, no dependencies.
Deploy by dragging this folder to Netlify, Vercel or GitHub Pages.

Local preview: `python3 -m http.server 8000`

---

## 🔴 LAUNCH BLOCKERS

### 0a. ~~Mezzotint CF ampersand~~ — RESOLVED, substituted

**No longer a blocker.** The `&` is now Playfair Display Italic SemiBold, an
SIL Open Font Licence face from Google Fonts, self-hosted at
`assets/fonts/amp.woff2`. Nothing was ever extracted from Mezzotint CF, and
the `.otf` has been deleted from the working tree and the git index.

Mezzotint CF was only ever on the build machine as an Adobe Fonts / Creative
Cloud activated font (The Type Founders). That licence covers desktop use and
Adobe's own web CDN; it does not permit self-hosting a subset. Rather than buy
a webfont licence or accept a third-party CDN request, the glyph was
substituted. If you later license Mezzotint CF properly, swap the file at
`assets/fonts/amp.woff2` and re-run the optical tuning below — the CSS needs
no structural change.

**How it was chosen.** Three Google Fonts italic serifs were set in the real
headline and compared: Playfair Display, EB Garamond, Bodoni Moda.

- **Bodoni Moda was eliminated on the 375px hairline test.** Browsers apply
  `font-optical-sizing: auto` by default, which at headline sizes drives
  Bodoni's `opsz` axis (range 6–96) to the display end, where its hairlines are
  thinnest. Measured on the rasterised glyph at 375px/50.25px, its thinnest
  strokes peak at **0.54 luminance** and — the deciding detail — do **not**
  recover at DPR 2 (still 0.54), so it is a genuinely sub-pixel stroke, not a
  rasterisation artifact. Playfair measured 0.83/0.96 and EB Garamond 0.94/0.96
  at DPR 1/2. Forcing `opsz: 6` fixes Bodoni's hairlines (0.91/0.99) but gives
  up the high-contrast display character that was the reason to consider it.
- **EB Garamond** survived the hairline test but lost on form: its open
  double-curl reads as a separate ornament next to Delight's tight geometric
  bowls, especially at 375 where it degrades into a squiggle.
- **Playfair Display** has a closed lower bowl and a strong diagonal that
  counterpoint the sans instead of fighting it.

**Optical tuning — `1.18em / w600 / vertical-align -0.035em`.** Worth knowing
why, because the obvious diagnosis is wrong. Playfair's `&` is *already*
cap-aligned against Delight Black (ink top −1px, bottom +1px against the cap
band, measured in a shared line box). It does **not** float high at its natural
size. It reads small purely because a high-contrast italic puts far less ink on
the page than Delight Black at the same height — so `1.18em` and `w600` are
both doing optical-*mass* work, not height work. The `-0.035em` only re-seats
it after that scale-up; measured, it lands the `&`'s ink centroid within 0.7px
of the surrounding caps'. An earlier `-0.05em` overshot and sat visibly low.

**The file.** Subset to `U+0026` and instanced at `wght 600`: **744 bytes**,
two glyphs (`.notdef` + `ampersand`). Static rather than variable — the
variable subset was 1276 bytes and would have depended on the browser exposing
the weight range. `unicode-range: U+0026` means it is only fetched because the
headline contains an `&`. The `@font-face` declares `font-weight: 600` so
`.hero-amp`'s request is an exact match and no synthetic bolding is applied.

Self-hosted, not the Google Fonts CDN, deliberately: a CDN `<link>` costs a DNS
lookup and TLS handshake to a third-party origin before the CSS referencing it
can be parsed, which is the expensive part on 3G.

To reproduce the subset:

```bash
# 1. Get the latin italic woff2 URL (modern UA -> woff2)
curl -A "Mozilla/5.0 ... Chrome/120.0" \
  "https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@1,400..900"
# 2. Download that .woff2, then pin the weight and subset to one glyph
fonttools varLib.instancer playfair-italic-full.woff2 wght=600 -o playfair-600.ttf
pyftsubset playfair-600.ttf --unicodes=U+0026 --flavor=woff2 \
  --layout-features='' --no-hinting --desubroutinize --name-IDs='' \
  --output-file=assets/fonts/amp.woff2
```

### 0b. Hero media — RIGHTS, and the framing the layout depends on

**The image currently wired into the hero is a comp and must not ship.** It is
a publicity still of a recognisable actor (Giancarlo Esposito). It is in the
repo so the scrim could be tuned against real pixels rather than a guess.

**Any replacement must be framed subject centre-right, with the left third
falling to near-black.** This is not a preference. At >=1024 the headline, the
See All Tracks button and the partner strip all sit over the picture on the
left. If the subject or a lit surface occupies the left third, the layout does
not adapt — it breaks, and the scrim has to be re-tuned from scratch to recover
it. The comp itself only half-conforms: its lit sleeve runs into the left half,
which is why the scrim is the shape it is (see 0c).

Wired as `<picture>` in `index.html`:

| width | AVIF | WebP | JPEG |
|---|---|---|---|
| 900  | 35.4 KB | 37.4 KB | 55.5 KB |
| 1440 | 79.0 KB | 77.3 KB | 128.2 KB |
| 1688 | 104.0 KB | 99.0 KB | 171.0 KB |

Verified on a cold cache: 375px fetches `hero-900.avif` (36 KB), 1440px fetches
`hero-1440.avif` (81 KB). One request, no double-download, under the 150KB
budget at 1440. (Chrome will not downgrade to a smaller candidate once a larger
one is in cache — if you test selection by resizing, use a fresh origin or you
will always see the largest file.)

There is no 1920 step. The master is 1688px wide; a 1920 would be an upscale
with no extra detail and more bytes. Drop in a >=1920 master and regenerate.

`object-position: 65% 50%` holds the subject centre-right as the frame narrows.
Do not centre it. `fetchpriority="high"`, `loading="eager"` — it is the LCP
element, never lazy-load it. `alt=""`, the headline carries the meaning.

**Regenerating the derivatives** (Pillow with AVIF + WebP support):

```python
from PIL import Image
src = Image.open('assets/media/hero.png'); W, H = src.size
base = src.convert('RGB')
for tw in (900, 1440, 1688):
    im = base.resize((tw, round(tw * H / W)), Image.LANCZOS)
    im.save('assets/media/hero-%d.avif' % tw, 'AVIF', quality=80)
    im.save('assets/media/hero-%d.webp' % tw, 'WEBP', quality=90, method=6)
    im.save('assets/media/hero-%d.jpg'  % tw, 'JPEG', quality=88,
            optimize=True, progressive=True, subsampling=1)
```

`assets/media/hero.png` is the 1.5MB master. It is **not** referenced by the
page — do not deploy it.

### 0c. Hero contrast — measured, not eyeballed

Method: render the page, hide `.hero-inner` and `.site-head` so only image and
scrim remain, capture the viewport 1:1, then sample **every pixel** inside the
real glyph boxes (per-line `Range.getClientRects()`, not the block box) and
take the worst white-on-background ratio. Floor is 4.5:1.

Shipping result — worst pixel found in each box:

| | 375 | 768 | 1023 | 1440 |
|---|---|---|---|---|
| headline | 21.00 | 21.00 | 21.00 | **8.12** |
| subhead | 21.00 | 21.00 | 21.00 | **6.20** |
| See All Tracks | 21.00 | 21.00 | 21.00 | 20.87 |
| header mark | 10.48 | 14.74 | 18.79 | 20.56 |
| partner marks | 21.00 | 21.00 | 21.00 | 18.71 |

Below 1024 the type is on solid black (stacked layout), hence 21:1; the only
thing over the picture there is the header.

**Why the desktop scrim is an ellipse, not a linear wedge.** All the type sits
lower-left; the subject sits upper-middle. A left-anchored *linear* wedge has
to darken the full column height to reach the type, which takes the face down
with it. An ellipse anchored off the bottom-left corner builds density only
where the type is. Measured at 1440; subject brightness is the mean luminance
of the face box:

| treatment | headline | partner marks | subject brightness |
|---|---|---|---|
| no scrim | 1.62 ✗ | 2.57 ✗ | 0.0519 (100%) |
| linear 100deg wedge | 4.16 ✗ | 14.69 | 0.0222 (43%) |
| denser linear wedge | 6.80 | 17.39 | 0.0132 (25%) |
| **shipping ellipse** | **8.12** | **18.71** | **0.0492 (95%)** |

1.8× the floor for 5% of the subject's brightness. The linear wedge could not
clear the floor without halving it.

The mobile top band is a separate, px-anchored gradient: it guards the header
mark, not a fraction of the picture, so its stops are in px and keyed to
`--head-mark-h`. It took the mark at 375 from 1.37:1 to 10.48:1 for 7% of the
block's mean luminance.

The subhead's 6.20:1 comes from the **image**, not the scrim — the scrim does
not reach the right edge. A replacement with a bright right edge will need a
pool added back there. Watch that number.

**These stops are tuned to this specific image. Re-run the measurement when it
is replaced.** Do not assume they transfer.

### 0d. Hero needs a dedicated mobile frame

At <1024 the layout is a 4:5 image block on top with the type stacked on black
beneath — correct, and the type reads at 21:1. But at 375 the comp's 4:5 crop
puts the subject's head hard against the top of the block, right under the
header band, and it reads badly.

`object-position` cannot fix this. At 4:5 the source (1688×1031) scales to fit
the block's *height*, so the crop is horizontal only — there is no vertical
travel to give. **The mobile frame has to be shot or cropped separately**, with
the subject lower in a 4:5 field.

When that asset exists, add it as the first `<source>` inside the existing
`<picture>`:

```html
<source media="(max-width: 1023px)" type="image/avif" sizes="100vw"
        srcset="assets/media/hero-mobile-750.avif 750w,
                assets/media/hero-mobile-1200.avif 1200w">
```

### Partner logos — LANDED

All four supplied as SVG, white fills, in `assets/logos/`:
`multimudia-studios.svg`, `clan-yujo.svg`, `colab.svg`, `kaykav-academy.svg`.
Renamed from the delivered filenames, which had spaces and mixed case.

They render at their own intrinsic heights (set inline as `--h`) times a shared
`--logo-u` px-per-unit scale, so the four keep their relative optical weight at
every width instead of being forced into one box height. At >=1024 `--logo-u`
is `1px` and each mark sits at native size, matching the comp. At <560 the row
wraps to two-by-two rather than shrinking below legibility.

The label is **"Supported by"**. In the hero it is `sr-only` — the comp carries
no visible label — so the wording lives in the accessible name. The footer
prints it.

### 1. Cost — needs a real answer AND a prominent home

There is currently no price anywhere on the page, and no placeholder standing
in for one. This is the single biggest gap: people cannot decide to apply
without it. When the number exists it needs more than an FAQ line — most
likely its own block near the apply form, or in the tracks section beside the
day/week tags.

### 2. Everything else missing

| Item | Where it needs to go |
|---|---|
| Venue address in Kaduna | New FAQ entry |
| Application deadline | New FAQ entry, and near the apply form |
| Certificate — yes or no | New FAQ entry |
| Reply time, in days | Under the submit button |
| Contact — phone, WhatsApp, email | Footer |
| Socials — school, Clan Yujo, Multimudia | Footer |
| Content track, weeks 10–11 | Timeline lane — currently the one visible `[To confirm]` on the page |
| Tutor roster | Section was cut. Needs photos, credits and each person's sign-off before it earns a place back. |

### 3. `FORM_ENDPOINT`

Top of `script.js`, currently `null`. Set it to a Formspree / Tally / Google
Form URL. Until then the form validates fully and then says it is not
connected, rather than pretending to send.

The submit-failure message used to read "…or message us on \[TO CONFIRM]".
It now ends at "Check your connection and try again." Add the contact channel
back into that string in `script.js` once there is one.

### 4. Open Graph image

1200×630 on Soft Black `#2E1E1C`, both logos, headline. Add at
`assets/og-image.png`, then uncomment the block in `<head>` and set the live
domain. Carrot `#F3681A` is allowed on the card only if it carries the same
meaning it does on the page — the action, or the destination. Not decoration. This link will be
shared on WhatsApp far more than it will be found in search, so the preview
card matters more than the SEO.

An analytics slot sits commented in `<head>`. Nothing is loaded.

---

## 🚧 REGRESSION GUARD — DOCUMENT WIDTH MUST EQUAL VIEWPORT WIDTH

**Invariant: `document.documentElement.scrollWidth === document.documentElement.clientWidth`
at every breakpoint, in BOTH motion states.** Check it before shipping any change
to the timeline, the media scrollers, or the header.

```js
// paste in the console at each width, normal AND prefers-reduced-motion
document.documentElement.scrollWidth === document.documentElement.clientWidth
```

### Read `documentElement`, NOT `body`

`document.body.scrollWidth` is the wrong number and it will lie to you. A page
whose scrollers are clipped reports a contained `body.scrollWidth` while
`documentElement.scrollWidth` is still ~3x the frame — measured 390 vs 1108 at a
390px viewport on the build that was live. **`body` reads correct both before and
after the fix**, so a check written against it passes on a broken build. The
layout viewport is built from the `documentElement` number. That is the one that
decides where the fixed header goes.

**Or open `/?widthcheck` on the actual phone.** That renders a fixed readout in
the corner — green when document == viewport, red with the overhang in px when
not. It is opt-in via the querystring, costs one regex test on a normal load, and
exists because this bug cannot be reproduced on a desktop browser at any emulated
size. No console, no cable, no Mac required.

Widths to check: **320 / 360 / 375 / 390 / 414 / 430 / 768 / 1024 / 1440.**
Reduce Motion is set at the OS level, so a default browser profile will NOT
show the failure — toggle it on the machine, not in devtools.

### Why this is not a cosmetic overflow

`.site-head` is `position: fixed`. On iOS Safari a fixed element resolves against
the **layout viewport**, which widens to the document width. So the instant the
document is wider than the screen, the header stretches to the document width and
takes the Apply pill off the right edge with it — 606px document on a 375px
screen put the pill **231px off screen**. A full-page screenshot reproduces it
(it captures at document width); a normal viewport screenshot does NOT.

### The original offender — `.chev` — is gone; the invariant is not

The worst offender was the curriculum marquee. `.chev` was `white-space: nowrap`
+ `flex: none`, so one tag was as wide as its text — **up to 581px against a
375px frame**, and the row laid ~9368px end to end — contained only by clipping.
**That whole band (the marquee and the Foundation block above it) has been
removed**, and with it every `.marq` / `.chev` rule and the reduced-motion wrap
that used to tame them. The tracks intro now runs straight into the panels.

Removing the widest scroller does not retire the invariant — it still binds the
three that remain, and the single rule that actually holds it is unchanged:

- `.tl-scroll, .prod-scroll, .showcase-scroll { contain: paint }` —
  **this is what actually fixes the document width.** A scroll container clips
  its content, but that content still counts toward the ROOT's scrollable
  overflow; only containment removes it from that sum. Overflow rules alone do
  not: with `html, body { overflow-x: clip }` in place and no containment,
  `documentElement.scrollWidth` stays wide. **Any new horizontal scroller must
  be added to that selector list** (this is where `.marq-row` used to sit), and
  no intrinsically-wide (`max-content`, `nowrap`) element may be reintroduced
  guarded by `overflow: clip` alone.

### Two traps when testing this

- **`scroll-behavior: smooth` is set on `html`.** `window.scrollTo(9999, 0)`
  followed by reading `window.scrollX` returns `0` whether or not the page
  overflows, because the scroll is still animating. It is not a valid probe.
- **`overflow: hidden` and `clip` still allow programmatic `scrollLeft`.** A
  non-zero `scrollLeft` read does not prove user-visible overflow either.
- **Chrome cannot reproduce this class of bug at all.** It contains the three
  scrollers and reports a correct `body.scrollWidth` at every emulated size.
  iOS Safari widens the layout viewport instead. A desktop pass is not evidence;
  `/?widthcheck` on a real phone is.

Compare `documentElement.scrollWidth` to `clientWidth`. Nothing else.

*This bug has cost two sessions. Both times the header looked correct in a
viewport screenshot and in `getBoundingClientRect` — Chrome pins fixed elements
to the visual viewport, so the drift is invisible there.*

---

## THE HEADER

**It never gets a background.** No fill, no blur, no border, no shadow, at any
scroll position. The mark and the Apply pill are the only fixed elements on the
page and they float over whatever is beneath them for the whole scroll.

Because the bar is invisible, `.site-head` is `pointer-events: none` and the two
controls opt back in — otherwise an invisible 94–200px strip would swallow every
click across the top of the page.

### Two states, triggered by scroll distance only

| | mark | pill |
|---|---|---|
| rest | `clamp(80px, 9.5vw, 150px)` | 52px tall |
| compact | 44px | 44px tall |

Compact latches on at **120px** of scroll and releases at **96px**. The 24px
dead band stops the 200ms transition fluttering if you park on the threshold.
It is a pure function of `scrollY` — not scroll direction, not which section is
in view. Both states keep the 25px left/right/top offsets, with
`--head-pad-top: max(var(--edge), env(safe-area-inset-top, 0px))` for notched
devices.

The compact pill is 44×108 — above the 44×44 tap floor. The old `.btn-sm`
height was 42px, which was already under it; that is fixed. The label stays
"Apply now" in both states: at 375 the compact row uses 218 of 325 available
px, so there is no need to shorten it, and a stable accessible name is worth
more than the 34px.

### `--head-h` is gone

It was a literal px value that `script.js` parsed and that had to be re-derived
by hand at four breakpoints. A header that changes height on scroll would have
made that literal wrong the moment the compact state engaged, and every anchor
would have landed short. Nothing parses it now — the old IntersectionObserver
that needed it went with the scrolled background.

Anchors use a derived value instead:

```css
--head-compact-h: calc(var(--head-pad-top) + var(--head-mark-compact) + var(--edge));
main[id], section[id] { scroll-margin-top: calc(var(--head-compact-h) + 24px); }
```

Right by construction, including on a notched device where `--head-pad-top`
grows. It is deliberately the **compact** height: every anchor target sits more
than 120px down, so the header is always compact by the time a jump lands. The
taller resting header only exists over the hero, where nothing anchors.

That selector is structural, not a hand-kept list. The old enumeration had
drifted — `#showcase` and `#production` were missing and landing 94px under the
header. Measured after the change: `#tracks` `#weeks` `#showcase` `#production`
`#faq` `#apply` all land with exactly 24px of clearance at 375 and at 1440.

### Legibility: drop-shadow on the mark, no scrim

The pill is yellow with black text and holds against anything. The white mark
does not, so it carries two stacked drop-shadows — a tight one for edge
definition, a wide soft one for ambient density. On the SVG, `drop-shadow`
follows the alpha channel, so it traces the crocodile and reel outline instead
of boxing them.

**The values are scaled to the state.** Measured over pure white — the ring is
isolated by diffing against a `filter: none` render, so the mark's own black
artwork is excluded:

| mark size | shadow pair | darkest ring pixel | background covered |
|---|---|---|---|
| 150px | `0 1 2` / `0 4 16` (spec) | rgb(87) | 42.9% |
| 150px | `0 1 1.5` / `0 2 6` | rgb(70) | 24.9% |
| 44px | `0 1 2` / `0 4 16` (spec) | rgb(122) | 21.0% |
| 44px | **`0 1 1.5` / `0 2 6` (shipped)** | **rgb(91)** | **9.2%** |

At 44px the 16px ambient blur spreads the same alpha over 36% of the mark's own
height: it separates *less* (rgb 122 vs 91) while clouding *more* (21% vs 9.2%).
A fixed shadow cannot serve a mark that changes size 3.4×. Rest keeps the spec
pair; compact gets the tighter one, and `filter` transitions between them.

The linework survives at both sizes — checked at 3× over a blown-out frame, the
reel spokes and the crocodile's teeth stay separate — so the scrim fallback was
not needed.

### Known consequence

A background-less fixed header means content passes *under* the mark. Scrolling
through the hero at 1440, the compact mark crosses the "See all tracks" button;
at 375 it crosses body copy. The shadow keeps the mark readable, but the content
beneath is briefly obscured. That is inherent to the no-background decision, not
a bug to fix elsewhere.

## MEDIA MANIFEST

Twenty slots. Nineteen render on the page as labelled placeholders;
`og-image` is the social card and is built, not photographed. The reel is not
in this table — it is shot, cut and delivered, and has its own section below.
**Every slot needs original or licensed material.** The hero reference comp
must not ship — it is a publicity still of a recognisable actor.

Drop assets in at the exact paths below and they appear with no code change.
Every `LOOP` needs a `.mp4` **and** a `.jpg` poster at the same name.

| Slot | Section | Path | Ratio | Dimensions | Type | What it is | Status |
|---|---|---|---|---|---|---|---|
| `track-film-portrait` | Track 1 | `assets/media/track-film/portrait.*` | ~4:5, full-bleed | 1600×2000+ | STILL or LOOP | A student, rim-lit, looking to camera. Head-and-shoulders, subject centre-right; edges fall to near-black so the title and body type stay legible over them. |  |
| `film-clip-01` | Track 1 | `assets/media/track-film/clip-01.*` | 4:3 | — | STILL or LOOP | Foot-row clip, film track. |  |
| `film-clip-02` | Track 1 | `assets/media/track-film/clip-02.*` | 16:9 | — | STILL or LOOP | Foot-row clip, film track. |  |
| `film-clip-03` | Track 1 | `assets/media/track-film/clip-03.*` | 16:9 | — | STILL or LOOP | Foot-row clip, film track. |  |
| `track-content` | Track 2 | `assets/media/track-content.mp4` | 9:16 | 1080×1920 | LOOP | Phone-shot content as it appears in feed. 5–8s. |  |
| `track-finishers` | Track 3 | `assets/media/track-finishers.jpg` | 16:9 | 1600×900 | STILL | An NLE timeline mid-cut, or a grade before/after. |  |
| `showcase-01` | Showcase | `assets/media/showcase-01.mp4` | 16:9 | 1920×1080 | LOOP | Tutor work. |  |
| `showcase-02` | Showcase | `assets/media/showcase-02.jpg` | 9:16 | 1080×1920 | STILL | Tutor work. |  |
| `showcase-03` | Showcase | `assets/media/showcase-03.jpg` | 4:5 | 1080×1350 | STILL | Tutor work. |  |
| `showcase-04` | Showcase | `assets/media/showcase-04.jpg` | 16:9 | 1920×1080 | STILL | Tutor work. |  |
| `showcase-05` | Showcase | `assets/media/showcase-05.mp4` | 9:16 | 1080×1920 | LOOP | Tutor work. |  |
| `showcase-06` | Showcase | `assets/media/showcase-06.jpg` | 1:1 | 1200×1200 | STILL | Tutor work. |  |
| `production-01` | Production | `assets/media/production-01.jpg` | 16:9 | 1920×1080 | STILL | Behind the scenes, production week. NOT YET SHOT. |  |
| `production-02` | Production | `assets/media/production-02.jpg` | 9:16 | 1080×1920 | STILL | Behind the scenes, production week. NOT YET SHOT. |  |
| `production-03` | Production | `assets/media/production-03.jpg` | 16:9 | 1920×1080 | STILL | Behind the scenes, production week. NOT YET SHOT. |  |
| `production-04` | Production | `assets/media/production-04.jpg` | 9:16 | 1080×1920 | STILL | Behind the scenes, production week. NOT YET SHOT. |  |
| `production-05` | Production | `assets/media/production-05.jpg` | 16:9 | 1920×1080 | STILL | Behind the scenes, production week. NOT YET SHOT. |  |
| `production-06` | Production | `assets/media/production-06.jpg` | 9:16 | 1080×1920 | STILL | Behind the scenes, production week. NOT YET SHOT. |  |
| `apply-still` | Apply | `assets/media/apply-still.jpg` | 3:2 | 1800×1200 | STILL | A premiere audience, or a room watching a screen. Warm, full of people. |  |
| `og-image` | Social | `assets/media/og-image.jpg` | 1.91:1 | 1200×630 | STILL | Black ground, TFCS.AFRIC mark, headline. Built, not photographed. |  |

### The background loop — section 2 at rest

The rest state of section 2 is a silent ambient loop, not a still. It is a
**different film from the reel** and the two never run together: pressing play
pauses and hides the loop before the reel is given a URL, and exiting unloads
the reel and resumes the loop.

| | |
|---|---|
| Source master | `assets/media/BackgroundLoop.mp4` — 4.9MB, 1280x720 HEVC Main 10, 24fps, 9.625s, **gitignored** |
| >=1280 device px | `assets/media/loop/background-loop-720.mp4` — 2.08MB, 1.82 Mbps |
| <1280 device px | `assets/media/loop/background-loop-540.mp4` — 1.05MB, 0.92 Mbps |
| Poster ladder | `assets/media/loop/loop-poster-{900,1280}.{avif,webp,jpg}` — 17.4KB AVIF at 1280 |

```bash
python3 tools/background-loop.py     # both renditions and the poster ladder
```

**The master cannot ship as supplied.** It is HEVC in an `hvc1` box, which only
Safari decodes on the web, and 4.09 Mbps for decorative wallpaper that autoplays
on every visit is roughly twice what the budget allows. Both renditions are
8-bit H.264 High, two-pass, VBV-constrained to 1.5x target.

**The last frame is dropped.** Frame 230 of the master (t=9.583s) is pure black
while frames 227-229 average 164/255 — a one-frame cut to black that `loop`
replays as a visible blink every ten seconds. `TRIM = 230` in the tool. Check
this again if the master is replaced; the tail is not guaranteed to be a fade.

**720 IS THE CEILING, and it is a real limit.** The supplied master is 1280x720,
so a 1920 rung would be an upscale — more bytes, no more detail, and the same
per-asset cap rule the hero and the old rest-state still already follow. Cover-
fit into a full viewport means the file is being stretched 1.25x at 1440 and
1.5x at 1920 before device pixel ratio is even counted, so on a retina laptop it
is a 2.5-3x upscale and it will read soft. **Nothing in this repo can fix that —
only a re-export from the original edit can.** If a 1920x1080 master arrives,
drop it in and change one line:

```python
STEPS = [(1920, 1_800_000), (1280, 900_000)]   # tools/background-loop.py
```

The `<source>` lists in `index.html` are keyed to the file stems, not to pixel
counts, so nothing else changes — but **re-run the contrast measurement**, because
a sharper master has brighter specular pixels and the scrim below is tuned to
this encode.

#### When the loop does not play

Three gates, and in all three the section looks identical, just still — the
poster is already the background, and the play button still plays the reel
(verified: `prefers-reduced-motion` still gets `reel-1080.mp4`, Save-Data gets
`reel-720.mp4`):

- **<1024px.** Mobile gets the poster only. `script.js` **constructs** the
  `<video>`, so below 1024 there is no element in the document at all — not a
  paused one, not a `preload="none"` one. An element with a `src` is a fetch the
  browser may start on its own terms; an element that was never created is a
  guarantee.
- **Save-Data, or `effectiveType` 2g / slow-2g / 3g.** `navigator.connection
  .saveData` is the client-side half of the preference the `Save-Data` header
  carries — the header is not readable from script, but a browser that sends it
  also sets this.
- **`prefers-reduced-motion: reduce`.**

The gates are re-evaluated on `matchMedia` `change`, so resizing across 1024 or
toggling reduced motion mid-session creates or destroys the element rather than
leaving a stale one.

Otherwise: `preload="metadata"`, `muted` + `defaultMuted` + the attribute,
`loop`, `playsinline`, `aria-hidden="true"`, `tabindex="-1"`,
`disablepictureinpicture`. It pauses on `visibilitychange` and when the section
leaves the viewport.

**Two IntersectionObservers, not one**, because "worth downloading" and "worth
decoding" are different distances. The lead observer runs at `rootMargin: 20%`
and only constructs. The playback observer runs at `rootMargin: -1px` and only
starts and stops. The **-1px is load-bearing**: the hero above is exactly
`100svh`, so at the top of the page this section's first pixel row sits exactly
on the fold, and Chromium reports that zero-height overlap as intersecting. At
`0` the loop plays and buffers its full 2MB for every reader who lands and never
scrolls, with none of it on screen.

#### Looping is not just the `loop` attribute

`loop` is set as both property and attribute, and Chromium honours it —
measured, the wrap costs a single frame (32.6ms against a 41.7ms median step at
24fps). But honouring it requires the engine to seek the resource back to zero,
and **WebKit will not seek a resource from a host that answers `200` to a Range
request instead of `206`**. `python3 -m http.server` is exactly such a host, and
it is what this project is tested on. In Safari that combination gives a video
that plays once and stops on its last frame — which looks exactly like "the
loop is broken" and is not a code fault at all.

Three things guard it, and they are deliberately redundant:

1. **`loop` as property and attribute.** The normal path.
2. **An `ended` handler that rewinds and replays.** Where the native loop works
   `ended` never fires and this never runs (verified: 0 events over 2.4 passes
   on both a Range and a non-Range host). Where `loop` is dropped, this is what
   puts it back.
3. **The element is inserted into the DOM before it gets a `src`.** Resource
   selection on a *detached* media element is the path engines disagree about;
   WebKit can finish selecting against an element that is not yet in a document
   and ignore attributes set alongside the src, `loop` among them.

**`preload` is promoted from `metadata` to `auto` in `resume()`** — the moment
every gate has passed and the section is on screen, not before. It buys the
seam: measured against a non-Range host at `preload="metadata"`, the wrap
stalled **242ms** because the head of the file had been evicted and had to be
fetched again. Holding the whole 2MB once we are committed to it takes the
worst frame-to-frame step to **51ms**, on both host types.

Promoted in `resume()` rather than off the `playing` event because `playing` is
not guaranteed to fire on a first play that never had to wait for data —
measured, it fired on some loads and not others.

> Testing locally: `python3 -m http.server` does not serve Range. If you are
> checking loop or scrub behaviour, use a host that does, or you will be
> debugging the server.

**No `poster` attribute on the element.** The `<picture>` underneath already
shows the same frame in AVIF at a third of the JPEG's bytes, and `poster` would
fetch it a second time. The element starts at `opacity: 0` and fades in on
`loadeddata`/`playing`, so a decoder that paints black before its first frame
cannot flash over the poster.

#### The poster is frame zero, deliberately

It is three things at once: the first paint, the handoff image while the loop
decodes, and the entire background wherever the loop is suppressed. Frame zero
makes the handoff a continuation rather than a cut, and it is within 6% of the
loop's brightest frame — so the scrim that clears frame zero clears the video
too, and one measurement covers both states.

### Section 2 contrast — measured against a moving target

Same method as the hero (0c): render the page, hide `.still-content` and
`.site-head` so only backdrop and scrim remain, capture the viewport 1:1, then
sample **every pixel** inside the real glyph boxes — per-line
`Range.getClientRects()`, not the block box — and take the worst ratio. Yellow
`#FFEA33` needs **3:1**, white needs **4.5:1**.

**Every frame was measured, not just the brightest one.** 230 frames x 4
viewports where the loop runs, plus the poster at 768 and 375. That is 920
browser captures rather than six, and it is not thoroughness for its own sake —
see the finding below.

Shipping result — worst pixel found in each box, across the whole loop:

| | 1920 | 1440 | 1280 | 1024 | 768 | 375 |
|---|---|---|---|---|---|---|
| pull line 1 | 4.03 | 3.97 | 3.93 | **3.82** | 4.26 | 4.28 |
| pull line 2 | 4.06 | 3.97 | 3.93 | 3.88 | 4.01 | 4.26 |
| pull line 3 | 4.02 | 4.01 | 3.94 | 3.90 | 4.33 | 4.13 |
| pull line 4 | 4.01 | 4.07 | 3.99 | 3.91 | 4.36 | 4.51 |
| pull line 5 | 4.02 | 4.02 | 4.01 | 3.91 | 5.62 | 5.09 |
| pull lines 6-8 | — | — | — | — | 4.86 / 6.04 | 5.67 / 4.79 / 4.50 |
| button label | 4.89 | 4.93 | 4.68 | **4.65** | 5.44 | 5.37 |
| play glyph | 4.99 | 4.94 | 4.79 | 4.84 | 13.27 | 5.40 |

768 and 375 are the poster, which is one frame; the other four are the worst of
230. **Worst yellow anywhere: 3.82** (1024x768, frame 228, t=9.500s). **Worst
white anywhere: 4.65** (1024x768, frame 153, t=6.375s). Both clear.

#### The brightest frame is not the frame that binds

The brief asked for the brightest frame. Measuring only that frame would have
shipped a failing page. The loop's brightest frame is 206 (t=8.583s, mean
relative luminance 0.5231) and its darkest is 126 (t=5.250s, 0.0219) — a **24x
swing** inside ten seconds. But the frame that binds the white floor is **153
(t=6.375s), at 17% of the brightest frame's mean luminance** — one of the
darkest frames in the cut. It binds because it is the shot of a man beside a
fire in dark foliage, and the flame lands exactly where the button label sits.
A small bright object over the type beats a bright frame that is bright
somewhere else.

#### Why the scrim is a band and not a flat wash

Tuned against the true worst frame, a **flat** scrim has to be **53.2%**, and
53.2% flat leaves **19.6%** of the loop's mean luminance — which puts the dark
half of a montage that already runs to 0.0219 below what a screen resolves. The
shipping band clears the same floors at **31.1%**: 1.6x the picture for the same
contrast, because it spends density only where the type is.

| treatment | worst yellow | worst white | picture kept |
|---|---|---|---|
| flat 25% (what the still used) | 1.49 ✗ | 1.86 ✗ | 48.6% |
| flat 30% | 1.71 ✗ | 2.13 ✗ | 43.5% |
| flat 53.2% | 3.00 | 4.50 | 19.6% |
| **28% base + band** | **3.82** | **4.65** | **31.1%** |

Shipping values, in `.still-veil`:

```css
background-color: rgb(0 0 0 / .28);                  /* the brief's 25-30% */
background-image: linear-gradient(to bottom,
  rgb(0 0 0 / 0)    9%,
  rgb(0 0 0 / .36) 29%,
  rgb(0 0 0 / .36) 69%,
  rgb(0 0 0 / 0)   89%);                             /* 53.9% combined at centre */
```

**The geometry is the type's, not a guess.** The pull block plus the button
centres on 49% of the section height at every viewport measured — 1920, 1440,
1280, 1024, 768 and 375 — and its half-height never exceeds 20.2% (375 is the
widest case). So the plateau is 49% ±20% and the ramp runs to 49% ±40%, reaching
zero at 9% and 89%: a scrim that has faded to nothing well before the frame
edge, not a bar with a seam.

**A band and not an ellipse** — the opposite call to the hero's, for the opposite
reason. The hero's type sits in one corner, so density belongs in a corner. This
block is centred and nearly full width: its half-*width* runs from 18.7% of the
frame at 1920 to 40.1% at 375, so any ellipse wide enough for the phone is most
of the frame anyway. The half-*height* over the same range is 14.0%-20.2%.
Height is the axis that holds still, so height is the axis the scrim is built on.

**These numbers are tuned to this cut.** Re-run the measurement when the loop is
replaced, or when it is re-exported at 1920. Do not assume they transfer.

#### The old rest-state still is now dead weight

`assets/media/section-still-{900,1440}.{avif,webp,jpg}` (~120KB, committed),
`assets/media/Section2img.png` (the gitignored master) and
`tools/section-still.py` are no longer referenced by anything — the loop poster
replaced them. Left on disk rather than deleted in the same change that
replaced them; delete when you are satisfied the loop is staying.

#### ⚠ 3.1MB more video in git

Same problem as the reel below, and the same fix — both renditions are
committed, only the 4.9MB master is ignored. When the reel moves to a CDN, move
these two with it and repoint `data-loop-720` / `data-loop-540`. No JS change:
the URLs were never in the JS.

### The reel — the one piece of media that is actually finished

Under the pull line, full bleed, 16:9. Fifty-seven seconds of work from the
four founding partners, with a music bed and no speech.

| | |
|---|---|
| Source master | `assets/media/clan_yujo_showreel_23_24 (1080p).mp4` — 33MB, **gitignored** |
| 1080p rendition | `assets/media/reel-1080.mp4` — 16.4MB, 2.17 Mbps video / 128 kbps audio |
| 720p rendition | `assets/media/reel-720.mp4` — 8.3MB, 1.06 Mbps video / 96 kbps audio |
| Poster ladder | `assets/media/reel/reel-poster-{900,1440,1920}.{avif,webp,jpg}` |

**It never autoplays**, at any width, on any connection. `preload="none"` and
the `<video>` ships with no `src` at all — `script.js` assigns one on the first
press, so the only reel byte on the wire before that is the poster (56KB AVIF
at 1440, lazy-loaded, below the fold). It starts muted with an Unmute pill;
that choice then sticks for the visit. Native controls take over once it is
running. Scrolling it out of view pauses it and does not resume it.

720p is served below 1024px, on Save-Data, and on `effectiveType` 2g/3g. The
choice is made in JS at press time rather than with `<source media>`, because
no shipping browser re-evaluates that attribute after load.

Rebuild the renditions:

```bash
ffmpeg -i "assets/media/clan_yujo_showreel_23_24 (1080p).mp4" \
  -c:v libx264 -profile:v high -level 4.0 -preset slow \
  -b:v 2500k -maxrate 3000k -bufsize 5000k -pix_fmt yuv420p -g 48 \
  -c:a aac -b:a 128k -ac 2 -movflags +faststart assets/media/reel-1080.mp4

ffmpeg -i "assets/media/clan_yujo_showreel_23_24 (1080p).mp4" \
  -vf "scale=1280:720:flags=lanczos" \
  -c:v libx264 -profile:v main -level 3.1 -preset slow \
  -b:v 1200k -maxrate 1500k -bufsize 2400k -pix_fmt yuv420p -g 48 \
  -c:a aac -b:a 96k -ac 2 -movflags +faststart assets/media/reel-720.mp4
```

`+faststart` is not optional — it moves `moov` ahead of `mdat` so playback can
begin before the file has finished arriving. Verify with
`ffprobe -show_entries format_tags` or just check the box order.

Rebuild the poster:

```bash
python3 tools/reel-poster.py 42.5          # timestamp is optional, 42.5 is the default
python3 tools/reel-poster.py 31.5 --check  # audition a frame without writing the ladder
```

`--check` exists because most shots in this reel carry their own 2.35:1 mattes,
baked in at the edit. A matted still inside an honest 16:9 box strands the
caption ~100px below the last visible pixel, so the poster has to come from one
of the frames that fills the frame — and it has to be dark enough at dead
centre to carry a white play ring. `--check` reports both.

#### ⚠ 25MB of video is sitting in git

The two renditions are committed; only the 33MB master is ignored. That is a
deliberate placeholder, not a decision — it keeps the page working today at the
cost of a repo that grows by 25MB and can never shrink, because git keeps
history forever.

Before this gets committed more than a couple of times, move both renditions to
Vercel Blob, R2, or any CDN, and point the two data attributes at the new URLs:

```html
<div class="reel" data-reel
     data-src-1080="https://cdn.example/reel-1080.mp4"
     data-src-720="https://cdn.example/reel-720.mp4">
```

That is the whole change — no JS edit, because the URLs were never in the JS.
Then add `assets/media/reel-*.mp4` to `.gitignore` and purge them from history.

Whatever host you pick **must serve HTTP Range requests**, or the native
controls cannot scrub. Vercel, Netlify, Cloudflare and nginx all do; Python's
`http.server` does not, which is worth knowing if you test locally.

### The 500KB problem

The page budget is 500KB and the audience is on mobile data in Nigeria.
Measured on disk, first view:

| | 375 | 1440 |
|---|---|---|
| HTML + CSS + JS | 88 KB | 88 KB |
| Delight woff2 ×3 | 62 KB | 62 KB |
| partner SVGs ×4 | 40 KB | 40 KB |
| hero (AVIF) | 36 KB | 80 KB |
| **total** | **~226 KB** | **~270 KB** |

Posters are not in that table because they are `loading="lazy"` and sit below
the fold — they cost nothing until someone scrolls. Then the reel poster is
29KB at 375 and 56KB at 1440 (AVIF), and the loop poster is 11KB at 375 and
17KB at 1440. The reel itself costs nothing until pressed.

**The background loop is the one thing on this page that breaks the budget, and
it does it on purpose.** It autoplays, so at >=1024 it is 2.08MB on every visit
that scrolls to section 2 — eight times the whole rest of the page. That is a
deliberate, briefed trade with a 2.5MB ceiling, not an oversight, and it is why
the three suppression gates are absolute rather than best-effort: **below 1024,
on Save-Data and on 2g/3g the figure is 0 bytes of video**, which is the case
the Nigerian-mobile-data argument is actually about. Desktop pays; the audience
this budget was written for does not.

If that trade is ever reconsidered, the lever is the bitrate in
`tools/background-loop.py`, not the gates.

That leaves roughly 230–270KB for everything else. Sixteen more images at even
80KB each is 1.3MB — five times what is left.

So these nineteen slots are a shot list, not a shipping list. Pick the four or
five that carry the most weight, compress hard (WebP/AVIF with JPEG fallback,
sized to the actual rendered box, not the source dimensions), and delete the
rest. **Four real assets beat sixteen briefs.**

### Before launch: close the gate

`script.js` has a constant at the top:

```js
var SHOW_MEDIA_PLACEHOLDERS = true;
```

Set it to `false` and every slot still holding a placeholder is removed from
the DOM. Sections that exist only to hold media — the showcase band and the
production strip — are removed entirely when empty. This has been tested at
375 and 1440: the page reads correctly with all nineteen slots absent, no gaps
and no orphaned headings. The reel is exempt — it holds a real asset, so the
gate never touches it.

**Do not ship dashed boxes to a live page.**

### How the slots behave

- Every slot holds its ratio with CSS `aspect-ratio`, so nothing shifts when an
  asset lands. All 18 measure exact. The reel is not a slot but follows the
  same rule: the box is `aspect-ratio: 16/9` and both the poster and the video
  are absolutely positioned inside it, so its height is known before a byte of
  either arrives.
- `<video>` is `muted`, `loop`, `playsinline`, with a required poster.
- **No autoplay below 1024px, and none under `prefers-reduced-motion`** — those
  cases get the poster and a play/pause control instead. `script.js` wires this
  automatically for any `<video>` inside a slot.
- Everything below the fold carries `loading="lazy"` and `decoding="async"`.
- Stills take real alt text. The reel poster takes empty `alt` — it is the
  play button's backdrop, and the caption beneath already names the work.
- Placeholders never use the accent. A page full of yellow dashed boxes would
  burn it — yellow stays reserved for the Apply CTA.

### Production strip — NOT YET SHOT

`production-01` through `production-06` are behind-the-scenes from production
week, **16–21 November**. That is after this page goes live, so those six slots
cannot be filled at launch. Either close the gate on them and add the section
back in November, or ship the section with real frames from a previous shoot.

---

## Files

```
index.html
styles.css
script.js
assets/
  favicon.svg
  tfcs-afric-logo.svg              header + footer mark
  tfcs-afric-logo.png              raster fallback, for the OG image
  fonts/delight-regular.woff2      400
  fonts/delight-bold.woff2         700
  fonts/delight-black.woff2        900   (the headline weight)
  logos/multimudia-studios.svg     partner marks, white fills
  logos/clan-yujo.svg
  logos/colab.svg
  logos/kaykav-academy.svg
  media/hero.png                   1.5MB master — NOT deployed
  media/hero-{900,1440,1688}.{avif,webp,jpg}
  media/reel-1080.mp4              16.4MB — see "25MB of video is sitting in git"
  media/reel-720.mp4               8.3MB
  media/reel/reel-poster-{900,1440,1920}.{avif,webp,jpg}
  media/reel/reel-poster-master.png   frame 42.5, build input — gitignored
  track-film.js                    Track 1 pinned scrollytelling (GSAP + Lenis)
vendor/
  gsap.min.js                      GSAP 3.12.5 core   — self-hosted, not a CDN
  ScrollTrigger.min.js             GSAP ScrollTrigger — the scroll-driven pin
  lenis.min.js                     Lenis 1.1.x        — global smooth scroll
tools/
  hero-derivatives.py              regenerates the hero ladder + stamps index.html
  reel-poster.py                   regenerates the reel poster ladder
```

Fonts are self-hosted rather than called from Google Fonts: the audience is on
mobile data, and self-hosting removes two DNS + TLS round trips before the
first byte of font CSS arrives. Only the three weights the page actually uses
are wired; `fonts/` at the repo root holds the rest of the family, unused.

`vendor/` holds GSAP (core + ScrollTrigger) and Lenis, self-hosted for the same
reason as the fonts — never a CDN. Together they are ~128KB raw / ~49KB
gzipped, which is real weight against the budget, so they are **not** on the
critical path: the loader at the foot of `index.html` fetches them, and
`track-film.js`, only on a wide viewport (>=1024) with motion allowed. On a
phone's data, and under `prefers-reduced-motion`, none of it is requested and
the Film Track is a plain static layout. To upgrade, re-pull the same files
from `registry.npmjs.org` (the CDN hosts are blocked; the registry is not).

## Notes for whoever picks this up

- **Black, white, one yellow.** `--ground #000000`, `--paper #FFFFFF`,
  `--accent #FFEA33` (sampled from the supplied comp), `--on-accent #000000`.
  A supporting grey ladder (`--body --mute --rule --surface --sunk`) is derived
  against pure black and documented inline in `styles.css`.
- **Yellow appears in exactly one place: the Apply CTA** — the header pill and
  the submit button. It is referenced once in the whole stylesheet
  (`.btn-apply`). If it shows up in a second place it stops meaning anything.
  The PREMIERE block in the timeline is `--paper` like the other whole-school
  blocks; it no longer carries an accent.
- **Never white on yellow.** `#FFFFFF` on `#FFEA33` is **1.23:1** — effectively
  invisible. Black on it is 17.07:1. The focus ring stays white and carries a
  black halo so it survives landing on the yellow pill or on the hero image.
- **Type is Delight** (400 / 700 / 900), self-hosted. `fsType=0`, i.e. the font
  files carry no technical embedding restriction — **but that is not the EULA.
  Confirm the webfont licence separately before this goes public.**
- **Anchor links re-aim after fonts load.** Loading `#faq` scrolls using
  fallback metrics, then the real fonts swap in and sections shift. `script.js`
  re-scrolls on `document.fonts.ready`.
- **The header is transparent everywhere, always** — see "THE HEADER" above.
  It changes size on scroll, never colour. Legibility over light content is the
  mark's own drop-shadow, not a bar and not a scrim.
- Copy comes from `content.md`. The subhead is sentence case in the source —
  there is no `text-transform` on it.
- **Horizontal-overflow guard.** The document-width invariant and its fix
  (`contain: paint` on the horizontal scrollers) are documented in full under
  "REGRESSION GUARD" above — read `documentElement.scrollWidth`, never
  `body.scrollWidth`. The curriculum marquee that first exposed it, and the
  Foundation block above it, have been removed; the guard now covers the three
  scrollers that remain (timeline, production, showcase).
- **Film Track scrollytelling (Track 1).** `track-film.js` pins the Film
  section and scrubs a GSAP timeline over a Lenis-smoothed scroll. Two things
  to know before adding more of these: (1) **Lenis is global** — once it loads
  (>=1024, motion allowed) it smooths the *whole* page's scroll, and it drives
  `ScrollTrigger.update` off one shared `gsap.ticker` loop. A second smooth-
  scroll library, or a ScrollTrigger that reads scroll independently, will
  fight it. Reuse the single Lenis instance. (2) The reveal tweens are
  `fromTo`, never `.from()` — a scrubbed timeline of chained `.from()` tweens
  captures the wrong end value and the piece stays hidden at progress 1. (3)
  It is gated at load: below 1024 and under reduced motion the libraries are
  never fetched and the section is the static CSS layout, so nothing here may
  become load-bearing for the content. When Tracks 2 and 3 get the same
  treatment, extend this file rather than starting a second Lenis.
