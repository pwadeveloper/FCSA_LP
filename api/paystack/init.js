/* POST /api/paystack/init
   Starts a card transaction for the FULL tuition and hands the browser an
   access_code.

   Card checkout is the pay-in-full route only. Instalments are paid by bank
   transfer and recorded through a Tally form, so there is no balance to look
   up here and nothing that varies per payer: this endpoint charges the same
   amount every time.

   THE CLIENT STILL DOES NOT GET TO SAY WHAT THAT AMOUNT IS. It is read from
   the server's environment and any amount, price or total in the request body
   is ignored. Send the figure from the browser and someone opens devtools,
   changes 20000000 to 100, and buys a term of film school for one naira;
   Paystack charges exactly what it is told.

   The REFERENCE is generated here too, because a client-chosen one lets
   somebody replay a reference they have already seen verified. */
import { settings, configProblem, json, paystack, emailLooksReal, clean } from '../_paystack.js';

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
  const problem = configProblem(c);
  if (problem) return json({ error: problem }, 503);

  let body;
  try { body = await request.json(); } catch { return json({ error: 'Expected a JSON body.' }, 400); }

  const email = clean(body && body.email, 254).toLowerCase();
  if (!emailLooksReal(email)) {
    return json({ error: 'A valid email address is required — the receipt goes there.' }, 400);
  }

  const reference = `fcsa_full_${Date.now().toString(36)}_${crypto.randomUUID().slice(0, 8)}`;

  const res = await paystack('/transaction/initialize', {
    method: 'POST',
    secret: c.secret,
    body: {
      email,
      amount: c.totalKobo,          // server-owned, kobo, integer
      currency: c.currency,
      reference,
      /* Labels, so a payment can be matched to a person in the Paystack
         dashboard without any database of our own. Nothing here is trusted
         for authorisation — it travels through Paystack and comes back as
         data, not as proof. */
      metadata: {
        name: clean(body && body.name),
        phone: clean(body && body.phone, 32),
        track: clean(body && body.track, 60),
        plan: 'full',
        custom_fields: [
          { display_name: 'Name', variable_name: 'name', value: clean(body && body.name) },
          { display_name: 'Track', variable_name: 'track', value: clean(body && body.track, 60) },
        ],
      },
    },
  });

  if (!res.ok) return json({ error: res.message }, 502);

  return json({ accessCode: res.data.access_code, reference: res.data.reference });
}
