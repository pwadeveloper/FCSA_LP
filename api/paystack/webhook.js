/* POST /api/paystack/webhook
   Paystack tells the server what happened, out of band.

   OPTIONAL NOW, AND WORTH SAYING WHY. With no database, the Paystack
   dashboard is the record of every card payment — this endpoint does not
   write anything the dashboard does not already hold. What it gives you is a
   line in the function log at the moment money moves, including for the
   payers whose browser died before it could call verify. That is the case the
   dashboard makes you go looking for and this makes you trip over.

   Leave the webhook URL unset in the Paystack dashboard and nothing breaks.
   If you set it (Settings -> API Keys & Webhooks):
       https://YOUR-DOMAIN/api/paystack/webhook

   VERIFY THE SIGNATURE FIRST, always. This URL is public and
   unauthenticated — anyone can POST {"event":"charge.success"} at it. The
   HMAC is the only thing between a real Paystack event and a stranger with
   curl. That matters even though nothing here grants anything: a forged
   "payment" in your log is a forged payment in your reconciliation. */
import { settings, json, signatureValid } from '../_paystack.js';

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
  if (request.method !== 'POST') return json({ error: 'Use POST.' }, 405);

  const c = settings();
  if (!c.hasKeys) return json({ error: 'Not configured.' }, 503);

  /* The RAW bytes — see the note at the top of api/_paystack.js for why these
     are Edge functions at all. */
  const raw = await request.text();
  const ok = await signatureValid(raw, request.headers.get('x-paystack-signature'), c.secret);
  if (!ok) return json({ error: 'Bad signature.' }, 401);   // no detail: a forger would use it

  let event;
  try { event = JSON.parse(raw); } catch { return json({ error: 'Bad JSON.' }, 400); }

  if (event.event === 'charge.success') {
    const d = event.data || {};
    const meta = d.metadata || {};
    console.log('[paystack] charge.success', {
      reference: d.reference,
      amountKobo: d.amount,
      currency: d.currency,
      email: d.customer && d.customer.email,
      name: meta.name,
      track: meta.track,
      /* false means a successful charge that was NOT the full tuition — a
         genuine event that still needs a human to look at it. */
      fullTuition: d.amount === c.totalKobo,
      paidAt: d.paid_at,
    });
  }

  /* 200 for every signed event, handled or not. A non-200 tells Paystack
     delivery failed and puts the event into retry. */
  return json({ received: true });
}
