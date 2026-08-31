/* GET /api/paystack/config
   What the page is allowed to know: the public key and the figures.

   EVERY FIGURE ON THE PAY SECTION COMES FROM HERE rather than being written
   into index.html, so the price shown and the price charged read one
   environment variable and cannot drift. The deposit and balance are derived
   from the total (see api/_paystack.js) so they cannot drift from each other
   either — they are display-only, since the instalment route is a bank
   transfer and nothing charges them. */
import { config, configProblem, json } from '../_paystack.js';

export const runtime = 'edge';

export default async function handler(request) {
  if (request.method !== 'GET') return json({ error: 'Use GET.' }, 405);

  const c = config();
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
