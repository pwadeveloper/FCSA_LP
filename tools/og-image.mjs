/* ==========================================================================
   Regenerate the Open Graph card from the live hero.

       python3 tools/serve.py 8123      # or the dev-api server on 3000
       node tools/og-image.mjs [url]

   It is a SCREENSHOT OF THE REAL PAGE, not a hand-drawn card, so it cannot
   drift from the site: change the headline or the mark and re-run this, and
   the card is right again.

   Two deliberate interventions, both of which look like bugs if you remove
   them without knowing why:

   1. THE CAROUSEL IS PINNED TO FRAME 1 (the portrait). Whichever frame
      happens to be up when the shot fires is a coin toss, and the landscape
      frames turn to mush at the ~500px a timeline preview actually renders.
      A face survives that. Clicking the dot starts a ~900ms crossfade, so the
      script waits it out — screenshot too early and you capture the outgoing
      frame, which is how this first produced a hilltop labelled "index 0".

   2. THE PARTNER STRIP IS HIDDEN. At 1200x630 the cut lands halfway through
      the logo row, and a row of half-logos reads as a broken image.

   Requires the gstack browse daemon; falls back to telling you so.
   ========================================================================== */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { homedir } from 'node:os';

const URL_ = process.argv[2] || 'http://localhost:3000/';
const B = join(homedir(), '.claude/skills/gstack/browse/dist/browse');
if (!existsSync(B)) {
  console.error('gstack browse not found at', B);
  process.exit(1);
}
const tmp = join(mkdtempSync(join(tmpdir(), 'og-')), 'og.png');
const run = (...a) => execFileSync(B, a, { encoding: 'utf8' });

run('viewport', '1200x630');
run('goto', URL_);
run('js', `(function(){
  var p = document.querySelector('.partners'); if (p) p.style.visibility = 'hidden';
  var d = document.querySelectorAll('.hero-dot'); if (d[0]) d[0].click();
  return 'pinned';
})()`);
/* wait out the crossfade — see note 1 */
for (let i = 0; i < 14; i++) run('js', '1');
run('screenshot', '--clip', '0,0,1200,630', tmp);

const { execFileSync: ex } = await import('node:child_process');
ex('python3', ['-c', `
from PIL import Image
import os
im = Image.open(${JSON.stringify(tmp)}).convert('RGB')
assert im.size == (1200, 630), im.size
q = 88
while True:
    im.save('assets/og-image.jpg', 'JPEG', quality=q, optimize=True,
            progressive=True, subsampling='4:2:0')
    if os.path.getsize('assets/og-image.jpg') <= 200*1024 or q <= 70: break
    q -= 4
print('assets/og-image.jpg  q=%d  %.0f KB' % (q, os.path.getsize('assets/og-image.jpg')/1024))
`], { stdio: 'inherit' });
