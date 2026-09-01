#!/usr/bin/env python3
"""
Encode the derivatives for the still in the closing section.

    python3 tools/apply-still.py

Same reason as tools/section-still.py and tools/hero-derivatives.py: the
ladder in index.html is only correct as long as the files on disk match it.
Re-run this after replacing the master and the widths stay honest.

THE MASTER IS 1920x1440 — 4:3, not the 3:2 the placeholder briefed. The slot's
`--ar` in index.html was moved to 4/3 to match rather than cropping 120px off
the frame, because what those 120px hold is the top of the lighting grid and
the bottom of the studio floor, which is most of what makes the shot read as a
studio at all.

THE LADDER STOPS AT 1920 because the master does. This block sits inside
`.wrap-narrow` (max-width 820px), so 1440 already covers that box at 1.76x and
1920 covers it at 2.34x — the top rung exists for 2x displays and nothing
beyond.
"""
import os
from PIL import Image

ROOT   = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MASTER = os.path.join(ROOT, 'assets/media/See you in class.jpg')
OUTDIR = os.path.join(ROOT, 'assets/media/apply')
STEM   = 'apply-still'

# Caps follow tools/section-still.py's 120KB at 1440 and scale with pixel count.
STEPS = [(900, 60 * 1024), (1440, 120 * 1024), (1920, 200 * 1024)]
FMTS  = [('AVIF', 'avif', 62, 28), ('WEBP', 'webp', 80, 38), ('JPEG', 'jpg', 78, 38)]

os.makedirs(OUTDIR, exist_ok=True)
master = Image.open(MASTER).convert('RGB')
print(f'master {master.width}x{master.height}')

for w, cap in STEPS:
    if w > master.width:
        print(f'  skip {w}w — wider than the master, would be an upscale')
        continue
    im = master.resize((w, round(master.height * w / master.width)), Image.LANCZOS)
    for fmt, ext, qhi, qlo in FMTS:
        p = os.path.join(OUTDIR, f'{STEM}-{w}.{ext}')
        q = qhi
        while True:
            if fmt == 'JPEG':
                im.save(p, 'JPEG', quality=q, optimize=True, progressive=True, subsampling='4:2:0')
            elif fmt == 'WEBP':
                im.save(p, 'WEBP', quality=q, method=6)
            else:
                im.save(p, 'AVIF', quality=q, speed=4)
            if os.path.getsize(p) <= cap or q <= qlo:
                break
            q -= 3
        print(f'  {os.path.basename(p):26s} q={q:3d} {os.path.getsize(p)/1024:6.1f} KB'
              f'{"  OVER CAP" if os.path.getsize(p) > cap else ""}')
