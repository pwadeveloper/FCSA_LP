/* POST /api/paystack/init
   Starts a transaction and hands the browser an access_code to open the modal
   with.

   THE CLIENT DOES NOT GET TO SAY WHAT THINGS COST. The amount is read from the
   server's own environment and any `amount` in the request body is ignored
   outright. This is the single most important line in the integration: send
   the amount from the browser and someone will open devtools, change 500000 to
   100, and buy a term of film school for one naira. Paystack will happily
   charge whatever it is told to charge.

   For the same reason the REFERENCE is generated here. A client-chosen
   reference lets someone replay a reference they have already seen verified. */
import { config, configProblem, json, paystack, emailLooksReal, clean } from '../_paystack.js';

export const runtime = 'edge';

export default async function handler(request) {
  if (request.method !== 'POST') return json({ error: 'Use POST.' }, 405);

  const c = config();
  const problem = configProblem(c);
  if (problem) return json({ error: problem }, 503);

  let body;
  try { body = await request.json(); } catch { return json({ error: 'Expected a JSON body.' }, 400); }

  const email = clean(body && body.email, 254);
  if (!emailLooksReal(email)) {
    return json({ error: 'A valid email address is required — the receipt goes there.' }, 400);
  }

  const reference = `fcsa_${Date.now().toString(36)}_${crypto.randomUUID().slice(0, 8)}`;

  const res = await paystack('/transaction/initialize', {
    method: 'POST',
    secret: c.secret,
    body: {
      email,
      amount: c.amountKobo,          // server-owned, in kobo, integer
      currency: c.currency,
      reference,
      /* Carried through to the dashboard and echoed back on verify and on the
         webhook, so a payment can be matched to a person without a database.
         Nothing here is trusted for authorisation — it is a label. */
      metadata: {
        name: clean(body && body.name),
        phone: clean(body && body.phone, 32),
        track: clean(body && body.track, 60),
        custom_fields: [
          { display_name: 'Name', variable_name: 'name', value: clean(body && body.name) },
          { display_name: 'Track', variable_name: 'track', value: clean(body && body.track, 60) },
        ],
      },
    },
  });

  if (!res.ok) {
    /* Paystack's message describes the request, not the key, so it is safe to
       surface. The key itself never appears in any branch of this function. */
    return json({ error: res.message }, 502);
  }

  return json({
    accessCode: res.data.access_code,
    reference: res.data.reference,
  });
}
