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

### 0b. Hero media — RIGHTS

`assets/media/` is empty and the hero shows a labelled placeholder.

**The reference comp must not be used.** It is a publicity still of a
recognisable actor (Giancarlo Esposito). The slot needs original or properly
licensed material: a portrait of one person, dramatically lit against a dark
ground, looking to camera, subject centre-right, left third falling to
near-black.

Wire to `assets/media/hero-media.jpg` (3:2 desktop, 4:5 mobile crop) and
optionally `hero-media.mp4`, both with a poster. The commented markup is in
`index.html`; `script.js` already gates playback — no autoplay below 1024px,
and none under `prefers-reduced-motion`.

The scrim does not depend on the image being dark. It was verified against a
**pure white** image — the worst case any photo can present — with the
background sampled under every white glyph pixel at 1024, 1280 and 1440. Worst
result 17.2:1, zero pixels below 4.5:1. Any conforming image will be safe. If
you change the scrim, re-run that test rather than eyeballing it.

### Partner logos

The four partners currently render as **text wordmarks**, not logos. Only Clan
Yujo and Multimudia Studios have supplied SVGs; CoLAB and KayKav Academy have
not. Mixing two logos with two text labels would break the "all four at equal
weight" requirement, so all four are text until the other two land.


The page no longer shows placeholders for missing facts — it simply omits
them. That keeps it from looking broken, but it also means **nothing on the
page will tell you these are missing.** They are tracked only here.

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

## MEDIA MANIFEST

Twenty slots. Nineteen render on the page as labelled placeholders; `og-image`
is the social card and is built, not photographed. **Every slot needs original
or licensed material.** The hero reference comp must not ship — it is a
publicity still of a recognisable actor.

Drop assets in at the exact paths below and they appear with no code change.
Every `LOOP` needs a `.mp4` **and** a `.jpg` poster at the same name.

| Slot | Section | Path | Ratio | Dimensions | Type | What it is | Status |
|---|---|---|---|---|---|---|---|
| `pullquote-loop` | Pull line | `assets/media/pullquote-loop.mp4` | 21:9 | 1920×823 | LOOP | Ambient, near-abstract. A light being flagged, a lens turning, dust in a beam. No faces. 6–8s, silent. |  |
| `foundation-wide` | Foundation | `assets/media/foundation-wide.jpg` | 16:9 | 1920×1080 | STILL | A class in progress. Phones and cameras out, people leaning in. |  |
| `foundation-vertical` | Foundation | `assets/media/foundation-vertical.jpg` | 4:5 | 1080×1350 | STILL | One student at work, close. Portrait orientation. |  |
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

The page budget is 500KB and the audience is on mobile data in Nigeria. The
page is currently **~146KB** with no media at all. Sixteen images at even 80KB
each is 1.3MB — nearly triple the budget.

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
  CLAN_YUJO_LOGO_FULL_1__Vectorized_.svg
  mms_logo.svg
  favicon.svg
  fonts/bodoni-moda-latin.woff2   (display — Bodoni Moda, variable)
  fonts/inter-latin.woff2         (text — Inter, variable)
```

Fonts are self-hosted rather than called from Google Fonts: the audience is on
mobile data, and self-hosting removes two DNS + TLS round trips before the
first byte of font CSS arrives.

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
- **The header is transparent only while the hero media is behind it.**
  `script.js` observes `.hero-media`, which covers both layouts: inset on
  desktop, the 4:5 block on mobile.
- Copy comes from `content.md`. The subhead is sentence case in the source —
  there is no `text-transform` on it.
