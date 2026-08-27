#!/usr/bin/env python3
"""
Encode the section-2 ambient background loop and its poster ladder.

    python3 tools/background-loop.py

THE SOURCE IS 1280x720 HEVC MAIN 10. Two reasons it cannot ship as supplied:
hvc1/HEVC is Safari-only on the web (Chrome and Firefox will not decode this
file), and 4.09 Mbps for a decorative backdrop that autoplays on every visit
is roughly twice the budget. Both renditions below are 8-bit H.264 High,
which every target decodes, at rates chosen against the brief.

THE LAST FRAME IS DROPPED. Frame 230 (t=9.583s) is pure black while 227-229
average 164/255 — a one-frame cut to black that a `loop` attribute replays
every ten seconds as a visible blink. TRIM is 230 frames, not 231. Re-check
this if the master is replaced: the tail is not guaranteed to be a fade.

RESOLUTION. The ladder tops out at the master's native 1280 because there is
nothing above it to draw on; a 1920 rung would be an upscale, which is the
same per-asset cap rule already written down in tools/hero-derivatives.py and
tools/section-still.py. If the edit is ever re-exported at 1920x1080, change
STEPS to [(1920, 1_800_000), (1280, 900_000)] and re-run — the <source> lists
in index.html are keyed to the file stems, not to the pixel counts.

TWO RATES, NOT TWO CROPS. The brief's split is a high rung for >=1024px and a
low rung under it. Off a 720 master the high rung is native 720 and the low
rung steps down to 540 rather than re-encoding the same frame twice.

Two-pass, because the point of the exercise is landing ON a byte budget: a
single-pass CRF encode of a montage this contrasty overshoots badly on the
dust and blossom shots and undershoots on the black close-up.

THE POSTER IS FRAME ZERO, deliberately. It is the fallback everywhere the
loop does not run and the handoff image everywhere it does, so it has to be
the frame the video itself starts on or pressing play cuts. Frame zero is
also within 6% of the loop's brightest frame, which means the overlay that
clears the poster clears the video too — one measurement covers both states.
"""
import os, subprocess, sys
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC  = os.path.join(ROOT, 'assets/media/BackgroundLoop.mp4')
OUT  = os.path.join(ROOT, 'assets/media/loop')
MASTER = os.path.join(OUT, 'loop-poster-master.png')

TRIM = 230                      # frames kept; drops the black tail frame
FPS  = 24
# (width, video bitrate). Height follows 16:9. Order is high rung first.
STEPS = [(1280, 1_800_000), (960, 900_000)]
HARD_CAP = 2.5 * 1024 * 1024    # the brief's ceiling on the larger rendition

# Poster ladder. Cap is the brief's 100KB at 1440 scaled by pixel count, so
# bytes-per-pixel stays constant instead of letting the top rung balloon.
CAP_1440 = 100 * 1024
POSTER_STEPS = [900, 1280]
FMTS = [('AVIF', 'avif', 62, 26), ('WEBP', 'webp', 80, 34), ('JPEG', 'jpg', 78, 34)]


def run(args):
    r = subprocess.run(args, capture_output=True, text=True)
    if r.returncode != 0:
        sys.stderr.write(r.stderr[-2000:])
        raise SystemExit(' '.join(args[:3]) + ' failed')


