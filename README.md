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
