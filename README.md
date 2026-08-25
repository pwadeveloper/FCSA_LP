# The Film and Content School — landing page

Static single-page site. No framework, no build step, no dependencies.
Deploy by dragging this folder to Netlify, Vercel or GitHub Pages.

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

169 KB total, uncompressed. Fonts are self-hosted rather than called from
Google Fonts: the audience is on mobile data, and self-hosting removes two
DNS + TLS round trips before the first byte of font CSS.

Local preview: `python3 -m http.server 8000`

## Outstanding before this goes live

Everything below renders on the page as a visible `[To confirm]` placeholder.
Nothing has been guessed.

| Item | Where |
|---|---|
| Venue address in Kaduna | FAQ |
| Tuition, deposit, payment plan | FAQ |
| Application deadline | FAQ |
| Certificate — yes or no | FAQ |
| Reply time, in days | Under the apply button |
| Contact — phone, WhatsApp, email | Footer |
| Socials — school, Clan Yujo, Multimudia | Footer |
| Content track, weeks 10–11 | Timeline lane |
| Tutor listings — each person's approval | Tutors section |

Two more that are not visible on the page:

- **`FORM_ENDPOINT`** — top of `script.js`, currently `null`. Set it to a
  Formspree / Tally / Google Form URL. Until then the form validates fully and
  then says it isn't wired, rather than pretending to send.
- **Open Graph image** — 1200×630, black, both logos, headline. Add it at
  `assets/og-image.png` and uncomment the block in `<head>`. This link will be
  shared on WhatsApp far more than it will be found in search, so the preview
  card matters more than the SEO.

An analytics slot sits commented in `<head>`. Nothing is loaded.

## Notes for whoever picks this up

- Monochrome is deliberate and total. Seven greys, defined once as custom
  properties at the top of `styles.css`. There is no accent colour and adding
  one would break the identity.
- Emphasis comes from fill weight, scale and spacing. The timeline's
  `--paper` / `--surface` / `--sunk` ladder is how it signals intensity
  without colour.
- Tutor cards take a photo: drop `<img class="tutor-img" src="…" alt="">` in as
  the first child of any `.tutor`. Photos render greyscale by design.
- Copy comes from `content.md` and is used as written.
