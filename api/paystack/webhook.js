/* POST /api/paystack/webhook
   Paystack tells the server what happened, out of band. THIS is the record to
   trust, not the browser.

   Why it exists when verify.js already checks: the callback path only runs if
   the payer's browser survives long enough to run it. Cards get charged and
   then the phone dies, the tab closes, the tunnel eats the request. The
   webhook arrives regardless, and Paystack retries it. Any money that has
   moved shows up here even when nobody was watching.

   Set the URL in the dashboard (Settings -> API Keys & Webhooks):
       https://YOUR-DOMAIN/api/paystack/webhook

   TWO RULES ABOUT THIS ENDPOINT:

   1. VERIFY THE SIGNATURE FIRST. This URL is public and unauthenticated —
      anyone can POST {"event":"charge.success"} at it. The HMAC is the only
      thing separating a real Paystack event from a stranger with curl who
      wants a free place in the school.

   2. ANSWER 200 FAST. Paystack expects an immediate 200 and treats a slow or
      failing response as a delivery failure, then retries. Do the slow work
      (email, spreadsheet, database) after responding, or from a queue. */
import { config, json, signatureValid } from '../_paystack.js';

export const runtime = 'edge';

export default async function handler(request) {
  if (request.method !== 'POST') return json({ error: 'Use POST.' }, 405);

  const c = config();
  if (!c.hasKeys) return json({ error: 'Not configured.' }, 503);

  /* The RAW bytes. Do not parse before this line and do not re-serialise to
     get them back — see the note at the top of api/_paystack.js. */
  const raw = await request.text();
  const ok = await signatureValid(raw, request.headers.get('x-paystack-signature'), c.secret);

  /* 401 and nothing else. No detail about why it failed: a forger would use
     it. */
  if (!ok) return json({ error: 'Bad signature.' }, 401);

  let event;
  try { event = JSON.parse(raw); } catch { return json({ error: 'Bad JSON.' }, 400); }

  if (event.event === 'charge.success') {
    const d = event.data || {};
    /* The same three checks verify.js makes. A signed event still has to be
       the RIGHT payment — a genuine ₦100 charge on this account is genuinely
       signed and is still not tuition. */
    const full =
      d.amount === c.amountKobo &&
      String(d.currency).toUpperCase() === c.currency;

    /* ---------------------------------------------------------------
       WHERE YOUR FULFILMENT GOES.

       Right now this only records the event in the function log, which is
       enough to reconcile by hand against the Paystack dashboard but is NOT
       a system of record — Vercel logs roll off.

       Before taking real money, make this write somewhere durable and make it
       IDEMPOTENT on d.reference. Paystack retries on any non-200, so the same
       charge.success will arrive more than once, and a handler that emails a
       receipt or allocates a seat per delivery will do it repeatedly.
       --------------------------------------------------------------- */
    console.log('[paystack] charge.success', {
      reference: d.reference,
      amountKobo: d.amount,
      currency: d.currency,
      email: d.customer && d.customer.email,
      fullAmount: full,
      paidAt: d.paid_at,
    });
  }

  /* 200 for every signed event, including ones not handled above. A non-200
     tells Paystack delivery failed and puts the event into retry. */
  return json({ received: true });
}
