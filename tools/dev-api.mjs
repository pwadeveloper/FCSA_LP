/* ==========================================================================
   Local dev server WITH the api/ functions.

       python3 tools/serve.py 8123          # terminal 1 — the static page
       node tools/dev-api.mjs 3000          # terminal 2 — this
       open http://localhost:3000

   tools/serve.py alone cannot run the payment endpoints — it is a static file
   server, so /api/paystack/config 404s and the pay section correctly reports
   itself unavailable. That is honest but it means the flow cannot be tested
   without deploying, which is a bad way to work on something that moves money.

   So this process owns /api/* and PROXIES everything else to serve.py. It
   proxies rather than serving files itself because serve.py answers HTTP Range
   requests and the stock library server does not — see the long note at the
   top of that file. Reimplementing it here would have quietly broken video
   scrubbing in local testing only.

   The handlers are imported unchanged. They are Edge-runtime modules, which
   means standard Request/Response and Web Crypto, and Node has had all of
   those since 18 — so what runs here is the same code Vercel runs, not a
   reimplementation of it.

   Reads .env.local. Never commit that file.
   ========================================================================== */
import { createServer } from 'node:http';
import { readFileSync, existsSync } from 'node:fs';

const API_PORT = Number(process.argv[2] || 3000);
const STATIC = process.env.STATIC_ORIGIN || 'http://localhost:8123';

/* ---- .env.local ---- */
if (existsSync('.env.local')) {
  for (const line of readFileSync('.env.local', 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    /* A variable already in the environment WINS over the file, which is how
       dotenv behaves everywhere else and is what lets you override one value
       for a single run:  PAYSTACK_AMOUNT_KOBO=50000000 node tools/dev-api.mjs */
    if (m && !line.trim().startsWith('#') && process.env[m[1]] === undefined) {
      process.env[m[1]] = m[2].trim();
    }
  }
  console.log('  loaded .env.local');
} else {
  console.log('  no .env.local — endpoints will report themselves unconfigured');
}

const routes = {
  '/api/paystack/config':  (await import('../api/paystack/config.js')).default,
  '/api/paystack/init':    (await import('../api/paystack/init.js')).default,
  '/api/paystack/verify':  (await import('../api/paystack/verify.js')).default,
  '/api/paystack/webhook': (await import('../api/paystack/webhook.js')).default,
};

createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${API_PORT}`);
  const handler = routes[url.pathname];

  if (handler) {
    /* Buffer the body and hand the handler a real Request, exactly as the Edge
       runtime would. The webhook needs the untouched bytes, so nothing here
       parses or re-serialises. */
    const chunks = [];
    for await (const c of req) chunks.push(c);
    const body = chunks.length ? Buffer.concat(chunks) : undefined;

    let out;
    try {
      out = await handler(new Request(url, {
        method: req.method,
        headers: req.headers,
        body: ['GET', 'HEAD'].includes(req.method) ? undefined : body,
      }));
    } catch (err) {
      console.error(`  500 ${req.method} ${url.pathname}`, err.message);
      res.writeHead(500, { 'content-type': 'application/json' });
      return res.end(JSON.stringify({ error: 'Handler threw. See the server log.' }));
    }

    const text = await out.text();
    console.log(`  ${out.status} ${req.method} ${url.pathname}`);
    res.writeHead(out.status, Object.fromEntries(out.headers));
    return res.end(text);
  }

  /* everything else -> serve.py */
  try {
    const upstream = await fetch(STATIC + req.url, {
      method: req.method,
      headers: { ...req.headers, host: new URL(STATIC).host },
      body: ['GET', 'HEAD'].includes(req.method) ? undefined : req,
      duplex: 'half',
      redirect: 'manual',
    });
    res.writeHead(upstream.status, Object.fromEntries(upstream.headers));
    res.end(Buffer.from(await upstream.arrayBuffer()));
  } catch {
    res.writeHead(502, { 'content-type': 'text/plain' });
    res.end(`Cannot reach the static server at ${STATIC}.\nStart it first:  python3 tools/serve.py 8123\n`);
  }
}).listen(API_PORT, () => {
  console.log(`\n  api    http://localhost:${API_PORT}/api/paystack/*`);
  console.log(`  static proxied from ${STATIC}`);
  console.log(`\n  open   http://localhost:${API_PORT}/#pay\n`);
});