def zero_edit_list(path):
    """Neutralise the edit list libx264 emits, so the loop is seamless.

    libx264 uses B-frames (good — they pay for themselves on this montage), and
    the mov muxer represents the resulting reorder delay as an edit list with a
    non-zero media_time — measured 1024 @ a 12288 media timescale, i.e. the
    first 83ms of the track are skipped on playback. A `loop` attribute then
    has to seek back to that offset every cycle, and browsers do that
    inconsistently: sometimes it loops, sometimes it stalls on the last frame.
    (Same family of problem as the black tail frame TRIM already removes.)

    Setting media_time to 0 makes the edit an identity map, which every engine
    loops cleanly, and starts playback on frame 0 — the exact frame the poster
    is extracted from, so the poster->video handoff is now frame-accurate too.
    Only a single 4-byte field changes; sample tables and mdat are untouched,
    so the encode is bit-for-bit identical to decode. Doing it here rather than
    with an ffmpeg flag because no libx264 flag reliably suppresses the edit
    list without also giving up B-frames."""
    import struct
    data = bytearray(open(path, 'rb').read())

    def find(path_boxes):
        def rec(off, end, p):
            while off < end - 8:
                size = struct.unpack('>I', data[off:off + 4])[0]
                typ, hdr = data[off + 4:off + 8], 8
                if size == 1:
                    size = struct.unpack('>Q', data[off + 8:off + 16])[0]; hdr = 16
                elif size == 0:
                    size = end - off
                if typ == p[0]:
                    if len(p) == 1:
                        return off + hdr
                    r = rec(off + hdr, off + size, p[1:])
                    if r is not None:
                        return r
                off += size
            return None
        return rec(0, len(data), [b.encode() for b in path_boxes])

    o = find(['moov', 'trak', 'edts', 'elst'])
    if o is None:
        return  # no edit list, nothing to do
    ver, cnt = data[o], struct.unpack('>I', data[o + 4:o + 8])[0]
    if ver != 0 or cnt != 1:
        return  # unexpected shape — leave it rather than guess
    struct.pack_into('>i', data, o + 8 + 4, 0)  # entry0.media_time -> 0
    open(path, 'wb').write(data)


def encode(w, rate):
    h = round(w * 9 / 16 / 2) * 2
    dst = os.path.join(OUT, f'background-loop-{h}.mp4')
    log = os.path.join(OUT, f'.x264-{h}')
    common = [
        'ffmpeg', '-y', '-i', SRC,
        '-frames:v', str(TRIM),
        '-an', '-sn', '-dn', '-map_metadata', '-1',
        '-vf', f'scale={w}:{h}:flags=lanczos,format=yuv420p',
        '-c:v', 'libx264', '-profile:v', 'high', '-level', '4.0',
        '-preset', 'slower', '-b:v', str(rate),
        # ~2s of VBV at the target rate. Without it a two-pass encode is free
        # to spend a 4-second burst on one shot, which is exactly what stalls
        # a background loop on a thin connection.
        '-maxrate', str(int(rate * 1.5)), '-bufsize', str(rate * 2),
        '-g', str(FPS * 2), '-keyint_min', str(FPS),
        '-pix_fmt', 'yuv420p', '-movflags', '+faststart',
        '-passlogfile', log,
    ]
    run(common + ['-pass', '1', '-f', 'mp4', os.devnull])
    run(common + ['-pass', '2', dst])
    for f in os.listdir(OUT):
        if f.startswith('.x264-'):
            os.remove(os.path.join(OUT, f))
    zero_edit_list(dst)   # make the loop seamless — see the function's note
    return dst


def main():
    os.makedirs(OUT, exist_ok=True)
    print(f'trim {TRIM} frames = {TRIM / FPS:.3f}s @ {FPS}fps')

    for i, (w, rate) in enumerate(STEPS):
        dst = encode(w, rate)
        sz = os.path.getsize(dst)
        flag = ''
        if i == 0 and sz > HARD_CAP:
            flag = '  OVER THE 2.5MB CEILING'
        print(f'  {os.path.basename(dst):26s} {rate/1e6:.2f} Mbps target  '
              f'{sz/1024/1024:5.2f} MB  ({sz * 8 / (TRIM / FPS) / 1e6:.2f} Mbps actual){flag}')

    run(['ffmpeg', '-y', '-i', SRC, '-frames:v', '1', '-pix_fmt', 'rgb24',
         MASTER, '-loglevel', 'error'])
    master = Image.open(MASTER).convert('RGB')
    print(f'poster master {master.width}x{master.height} @ frame 0')

    for w in POSTER_STEPS:
        if w > master.width:
            print(f'  skip {w}w — wider than the master, would be an upscale')
            continue
        cap = int(CAP_1440 * (w / 1440) ** 2)
        im = master if w == master.width else master.resize(
            (w, round(master.height * w / master.width)), Image.LANCZOS)
        for fmt, ext, qhi, qlo in FMTS:
            p = os.path.join(OUT, f'loop-poster-{w}.{ext}')
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
            over = '  OVER CAP' if sz > cap else ''
            print(f'  {os.path.basename(p):26s} q={q:3d} {sz/1024:6.1f} KB '
                  f'(cap {cap/1024:.0f}){over}')


main()
