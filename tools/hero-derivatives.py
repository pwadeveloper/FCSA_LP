#!/usr/bin/env python3
"""
Regenerate everything the hero carousel depends on, from one source of truth:
assets/media/hero/hero-manifest.json.

    python3 tools/hero-derivatives.py            # stamp index.html only (fast)
    python3 tools/hero-derivatives.py --images   # re-encode the derivatives too

WHY THIS EXISTS. scrim, pos, alt and usable all live in the manifest, but the
page cannot afford to wait on a fetch before it paints the first frame at the
right density — that is a visible flash of under-scrimmed white type. So the
first frame's values are STAMPED into index.html, and hero.js fetches the
manifest only for frames 2-n. That split is only safe if there is one command
that keeps the two in sync. This is that command.

Edit hero-manifest.json, run this, commit both. Never hand-edit the generated
block in index.html — the markers below own it.

usable:false drops an image from the carousel entirely: no frame, no dot, no
derivative referenced. It stays in the manifest with its note so the reason
survives, and flipping it back to true and re-running restores it.
"""
import json, os, sys, html, io, re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MANIFEST = os.path.join(ROOT, 'assets/media/hero/hero-manifest.json')
INDEX = os.path.join(ROOT, 'index.html')
OUTDIR = os.path.join(ROOT, 'assets/media/hero')

# 900 / 1440 / 1920, with the per-image cap at the master's native width: a
# step wider than the master is an upscale, which costs bytes and adds no
# detail. Masters that are still 1512-wide comps therefore stop at 1512 and
# emit two steps, not three. Budget at 1440 is the brief's 150KB; the others
# scale with pixel count.
STEPS = [(900, 92 * 1024), (1440, 150 * 1024), (1920, 250 * 1024)]
FMTS = [('avif', 'avif', 62, 28), ('webp', 'webp', 80, 38), ('jpeg', 'jpg', 78, 38)]


def find_master(hid):
    """Masters are matched by id, whatever extension they arrive with — they
    get replaced by hand (comp today, licensed plate tomorrow) and a hard-coded
    filename map goes stale the moment someone renames one."""
    for ext in ('jpg', 'jpeg', 'png', 'webp', 'tif', 'tiff'):
        for name in (f'{hid}.{ext}', f'{hid}.jpg .{ext}'):
            p = os.path.join(ROOT, 'assets/media', name)
            if os.path.exists(p):
                return p
    raise SystemExit(f'no master found for {hid} in assets/media/')


def steps_for(w):
    """Ladder clipped to the master, plus the master's own width when it falls
    between two rungs, so the top step is always native rather than an upscale."""
    out = [(sw, cap) for sw, cap in STEPS if sw <= w]
    top = min(w, STEPS[-1][0])
    if not out or out[-1][0] < top:
        out.append((top, int(150 * 1024 * (top / 1440) ** 2)))
    return out

BEGIN_F, END_F = '<!-- BEGIN hero-frames (generated) -->', '<!-- END hero-frames -->'
BEGIN_D, END_D = '<!-- BEGIN hero-dots (generated) -->', '<!-- END hero-dots -->'


def encode_images(man):
    from PIL import Image
    os.makedirs(OUTDIR, exist_ok=True)
    for e in man:
        src = find_master(e['id'])
        master = Image.open(src).convert('RGB')
        e['_w'], e['_h'] = master.size
        for w, cap in steps_for(master.width):
            im = master.resize((w, round(master.height * w / master.width)), Image.LANCZOS)
            for fmt, ext, qhi, qlo in FMTS:
                p = os.path.join(OUTDIR, f"{e['id']}-{w}.{ext}")
                q = qhi
                while True:
                    if fmt == 'jpeg':
                        im.save(p, 'JPEG', quality=q, optimize=True, progressive=True, subsampling='4:2:0')
                    elif fmt == 'webp':
                        im.save(p, 'WEBP', quality=q, method=6)
                    else:
                        im.save(p, 'AVIF', quality=q, speed=4)
                    if os.path.getsize(p) <= cap or q <= qlo:
                        break
                    q -= 3
                print(f"  {os.path.basename(p):34s} q={q:3d} {os.path.getsize(p)/1024:6.1f} KB")


