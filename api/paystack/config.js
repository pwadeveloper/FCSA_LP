/* GET /api/paystack/config
   What the page is allowed to know: the public key and the figures.

   EVERY FIGURE ON THE PAY SECTION COMES FROM HERE rather than being written
   into index.html, so the price shown and the price charged read one
   environment variable and cannot drift. The deposit and balance are derived
   from the total (see api/_paystack.js) so they cannot drift from each other
   either — they are display-only, since the instalment route is a bank
   transfer and nothing charges them. */
import { settings, configProblem, json } from '../_paystack.js';

/* THE NAME MATTERS. Vercel Functions in /api read the Edge runtime off
   `export const config = { runtime: 'edge' }`. `export const runtime = 'edge'`
   is the Next.js App Router form and Vercel ignores it here — it then builds
   this as a NODE function, calls handler(req, res), and the Response object
   returned below goes nowhere. Nothing is ever written to res, so the request
   HANGS until the gateway times out. That is not a 500 you can see in a log;
   it is a fetch in the browser that never settles, which left the whole pay
   section stuck behind its `hidden` attribute in production. */
export const config = { runtime: 'edge' };

export default async function handler(request) {
  if (request.method !== 'GET') return json({ error: 'Use GET.' }, 405);

  const c = settings();
  const problem = configProblem(c);

  return json({
    configured: !problem,
    reason: problem,
    publicKey: c.hasKeys ? c.publicKey : null,   // pk_ only, never sk_
    currency: c.currency,
    live: c.live,
    totalKobo: c.totalKobo,
    depositKobo: c.depositKobo,
    balanceKobo: c.balanceKobo,
    depositPercent: c.depositPercent,
  });
}
