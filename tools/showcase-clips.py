#!/usr/bin/env python3
"""
Encode the eight Showcase clips and their posters.

    python3 tools/showcase-clips.py

THE SOURCES ARE HEVC WITH AUDIO, 24fps, 2–6 seconds each, at 2.8–5.9 Mbps.
The same three things that stopped the Content Track masters shipping as
supplied stop these, for the same reasons — see tools/content-clips.py for the
long version:

1. HEVC IS SAFARI-ONLY on the web. Everything below is 8-bit H.264 High.
2. THE AUDIO IS DEAD WEIGHT. These autoplay, autoplay only survives browser
   policy while muted, so `-an` drops the track rather than shipping bytes
   nobody can play.
3. THE BITRATE IS SIZED FOR A CINEMA, NOT A TILE.

24fps IS KEPT, and that is the one place this differs from the Content Track,
which resamples to 30. These are cut from finished film work and 24 is the
rate they were graded at; resampling a 24fps pan to 30 duplicates every fifth
frame and the judder is visible on exactly the slow camera moves these clips
are made of. The Content clips are phone-shot vertical cuts where 30 is the
native rate and 24 reads as a stumble. Different source, different answer.

THE LADDER IS SET BY THE LONG EDGE, not by width. Three of these are 16:9,
three are 4:3 and two are 9:16, and a flat "1280 wide" rung would send a
1280x2276 portrait into a 280px column — nearly three times the pixels of the
landscape rung for a tile that is the NARROWEST in the grid. Long edge is the
axis the layout actually constrains, so it is the axis the ladder is cut on.

MEASURED TILE WIDTHS, which is where 1280 and 640 come from. At >=1024 the
grid is the 12-column rail in styles.css; at a 1920 viewport (56px gutters,
26px column gap) a column is 126.8px, so the spans in the markup measure:

    span 2  (sc-02, sc-05 — the two portraits)   280px
    span 4  (sc-03)                              585px
    span 5  (sc-04, sc-06)                       738px
    span 6  (sc-01, sc-07, sc-08)                891px

At 2x that is 560 / 1171 / 1476 / 1782 device pixels. The 1280 rung covers the
span-4 tile exactly and asks the span-5 and span-6 to stretch ~1.15x and ~1.39x.
That is a deliberate trade: a 1920 rung would very nearly double the byte count
of a section that holds EIGHT clips, to sharpen a moving 24fps image on a 2x
display by an amount that does not survive the motion.

THE PORTRAITS GO THE OTHER WAY and are oversampled rather than stretched: the
long-edge rule gives them 720x1280 for a tile that is 280px wide, which is 1.28x
more width than a 2x display asks for. That is deliberate too. Their span
dropped from 3 to 2 when the grid was rebalanced (see the .showcase block in
styles.css), and cutting a third portrait-only rung to match would be a rung
that exists for two files. 720 also happens to be the right number for the
OTHER way these are watched: below 1024 the tiles stack full-width, nothing
autoplays, and a tap on the play button gets the 640 rung — 360px wide against
a ~340px tile that a phone renders at 2x or 3x. The small rung is already the
compromise there; the large one absorbing 1.28x of slack is the cheaper end of
the same problem.

TOTAL BUDGET. Eight clips, 36.9 seconds of footage between them. The large
rung lands around 6MB all together and the small around 2MB — but the section
never fetches all eight, because script.js assigns no `src` until a tile is
within 300px of the viewport and pauses it again on the way out. What a
visitor actually pays for is the three or four tiles they scroll past.
"""
import os, subprocess, sys
from PIL import Image, ImageStat

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC  = os.path.join(ROOT, 'assets/media')
OUT  = os.path.join(ROOT, 'assets/media/showcase')

# (stem, source file). Order matches sc-01..sc-08 in index.html.
CLIPS = [
    ('showcase-01', 'Showcase 1.mp4'),
    ('showcase-02', 'Showcase 2.mp4'),
    ('showcase-03', 'Showcase 3.mp4'),
    ('showcase-04', 'Showcase 4.mp4'),
    ('showcase-05', 'Showcase 5.mp4'),
    ('showcase-06', 'Showcase 6.mp4'),
    ('showcase-07', 'Showcase 7.mp4'),
    ('showcase-08', 'Showcase 8.mp4'),
]

# (long edge, bits per pixel per frame). The small rung carries a HIGHER bpp on
# purpose: compression efficiency per pixel drops as the frame shrinks, so
# holding the same bpp across both rungs would leave the 640 visibly blockier
# than its share of the budget deserves.
STEPS = [(1280, 0.055), (640, 0.075)]
FPS = 24

# THE POSTER LADDER IS SHORTER THAN THE VIDEO LADDER, and it is worth saying
# why rather than leaving it to look like a typo. A first pass cut these at
# 1280 to match the large rung and three of the eight could not reach 40KB
# even at quality 33 — a poster that is simultaneously over budget AND visibly
# blocky, which is the worst of both. 960 is 56% of the pixels, and the same
# budget buys quality 60-80 instead. The poster never renders larger than the
# tile does: 960 covers a 340px phone tile at 2.8x and the widest desktop tile
# at 1.6x, and unlike the video it is a still that is on screen for a moment
# before playback starts.
POSTER_LONG = 960
CAP = 34 * 1024
# JPEG ONLY. <video poster> takes a single URL — there is no <picture> to
# negotiate a format with — so an avif and a webp alongside it are files
# nothing can ever request. Same rule as tools/content-clips.py, and the same
# 232KB of dead files that rule was written to stop.
FMT = ('JPEG', 'jpg', 80, 45)

