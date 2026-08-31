/* ==========================================================================
   Self-test for the Paystack integration.

       node tools/paystack-selftest.mjs      (or: npm run test:paystack)

   Runs with NO Paystack account and NO keys. It cannot tell you a real card
   will clear — only a test transaction against Paystack does that. What it
   does cover is the part that is dangerous to get wrong and impossible to
   eyeball: the amount guard and the webhook signature check.

   The fetch to Paystack is stubbed, so nothing here touches the network or
   moves money.
   ========================================================================== */
import { signatureValid, emailLooksReal, config } from '../api/_paystack.js';

let pass = 0, fail = 0;
const ok = (name, cond, extra = '') => {
  if (cond) { pass++; console.log(`  ok   ${name}`); }
  else { fail++; console.log(`  FAIL ${name}${extra ? '  — ' + extra : ''}`); }
};

/* Reference HMAC, computed independently of the implementation under test —
   this is what Paystack's own server does to sign a delivery. */
import { createHmac } from 'node:crypto';
const sign = (body, secret) => createHmac('sha512', secret).update(body).digest('hex');

const SECRET = 'sk_test_selftest_not_a_real_key';

console.log('\nwebhook signature');
{
  const body = JSON.stringify({ event: 'charge.success', data: { reference: 'r1', amount: 50000 } });
  const good = sign(body, SECRET);

  ok('accepts a correctly signed body', await signatureValid(body, good, SECRET));
  ok('rejects a tampered body',
     !(await signatureValid(body.replace('50000', '100'), good, SECRET)));
  ok('rejects a signature from the wrong key',
     !(await signatureValid(body, sign(body, 'sk_test_someone_elses_key'), SECRET)));
  ok('rejects a missing signature header', !(await signatureValid(body, null, SECRET)));
  ok('rejects an empty signature header', !(await signatureValid(body, '', SECRET)));
  ok('rejects a truncated signature', !(await signatureValid(body, good.slice(0, -2), SECRET)));
  ok('rejects a signature with one flipped character',
     !(await signatureValid(body, (good[0] === 'a' ? 'b' : 'a') + good.slice(1), SECRET)));
  /* Byte-for-byte identical to what Paystack computes. If this drifts, every
     real webhook silently 401s. */
  ok('matches an independently computed HMAC SHA-512', await signatureValid(body, good, SECRET));
}

console.log('\namount parsing (kobo must be a positive integer)');
{
  const withEnv = (v) => {
    process.env.PAYSTACK_SECRET_KEY = SECRET;
    process.env.PAYSTACK_PUBLIC_KEY = 'pk_test_x';
    process.env.PAYSTACK_AMOUNT_KOBO = v;
    return config().amountKobo;
  };
  ok('accepts a whole number', withEnv('50000000') === 50000000);
  ok('rejects a decimal', withEnv('50000.5') === null);
  ok('rejects a negative', withEnv('-100') === null);
  ok('rejects zero', withEnv('0') === null);
  ok('rejects an empty value', withEnv('') === null);
  ok('rejects text', withEnv('five hundred') === null);
  ok('rejects a thousands separator', withEnv('500,000') === null);
}

console.log('\nemail sanity');
{
  ok('accepts an ordinary address', emailLooksReal('ada@example.com'));
  ok('rejects a missing @', !emailLooksReal('ada.example.com'));
  ok('rejects an empty string', !emailLooksReal(''));
  ok('rejects a non-string', !emailLooksReal(null));
  ok('rejects an over-long address', !emailLooksReal('a'.repeat(250) + '@x.com'));
}

console.log('\nthe amount guard — a client MUST NOT be able to set the price');
{
  process.env.PAYSTACK_SECRET_KEY = SECRET;
  process.env.PAYSTACK_PUBLIC_KEY = 'pk_test_x';
  process.env.PAYSTACK_AMOUNT_KOBO = '50000000';   // ₦500,000
  process.env.PAYSTACK_CURRENCY = 'NGN';

  let sentToPaystack = null;
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (url, opts) => {
    sentToPaystack = JSON.parse(opts.body);
    return new Response(
      JSON.stringify({ status: true, data: { access_code: 'ac_x', reference: sentToPaystack.reference } }),
      { status: 200, headers: { 'content-type': 'application/json' } }
    );
  };

  const { default: init } = await import('../api/paystack/init.js');

  /* The attack: a hand-rolled request that asks to pay ₦1 for a ₦500,000
     course. Anyone can send this — it is four lines in a browser console. */
  const res = await init(new Request('https://x/api/paystack/init', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: 'attacker@example.com', amount: 100, amount_kobo: 100, price: 100 }),
  }));

  ok('request succeeds', res.status === 200, `status ${res.status}`);
  ok('charges the SERVER price, not the one in the request',
     sentToPaystack.amount === 50000000, `sent ${sentToPaystack && sentToPaystack.amount}`);
  ok('currency comes from the server', sentToPaystack.currency === 'NGN');
  ok('reference is generated server-side, not accepted from the client',
     typeof sentToPaystack.reference === 'string' && sentToPaystack.reference.startsWith('fcsa_'));

  const bad = await init(new Request('https://x/api/paystack/init', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: 'not-an-email' }),
  }));
  ok('rejects a malformed email with 400', bad.status === 400);

  const wrongVerb = await init(new Request('https://x/api/paystack/init', { method: 'GET' }));
  ok('rejects GET with 405', wrongVerb.status === 405);

  /* Unset the price and the endpoint must refuse rather than charge zero or
     guess. */
  process.env.PAYSTACK_AMOUNT_KOBO = '';
  const unpriced = await init(new Request('https://x/api/paystack/init', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: 'ada@example.com' }),
  }));
  ok('refuses to charge when no price is configured (503)', unpriced.status === 503);

  globalThis.fetch = realFetch;
}

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
