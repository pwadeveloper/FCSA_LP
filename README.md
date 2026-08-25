# The Film and Content School — landing page

Static single-page site. No framework, no build step, no dependencies.
Deploy by dragging this folder to Netlify, Vercel or GitHub Pages.

Local preview: `python3 -m http.server 8000`

---

## 🔴 LAUNCH BLOCKERS

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

1200×630, black, both logos, headline. Add at `assets/og-image.png`, then
uncomment the block in `<head>` and set the live domain. This link will be
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

- **Monochrome is deliberate and total.** Seven greys, defined once as custom
  properties at the top of `styles.css`. There is no accent colour and adding
  one would break the identity. Emphasis comes from fill weight, scale and
  spacing — the timeline's `--paper` / `--surface` / `--sunk` ladder is how it
  signals intensity without colour.
- **Anchor links re-aim after fonts load.** Loading `#faq` scrolls using
  fallback-font metrics, then the real fonts swap in and sections shift up to
  ~120px. `script.js` re-scrolls on `document.fonts.ready`. If you add
  sections, add their IDs to the `scroll-margin-top` rule in `styles.css`.
- **The four display-face pull lines** in the tracks section ("I hit record,
  but all I see are shadows", etc.) are real class titles from the curriculum.
  They were promoted out of the class lists, so they appear once each. Don't
  reintroduce them into the lists.
- Copy comes from `content.md`. Two deliberate trims: "the part nobody teaches
  properly" was cut from the Content track paragraph because it now runs as
  that panel's pull line, and the two Foundation pull lines were removed from
  the Foundation class list for the same reason.