def srcset(e, ext):
    pad = '\n' + ' ' * 24
    return (',' + pad).join(
        f"assets/media/hero/{e['id']}-{w}.{ext} {w}w" for w, _ in steps_for(e['_w']))


def frames_block(live):
    o = io.StringIO(); w = o.write
    for i, e in enumerate(live):
        hid, alt = e['id'], html.escape(e['alt'], quote=True)
        first = (i == 0)
        d = '' if first else 'data-'
        # scrim / reach / pos are STAMPED on every frame, not fetched at
        # runtime: over file:// the fetch is blocked outright, and a hero that
        # only gets its density when served over HTTP is a hero that is wrong
        # every time someone opens the file to look at it.
        w(f'      <picture class="hero-frame{" is-on" if first else ""}" data-hero="{hid}"'
          f' data-scrim="{e["scrim"]}" data-reach="{e.get("reach", 1)}"'
          f'{"" if first else " aria-hidden=\"true\""}>\n')
        for ext in ('avif', 'webp'):
            w(f'        <source type="image/{ext}" sizes="100vw"\n')
            w(f'                {d}srcset="{srcset(e, ext)}">\n')
        w(f'        <img class="hero-img" alt="{alt}"\n')
        # Real intrinsic size, per image: the masters are no longer one shape.
        w(f'             width="{e["_w"]}" height="{e["_h"]}" sizes="100vw"\n')
        w(f'             style="--hero-pos: {e["pos"]}"\n')
        w(f'             {d}src="assets/media/hero/{hid}-1440.jpg"\n')
        w(f'             {d}srcset="{srcset(e, "jpg")}"\n')
        w('             fetchpriority="high" loading="eager" decoding="async">\n' if first
          else '             decoding="async">\n')
        w('      </picture>\n')
    return o.getvalue().rstrip('\n')


def dots_block(live):
    n = len(live)
    o = io.StringIO()
    for i in range(n):
        on = ' is-on' if i == 0 else ''
        cur = ' aria-current="true"' if i == 0 else ''
        o.write(f'        <button class="hero-dot{on}" type="button" data-go="{i}"{cur} '
                f'aria-label="Show image {i+1} of {n}"></button>\n')
    return o.getvalue().rstrip('\n')


def splice(src, begin, end, body):
    a, b = src.index(begin), src.index(end)
    return src[:a + len(begin)] + '\n' + body + '\n' + src[b - len(' ' * 6):b] + src[b:]


def main():
    man = json.load(open(MANIFEST))
    from PIL import Image
    for e in man:
        with Image.open(find_master(e['id'])) as im:
            e['_w'], e['_h'] = im.size
    live = [e for e in man if e.get('usable', True)]
    dropped = [e for e in man if not e.get('usable', True)]
    if not live:
        sys.exit('every image is marked unusable — nothing to build')

    if '--images' in sys.argv:
        print('encoding derivatives...')
        encode_images(live)

    src = open(INDEX).read()
    for begin, end, body, pad in ((BEGIN_F, END_F, frames_block(live), ' ' * 6),
                                  (BEGIN_D, END_D, dots_block(live), ' ' * 8)):
        a, b = src.index(begin) + len(begin), src.index(end)
        src = src[:a] + '\n' + body + '\n' + pad + src[b:]

    # The scrim's opening value belongs to frame 1 and must be inline for the
    # same reason its crop is: no flash of the wrong density before hero.js.
    src = re.sub(r'(<div class="hero-scrim" aria-hidden="true")[^>]*>',
                 rf'\1 style="--scrim: {live[0]["scrim"]}; '
                 rf'--scrim-reach: {live[0].get("reach", 1)}">', src, count=1)

    open(INDEX, 'w').write(src)
    print(f'index.html stamped: {len(live)} frames, {len(live)} dots')
    for e in live:
        print(f'   {e["id"]:22s} scrim {e["scrim"]:.2f}  reach {e.get("reach",1):.1f}  pos {e["pos"]}')
    for e in dropped:
        print(f'  DROPPED {e["id"]}: {e.get("note","(usable:false)")[:80]}...')


if __name__ == '__main__':
    main()
