/* ==========================================================================
   PAY TUITION — Paystack inline checkout.

   THE ONE THING TO UNDERSTAND ABOUT THIS FILE: it is not trusted, and it is
   not supposed to be. It runs on the payer's machine, where every line can be
   edited, so nothing it says is taken as fact by the server.

     - it does not know or send the price. The amount is set by
       /api/paystack/init from the server's own environment, and the figure
       displayed here is read back from /api/paystack/config so the two cannot
       disagree.
     - it does not decide that a payment happened. Paystack's onSuccess is a
       message from this same untrusted machine and can be called by hand from
       a console. It is only ever used as a nudge to go and ASK the server, via
       /api/paystack/verify, which asks Paystack.

   So the flow is: server starts the transaction -> Paystack's modal takes the
   card -> the server confirms with Paystack that money actually moved. The
   browser is a courier between those three, nothing more.
   ========================================================================== */
(function () {
  'use strict';

  var sec = document.querySelector('[data-pay]');
  if (!sec) return;

  var form     = document.getElementById('pay-form');
  var btn      = sec.querySelector('[data-pay-btn]');
  var msg      = document.getElementById('pay-msg');
  var amountEl = sec.querySelector('[data-pay-amount]');
  var introEl  = sec.querySelector('[data-pay-intro]');
  var testEl   = sec.querySelector('[data-pay-testmode]');
  var cfg      = null;

  function say(text, state) {
    msg.textContent = text;
    if (state) msg.setAttribute('data-state', state);
    else msg.removeAttribute('data-state');
    msg.hidden = false;
  }
  function quiet() { msg.hidden = true; msg.textContent = ''; msg.removeAttribute('data-state'); }

  /* Kobo to naira. Intl gives the ₦ and the grouping; the fallback covers a
     browser without the NGN currency data rather than printing "50000000". */
  function money(kobo, currency) {
    var major = kobo / 100;
    try {
      return new Intl.NumberFormat('en-NG', {
        style: 'currency', currency: currency || 'NGN', maximumFractionDigits: 0
      }).format(major);
    } catch (e) {
      return (currency || 'NGN') + ' ' + major.toLocaleString('en-NG');
    }
  }

  /* ---------- 1. what does it cost, and are we switched on ---------- */
  fetch('/api/paystack/config', { headers: { Accept: 'application/json' } })
    .then(function (r) { return r.json(); })
    .then(function (c) {
      cfg = c;
      sec.hidden = false;

      if (!c.configured) {
        /* Not an error state. Before a price exists this is simply the truth,
           and it says so instead of showing a dead button. */
        amountEl.textContent = '—';
        introEl.textContent = 'Fees for the 2026 term have not been published yet. ' +
                              'Send an application above and we will be in touch with the figure.';
        btn.disabled = true;
        btn.textContent = 'Not open yet';
        return;
      }

      amountEl.textContent = money(c.amountKobo, c.currency);
      btn.disabled = false;
      if (!c.live) testEl.hidden = false;
    })
    .catch(function () {
      /* The endpoint is missing entirely — the static page is being served
         without the functions, which is exactly what happens on the local
         python server. Say so rather than showing a button that cannot work. */
      sec.hidden = false;
      amountEl.textContent = '—';
      introEl.textContent = 'Payment is not available on this build.';
      btn.disabled = true;
      btn.textContent = 'Unavailable';
    });

  /* ---------- 2. validation, matching the apply form's behaviour ---------- */
  function fieldOf(el) { return el.closest ? el.closest('.f') : null; }
  function showErr(el, text) {
    var f = fieldOf(el); if (!f) return;
    f.classList.add('has-err');
    var slot = f.querySelector('.err');
    if (slot) { slot.textContent = text; slot.hidden = false; }
    el.setAttribute('aria-invalid', 'true');
  }
  function clearErrs() {
    form.querySelectorAll('.has-err').forEach(function (f) { f.classList.remove('has-err'); });
    form.querySelectorAll('.err').forEach(function (e) { e.hidden = true; e.textContent = ''; });
    form.querySelectorAll('[aria-invalid]').forEach(function (e) { e.removeAttribute('aria-invalid'); });
  }
  function validate() {
    var bad = [];
    var name  = form.querySelector('#p-name');
    var email = form.querySelector('#p-email');
    var phone = form.querySelector('#p-phone');
    var track = form.querySelector('#p-track');

    if (!name.value.trim())  bad.push([name,  'Tell us your name.']);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value.trim()))
      bad.push([email, 'We need a working email — the receipt goes there.']);
    if (!phone.value.trim()) bad.push([phone, 'A number we can reach you on.']);
    if (!track.value)        bad.push([track, 'Choose a track.']);
    return bad;
  }

  /* ---------- 3. pay ---------- */
  form.addEventListener('submit', function (ev) {
    ev.preventDefault();
    quiet();
    clearErrs();

    var bad = validate();
    if (bad.length) {
      bad.forEach(function (p) { showErr(p[0], p[1]); });
      var first = form.querySelector('.has-err input, .has-err select');
      if (first) first.focus();
      return;
    }

    if (!cfg || !cfg.configured) { say('Payment is not switched on yet.', 'err'); return; }

    /* The library is deferred, so on a slow connection a fast clicker can get
       here before it exists. Say that, rather than throwing. */
    if (typeof window.PaystackPop === 'undefined') {
      say('Still loading the payment window. Give it a second and try again.', 'err');
      return;
    }

    var label = btn.textContent;
    btn.disabled = true;
    btn.textContent = 'Starting…';

    fetch('/api/paystack/init', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      /* No amount in this body. Deliberately. If one were here the server
         would ignore it, but sending it at all invites someone to change it
         and conclude it worked. */
      body: JSON.stringify({
        name:  form.querySelector('#p-name').value.trim(),
        email: form.querySelector('#p-email').value.trim(),
        phone: form.querySelector('#p-phone').value.trim(),
        track: form.querySelector('#p-track').value
      })
    })
      .then(function (r) { return r.json().then(function (b) { return { ok: r.ok, body: b }; }); })
      .then(function (res) {
        if (!res.ok) throw new Error(res.body && res.body.error);

        btn.textContent = 'Waiting for payment…';

        new window.PaystackPop().resumeTransaction(res.body.accessCode, {
          onSuccess: function (tx) {
            /* NOT "paid". Only that the modal believes it finished. The
               server decides, below. */
            btn.textContent = 'Confirming…';
            confirm(tx && tx.reference ? tx.reference : res.body.reference);
          },
          onCancel: function () {
            btn.disabled = false;
            btn.textContent = label;
            say('Payment cancelled. Nothing was charged.');
          },
          onError: function (err) {
            btn.disabled = false;
            btn.textContent = label;
            say((err && err.message) || 'The payment window hit an error. Nothing was charged.', 'err');
          }
        });
      })
      .catch(function (e) {
        btn.disabled = false;
        btn.textContent = label;
        say(e.message || 'Could not start the payment. Check your connection and try again.', 'err');
      });
  });

  /* ---------- 4. the only thing that can say "paid" ---------- */
  function confirm(reference) {
    fetch('/api/paystack/verify?reference=' + encodeURIComponent(reference), {
      headers: { Accept: 'application/json' }
    })
      .then(function (r) { return r.json(); })
      .then(function (v) {
        if (v.paid) {
          form.reset();
          btn.textContent = 'Paid';
          say('Payment confirmed. Your receipt is on its way to your email. ' +
              'Reference ' + reference + ' — keep it.');
          return;
        }
        btn.disabled = false;
        btn.textContent = 'Pay tuition';
        /* Money may well have left the account even here — a mismatch is not
           a refusal. So the reference is printed and the wording never claims
           nothing was charged. */
        say('We could not confirm that payment. ' + (v.mismatch || '') +
            ' Quote reference ' + reference + ' and we will sort it out.', 'err');
      })
      .catch(function () {
        btn.disabled = false;
        btn.textContent = 'Pay tuition';
        say('Your payment may have gone through, but we could not reach the server to confirm it. ' +
            'Do not pay again — send us reference ' + reference + '.', 'err');
      });
  }

  /* clear a field's error as soon as it is corrected — same as the apply form */
  form.addEventListener('input', function (ev) {
    var f = fieldOf(ev.target);
    if (!f || !f.classList.contains('has-err')) return;
    f.classList.remove('has-err');
    var slot = f.querySelector('.err');
    if (slot) { slot.hidden = true; slot.textContent = ''; }
  });
})();
