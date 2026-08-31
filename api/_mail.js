/* ==========================================================================
   EMAIL — Resend.

   WHAT THIS DOES NOT DO: receipts. Paystack already emails the payer a
   receipt for every successful charge, and a second one from us would be
   noise that contradicts the first the moment the two ever disagree.

   What it does is the thing Paystack cannot know: that ₦140,000 was a
   DEPOSIT, that ₦60,000 is still owed, and that it is due within the first
   four weeks. That fact lives in our record, so the email about it has to
   come from us.

   Plain HTTPS, so it runs on the Edge runtime like everything else here.
   Unconfigured, every function below is a no-op that returns false — a
   missing email must never fail a payment that has already been taken.
   ========================================================================== */

export function mailConfig() {
  const key = (process.env.RESEND_API_KEY || '').trim();
  const from = (process.env.MAIL_FROM || '').trim();
  const bcc = (process.env.MAIL_BCC || '').trim();
  return { key, from, bcc, enabled: Boolean(key && from) };
}

export function naira(kobo) {
  return '₦' + (kobo / 100).toLocaleString('en-NG');
}

async function send({ to, subject, html }) {
  const c = mailConfig();
  if (!c.enabled) return false;

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${c.key}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      from: c.from,
      to: [to],
      /* Copy to the school, so there is a human-visible trail even before
         anyone opens the Supabase dashboard. */
      ...(c.bcc ? { bcc: [c.bcc] } : {}),
      subject,
      html,
    }),
  });
  if (!res.ok) throw new Error(`Resend ${res.status}: ${await res.text()}`);
  return true;
}

/* Deliberately plain HTML. It has to survive Gmail, Outlook and a cheap
   Android mail app, and the one thing that must arrive intact is the number
   still owed and the deadline. */
function wrap(bodyHtml) {
  return `<div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;font-size:15px;line-height:1.6;color:#111">
  ${bodyHtml}
  <p style="margin-top:28px;color:#666;font-size:13px">
    The Film &amp; Content School Africa &middot; Kaduna, Nigeria
  </p>
</div>`;
}

export function depositReceivedEmail({ name, paidKobo, outstandingKobo, reference }) {
  return {
    subject: `We received your ${naira(paidKobo)} deposit — ${naira(outstandingKobo)} balance to come`,
    html: wrap(`
      <p>Hi ${name || 'there'},</p>
      <p>Your deposit of <strong>${naira(paidKobo)}</strong> has been received. Your place is held.</p>
      <p>The remaining <strong>${naira(outstandingKobo)}</strong> is due on resumption,
         within the first four weeks of the programme.</p>
      <p>When you are ready, pay it on the same page with <strong>the same email address</strong> —
         the balance is worked out automatically, so you will not be charged the deposit again.</p>
      <p style="color:#666">Payment reference: ${reference}</p>`),
  };
}

export function paidInFullEmail({ name, totalKobo, reference }) {
  return {
    subject: 'Tuition paid in full — you are all set',
    html: wrap(`
      <p>Hi ${name || 'there'},</p>
      <p>That completes your tuition of <strong>${naira(totalKobo)}</strong>. Nothing further is owed.</p>
      <p>We will be in touch on WhatsApp with joining details before the first session.</p>
      <p style="color:#666">Payment reference: ${reference}</p>`),
  };
}

export async function notify(to, message) {
  return send({ to, subject: message.subject, html: message.html });
}
