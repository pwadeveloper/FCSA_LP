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

### 1. ~~Cost~~ — RESOLVED, and the layout was chosen from a prototype

NGN 200,000, in its own section (`#pricing`) between the timeline and the
pay section. One fee, all three tracks, no per-track upsells.

**Pricing section layout — decided from `/proto/pricing`**

- **Direction: Ledger.** A hairline-bordered card split by one rule: fee cell
  left, inclusions right. Kept because the fee and what it buys read side by
  side, and the card stays a discrete object rather than a page-wide gesture.
- Currency and figure are separate spans — `NGN` sits back as a muted label so
  the figure can run to 104px at 1512. Set at one size, three letters nobody is
  deciding on carried the same weight as the one number that matters.
- The CTA hugs its label from 768 up (`width: auto` + `align-self: flex-start`),
  full-width below. `btn-block` had stretched it to 542px, which reads as a
  yellow strip rather than a control and spent the accent at a scale nothing
  else on the page uses.
- Panel is two anchored groups — fee at the top, CTA and small print at the
  foot — so the slack against the eight-row list becomes space between them
  rather than a hole in the middle. The label stays top-aligned with "What the
  fee unlocks" across the divider; that alignment ties the card's halves.
- **Rejected — Marquee** (no card, figure at 13rem across the rail): the most
  striking, but it eats the most vertical space and commits hardest. If the fee
  ever needs softening it is the worst layout to soften, and the inclusions lose
  the "unlocks" framing to a plain grid.
- **Rejected — Receipt** (single narrow column, items with no price against
  them, one total at the foot): makes "no add-ons" a visual argument rather than
  a claim, but "INCLUDED" eight times reads repetitive up close and the column
  leaves two-thirds of a wide viewport empty.

### 2. Everything else missing

| Item | Where it needs to go |
|---|---|
| Venue address in Kaduna | New FAQ entry |
| Application deadline | New FAQ entry, and in the closing section |
| Certificate — yes or no | New FAQ entry |
| Reply time, in days | Under the submit button |
| Contact — phone, WhatsApp, email | Footer |
| Socials — school, Clan Yujo, Multimudia | Footer |
| Tutor roster | Section was cut. Needs photos, credits and each person's sign-off before it earns a place back. |

### 3. There is no application form

`FORM_ENDPOINT` and the apply-form handler are gone. Applying and paying were
two forms on one page asking the same four questions, and the payment one is
the one that does something — so `#apply` is now the closing section (the
headline, the still, and "See you in class.") and `pay.js` owns the only form
on the page. The header CTA and "Claim your seat" point at `#pay`.

If applications ever need to be collected separately from payment, the Tally
account already has `tools/tally-form.mjs` — a second form there is a smaller
job than reinstating a hand-rolled one.

### 4. ~~Open Graph image~~ — RESOLVED

**No longer a blocker.** `assets/og-image.jpg` is live, and the `<head>` block
is uncommented and pointed at `https://filmschool.africa/`. (The description
here previously specified a `#2E1E1C` ground and Carrot `#F3681A` — colours
from an earlier palette that this site does not use. It is black, white and
one yellow.)

The card is a **screenshot of the real hero**, taken by `tools/og-image.mjs`,
not a graphic drawn alongside it — so it cannot drift from the page. Change the
headline or the mark, re-run the tool, and the card is right again. Two things
it does on purpose: it pins the hero carousel to frame 1, because whichever
frame happens to be up is otherwise a coin toss and a face survives the ~500px
a timeline preview actually renders where a landscape turns to mush; and it
hides the partner strip, which the 630px cut slices through the middle of.

JPEG at 103KB rather than PNG at 722KB for the same pixels — every scraper
re-encodes it anyway. This link is shared on WhatsApp far more than it is found
in search, so the preview card matters more than the SEO.

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

