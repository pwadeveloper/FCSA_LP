/* GET /api/paystack/config
   What the page is allowed to know: the public key, the plans and their
   prices, and whether the whole thing is switched on.

   EVERY FIGURE ON THE PAY SECTION COMES FROM HERE rather than being written
   into index.html, so the number shown and the number charged read the same
   environment variable and cannot drift. The deposit and balance are derived
   from the total (see api/_paystack.js), so they cannot drift from each other
   either. */
import { config, configProblem, json } from '../_paystack.js';
import { storeConfig } from '../_store.js';

export const runtime = 'edge';

export default async function handler(request) {
  if (request.method !== 'GET') return json({ error: 'Use GET.' }, 405);

  const c = config();
  const problem = configProblem(c);
  const store = storeConfig();

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

    /* THE SPLIT PLAN IS OFFERED ONLY IF THERE IS SOMEWHERE TO RECORD IT.
       Part payment without a durable record is a promise to track something
       you have no way of tracking: the deposit arrives, the browser closes,
       and nothing anywhere knows ₦60,000 is still owed. So with no database
       configured the page shows pay-in-full only, which is honest, instead of
       a plan it cannot honour. */
    splitAvailable: !problem && store.enabled,
  });
}
