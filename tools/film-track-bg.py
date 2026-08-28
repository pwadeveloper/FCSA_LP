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

FRAME 3 IS A DIFFERENT SHAPE. Frames 1 and 2 are 3840x2160 (16:9); frame 3 is
3840x1620 (2.37:1). Cover-fit into a full-viewport box crops all three anyway,
so this costs nothing at the background — but the clip strip at the foot uses
the same files at 428x225, and there the wider frame crops tighter. Check
frame 3's clip if the composition ever looks off.
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
        print(f'{stem}  <- {fname}  {master.width}x{master.height}')
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