**EVERY SLOT ON THE PAGE NOW HOLDS REAL MEDIA.** There is not one dashed
placeholder left in `index.html` — the eight Showcase clips and the closing
still were the last of them, and the production strip (six behind-the-scenes
slots that could not be shot before launch) was removed from the markup rather
than shipped empty. `og-image` is a capture of the live hero, not a drawn card;
the reel is shot, cut and delivered and has its own section. **Every slot needs
original or licensed material.**

The consequence for `SHOW_MEDIA_PLACEHOLDERS` is under "Before launch: close
the gate" below.

The three **track sections** carry their own media inline (not dashed slots),
currently repo placeholders to be swapped — the shape each one needs:

| Track media | Section | How many | Ratio | What it is |
|---|---|---|---|---|
| portrait | Film | 1 | ~4:5, full-bleed behind the section | A student, rim-lit, looking to camera. Head-and-shoulders; edges fall to near-black so the title/body stay legible over them. |
| clips | Film | 3 | 16:9 (first ~3:4) | Foot-row clips: a frame from a finished short and two supporting shots. |
| grid | Content | 6 | 9:16 | Phone-shot content as it appears in feed — 3×2 grid on the right. |
| frame | Finisher | 1 | 16:9 | A single wide frame — an NLE timeline mid-cut, a grade, or a finished shot. |

| Slot | Section | Path | Ratio | Dimensions | Type | What it is | Status |
|---|---|---|---|---|---|---|---|
| `showcase-01` | Showcase | `assets/media/showcase/showcase-01-*` | 16:9 | 1280 / 640 | LOOP | Short film — a harvested field, then figures in fog. | DONE |
| `showcase-02` | Showcase | `assets/media/showcase/showcase-02-*` | 9:16 | 720 / 360 | LOOP | Street piece to camera, Lagos market. | DONE |
| `showcase-03` | Showcase | `assets/media/showcase/showcase-03-*` | 4:3 | 1280 / 640 | LOOP | Documentary montage. | DONE |
| `showcase-04` | Showcase | `assets/media/showcase/showcase-04-*` | 4:3 | 1280 / 640 | LOOP | Fashion portrait, bamboo grove. | DONE |
| `showcase-05` | Showcase | `assets/media/showcase/showcase-05-*` | 9:16 | 720 / 360 | LOOP | Subtitled podcast interview. | DONE |
| `showcase-06` | Showcase | `assets/media/showcase/showcase-06-*` | 4:3 | 1280 / 640 | LOOP | Health documentary, clinic. | DONE |
| `showcase-07` | Showcase | `assets/media/showcase/showcase-07-*` | 16:9 | 1280 / 640 | LOOP | UNICEF field film. | DONE |
| `showcase-08` | Showcase | `assets/media/showcase/showcase-08-*` | 16:9 | 1280 / 640 | LOOP | Durbar festival documentary. | DONE |
| `apply-still` | Apply | `assets/media/apply/apply-still-*` | 4:3 | 1920×1440 | STILL | A television studio floor, cameras parked. | DONE |
| `og-image` | Social | `assets/og-image.jpg` | 1.91:1 | 1200×630 | DONE | A capture of the live hero — `node tools/og-image.mjs`. |  |

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

### The showcase band — eight clips, and the ratio trap

`python3 tools/showcase-clips.py` rebuilds all of it from the eight HEVC
masters. Same three reasons as the Content Track clips (HEVC is Safari-only,
the audio is dead weight under muted autoplay, the bitrate is sized for a
cinema) with one difference: **24fps is kept.** These are cut from finished
film work and 24 is the rate they were graded at. Resampling a 24fps camera
move to 30 duplicates every fifth frame, and the judder shows on exactly the
slow moves these clips are made of. The Content clips are phone-shot verticals
where 30 is native and 24 reads as a stumble. Different source, different
answer.

**THE RATIO TRAP, and it is the thing to be careful of here.** `.slot-box`
takes its aspect from `--ar` on the `<li>` and `object-fit: cover` on the
video. A wrong `--ar` does not letterbox — it **crops, silently**. The
placeholders shipped with guessed ratios (16/10, 5/8, 4/5, 2/3, 1/1, 2/1) and
the delivered clips are 16:9, 9:16 and 4:3, so taking the markup at its word
would have thrown away up to 72% of a frame with nothing on screen to say so.
Every `--ar` is now the measured ratio of its clip.

