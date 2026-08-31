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
import { signatureValid, emailLooksReal, config, owed } from '../api/_paystack.js';

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
    return config().totalKobo;
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
    return config();
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

console.log('\nwho owes what');
{
  process.env.PAYSTACK_TUITION_KOBO = '20000000';
  process.env.PAYSTACK_DEPOSIT_PERCENT = '70';
  const c = config();
  const o = (paid, plan) => owed({ paidKobo: paid, plan, cfg: c });

  ok('new payer, full  -> charged the whole N200,000',
     o(0, 'full').amountKobo === 20000000 && o(0, 'full').purpose === 'full');
  ok('new payer, split -> charged the N140,000 deposit',
     o(0, 'split').amountKobo === 14000000 && o(0, 'split').purpose === 'deposit');
  ok('paid the deposit -> charged the N60,000 balance',
     o(14000000, 'split').amountKobo === 6000000 && o(14000000, 'split').purpose === 'balance');
  /* Re-picking "70% now" when 70% is already behind you must not re-charge a
     deposit — the plan only means anything on a first payment. */
  ok('someone mid-plan cannot re-pick the deposit',
     o(14000000, 'split').purpose === 'balance');
  ok('a part payer choosing "full" still only pays the balance',
     o(14000000, 'full').amountKobo === 6000000);
  ok('paid in full -> nothing owed', o(20000000, 'full').done === true);
  ok('overpaid -> still nothing owed', o(25000000, 'full').done === true);
  ok('outstanding never goes negative', o(25000000, 'full').outstanding === 0);
}

console.log('\nthe amount guard — a client MUST NOT be able to set the price');
{
  process.env.PAYSTACK_SECRET_KEY = SECRET;
  process.env.PAYSTACK_PUBLIC_KEY = 'pk_test_x';
  process.env.PAYSTACK_TUITION_KOBO = '20000000';
  process.env.PAYSTACK_DEPOSIT_PERCENT = '70';
  process.env.PAYSTACK_CURRENCY = 'NGN';
  delete process.env.SUPABASE_URL;
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;

  let sent = null;
  let storeRows = [];
  let storeThrows = false;
  const realFetch = globalThis.fetch;

  globalThis.fetch = async (url, opts) => {
    const u = String(url);
    if (u.includes('/rest/v1/payments')) {
      if (storeThrows) return new Response('{"message":"boom"}', { status: 500 });
      return new Response(JSON.stringify(storeRows), { status: 200, headers: { 'content-type': 'application/json' } });
    }
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
  const res = await post({ email: 'attacker@example.com', plan: 'full', amount: 100, price: 100, amount_kobo: 100 });
  ok('request succeeds', res.status === 200, `status ${res.status}`);
  ok('charges the SERVER price, not the one in the request',
     sent.amount === 20000000, `sent ${sent && sent.amount}`);
  ok('currency comes from the server', sent.currency === 'NGN');
  ok('reference is generated server-side',
     typeof sent.reference === 'string' && sent.reference.startsWith('fcsa_'));

  ok('rejects a malformed email with 400',
     (await post({ email: 'not-an-email', plan: 'full' })).status === 400);
  ok('rejects GET with 405',
     (await init(new Request('https://x/api/paystack/init', { method: 'GET' }))).status === 405);

  /* No store -> the split plan must be refused outright, not silently
     downgraded to a deposit nobody can track the balance of. */
  ok('refuses the split plan when there is nowhere to record it (503)',
     (await post({ email: 'ada@example.com', plan: 'split' })).status === 503);

  process.env.SUPABASE_URL = 'https://stub.supabase.co';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'stub';

  storeRows = [];
  await post({ email: 'ada@example.com', plan: 'split' });
  ok('with a store, split charges the N140,000 deposit', sent.amount === 14000000);
  ok('the transaction is tagged as a deposit', sent.metadata.purpose === 'deposit');

  storeRows = [{ amount_kobo: 14000000 }];
  await post({ email: 'ada@example.com', plan: 'split' });
  ok('a returning depositor is charged the N60,000 balance', sent.amount === 6000000);
  ok('the transaction is tagged as a balance', sent.metadata.purpose === 'balance');

  await post({ email: 'ada@example.com', plan: 'full' });
  ok('and still only the balance if they pick "full"', sent.amount === 6000000);

  /* Case and whitespace must not create a second student who owes the lot. */
  sent = null;
  await post({ email: '  ADA@Example.COM ', plan: 'full' });
  ok('email is normalised, so the same person is recognised', sent.amount === 6000000);

  storeRows = [{ amount_kobo: 20000000 }];
  const done = await post({ email: 'ada@example.com', plan: 'full' });
  ok('someone already paid in full is refused with 409', done.status === 409);

  /* A store that is down must NOT fall through to "nothing paid" — that
     charges a returning student the full N200,000 on top of their deposit. */
  storeThrows = true;
  const blind = await post({ email: 'ada@example.com', plan: 'full' });
  ok('refuses to charge when the payment history cannot be read (503)', blind.status === 503);
  storeThrows = false;

  process.env.PAYSTACK_TUITION_KOBO = '';
  ok('refuses to charge when no price is configured (503)',
     (await post({ email: 'ada@example.com', plan: 'full' })).status === 503);

  globalThis.fetch = realFetch;
}

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
