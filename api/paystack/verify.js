/* GET /api/paystack/verify?reference=…
   Asks Paystack what actually happened, and is the ONLY thing allowed to tell
   the page a payment succeeded.

   The browser's onSuccess callback is not evidence. It is a message from a
   machine the payer controls, and it can be fabricated by calling the
   callback by hand in a console. Paystack's own documentation says the same:
   never deliver value on the client callback alone.

   Three things are checked, not one. A transaction can be genuinely
   "successful" and still be the wrong payment:
     status   — did it actually complete
     amount   — for the full price, not a partial or a stale cheaper one
     currency — NGN, not some other currency that merely has a similar number */
import { config, configProblem, json, paystack } from '../_paystack.js';

export const runtime = 'edge';

export default async function handler(request) {
  if (request.method !== 'GET') return json({ error: 'Use GET.' }, 405);

  const c = config();
  const problem = configProblem(c);
  if (problem) return json({ error: problem }, 503);

  const reference = new URL(request.url).searchParams.get('reference');
  if (!reference || !/^[\w.=-]{1,100}$/.test(reference)) {
    return json({ error: 'A valid reference is required.' }, 400);
  }

  const res = await paystack(`/transaction/verify/${encodeURIComponent(reference)}`, {
    secret: c.secret,
  });
  if (!res.ok) return json({ paid: false, error: res.message }, 502);

  const d = res.data;
  const paid =
    d.status === 'success' &&
    d.amount === c.amountKobo &&
    String(d.currency).toUpperCase() === c.currency;

  return json({
    paid,
    status: d.status,
    reference: d.reference,
    amountKobo: d.amount,
    currency: d.currency,
    paidAt: d.paid_at || null,
    /* Says WHICH check failed, so a support conversation does not start from
       "it says it didn't work". */
    mismatch: paid
      ? null
      : d.status !== 'success'
        ? `Paystack reports this transaction as "${d.status}".`
        : d.amount !== c.amountKobo
          ? `Paid ${d.amount} kobo, expected ${c.amountKobo}.`
          : `Paid in ${d.currency}, expected ${c.currency}.`,
  });
}
