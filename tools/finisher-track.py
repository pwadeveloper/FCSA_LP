#!/usr/bin/env python3
"""
Derivatives for the seven Finisher Track frames.

    python3 tools/finisher-track.py

Seven stills cycle inside the Finisher's single wide frame at a 500ms dwell
(finisher-track.js). Six are DaVinci Resolve pages in the order the app itself
lists them along the bottom bar — Photo, Cut, Edit, Fusion, Color, Fairlight —
and the seventh is the grading suite the whole thing is pointed at.

THE FRAME IS 428/225 (1.902) AND THE MASTERS ARE NOT.

Six of the masters are 1440x810 (16:9, 1.778) and one is 1440x670 (2.149), so
every one of them has to be made to agree with the frame or `object-fit: cover`
does it for us — differently per image, which at a 500ms cadence reads as the
picture jumping size every half second.

They are NOT all cropped, because cropping the wrong axis destroys these
particular images. To take a 1.778 master to 1.902 by cropping you cut 53px of
HEIGHT — 26px off the top and 26px off the bottom. In a 1440-wide Resolve
screenshot the top menu bar is ~22px and the bottom page-switcher is ~26px, so
that crop removes almost exactly the two strips that say which page you are
looking at. The page name is the entire point of the frame.

So the rule is: crop only ever takes from WIDTH. A master wider than the frame
is centre-cropped at the sides (the suite photograph, which loses 5.5% of its
sides and does not care). A master narrower than the frame is PILLARBOXED — a
flat pad each side — rather than cut. The pad is #17181A, sampled from the
Resolve window chrome, which is the exact corner colour of all six screenshots,
so the seam sits inside the app's own frame instead of against it.

BUDGET. Seven frames all have to be decoded before the loop can start, so this
is seven images' worth of bytes for one visible frame — the caps are per-image
and deliberately tight. 56KB at the 960 rung, the other rungs scaled by pixel
count to hold bytes-per-pixel constant. At a 500ms dwell nobody reads the UI
text, so detail below "you can tell it is the Color page" is detail nobody
gets to use.
"""
import os
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC  = os.path.join(ROOT, 'assets/media/finisher track')
OUT  = os.path.join(ROOT, 'assets/media/finisher')

# In Resolve's own page order, then the room the pages are run from.
MASTERS = [
    ('fin-01-photo',     'photo.jpg'),
    ('fin-02-cut',       'cut.jpg'),
    ('fin-03-edit',      'edit.jpg'),
    ('fin-04-fusion',    'fusion.jpg'),
    ('fin-05-color',     'color.jpg'),
    ('fin-06-fairlight', 'fairlight.jpg'),
    ('fin-07-suite',     'hollywood-md.jpg'),
]

TARGET_AR = 428 / 225          # the frame, and the Film clips' ratio
PAD = (0x17, 0x18, 0x1A)       # Resolve window chrome
CAP_960 = 56 * 1024
STEPS = [640, 960, 1280]
FMTS = [('AVIF', 'avif', 60, 26), ('WEBP', 'webp', 78, 34), ('JPEG', 'jpg', 76, 34)]


def fit_to(im, ar):
    """Crop the sides if too wide; pillarbox if too tall. Never crop height."""
    w, h = im.size
    cur = w / h
    if abs(cur - ar) < 1e-3:
        return im, 'already'
    if cur > ar:                                  # too wide: take from the sides
        nw = round(h * ar)
        x = (w - nw) // 2
        return im.crop((x, 0, x + nw, h)), f'cropped {w - nw}px of width'
    nw = round(h * ar)                            # too tall: pad the sides
    out = Image.new('RGB', (nw, h), PAD)
    out.paste(im, ((nw - w) // 2, 0))
    return out, f'pillarboxed +{(nw - w) // 2}px a side'


def cap_for(w):
    return int(CAP_960 * (w / 960) ** 2)


def main():
    os.makedirs(OUT, exist_ok=True)
    total = 0
    for stem, fname in MASTERS:
        src = os.path.join(SRC, fname)
        if not os.path.exists(src):
            print(f'  MISSING {fname}')
            continue
        master = Image.open(src).convert('RGB')
        w0, h0 = master.size
        master, note = fit_to(master, TARGET_AR)
        print(f'{stem}  <- {fname}  {w0}x{h0} -> {master.width}x{master.height}  ({note})')
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
                if ext == 'avif':
                    total += sz
                flag = '' if sz <= cap else '  OVER CAP'
                print(f'    {os.path.basename(p):28s} q={q:3d} {sz/1024:6.1f} KB '
                      f'(cap {cap/1024:.0f}){flag}')
    print(f'\nAVIF, all seven frames: {total/1024:.0f} KB across the three rungs; '
          f'a browser pulls one rung.')


main()
