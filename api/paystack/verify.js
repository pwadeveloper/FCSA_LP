/* GET /api/paystack/verify?reference=…
   Asks Paystack what actually happened. The ONLY thing allowed to tell the
   page a payment succeeded.

   The browser's onSuccess is not evidence — it runs on the payer's machine
   and can be called by hand from a console. Paystack's own docs say the same:
   never deliver value on the client callback alone.

   Three things are checked, not one, because a transaction can be genuinely
   "successful" and still be the wrong payment: status, amount, and currency.
   Card checkout only ever collects the full tuition, so the expected amount
   is simply the total. */
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

  const res = await paystack(`/transaction/verify/${encodeURIComponent(reference)}`, { secret: c.secret });
  if (!res.ok) return json({ paid: false, error: res.message }, 502);

  const d = res.data;
  const paid =
    d.status === 'success' &&
    d.amount === c.totalKobo &&
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
        : d.amount !== c.totalKobo
          ? `Paid ${d.amount} kobo, expected ${c.totalKobo}.`
          : `Paid in ${d.currency}, expected ${c.currency}.`,
  });
}
