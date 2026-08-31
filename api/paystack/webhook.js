/* POST /api/paystack/webhook
   Paystack tells the server what happened, out of band. THIS writes the
   record, and this is the thing to trust.

   Why not do it in verify.js: that only runs if the payer's browser survived
   long enough to call it. Cards get charged and then the phone dies, the tab
   closes, the tunnel eats the request. The webhook arrives regardless, and
   Paystack retries it until it gets a 200.

   Set the URL in the dashboard (Settings -> API Keys & Webhooks):
       https://YOUR-DOMAIN/api/paystack/webhook

   THREE RULES:

   1. VERIFY THE SIGNATURE FIRST. This URL is public and unauthenticated —
      anyone can POST {"event":"charge.success"} at it. The HMAC is the only
      thing between a real event and a stranger with curl who fancies a free
      place in the school.

   2. BE IDEMPOTENT. Retries mean the same charge.success arrives more than
      once. The row write is idempotent through a unique constraint on
      reference; the EMAIL is not, so it is sent only when the row was new.

   3. ANSWER 200 EVEN WHEN OUR OWN SIDE FAILED. A non-200 puts Paystack into
      retry, which is right for a transient database blip and wrong for a bad
      row that will fail forever — that one would be retried for days and then
      dropped. The money has already moved either way, so the event is
      acknowledged and the failure is logged loudly for a human. */
import { config, json, signatureValid } from '../_paystack.js';
import { storeConfig, recordPayment, alreadyRecorded, paidSoFar } from '../_store.js';
import { mailConfig, notify, depositReceivedEmail, paidInFullEmail } from '../_mail.js';

export const runtime = 'edge';

export default async function handler(request) {
  if (request.method !== 'POST') return json({ error: 'Use POST.' }, 405);

  const c = config();
  if (!c.hasKeys) return json({ error: 'Not configured.' }, 503);

  /* The RAW bytes — see the note at the top of api/_paystack.js for why these
     are Edge functions at all. */
  const raw = await request.text();
  const ok = await signatureValid(raw, request.headers.get('x-paystack-signature'), c.secret);
  if (!ok) return json({ error: 'Bad signature.' }, 401);   // no detail: a forger would use it

  let event;
  try { event = JSON.parse(raw); } catch { return json({ error: 'Bad JSON.' }, 400); }
  if (event.event !== 'charge.success') return json({ received: true, ignored: event.event });

  const d = event.data || {};
  const meta = d.metadata || {};
  const email = (d.customer && d.customer.email) || meta.email || '';
  const purpose = meta.purpose || 'full';
  const store = storeConfig();

  try {
    let isNew = true;
    if (store.enabled) {
      isNew = !(await alreadyRecorded(d.reference));
      await recordPayment({
        reference: d.reference,
        email,
        name: meta.name,
        phone: meta.phone,
        track: meta.track,
        plan: meta.plan,
        purpose,
        amountKobo: d.amount,
        expectedTotalKobo: Number(meta.expected_total_kobo) || c.totalKobo,
        currency: d.currency,
        status: d.status,
        paidAt: d.paid_at,
      });
    }

    /* Only on the first delivery, or a retry emails the same person again. */
    if (isNew && mailConfig().enabled && email) {
      /* Recomputed from the record rather than taken from this one event: it
         is the sum that decides whether they are finished, and after a
         deposit-then-balance the second event alone does not show that. */
      const paid = store.enabled ? await paidSoFar(email) : d.amount;
      const outstanding = Math.max(0, ((Number(meta.expected_total_kobo) || c.totalKobo) - paid));

      await notify(email, outstanding > 0
        ? depositReceivedEmail({ name: meta.name, paidKobo: d.amount, outstandingKobo: outstanding, reference: d.reference })
        : paidInFullEmail({ name: meta.name, totalKobo: Number(meta.expected_total_kobo) || c.totalKobo, reference: d.reference }));
    }
  } catch (err) {
    /* Loud, and still a 200. Rule 3 above. This line is the one to grep for
       when a payment shows in Paystack but not in the dashboard. */
    console.error('[paystack] POST-PAYMENT WRITE FAILED — money moved, record did not.', {
      reference: d.reference, email, amountKobo: d.amount, error: err.message,
    });
  }

  return json({ received: true });
}
