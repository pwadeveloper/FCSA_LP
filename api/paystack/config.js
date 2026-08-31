/* GET /api/paystack/config
   What the page is allowed to know: the public key, the price, and whether the
   whole thing is switched on yet.

   THE PRICE IS SERVED FROM HERE rather than written into index.html so that
   the number on the page and the number charged come from the SAME
   environment variable. Hard-coding it in the markup gives you two sources of
   truth that drift, and the failure mode is a page advertising one figure
   while the card is debited another. */
import { config, configProblem, json } from '../_paystack.js';

export const runtime = 'edge';

export default async function handler(request) {
  if (request.method !== 'GET') return json({ error: 'Use GET.' }, 405);

  const c = config();
  const problem = configProblem(c);

  return json({
    /* configured:false is the page's cue to disable the button and say so.
       It is not an error — before a price exists this is the correct state. */
    configured: !problem,
    reason: problem,
    /* pk_ only. The secret key is not in this object and must never be. */
    publicKey: c.hasKeys ? c.publicKey : null,
    amountKobo: c.amountKobo,
    currency: c.currency,
    live: c.live,
  });
}