**THE SPANS MOVED WITH THEM.** A tile's height is its span times its ratio, so
the comp's `(5,3,4) (4,3,5) (6,6)` was only balanced against the ratios the
placeholders carried. Against the real ones it measured 305 / 561 / 322 in row
one at 1440 — a 256px hole, not a stagger. The portraits dropped to span 2 and
the landscapes took the column back: `(6,2,4) (5,2,5) (6,6)`, which measures
~50px of stagger and holds at every width from 1024 up. The arithmetic is in
the `.showcase` block in `styles.css`. **Swap a clip and you must re-measure**
— a new ratio in an unchanged span re-opens the hole.

**Budget.** 5.7MB across the eight at the 1280 rung, 1.9MB at 640, 277KB of
posters. Nobody pays all of it: no `src` and no `poster` is assigned until a
tile is within 300px of the viewport, playback pauses on the way out, and below
1024 no video byte is fetched at all until a play button is pressed.

**Two things in the footage, not in the code.** Showcase 1 opens with ~1s of
2.35:1 letterbox that then opens to full 16:9 — that is the edit, and it is why
`cropdetect` on the first frames reports no bars. Showcase 3 contains a shot
that is itself letterboxed inside its 4:3 frame. Neither is croppable without
wrecking the other shots in the same montage.

**STILL OPEN: the credits.** The comp has a credit line under each tile and
`.showcase .slot-cap` is still in the stylesheet waiting for it, but nobody has
supplied who made what. The tiles ship without captions — eight repetitions of
"Partner Name And Project" on a live page is worse than none, and a guessed
credit on somebody's film is worse than both. Adding them is one
`<figcaption class="slot-cap">` per tile. Two of the clips carry visible
attribution in the footage itself (a `@soshaibutv` watermark on 2, a UNICEF bug
on 7), which is a starting point and not a clearance.

### The closing still

`python3 tools/apply-still.py`. The master is 1920x1440 — 4:3, not the 3:2 the
placeholder briefed — and the slot moved to match rather than cropping 120px
off the frame, because what those 120px hold is the top of the lighting grid
and the bottom of the studio floor, which is most of what makes the shot read
as a studio. The ladder stops at 1920 because the master does; the block sits
in `.wrap-narrow` (820px), so 1440 already covers it at 1.76x.

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

**As of the showcase landing, flipping this is a no-op** — every slot in
`index.html` holds a real `<img>` or `<video>`, so there is nothing left for
the gate to strip. It is still worth closing, as a guard against the next
placeholder rather than as a fix for a current one. It is left `true` because
turning it off changes nothing you can see today and someone should make that
call deliberately.

### How the slots behave

- Every slot holds its ratio with CSS `aspect-ratio`, so nothing shifts when an
  asset lands. All 18 measure exact. The reel is not a slot but follows the
  same rule: the box is `aspect-ratio: 16/9` and both the poster and the video
  are absolutely positioned inside it, so its height is known before a byte of
  either arrives.
- `<video>` is `muted`, `loop`, `playsinline`, and carries **no `src` and no
  `poster` attribute in the markup**. `script.js` assigns both, and only once
  the tile is within 300px of the viewport. There is no `loading="lazy"` for a
  poster — the attribute is fetched the moment the element is parsed — so
  withholding the attribute is the only way to defer it, and eight showcase
  tiles is 277KB of posters in a band a lot of visitors never reach.
- **Playback is gated on visibility**, not just on load. Eight autoplaying
  clips in one band is eight simultaneous decodes; each one starts when its
  tile comes into view and pauses when it leaves.
- **No autoplay below 1024px, none under `prefers-reduced-motion`, and none on
  Save-Data or 2g** — those cases get the poster and a play/pause control
  instead, and not one byte of video is fetched until it is pressed. A press
  overrides Save-Data: it is a standing request not to spend bytes unasked, not
  a refusal to ever play anything.
