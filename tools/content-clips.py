#!/usr/bin/env python3
"""
Encode the three Content Track clips and their posters.

    python3 tools/content-clips.py

THE SOURCES ARE 1080x1920 HEVC WITH AUDIO. Three things stop them shipping as
supplied:

1. HEVC IS SAFARI-ONLY on the web. Chrome and Firefox will not decode these
   files, so on most of the audience's browsers the section would be three
   black boxes. Everything below is 8-bit H.264 High, which every target
   decodes — the same call tools/background-loop.py makes for the same reason.

2. THE AUDIO IS DEAD WEIGHT. These autoplay, and autoplay only survives
   browser policy while muted, so not one viewer will ever hear it. `-an`
   drops the track entirely rather than shipping bytes nobody can play.

3. 5.4 Mbps INTO A 314px BOX. Measured, the card is 110px wide on a 390px
   phone and 314px at 1920 — so even a 2x display never asks for more than
   ~628px. The ladder below tops out at 640 because anything above it is
   detail the layout cannot show.

THREE OF THEM PLAY AT ONCE, which is what makes the budget tight: it is three
simultaneous decodes, not one, and on a mid-range phone that is the difference
between a section that scrolls and one that stutters. Hence 30fps kept (these
are punchy vertical cuts where 24 reads as a stumble) but the bitrate held
low, and the small rung genuinely small.
"""
import os, subprocess, sys
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC  = os.path.join(ROOT, 'assets/media')
OUT  = os.path.join(ROOT, 'assets/media/content')

CLIPS = [
    ('content-01-network',   'build a network.mp4'),
    ('content-02-compintel', 'compintel mini.mp4'),
    ('content-03-worldgov',  'world gov see ai.mp4'),
]

# (width, video bitrate). Height follows 9:16. High rung first.
STEPS = [(640, 900_000), (360, 400_000)]
FPS = 30

# Poster ladder, one per clip. Frame zero, deliberately: it is what shows
# before playback starts and wherever the loop is suppressed, so it has to be
# the frame the video itself begins on or starting reads as a cut.
POSTER_W = 640
CAP = 42 * 1024
FMTS = [('AVIF', 'avif', 60, 26), ('WEBP', 'webp', 78, 34), ('JPEG', 'jpg', 76, 34)]


def run(args):
    r = subprocess.run(args, capture_output=True, text=True)
    if r.returncode != 0:
        print(r.stderr[-1500:], file=sys.stderr)
        raise SystemExit(f'ffmpeg failed: {" ".join(args[:6])}…')


def main():
    os.makedirs(OUT, exist_ok=True)
    total = {w: 0 for w, _ in STEPS}

    for stem, fname in CLIPS:
        src = os.path.join(SRC, fname)
        if not os.path.exists(src):
            print(f'  MISSING {fname}')
            continue
        print(f'\n{stem}  <- {fname}')

        for w, rate in STEPS:
            h = round(w * 16 / 9)
            h += h % 2                      # H.264 needs even dimensions
            dst = os.path.join(OUT, f'{stem}-{w}.mp4')
            run([
                'ffmpeg', '-y', '-loglevel', 'error', '-i', src,
                '-an',                                  # no audio: see note 2
                '-vf', f'scale={w}:{h}:flags=lanczos,fps={FPS}',
                '-c:v', 'libx264', '-profile:v', 'high', '-pix_fmt', 'yuv420p',
                '-b:v', str(rate), '-maxrate', str(int(rate * 1.4)),
                '-bufsize', str(rate * 2),
                '-preset', 'slow',
                # +faststart puts the moov atom first so playback can begin
                # before the whole file has arrived. On a looping clip that is
                # the difference between instant and a visible wait.
                '-movflags', '+faststart',
                dst,
            ])
            sz = os.path.getsize(dst)
            total[w] += sz
            print(f'    {os.path.basename(dst):28s} {sz/1024:7.1f} KB')

        # poster: frame zero
        raw = os.path.join(OUT, f'{stem}-poster.png')
        run(['ffmpeg', '-y', '-loglevel', 'error', '-i', src,
             '-vf', f'scale={POSTER_W}:-2:flags=lanczos', '-frames:v', '1', raw])
        im = Image.open(raw).convert('RGB')
        for fmt, ext, qhi, qlo in FMTS:
            p = os.path.join(OUT, f'{stem}-poster.{ext}')
            q = qhi
            while True:
                if fmt == 'JPEG':
                    im.save(p, 'JPEG', quality=q, optimize=True, progressive=True, subsampling='4:2:0')
                elif fmt == 'WEBP':
                    im.save(p, 'WEBP', quality=q, method=6)
                else:
                    im.save(p, 'AVIF', quality=q, speed=4)
                if os.path.getsize(p) <= CAP or q <= qlo:
                    break
                q -= 3
            print(f'    {os.path.basename(p):28s} q={q:3d} {os.path.getsize(p)/1024:6.1f} KB')
        os.remove(raw)

    print('\nall three clips together:')
    for w, _ in STEPS:
        print(f'   {w}w rung: {total[w]/1024/1024:.2f} MB')


main()