# Frame zero is the poster wherever frame zero is usable: it is what shows
# before playback starts and on every phone, where nothing autoplays, it is
# the ONLY thing most visitors see. Showcase 4 fades up from black, and its
# frame zero measures 2.3 mean luma — a black tile that reads as a failed
# load, not as a considered still. So the search walks forward until the frame
# is actually an image. Everything else answers at t=0 and is untouched.
POSTER_FLOOR = 18
POSTER_SEEK = [0.0, 0.25, 0.5, 0.75, 1.0, 1.5, 2.0]


def run(args):
    r = subprocess.run(args, capture_output=True, text=True)
    if r.returncode != 0:
        print(r.stderr[-1500:], file=sys.stderr)
        raise SystemExit(f'ffmpeg failed: {" ".join(args[:6])}…')


def probe(path):
    r = subprocess.run(
        ['ffprobe', '-v', 'error', '-select_streams', 'v:0',
         '-show_entries', 'stream=width,height', '-of', 'csv=p=0:s=x', path],
        capture_output=True, text=True)
    w, h = r.stdout.strip().split('x')
    return int(w), int(h)


def fit(sw, sh, long_edge):
    """Scale so the LONGER source axis lands on long_edge. Even dimensions —
    H.264 requires them — and never an upscale."""
    if max(sw, sh) <= long_edge:
        w, h = sw, sh
    elif sw >= sh:
        w, h = long_edge, round(sh * long_edge / sw)
    else:
        w, h = round(sw * long_edge / sh), long_edge
    return w + w % 2, h + h % 2


def poster_frame(src, dst):
    """First frame at or after t=0 that is brighter than POSTER_FLOOR."""
    tmp = dst + '.probe.png'
    for t in POSTER_SEEK:
        run(['ffmpeg', '-y', '-loglevel', 'error', '-ss', str(t), '-i', src,
             '-frames:v', '1', '-vf', 'scale=160:-2', tmp])
        luma = ImageStat.Stat(Image.open(tmp).convert('L')).mean[0]
        if luma > POSTER_FLOOR:
            os.remove(tmp)
            return t, luma
    os.remove(tmp)
    return 0.0, luma


def main():
    os.makedirs(OUT, exist_ok=True)
    total = {le: 0 for le, _ in STEPS}
    posters = 0

    for stem, fname in CLIPS:
        src = os.path.join(SRC, fname)
        if not os.path.exists(src):
            print(f'  MISSING {fname}')
            continue
        sw, sh = probe(src)
        print(f'\n{stem}  <- {fname}  {sw}x{sh}')

        for long_edge, bpp in STEPS:
            w, h = fit(sw, sh, long_edge)
            rate = round(w * h * FPS * bpp)
            dst = os.path.join(OUT, f'{stem}-{long_edge}.mp4')
            run([
                'ffmpeg', '-y', '-loglevel', 'error', '-i', src,
                '-an',                                  # no audio: see note 2
                '-vf', f'scale={w}:{h}:flags=lanczos,fps={FPS}',
                '-c:v', 'libx264', '-profile:v', 'high', '-pix_fmt', 'yuv420p',
                '-b:v', str(rate), '-maxrate', str(int(rate * 1.4)),
                '-bufsize', str(rate * 2),
                '-preset', 'slow',
                # +faststart puts the moov atom first so playback can begin
                # before the whole file has arrived. On a short loop that is
                # the difference between instant and a visible wait.
                '-movflags', '+faststart',
                dst,
            ])
            sz = os.path.getsize(dst)
            total[long_edge] += sz
            print(f'    {os.path.basename(dst):26s} {w}x{h} @ {rate/1000:6.0f}k  {sz/1024:7.1f} KB')

        p = os.path.join(OUT, f'{stem}-poster.{FMT[1]}')
        t, luma = poster_frame(src, p)
        pw, ph = fit(sw, sh, POSTER_LONG)
        raw = p + '.raw.png'
        run(['ffmpeg', '-y', '-loglevel', 'error', '-ss', str(t), '-i', src,
             '-vf', f'scale={pw}:{ph}:flags=lanczos', '-frames:v', '1', raw])
        im = Image.open(raw).convert('RGB')
        _, ext, q, qlo = FMT
        while True:
            im.save(p, 'JPEG', quality=q, optimize=True, progressive=True, subsampling='4:2:0')
            if os.path.getsize(p) <= CAP or q <= qlo:
                break
            q -= 3
        os.remove(raw)
        posters += os.path.getsize(p)
        note = '' if t == 0.0 else f'  (t={t}s — frame zero was black, luma {luma:.0f})'
        over = '  OVER CAP' if os.path.getsize(p) > CAP else ''
        print(f'    {os.path.basename(p):26s} {pw}x{ph} q={q:3d}  {os.path.getsize(p)/1024:7.1f} KB{over}{note}')

    print('\nall eight clips together:')
    for long_edge, _ in STEPS:
        print(f'   {long_edge} rung: {total[long_edge]/1024/1024:.2f} MB')
    print(f'   posters:   {posters/1024:.0f} KB  (lazily assigned — see script.js)')


main()