- 3g is deliberately NOT suppressed, for the reason spelled out under the reel:
  Chrome buckets any link over 270ms RTT as 3g regardless of the technology.
  3g gets the small rung, not nothing.
- A `<video>` takes no `alt`, so each one carries an **`aria-label`** describing
  the clip. `script.js` reuses it for the play button, because eight buttons all
  reading "Play this clip" is a control nobody can choose between.
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
  favicon.svg                      the roundel alone, cut from the logo below
  tfcs-afric-logo.svg              header + footer mark, 316x137
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
  media/finisher/fin-0N-*-{640,960,1280}.{avif,webp,jpg}   the Finisher's cycling frames
  media/finisher track/            the seven masters, build inputs — gitignored
  media/showcase/showcase-0N-{640,1280}.mp4       the eight Showcase clips
  media/showcase/showcase-0N-poster.jpg           one poster each, assigned lazily
  media/Showcase N.mp4             the eight masters, build inputs — gitignored
  media/apply/apply-still-{900,1440,1920}.{avif,webp,jpg}   the closing still
  media/See you in class.jpg       its 1920x1440 master, build input — gitignored
  tracks.js                        the three track sections reveal on enter (~1KB, no deps)
  finisher-track.js                the Finisher's 500ms frame cycle, paused on hover
  content-track.js                 the Content Track's three clips; gates the
                                   fetch, not just playback. PLAYS ON PHONES —
                                   see "the one video that ignores the 1024
                                   rule" below
  pay.js                           Paystack checkout — trusted with nothing
api/
  _paystack.js                     shared helpers (underscore = not a route)
  paystack/config.js               public key + the figures, so the page and
                                   the charge read one variable
  paystack/init.js                 starts a transaction; owns the amount
  paystack/verify.js               the only thing that may say "paid"
  paystack/webhook.js              signed events. Optional — no database now.
tools/
  hero-derivatives.py              regenerates the hero ladder + stamps index.html
  reel-poster.py                   regenerates the reel poster ladder
  finisher-track.py                regenerates the seven Finisher frames
  dev-api.mjs                      local server that actually runs api/
  paystack-selftest.mjs            36 assertions, no keys needed
  tally-form.mjs                   creates/updates the receipt form
  content-clips.py                 transcodes the three Content Track clips
  showcase-clips.py                transcodes the eight Showcase clips + posters
  apply-still.py                   regenerates the closing still's ladder
  og-image.mjs                     regenerates the social card from the hero
