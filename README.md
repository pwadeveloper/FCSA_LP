# TFCS.AFRIC — The Film & Content School Africa

Static single-page site. No framework, no build step, no dependencies.
Deploy by dragging this folder to Netlify, Vercel or GitHub Pages.

Local preview: `python3 -m http.server 8000`

---

## 🔴 LAUNCH BLOCKERS

### 0a. Mezzotint CF ampersand — BLOCKED ON LICENCE

The `&` in the hero headline is specified as Mezzotint CF. **It has not been
implemented, and nothing was extracted.**

Mezzotint CF is present on the build machine only as an **Adobe Fonts /
Creative Cloud activated font** (`~/Library/Application Support/Adobe/CoreSync/
plugins/livetype/`), by The Type Founders. That licence covers desktop use in
design apps and Adobe's own web CDN. It does **not** permit pulling the `.otf`
out and self-hosting a subset, which is what the spec asks for. Extracting it
would have been a licence violation, so the `&` currently renders in Delight.

To unblock, either buy a webfont licence for Mezzotint CF from The Type
Founders, or use an Adobe Fonts web project (a CDN `<link>`, not self-hosted —
which trades the self-hosting requirement for a third-party request).

Once a licensed file exists: subset it to `U+0026` only (2–4KB), save as
`assets/fonts/mezzotint-amp.woff2`, and uncomment the block at the top of
`styles.css`. The `@font-face`, the `unicode-range`, `font-display: block` and
starting optical values are all written out there. **Tune the size and baseline
by eye against the comp** — a serif ampersand in a heavy sans line reads small
and floats high at its natural size.

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

Eighteen slots. Seventeen render on the page as labelled placeholders;
`og-image` is the social card and is built, not photographed. **Every slot
needs original or licensed material.** The hero reference comp must not ship —
it is a publicity still of a recognisable actor.

Drop assets in at the exact paths below and they appear with no code change.
Every `LOOP` needs a `.mp4` **and** a `.jpg` poster at the same name.

| Slot | Section | Path | Ratio | Dimensions | Type | What it is | Status |
|---|---|---|---|---|---|---|---|
| `pullquote-loop` | Pull line | `assets/media/pullquote-loop.mp4` | 21:9 | 1920×823 | LOOP | Ambient, near-abstract. A light being flagged, a lens turning, dust in a beam. No faces. 6–8s, silent. |  |
| `track-film` | Track 1 | `assets/media/track-film.jpg` | 2.39:1 | 1920×803 | STILL | A frame from a finished short. |  |
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

That leaves roughly 230–270KB for everything else. Sixteen more images at even
80KB each is 1.3MB — five times what is left.

So these twenty slots are a shot list, not a shipping list. Pick the four or
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
375 and 1440: the page reads correctly with all twenty slots absent, no gaps
and no orphaned headings.

**Do not ship dashed boxes to a live page.**

### How the slots behave

- Every slot holds its ratio with CSS `aspect-ratio`, so nothing shifts when an
  asset lands. Verified: 18 of 19 measure exact. The exception is
  `pullquote-loop`, which is a cover backdrop by design — 21:9 is the shooting
  spec, the display crops to the band, and layout shift is zero because the
  media is absolutely positioned.
- `<video>` is `muted`, `loop`, `playsinline`, with a required poster.
- **No autoplay below 1024px, and none under `prefers-reduced-motion`** — those
  cases get the poster and a play/pause control instead. `script.js` wires this
  automatically for any `<video>` inside a slot.
- Everything below the fold carries `loading="lazy"` and `decoding="async"`.
- Stills take real alt text. The ambient pullquote loop takes empty `alt`.
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
```

Fonts are self-hosted rather than called from Google Fonts: the audience is on
mobile data, and self-hosting removes two DNS + TLS round trips before the
first byte of font CSS arrives. Only the three weights the page actually uses
are wired; `fonts/` at the repo root holds the rest of the family, unused.

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
- **Horizontal-overflow guard.** The global floor is
  `html, body { max-width: 100%; overflow-x: clip; }` in `styles.css` — keep it.
  The confirmed offender was the curriculum marquee: its `.chev` chevron rows
  were `width: max-content` and contained only by `.marq-row { overflow: clip }`,
  which iOS Safari honours unreliably — so the row widened the document and
  carried the fixed Apply pill off-screen. That whole band (marquee + the
  Foundation panel above it) has been **removed**; the tracks intro now runs
  straight into the panels. With it gone, the offender sweep at 390px reports
  `body.scrollWidth === clientWidth` and every element that still extends past
  the viewport is contained by an `overflow: auto`/`hidden` scroll band (the
  showcase, the timeline, the production strip) — never by `overflow: clip`.
  The remaining suspects are the intrinsic-width placeholder boxes inside those
  bands; they scroll within their own band and do not carry the document. Never
  reintroduce a `max-content` element guarded by `overflow: clip` alone.
