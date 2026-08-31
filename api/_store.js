/* ==========================================================================
   THE PAYMENT RECORD — Supabase (Postgres) over its REST API.

   WHY SUPABASE AND NOT A POSTGRES DRIVER: these are Edge functions. A normal
   Postgres client opens a TCP socket, and the Edge runtime has no raw TCP —
   pg, postgres.js and friends simply do not run there. Supabase exposes the
   database over HTTPS (PostgREST), so it is a plain fetch, exactly like the
   calls to Paystack. Nothing to install, and it keeps this repo at zero
   dependencies.

   WHY A RECORD IS NOT OPTIONAL: the 70/30 plan cannot exist without one.
   "You paid ₦140,000 and owe ₦60,000" is a fact that has to survive the
   browser closing, and Paystack alone will not tell you it — it knows about
   transactions, not about who has finished paying. So when this is not
   configured the split plan is not offered at all (see api/paystack/config.js)
   rather than offered and quietly unable to track the balance.

   THE SERVICE ROLE KEY BYPASSES ROW LEVEL SECURITY. It is as sensitive as the
   Paystack secret: server only, never in the browser, never in git. The
   `anon` key is the public one and is NOT used here — nothing in the browser
   talks to the database at all, it only ever talks to these functions.
   ========================================================================== */

export function storeConfig() {
  const url = (process.env.SUPABASE_URL || '').trim().replace(/\/+$/, '');
  const key = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
  return { url, key, enabled: Boolean(url && key) };
}

async function rest(path, { method = 'GET', body, prefer } = {}) {
  const { url, key } = storeConfig();
  const res = await fetch(`${url}/rest/v1/${path}`, {
    method,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'content-type': 'application/json',
      ...(prefer ? { Prefer: prefer } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { /* not JSON */ }
  if (!res.ok) {
    /* Surface Postgres's own message — it names the column or constraint,
       which is what makes a schema mistake fixable. It contains no key. */
    throw new Error((data && (data.message || data.hint)) || `Supabase ${res.status}`);
  }
  return data;
}

/* One spelling of an address, everywhere. Someone who pays their deposit as
   "Ada@Example.com " and comes back as "ada@example.com" is the same student,
   and without this they would be charged the deposit twice and told they
   still owe a balance on an account they never had. */
export function normaliseEmail(v) {
  return String(v || '').trim().toLowerCase();
}

/* What this address has successfully paid, in kobo.

   Rows, not a SQL aggregate: PostgREST needs a view or an RPC to do SUM, and
   a student has one or two payment rows. Summing two integers in JS is not
   the bottleneck, and it keeps the schema to one table anyone can read. */
export async function paidSoFar(email) {
  const rows = await rest(
    `payments?email=eq.${encodeURIComponent(normaliseEmail(email))}` +
    `&status=eq.success&select=amount_kobo`
  );
  return (rows || []).reduce((sum, r) => sum + (r.amount_kobo | 0), 0);
}

/* Write a successful payment.

   IDEMPOTENT ON `reference`, which is the whole reason this is safe to call
   from the webhook. Paystack retries delivery on any non-200, so the same
   charge.success arrives repeatedly; without the unique constraint plus
   ignore-duplicates, one payment would be counted three or four times and the
   student would be recorded as having overpaid.

   `expected_total_kobo` is stored on the row rather than looked up later, so
   next year's price change does not retroactively rewrite what this cohort
   owed. */
export async function recordPayment(p) {
  return rest('payments', {
    method: 'POST',
    prefer: 'resolution=ignore-duplicates,return=representation',
    body: [{
      reference: p.reference,
      email: normaliseEmail(p.email),
      name: p.name || null,
      phone: p.phone || null,
      track: p.track || null,
      plan: p.plan || null,
      purpose: p.purpose,
      amount_kobo: p.amountKobo,
      expected_total_kobo: p.expectedTotalKobo,
      currency: p.currency,
      status: p.status,
      paid_at: p.paidAt || null,
    }],
  });
}

/* Has this reference already been written? Used by the webhook to decide
   whether to send the "we got your money" email, so a Paystack retry does not
   email the same person four times. The row write is idempotent on its own;
   the EMAIL is the side effect that needs this check. */
export async function alreadyRecorded(reference) {
  const rows = await rest(
    `payments?reference=eq.${encodeURIComponent(reference)}&select=reference&limit=1`
  );
  return Array.isArray(rows) && rows.length > 0;
}
