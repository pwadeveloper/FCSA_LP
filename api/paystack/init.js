/* POST /api/paystack/init
   Starts a transaction and hands the browser an access_code.

   THE CLIENT DOES NOT GET TO SAY WHAT THINGS COST. It sends a PLAN — "full"
   or "split" — and never an amount. The server maps that to money from its
   own environment and ignores any amount, price or total in the body. Send
   the figure from the browser and someone opens devtools, changes 20000000 to
   100, and buys a term of film school for one naira; Paystack charges exactly
   what it is told.

   THE SERVER ALSO DECIDES WHAT STAGE YOU ARE AT. It looks up what this email
   has already paid and charges the difference, so a student coming back for
   their balance is charged ₦60,000 automatically — same form, same email, no
   second "pay balance" button to get wrong, and no way to re-pick "70% now"
   when 70% is already behind them.

   And the REFERENCE is generated here, because a client-chosen one lets
   somebody replay a reference they have already seen verified. */
import { config, configProblem, json, paystack, emailLooksReal, clean, owed } from '../_paystack.js';
import { storeConfig, paidSoFar, normaliseEmail } from '../_store.js';

export const runtime = 'edge';

export default async function handler(request) {
  if (request.method !== 'POST') return json({ error: 'Use POST.' }, 405);

  const c = config();
  const problem = configProblem(c);
  if (problem) return json({ error: problem }, 503);

  let body;
  try { body = await request.json(); } catch { return json({ error: 'Expected a JSON body.' }, 400); }

  const email = normaliseEmail(clean(body && body.email, 254));
  if (!emailLooksReal(email)) {
    return json({ error: 'A valid email address is required — the receipt goes there.' }, 400);
  }

  const store = storeConfig();
  const wantsSplit = (body && body.plan) === 'split';
  if (wantsSplit && !store.enabled) {
    return json({ error: 'The instalment plan is unavailable right now. Please pay in full.' }, 503);
  }

  /* How much has this address paid already? A store that is down must NOT
     silently fall through to "nothing paid" — that would charge a returning
     student the full ₦200,000 again on top of their deposit. Refuse instead. */
  let paid = 0;
  if (store.enabled) {
    try {
      paid = await paidSoFar(email);
    } catch (e) {
      return json({ error: 'Could not check your payment history. Please try again shortly.' }, 503);
    }
  }

  const due = owed({ paidKobo: paid, plan: wantsSplit ? 'split' : 'full', cfg: c });
  if (due.done) {
    return json({ error: 'Our records show this email has already paid in full.', paidInFull: true }, 409);
  }

  const reference = `fcsa_${due.purpose}_${Date.now().toString(36)}_${crypto.randomUUID().slice(0, 8)}`;

  const res = await paystack('/transaction/initialize', {
    method: 'POST',
    secret: c.secret,
    body: {
      email,
      amount: due.amountKobo,        // server-owned, kobo, integer
      currency: c.currency,
      reference,
      /* Echoed back on verify and on the webhook, so the webhook can record
         the plan and purpose without a second lookup. Labels only — nothing
         here is trusted for authorisation, because metadata travels through
         Paystack and comes back as data, not as proof. */
      metadata: {
        name: clean(body && body.name),
        phone: clean(body && body.phone, 32),
        track: clean(body && body.track, 60),
        plan: wantsSplit ? 'split' : 'full',
        purpose: due.purpose,                 // 'full' | 'deposit' | 'balance'
        expected_total_kobo: c.totalKobo,
        custom_fields: [
          { display_name: 'Name', variable_name: 'name', value: clean(body && body.name) },
          { display_name: 'Track', variable_name: 'track', value: clean(body && body.track, 60) },
          { display_name: 'Paying', variable_name: 'purpose', value: due.purpose },
        ],
      },
    },
  });

  if (!res.ok) return json({ error: res.message }, 502);

  return json({
    accessCode: res.data.access_code,
    reference: res.data.reference,
    /* Returned so the page can say what is about to be charged BEFORE the
       modal opens — it differs from the headline price for anyone paying a
       balance, and a figure appearing in Paystack's window that the page never
       mentioned reads like a mistake. */
    amountKobo: due.amountKobo,
    purpose: due.purpose,
    alreadyPaidKobo: paid,
  });
}
