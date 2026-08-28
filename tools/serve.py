#!/usr/bin/env python3
"""
Local dev server for this page.

    python3 tools/serve.py            # http://localhost:8000
    python3 tools/serve.py 8080       # pick a port

USE THIS AND NOT `python3 -m http.server`. The stock module gets two things
wrong that this page is unusually sensitive to, and both of them cost real
debugging time before this file existed.

1. NO RANGE REQUESTS. http.server answers 200 with the whole file to every
   request, including one that asked for a byte range. WebKit will not SEEK a
   resource served that way, and a `loop` attribute is a seek back to zero on
   every cycle — so in Safari the section-2 ambient loop plays once and stops on
   its last frame, and the reel's native scrub bar does nothing. Neither is a
   fault in the page. This server answers 206 with a real Content-Range, which
   is what Vercel, Netlify, Cloudflare, nginx and GitHub Pages all do, so what
   you test locally is what ships.

   Measured on the ambient loop: at preload="metadata" a host without Range
   stalled 242ms at the loop seam, because the head of the file had been
   evicted and had to be fetched again.

2. IT LETS THE BROWSER CACHE. Chromium will hold script.js in its memory cache
   for the session and re-run the old one after you have edited it, which
   produces measurements that disagree with the file on disk. Every response
   here is no-store, so a reload is always the code you just wrote. That is
   wrong for production and correct for a dev loop.

It also fills in the MIME types the stock module does not know — .avif and
.woff2 are both served as application/octet-stream by default on some Pythons,
and a font served as octet-stream is a font the browser declines to use.

Serves the repo root regardless of where it is invoked from. localhost only:
this binds 127.0.0.1, so nothing is exposed to the network.
"""
import functools
import http.server
import mimetypes
import os
import re
import socketserver
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

for ext, mime in (
    ('.avif', 'image/avif'),
    ('.webp', 'image/webp'),
    ('.woff2', 'font/woff2'),
    ('.woff', 'font/woff'),
    ('.mp4', 'video/mp4'),
    ('.svg', 'image/svg+xml'),
    ('.webmanifest', 'application/manifest+json'),
):
    mimetypes.add_type(mime, ext)

RANGE_RE = re.compile(r'^bytes=(\d*)-(\d*)$')


class Handler(http.server.SimpleHTTPRequestHandler):
    protocol_version = 'HTTP/1.1'          # Range is pointless without keep-alive

    def end_headers(self):
        self.send_header('Accept-Ranges', 'bytes')
        self.send_header('Cache-Control', 'no-store, must-revalidate')
        super().end_headers()

    def send_head(self):
        """Serve a byte range when one is asked for, otherwise defer to the base
        class. Only single ranges are handled — multipart/byteranges is legal but
        no media element asks for it."""
        rng = self.headers.get('Range')
        if not rng:
            return super().send_head()

        path = self.translate_path(self.path)
        if os.path.isdir(path) or not os.path.isfile(path):
            return super().send_head()

        m = RANGE_RE.match(rng.strip())
        if not m:
            return super().send_head()          # malformed: ignore it, send 200

        size = os.path.getsize(path)
        first, last = m.group(1), m.group(2)
        if first == '':
            # bytes=-N  ->  the LAST n bytes. An empty suffix is malformed.
            if last == '':
                return super().send_head()
            n = min(int(last), size)
            start, end = size - n, size - 1
        else:
            start = int(first)
            end = int(last) if last else size - 1
            end = min(end, size - 1)

        if start >= size or start > end:
            self.send_response(416)
            self.send_header('Content-Range', f'bytes */{size}')
            self.send_header('Content-Length', '0')
            self.end_headers()
            return None

        f = open(path, 'rb')
        f.seek(start)
        length = end - start + 1
        self.send_response(206)
        self.send_header('Content-Type', self.guess_type(path))
        self.send_header('Content-Range', f'bytes {start}-{end}/{size}')
        self.send_header('Content-Length', str(length))
        self.end_headers()
        self._range_left = length
        return f

    def copyfile(self, source, outputfile):
        """Base copyfile drains to EOF, which would send the whole tail of the
        file after a ranged seek. Send exactly the slice that was promised in
        Content-Length, or the connection desyncs on a keep-alive socket."""
        left = getattr(self, '_range_left', None)
        if left is None:
            return super().copyfile(source, outputfile)
        del self._range_left
        while left > 0:
            chunk = source.read(min(64 * 1024, left))
            if not chunk:
                break
            outputfile.write(chunk)
            left -= len(chunk)

    def log_message(self, fmt, *args):
        code = args[1] if len(args) > 1 else ''
        if str(code).startswith(('4', '5')):     # only the failures are worth a line
            super().log_message(fmt, *args)


class Server(socketserver.ThreadingTCPServer):
    allow_reuse_address = True
    daemon_threads = True


def main():
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8000
    handler = functools.partial(Handler, directory=ROOT)
    try:
        httpd = Server(('127.0.0.1', port), handler)
    except OSError as e:
        raise SystemExit(f'port {port} is not free ({e}) — pass another, e.g. '
                         f'python3 tools/serve.py {port + 1}')
    print(f'serving {ROOT}')
    print(f'  http://localhost:{port}/            Range: yes   cache: off')
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print('\nstopped')


main()
