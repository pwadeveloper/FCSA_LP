#!/usr/bin/env python3
"""
Build the reel poster ladder from one still.

    python3 tools/reel-poster.py [seconds]

The poster is a real frame of the reel, not a designed card. It is NOT frame
zero — the reel opens on a title plate, which is a weak still — so pressing
play does cut to the top of the film. That is the normal behaviour of a
poster and is not worth fixing.

CHOOSING A REPLACEMENT. Most shots in this reel carry their own 2.35:1
mattes, baked in at the edit: 132px of black top and bottom of a 1080-tall
frame. A matted still leaves the caption stranded ~100px under the last
visible pixel, because the box is honestly 16:9 and the image inside it is
not. So the frame has to be one of the ones that fills 16:9 — 42.5s is one.
Check a new timestamp before trusting it:

    python3 tools/reel-poster.py 42.5 --check

and take one that reports FULL-BLEED with a low button-area luma (the play
ring is white, and it sits dead centre).

Budget is the brief's 120KB at 1440; the other two rungs scale with pixel
count, which keeps bytes-per-pixel constant rather than letting 1920 balloon.

Re-run after replacing the reel. The <source> lists in index.html are hand
written and stable — only the files change.
"""
import os, sys
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC  = os.path.join(ROOT, 'assets/media/clan_yujo_showreel_23_24 (1080p).mp4')
OUT  = os.path.join(ROOT, 'assets/media/reel')
MASTER = os.path.join(OUT, 'reel-poster-master.png')

CAP_1440 = 120 * 1024
STEPS = [900, 1440, 1920]
# (pillow format, extension, starting quality, floor)
FMTS = [('AVIF', 'avif', 62, 26), ('WEBP', 'webp', 80, 34), ('JPEG', 'jpg', 78, 34)]


def cap_for(w):
    return int(CAP_1440 * (w / 1440) ** 2)


def probe(master):
    """Report matte bars on all four edges and the mean luminance of the disc
    the play ring covers. A matte row is both dark AND flat — a genuinely dark
    shot is dark but never flat, which is what separates the two."""
    import statistics
    im = master.convert('L'); w, h = im.size; px = im.load()

    def flat_dark(vals):
        return statistics.mean(vals) < 26 and statistics.pstdev(vals) < 6

    t = b = l = r = 0
    while t < h // 2 and flat_dark([px[x, t] for x in range(0, w, 4)]): t += 1
    while b < h // 2 and flat_dark([px[x, h - 1 - b] for x in range(0, w, 4)]): b += 1
    while l < w // 2 and flat_dark([px[l, y] for y in range(0, h, 4)]): l += 1
    while r < w // 2 and flat_dark([px[w - 1 - r, y] for y in range(0, h, 4)]): r += 1

    cx, cy, rad = w // 2, h // 2, int(w * 0.032)
    disc = [px[x, y] for y in range(cy - rad, cy + rad, 3) for x in range(cx - rad, cx + rad, 3)
            if (x - cx) ** 2 + (y - cy) ** 2 <= rad * rad]
    lum = statistics.mean(disc)
    shape = 'FULL-BLEED' if max(t, b, l, r) <= 2 else f'MATTED t{t} b{b} l{l} r{r}'
    warn = '  <- too bright behind the white play ring' if lum > 150 else ''
    return f'{shape}, button-area luma {lum:.0f}{warn}' 


def main():
    at = sys.argv[1] if len(sys.argv) > 1 and not sys.argv[1].startswith('-') else '42.5'
    if not os.path.exists(MASTER) or len(sys.argv) > 1:
        os.makedirs(OUT, exist_ok=True)
        rc = os.system(
            f'ffmpeg -y -ss {at} -i {SRC!r} -frames:v 1 -pix_fmt rgb24 {MASTER!r} -loglevel error')
        if rc != 0:
            raise SystemExit('ffmpeg could not pull the frame')

    master = Image.open(MASTER).convert('RGB')
    print(f'master {master.size[0]}x{master.size[1]} @ {at}s')
    print('  ' + probe(master))
    if '--check' in sys.argv:
        return
    for w in STEPS:
        cap = cap_for(w)
        im = master if w == master.width else master.resize(
            (w, round(master.height * w / master.width)), Image.LANCZOS)
        for fmt, ext, qhi, qlo in FMTS:
            p = os.path.join(OUT, f'reel-poster-{w}.{ext}')
            q = qhi
            while True:
                if fmt == 'JPEG':
                    im.save(p, 'JPEG', quality=q, optimize=True,
                            progressive=True, subsampling='4:2:0')
                elif fmt == 'WEBP':
                    im.save(p, 'WEBP', quality=q, method=6)
                else:
                    im.save(p, 'AVIF', quality=q, speed=4)
                if os.path.getsize(p) <= cap or q <= qlo:
                    break
                q -= 3
            sz = os.path.getsize(p)
            flag = '' if sz <= cap else '  OVER BUDGET'
            print(f'  {os.path.basename(p):26s} q={q:3d} {sz/1024:6.1f} KB '
                  f'(cap {cap/1024:.0f}){flag}')


main()
