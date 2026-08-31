/* ==========================================================================
   PAYSTACK — shared server helpers.

   Underscore-prefixed so Vercel does NOT route it as a function. It is a
   module the four handlers in api/paystack/ import.

   EVERY FUNCTION HERE RUNS ON THE EDGE RUNTIME, for one reason: the webhook
   has to HMAC the EXACT bytes Paystack signed. Vercel's Node runtime hands you
   a parsed req.body and re-serialising it with JSON.stringify is not
   byte-identical — key order and whitespace can differ, the HMAC then differs,
   and every webhook gets rejected. The Edge runtime hands you a standard
   Request, so `await request.text()` is the raw body, unmodified. Web Crypto
   covers HMAC SHA-512 there too, so nothing needs installing.
   ========================================================================== */

export const PAYSTACK_API = 'https://api.paystack.co';

/* ---------- configuration ----------
   Read at call time, never at module load: on Vercel a missing variable added
   later should start working on the next request, not require a redeploy to
   be noticed. */
export function config() {
  const secret = (process.env.PAYSTACK_SECRET_KEY || '').trim();
  const publicKey = (process.env.PAYSTACK_PUBLIC_KEY || '').trim();
  const raw = (process.env.PAYSTACK_TUITION_KOBO || '').trim();
  const currency = (process.env.PAYSTACK_CURRENCY || 'NGN').trim().toUpperCase();
  const pctRaw = (process.env.PAYSTACK_DEPOSIT_PERCENT || '70').trim();

  /* Kobo, and an INTEGER. Paystack rejects fractional amounts outright, and a
     float here would come back from their API as a different number than the
     one compared against on verify, which reads as "amount mismatch" on a
     payment that was actually correct. */
  const tuitionKobo = /^\d+$/.test(raw) ? parseInt(raw, 10) : null;
  const total = tuitionKobo && tuitionKobo > 0 ? tuitionKobo : null;

  /* THE DEPOSIT IS DERIVED, NEVER CONFIGURED SEPARATELY, and the balance is
     the subtraction rather than the other percentage. Two independently
     entered figures are two figures that can be edited apart, and the failure
     mode is silent: 70% + 30% of a number nobody re-checked leaves a student
     owing 1 kobo forever, or paying 1 kobo too much, and the "have they
     finished paying" comparison never comes out clean.
     deposit + balance === total is arithmetic here, not a convention. */
  const pct = /^\d{1,2}$/.test(pctRaw) ? parseInt(pctRaw, 10) : 70;
  const depositKobo = total ? Math.round((total * pct) / 100) : null;
  const balanceKobo = total ? total - depositKobo : null;

  return {
    secret,
    publicKey,
    currency,
    /* the whole cost of the course, however it gets paid */
    totalKobo: total,
    depositPercent: pct,
    depositKobo,
    balanceKobo,
    /* live vs test is not a separate switch — it is whichever key pair the
       environment holds. Vercel: test values on Preview/Development, live
       values on Production. One less thing that can disagree with itself. */
    live: secret.startsWith('sk_live_'),
    hasKeys: secret.startsWith('sk_') && publicKey.startsWith('pk_'),
  };
}

/* A configuration problem is a 503, not a 500: the code is fine, the operator
   has not finished. The message says which variable, because the person
   reading it is the one who can fix it. */
export function configProblem(c) {
  if (!c.hasKeys) return 'Paystack keys are not set. Add PAYSTACK_SECRET_KEY and PAYSTACK_PUBLIC_KEY.';
  if (c.totalKobo === null) return 'PAYSTACK_TUITION_KOBO is not set to a positive whole number of kobo.';
  return null;
}

/* ---------- what someone owes ----------
   ONE function, used by init to decide what to charge and by verify and the
   webhook to decide whether a payment was the right size. If these three ever
   computed it separately they would drift, and the symptom would be a student
   told they still owe money they have already paid.

   `paidKobo` is the sum of their successful payments so far, from the store.
   With no store it is 0 and the split plan is not offered at all — see
   api/_store.js. */
export function owed({ paidKobo, plan, cfg }) {
  const paid = Math.max(0, paidKobo | 0);
  const outstanding = cfg.totalKobo - paid;

  if (outstanding <= 0) {
    return { done: true, amountKobo: 0, purpose: 'none', outstanding: 0 };
  }
  /* Anyone who has already paid something is finishing, whatever the form
     said. The plan choice only means something on a first payment — you do
     not get to re-pick "70% now" when 70% is already behind you. */
  if (paid > 0) {
    return { done: false, amountKobo: outstanding, purpose: 'balance', outstanding };
  }
  if (plan === 'split') {
    return { done: false, amountKobo: cfg.depositKobo, purpose: 'deposit', outstanding };
  }
  return { done: false, amountKobo: cfg.totalKobo, purpose: 'full', outstanding };
}

export function json(body, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      /* Nothing here is cacheable. A cached config response would pin a stale
         price on the page, and a cached verify would confirm a payment that
         had since been reversed. */
      'cache-control': 'no-store',
      ...extraHeaders,
    },
  });
}

/* ---------- talking to Paystack ----------
   The secret key goes out in this header and NOWHERE else. It is never
   returned to a caller, never put in a log line, and never included in an
   error body — an error body is the classic way a key ends up in a browser's
   network tab. */
export async function paystack(path, { method = 'GET', body, secret } = {}) {
  const res = await fetch(PAYSTACK_API + path, {
    method,
    headers: {
      Authorization: `Bearer ${secret}`,
      'content-type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  let payload = null;
  try { payload = await res.json(); } catch { /* non-JSON: handled below */ }

  return {
    ok: res.ok && payload && payload.status === true,
    httpStatus: res.status,
    /* Paystack's own message is safe to pass on — it describes the request,
       not the credential. */
    message: (payload && payload.message) || `Paystack returned ${res.status}`,
    data: (payload && payload.data) || null,
  };
}

/* ---------- webhook signature ----------
   Paystack signs the raw request body with HMAC SHA-512 keyed by the SECRET
   key, and sends it as x-paystack-signature. An unsigned or wrongly-signed
   request is an impersonation attempt and gets nothing.

   The comparison is length-first then constant-time-ish: a plain === on
   hex strings leaks, through timing, how many leading characters matched,
   which is enough to forge a signature byte by byte given enough attempts. */
export async function signatureValid(rawBody, header, secret) {
  if (!header || typeof header !== 'string') return false;

  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-512' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(rawBody));
  const expected = [...new Uint8Array(sig)]
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  if (expected.length !== header.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) {
    diff |= expected.charCodeAt(i) ^ header.charCodeAt(i);
  }
  return diff === 0;
}

/* Deliberately loose. Strict RFC-5322 matching rejects addresses that work,
   and Paystack validates properly on its side anyway; this only catches the
   obvious typo before a pointless round trip. */
export function emailLooksReal(v) {
  return typeof v === 'string' && v.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}

/* Trim anything a human typed before it goes into metadata, so a paste of a
   whole CV cannot bloat the transaction record. */
export function clean(v, max = 120) {
  return typeof v === 'string' ? v.trim().slice(0, max) : '';
}
