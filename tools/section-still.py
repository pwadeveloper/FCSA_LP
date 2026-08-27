#!/usr/bin/env python3
"""
Encode the derivatives for the rest-state still behind the pull line.

    python3 tools/section-still.py

WHY A SCRIPT AND NOT A ONE-OFF. Same reason as tools/hero-derivatives.py:
the ladder in index.html is only correct as long as the files on disk match
it. Re-run this after replacing the master and the widths stay honest.

THE MASTER IS 1508px WIDE, so the ladder stops at 1440 and emits TWO steps,
not the usual three. A 1920 step would be an upscale: more bytes, no more
detail. This follows the per-image cap already documented in
tools/hero-derivatives.py rather than inventing a second rule.

The master is deliberately NOT pre-blurred. The blur is a CSS filter, so the
sharp original survives on disk and in the deployed derivatives, and revealing
it later is a stylesheet change rather than a re-encode.
"""
import os
from PIL import Image

ROOT   = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MASTER = os.path.join(ROOT, 'assets/media/Section2img.png')
OUTDIR = os.path.join(ROOT, 'assets/media')
STEM   = 'section-still'

# Budget is the brief's 120KB at 1440; 900 scales with pixel count.
STEPS = [(900, 74 * 1024), (1440, 120 * 1024)]
FMTS  = [('AVIF', 'avif', 62, 28), ('WEBP', 'webp', 80, 38), ('JPEG', 'jpg', 78, 38)]

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
