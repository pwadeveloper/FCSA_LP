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
import { signatureValid, emailLooksReal, settings } from '../api/_paystack.js';

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
    process.env.PAYSTACK_TUITION_KOBO = v;
    return settings().totalKobo;
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

console.log('\nthe 70/30 split — deposit + balance must equal the total EXACTLY');
{
  const at = (total, pct) => {
    process.env.PAYSTACK_SECRET_KEY = SECRET;
    process.env.PAYSTACK_PUBLIC_KEY = 'pk_test_x';
    process.env.PAYSTACK_TUITION_KOBO = String(total);
    process.env.PAYSTACK_DEPOSIT_PERCENT = String(pct);
    return settings();
  };
  const c = at(20000000, 70);            // the real numbers: N200,000
  ok('total is N200,000',   c.totalKobo   === 20000000);
  ok('deposit is N140,000', c.depositKobo === 14000000);
  ok('balance is N60,000',  c.balanceKobo ===  6000000);
  ok('deposit + balance === total', c.depositKobo + c.balanceKobo === c.totalKobo);

  /* The balance is a subtraction, not the other percentage, so it stays exact
     on figures that do not divide cleanly. A student left owing 1 kobo never
     shows as "paid in full" and gets chased forever. */
  for (const [t, p] of [[19999999, 70], [333333, 33], [100001, 7], [1, 70], [12345678, 55]]) {
    const x = at(t, p);
    ok(`no kobo lost at total=${t} pct=${p}`, x.depositKobo + x.balanceKobo === x.totalKobo);
  }
  at(20000000, 70);
}

console.log('\nthe amount guard — a client MUST NOT be able to set the price');
{
  process.env.PAYSTACK_SECRET_KEY = SECRET;
  process.env.PAYSTACK_PUBLIC_KEY = 'pk_test_x';
  process.env.PAYSTACK_TUITION_KOBO = '20000000';
  process.env.PAYSTACK_DEPOSIT_PERCENT = '70';
  process.env.PAYSTACK_CURRENCY = 'NGN';

  let sent = null;
  const realFetch = globalThis.fetch;

  globalThis.fetch = async (url, opts) => {
    sent = JSON.parse(opts.body);
    return new Response(
      JSON.stringify({ status: true, data: { access_code: 'ac_x', reference: sent.reference } }),
      { status: 200, headers: { 'content-type': 'application/json' } }
    );
  };

  const { default: init } = await import('../api/paystack/init.js');
  const post = (body) => init(new Request('https://x/api/paystack/init', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
  }));

  /* The attack: four lines in a browser console asking to pay N1. */
  const res = await post({ email: 'attacker@example.com', amount: 100, price: 100, amount_kobo: 100 });
  ok('request succeeds', res.status === 200, `status ${res.status}`);
  ok('charges the SERVER price, not the one in the request',
     sent.amount === 20000000, `sent ${sent && sent.amount}`);
  ok('currency comes from the server', sent.currency === 'NGN');
  ok('reference is generated server-side',
     typeof sent.reference === 'string' && sent.reference.startsWith('fcsa_'));

  ok('rejects a malformed email with 400',
     (await post({ email: 'not-an-email' })).status === 400);
  ok('rejects GET with 405',
     (await init(new Request('https://x/api/paystack/init', { method: 'GET' }))).status === 405);

  process.env.PAYSTACK_TUITION_KOBO = '';
  ok('refuses to charge when no price is configured (503)',
     (await post({ email: 'ada@example.com' })).status === 503);

  globalThis.fetch = realFetch;
}

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
