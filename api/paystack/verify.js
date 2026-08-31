/* GET /api/paystack/verify?reference=…
   Asks Paystack what actually happened. The ONLY thing allowed to tell the
   page a payment succeeded.

   The browser's onSuccess is not evidence — it runs on the payer's machine
   and can be called by hand from a console. Paystack's own docs say the same:
   never deliver value on the client callback alone.

   WHAT "CORRECT" MEANS WITH TWO PLANS. It is no longer "did they pay the
   total". A ₦140,000 charge is exactly right for a deposit and wrong for
   anything else, so the amount is checked against the AMOUNT THAT
   TRANSACTION WAS CREATED FOR, which Paystack echoes back in metadata.
   Checking against the total instead would reject every legitimate deposit.

   This endpoint reads and reports. It does NOT write the payment record —
   the webhook does, because this only runs if the payer's browser survived. */
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
  const meta = d.metadata || {};
  const purpose = meta.purpose || 'full';

  /* What this particular transaction was supposed to collect. */
  const expected =
    purpose === 'deposit' ? c.depositKobo :
    purpose === 'balance' ? d.amount :        // a balance is whatever remained at init
    c.totalKobo;

  const paid =
    d.status === 'success' &&
    d.amount === expected &&
    String(d.currency).toUpperCase() === c.currency;

  /* After a balance is settled there is nothing left; after a deposit there
     is. Drives the wording the page shows, not any decision. */
  const remaining = purpose === 'deposit' && paid ? c.balanceKobo : 0;

  return json({
    paid,
    status: d.status,
    reference: d.reference,
    amountKobo: d.amount,
    currency: d.currency,
    purpose,
    remainingKobo: remaining,
    totalKobo: c.totalKobo,
    paidAt: d.paid_at || null,
    mismatch: paid
      ? null
      : d.status !== 'success'
        ? `Paystack reports this transaction as "${d.status}".`
        : d.amount !== expected
          ? `Paid ${d.amount} kobo, expected ${expected}.`
          : `Paid in ${d.currency}, expected ${c.currency}.`,
  });
}
