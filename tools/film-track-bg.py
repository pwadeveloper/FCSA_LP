#!/usr/bin/env python3
"""
Derivatives for the three Film Track background frames.

    python3 tools/film-track-bg.py

The masters are 4K and total 11.6MB — they are build inputs, not deliverables,
and are gitignored alongside the hero and loop masters. These three cycle as
the full-bleed background of the Film track, so they carry the same budget as
the hero: 120KB at 1440, and the other rungs scale by pixel count to keep
bytes-per-pixel constant instead of letting 1920 balloon.

They can take heavier compression than a foreground image because a scrim sits
over them and type sits over that — detail below the scrim is detail nobody
sees. The quality floors below are lower than the hero's for exactly that.

ALL THREE ARE NORMALISED TO 16:9, AND THAT IS LOAD-BEARING. The masters are
not the same shape: 1 and 2 are 3840x2160 (1.778), 3 is 3840x1620 (2.370).

The cursor shader in hero-shader.js crossfades two frames through ONE uCover
uniform, computed from the outgoing frame only — coverFor() is called for the
incoming frame but only its offset is kept. That is safe on the hero, where
all five images share a ratio, and it is silently wrong the moment two frames
do not: the UV runs past [0,1] and CLAMP_TO_EDGE repeats the edge texel as a
vertical smear down the right of the frame. It only shows on the pairs that
straddle the difference, which is why it read as "sometimes stretched".

So the shapes are made to agree here rather than the shader made cleverer,
because the shader is the piece that cannot be tested without a GPU. A centre
crop is free at the background — every frame is cover-fit into a ~1.38:1 box
and already loses its sides.

IF YOU ADD A FRAME, it goes through this crop. Do not point the shader at a
set of mixed ratios.
"""
import os
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT  = os.path.join(ROOT, 'assets/media/film')
MASTERS = [
    ('film-bg-01', 'Film Track BG Image.jpg'),
    ('film-bg-02', '2nd BG image film track.jpg'),
    ('film-bg-03', '3rd bg image film track.jpg'),
]
CAP_1440 = 120 * 1024
STEPS = [900, 1440, 1920]
FMTS = [('AVIF', 'avif', 58, 24), ('WEBP', 'webp', 76, 32), ('JPEG', 'jpg', 74, 32)]


TARGET_AR = 16 / 9


def crop_to(im, ar):
    """Centre-crop to a target aspect ratio, taking from whichever axis is long."""
    w, h = im.size
    cur = w / h
    if abs(cur - ar) < 1e-3:
        return im
    if cur > ar:                       # too wide: take from the sides
        nw = round(h * ar)
        x = (w - nw) // 2
        return im.crop((x, 0, x + nw, h))
    nh = round(w / ar)                 # too tall: take from top and bottom
    y = (h - nh) // 2
    return im.crop((0, y, w, y + nh))


def cap_for(w):
    return int(CAP_1440 * (w / 1440) ** 2)


def main():
    os.makedirs(OUT, exist_ok=True)
    for stem, fname in MASTERS:
        src = os.path.join(ROOT, 'assets/media', fname)
        if not os.path.exists(src):
            print(f'  MISSING {fname}')
            continue
        master = Image.open(src).convert('RGB')
        w0, h0 = master.size
        master = crop_to(master, TARGET_AR)
        note = '' if (w0, h0) == master.size else f'  -> centre-cropped to {master.width}x{master.height}'
        print(f'{stem}  <- {fname}  {w0}x{h0}{note}')
        for w in STEPS:
            if w > master.width:
                print(f'    skip {w}w — wider than the master')
                continue
            cap = cap_for(w)
            im = master.resize((w, round(master.height * w / master.width)), Image.LANCZOS)
            for fmt, ext, qhi, qlo in FMTS:
                p = os.path.join(OUT, f'{stem}-{w}.{ext}')
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
                flag = '' if sz <= cap else '  OVER CAP'
                print(f'    {os.path.basename(p):24s} q={q:3d} {sz/1024:6.1f} KB '
                      f'(cap {cap/1024:.0f}){flag}')


main()