.env.example                       template. .env.local is gitignored.
package.json                       exists so Vercel builds api/; no dependencies
vercel.json                        no-store on /api/*
```

## Payments

**Tuition is ₦200,000.** Two routes, and they are deliberately not the same
mechanism:

| | |
|---|---|
| **Pay in full** — ₦200,000 | Paystack card checkout, `api/paystack/*` |
| **Pay in two** — ₦140,000 now, ₦60,000 on resumption | bank transfer, then a Tally form carrying the receipt |

The instalment route is **not** a card payment, and that is the whole reason
this stayed simple. Charging 70% now and 30% months later means knowing, across
that gap, who has paid what — which needs a database, a balance lookup, and
reminder mail. A transfer plus a receipt on a Tally form puts that record where
a human already looks, at the cost of reconciling by hand. For one cohort that
is the better trade.

The deposit and balance are **derived from the total** — `DEPOSIT_PERCENT = 70`
in `api/_paystack.js` gives the deposit, and the balance is the subtraction,
never the other percentage. **Nothing charges either of them**: instalments are
a bank transfer, so the only amount Paystack's API is ever sent is the full
tuition. They exist to produce the figures printed on the page, and a page
whose two instalments do not add up to its own total is the kind of thing a
student notices. The self-test checks `deposit + balance === total` on figures
that do not divide cleanly.

### The card route

```
pay.js                     the browser side. Trusted with nothing.
api/_paystack.js           config, the 70/30 arithmetic, HMAC
api/paystack/config.js     GET  -> public key and the figures
api/paystack/init.js       POST -> starts a transaction, returns access_code
api/paystack/verify.js     GET  -> asks Paystack what really happened
api/paystack/webhook.js    POST -> signed events. Optional; see below.
```

```
browser --POST /api/paystack/init--> server --sk_ key--> Paystack
        <---------- access_code -------------------------+
  |
  +-- PaystackPop().resumeTransaction(access_code) -> Paystack's own modal
                                                      (card never touches
                                                       this origin)
        onSuccess(reference)
  |
  +--GET /api/paystack/verify?reference=..--> server --sk_ key--> Paystack
        <-- {paid:true} only if status AND amount AND currency all match
```

**1. The browser never says what things cost.** `api/paystack/init.js` reads
the amount from the server's environment and ignores any `amount` in the
request body. This is the whole ballgame: send the price from the client and
someone opens devtools, changes 20000000 to 100, and buys a term of film school
for one naira — Paystack charges exactly what it is told. The self-test fires
that exact request at the real handler and asserts the server price wins.

**2. The browser never says a payment happened.** Paystack's `onSuccess` runs
on the payer's machine and can be called by hand from a console. It is treated
only as a hint to go and ask `/api/paystack/verify`, which asks Paystack with
the secret key, checking status *and* amount *and* currency.

**The webhook is optional now.** With no database, the Paystack dashboard is
the record and this endpoint writes nothing the dashboard does not hold. What
it adds is a log line at the moment money moves — including for payers whose
browser died before it could call verify, the case the dashboard makes you go
looking for. Leave the URL unset in the dashboard and nothing breaks. If you
set it, it still verifies the `x-paystack-signature` HMAC first: the URL is
public, and a forged "payment" in your log is a forged payment in your
reconciliation.

### The transfer route

Two constants at the top of `pay.js` — the "fill this in and it switches on"
idiom `script.js` used to carry as `FORM_ENDPOINT`, before that form was
removed. Both are set:

```js
var BANK = { bank: 'Guaranty Trust Bank',
             account: 'KayKav Creative Studio LTD',
             number: '3004903455', note: '…' };
var TALLY_URL = 'https://tally.so/r/kdPAX6';
```

**Left null, the instalment option is hidden entirely** and the page offers
pay-in-full only. That is deliberate: the alternative is publishing a
placeholder account number, and money sent to a wrong account number is money
gone. Both halves must be present — a bank with no form leaves the receipt
nowhere to go, a form with no bank leaves the money nowhere to go.

They are not in `.env.local` because they are not secrets. They are printed on
the page for anyone to read, like the details on an invoice.

**`BANK.note` exists because the account name is not the school's name.**
Someone about to transfer ₦140,000 sees "KayKav Creative Studio LTD" where
they expected "The Film & Content School Africa", and the correct instinct on
seeing that is to stop and check they are not being phished. The note answers
it before the doubt lands. Do not remove it without replacing it.

### The Tally form

Created by `node tools/tally-form.mjs --create`, which is re-runnable and
documents why each question exists. It asks for name, email, phone, track,
**which** payment (a ₦140,000 credit is a deposit and a ₦60,000 credit is a
balance, but a bank statement only shows a number and a date), the receipt
itself, and a free-text note — that last one because transfers routinely
arrive from a sibling's or a parent's account, and then the name on the
statement matches nobody on the list.

Tally's own docs only publish the `FORM_TITLE` block shape. The rest of the
structure came off the OpenAPI schema at
`developers.tally.so/api-reference/openapi.json` and off a real form on the
account, which is how the pairing became clear: a question is a `TITLE` block
with `groupType: QUESTION` followed by its input block, and choice options all
share one `groupUuid` carrying `index` / `isFirst` / `isLast`.

**Email notifications are ON**, going to the Tally account owner
(`sirmudiadavid@gmail.com`). Turn them on for a form without recreating it:

```bash
node tools/tally-form.mjs --notify kdPAX6 someone@example.com
```

One caveat, measured rather than assumed: Tally accepts `selfEmailTo`, answers
200, and then stores `null` — tried as `{html:'a@b.com'}`, as `'<p>a@b.com</p>'`,
and with a `mentions` array. Its schema marks the field nullable, and null means
the default, which is the account owner. So the API reliably switches
notifications **on**, and reliably sends them to whoever owns the key; it does
not reliably redirect them elsewhere. To move them to a `filmschool.africa`
address, set it in the Tally UI or forward from the owner's inbox.

### Keys

| | |
|---|---|
| `pk_…` public | safe in the browser, can only start a payment |
| `sk_…` secret | **never** in the browser, in git, or in a screenshot |

A leaked `sk_live_` key lets someone charge cards, refund, and export your
customer list. If one leaks, roll it in the dashboard at once.

There is **no test/live switch** — it is whichever keys the environment holds:
test values on Vercel Preview/Development, live values on Production. Until the
secret key starts with `sk_live_`, the pay section shows a "Test mode" note.

`.env.local` is gitignored; `.env.example` is the committed template and
carries no values. `.gitignore` covers `.env`, `.env.local`, `.env.*.local`.

| variable | | |
|---|---|---|
| `PAYSTACK_PUBLIC_KEY` | public | required |
| `PAYSTACK_SECRET_KEY` | **server only** | required |

**Two variables, and that is the whole list.** The price is not among them —
see below.

### Why the price is a constant, not an env var

`TUITION_KOBO`, `DEPOSIT_PERCENT` and `CURRENCY` live at the top of
`api/_paystack.js`. They were env vars while the price was genuinely unknown
and `content.md` still said `[TO CONFIRM]`; an unset variable was the honest
way to say "no price yet". That reason expired the moment the figure was
decided.

Environment variables are for secrets, and for values that differ between
environments. The tuition is neither: it is public, it is printed on the page,
and it is the same number in preview and production. Keeping it in env made it
a **fourth** source of truth — alongside the pricing section, the FAQ and
`content.md` — able to disagree with all three without anything noticing.

`PAYSTACK_DEPOSIT_PERCENT` was the sharpest case. Since instalments moved to
bank transfer, **Paystack never sees that number** — the only amount its API is
ever sent is the full tuition (`init.js`). It exists purely to derive the
₦140,000 and ₦60,000 the page prints, so the `PAYSTACK_` prefix was claiming an
owner that had nothing to do with it.

The three printed copies still have to be edited by hand, because the FAQ is
static HTML with no build step and having JS rewrite it would leave the figure
missing for anyone without JS and for every crawler. So `npm run test:paystack`
**fails** until they agree with the constant — verified by changing the price
in the code alone, which turns seven assertions red.

### Running it locally

`tools/serve.py` is a static file server, so on its own `/api/paystack/config`
404s and the pay section correctly reports itself unavailable. To run the
functions too:

```bash
python3 tools/serve.py 8123          # terminal 1 — the page
node tools/dev-api.mjs 3000          # terminal 2 — the api
open http://localhost:3000/#pay
```

`dev-api.mjs` owns `/api/*` and proxies everything else to `serve.py` (it
proxies rather than serving files itself because `serve.py` answers Range
requests and the stock library server does not). The handlers are imported
unchanged — Edge-runtime modules are standard `Request`/`Response` and Web
Crypto, all of which Node has had since 18, so what runs locally is the same
code Vercel runs. An env var overrides `.env.local` for a single run.

```bash
npm run test:paystack       # 36 assertions, no keys and no network needed
```

Covers the webhook HMAC against an independently computed signature, the 70/30
arithmetic, the amount guard, and the price-drift check described above.

**A real transaction has now been run** against Paystack's test environment,
which the self-test cannot cover:

| | |
|---|---|
| `init` | returned a genuine `access_code`; the inline modal opened on the page |
| `verify` before paying | `paid:false`, `"abandoned"` — no false positive |
| ₦200,000 test card charge | `verify` → **`paid:true`** |
| ₦140,000 charge (successful, but short) | `verify` → **`paid:false`**, *"Paid 14000000 kobo, expected 20000000"* |

That last row is the one that matters: Paystack reports the charge as
`success`, and the site still refuses to treat it as tuition. A successful
payment for the wrong amount does not buy a seat.

Paystack's hosted checkout sits behind Cloudflare and cannot be driven by a
headless browser, so the card itself was charged through Paystack's
`/charge` API with their test card. The modal opening was verified separately
on the page.

### Deploying

1. Push. Import the repo at vercel.com; `api/` is detected automatically and
   `package.json` exists so the functions build. The page itself is static.
2. Set `PAYSTACK_PUBLIC_KEY` and `PAYSTACK_SECRET_KEY` in Project Settings ->
   Environment Variables — test values for Preview/Development, live values for
   Production. Nothing else needs setting; the price ships in the code.
   **Environment variables only take effect on the next deploy.**
3. Optionally point the webhook at `https://YOUR-DOMAIN/api/paystack/webhook`.
4. Run a real test transaction with a
   [test card](https://paystack.com/docs/payments/test-payments) before going
   live.

### Still to do

- **Move the Tally notifications to a `filmschool.africa` address** when you
  want them off the personal Gmail — Tally UI, not the API (see the caveat
  above).
- **Switch to the live Paystack keys when you go live.** `.env.local` runs the
  TEST pair; the live pair is parked, commented out, in the same file. On
  Vercel, set the live values as Production environment variables rather than
  moving them through any file. The "Test mode" note on the pay section
  disappears on its own once the secret key starts `sk_live_`.
- **Instalments reconcile by hand.** Nothing tracks who has paid ₦140,000 and
  still owes ₦60,000; that lives in Tally submissions and your bank statement.
  This is the accepted cost of not running a database, and it is fine at one
  cohort's scale — it will not be at ten.
- **Nobody chases the balance automatically.** The page states the deadline;
  no reminder is sent.
- **Refunds and failed charges are not modelled.** Only `charge.success` is
  logged.
- **Applications are not collected anywhere.** The apply form was removed; the
  only way onto the list is paying. If that is wrong, a second Tally form is
  the quickest fix.

Fonts are self-hosted rather than called from Google Fonts: the audience is on
mobile data, and self-hosting removes two DNS + TLS round trips before the
first byte of font CSS arrives. Only the three weights the page actually uses
are wired; `fonts/` at the repo root holds the rest of the family, unused.

### The one video that ignores the 1024 rule

Every other video on this page is suppressed below 1024px and under
`prefers-reduced-motion` — "this audience is on mobile data", as the note in
`script.js` puts it. **The three Content Track clips are the exception**, and
the exception is deliberate.

That rule guards a full-screen ambient backdrop that is 1MB+ and carries no
information. Applying the same threshold to these was a category error. They
are 150KB each at the 360 rung — 430KB for all three, less than one hero frame
— and unlike a backdrop they *are* the section: the Content Track's whole claim
is "work made for a phone screen", argued with three phone-shaped clips. On a
phone that showed three still posters, which does not read as a considered
fallback. It reads as broken, and it was reported as exactly that.

What survives is the half of the policy that was about the person rather than
the screen: **Save-Data, 2g/3g and reduced-motion still fetch nothing**, and the
posters stand in. A narrow window is not a request; a Save-Data header is.

The rung follows the measurement — the card is 110px wide at 390 and 314px at
1920, so phones get the 360 and desktops the 640. It is chosen once, at first
play, and never re-chosen on resize: swapping `src` mid-playback restarts the
clip, and a video that jumps to frame one because someone dragged a window edge
is worse than a slightly wrong rung.

There is **one third-party script, and only one**: Paystack's
`js.paystack.co/v2/inline.js`, loaded deferred on the pay section. It is the
exception because card fields cannot be hand-rolled — letting a card number
touch this origin would pull the whole site into PCI scope. The modal is
Paystack's, served from Paystack, and the PAN never reaches this page.

Otherwise there are **no third-party JS libraries.** An earlier build drove the track
sections with GSAP ScrollTrigger over a Lenis smooth-scroll (pinned
scrollytelling); it felt slow and heavy, so it was removed. The sections now
reveal on enter with a ~1KB IntersectionObserver (`tracks.js`) over native
scroll — faster, ~128KB lighter, and it degrades to fully visible with no JS.

## Notes for whoever picks this up

- **Black, white, one yellow** — plus, since the 2026-08-31 mark, a sand
  `#D6C8A5` that lives only inside the logo artwork and is not tokenised.
  `--ground #000000`, `--paper #FFFFFF`,
  `--accent #FFEA33` (sampled from the supplied comp), `--on-accent #000000`.
  A supporting grey ladder (`--body --mute --rule --surface --sunk`) is derived
  against pure black and documented inline in `styles.css`.
- **Yellow is referenced once in the stylesheet: the Apply CTA** — the header
  pill and the submit button (`.btn-apply`). If it shows up in a second styled
  place it stops meaning anything. The PREMIERE block in the timeline is
  `--paper` like the other whole-school blocks; it no longer carries an accent.
- **UNRESOLVED — the mark now carries yellow too.** The logo installed on
  2026-08-31 puts `#FFEA33` in its sun and is otherwise `#D6C8A5`, a sand that
  is not in the palette above. So on the page the accent is no longer unique to
  the CTA: at the header the mark's sun and the Apply pill are the same yellow,
  16px apart on a 390px phone. That is a straight conflict with the rule
  directly above, and it is a brand decision, not a bug — resolve it one way or
  the other rather than letting the two notes sit here contradicting each other.
  Either the mark's sun changes, or this rule becomes "yellow is the mark and
  the CTA" and the CTA gets its distinction from shape instead of colour.
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
- **The three track sections.** Each track (`#track-film`, `#track-content`,
  `#track-finisher`) is its own full-bleed, full-viewport section: title
  top-left in a LIGHT weight (`.trk-h`, 400 — not the headline black), schedule
  top-right, the three copy blocks down the left, and the section's media on
  the right (or, for Film, a full-frame portrait behind everything with a clip
  row along the foot). Content carries a 3×2 grid of 9:16 frames sized by a
  fixed viewport height so two rows always fit; Finisher a single 428/225 frame.
  The reveal is CSS-only: pieces carry `.trk-anim` with a per-element `--i`
  index, and `tracks.js` just adds `.in` to the section when it scrolls in — no
  pin, no smooth-scroll library, native scroll. Film and Finisher now carry
  real media; Content's grid is still placeholders pulled from the repo, to be
  swapped.
- **The Finisher's frame holds seven stills, cycling at a 500ms dwell** — the
  six DaVinci Resolve pages in the app's own order (Photo, Cut, Edit, Fusion,
  Color, Fairlight) and then the suite they are run from. `finisher-track.js`.
  It **pauses while the pointer is over it**: half a second is a flick-through,
  and the moment anyone wants to actually look at a page the pointer is already
  there. It also **waits for all seven to decode before the first advance** —
  at 500ms there is no time to fetch a frame between beats, so a frame that has
  not arrived stutters on the one pass everybody sees; a 5s cap starts it
  anyway rather than sitting on frame one forever. Same in-view / tab-hidden /
  reduced-motion gating as the Film cycle.
  The frames are built by `tools/finisher-track.py`, which **pillarboxes** the
  16:9 screenshots instead of cropping them. Taking 1.778 to 1.902 by cropping
  removes 26px off the top and 26px off the bottom, which in a 1440-wide
  Resolve screenshot is almost exactly the menu bar and the page-switcher —
  i.e. the strip that says which page you are looking at. The pad is `#17181A`,
  the app's own corner chrome, so the seam does not read. The one master that
  is already wider than the frame (the suite photograph) is centre-cropped at
  the sides instead. Measured in AVIF, all seven frames: 142KB at the 640
  rung (what a 390-wide phone pulls), 259KB at 960 (what a 1440 desktop pulls),
  376KB at 1280.
