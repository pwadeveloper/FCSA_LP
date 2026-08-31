/* ==========================================================================
   Create (or re-create) the payment-receipt form on Tally.

       node tools/tally-form.mjs            # show what exists, change nothing
       node tools/tally-form.mjs --create   # create it and print the URL

   WHY THIS IS A SCRIPT AND NOT A FEW CLICKS. The form is part of the payment
   flow: the instalment route on the site is "transfer, then submit this
   form", and the fields it asks for are the fields needed to match a bank
   transfer to a student. Building it by hand means the next person to touch
   it has to reverse-engineer why each question is there. This file is the
   reason, and it can be re-run.

   Reads TALLY_API_KEY from .env.local. Never prints it.

   THE STRUCTURE IS NOT GUESSED. Tally's published example only covers
   FORM_TITLE; the rest was read off the OpenAPI schema at
   developers.tally.so/api-reference/openapi.json and off a real form on this
   account, which is how the TITLE/QUESTION pairing became clear:

     a question = a TITLE block with groupType QUESTION (its own groupUuid)
                  followed by the input block with its own groupUuid
     choices    = one groupUuid shared by every option, each carrying
                  index / isFirst / isLast / text
   ========================================================================== */
import { readFileSync, existsSync } from 'node:fs';
import { randomUUID } from 'node:crypto';

const API = 'https://api.tally.so';

if (existsSync('.env.local')) {
  for (const line of readFileSync('.env.local', 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !line.trim().startsWith('#') && process.env[m[1]] === undefined) {
      process.env[m[1]] = m[2].trim();
    }
  }
}
const KEY = (process.env.TALLY_API_KEY || '').trim();
if (!KEY) { console.error('TALLY_API_KEY is not set in .env.local'); process.exit(1); }

async function tally(path, init = {}) {
  const res = await fetch(API + path, {
    ...init,
    headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json', ...(init.headers || {}) },
  });
  const text = await res.text();
  let body = null;
  try { body = text ? JSON.parse(text) : null; } catch { /* not JSON */ }
  if (!res.ok) throw new Error(`Tally ${res.status} on ${path}: ${text.slice(0, 300)}`);
  return body;
}

/* ---------- block helpers ---------- */
const g = () => randomUUID();
const question = (html) => ({ uuid: g(), type: 'TITLE', groupUuid: g(), groupType: 'QUESTION', payload: { html } });
const text = (html) => ({ uuid: g(), type: 'TEXT', groupUuid: g(), groupType: 'TEXT', payload: { html } });
const input = (type, payload) => ({ uuid: g(), type, groupUuid: g(), groupType: type, payload });

/* Every option of one question shares a groupUuid; index/isFirst/isLast tell
   Tally the order and the ends of the list. */
function choices(options, { isRequired = true } = {}) {
  const groupUuid = g();
  return options.map((t, i) => ({
    uuid: g(), type: 'MULTIPLE_CHOICE_OPTION', groupUuid, groupType: 'MULTIPLE_CHOICE',
    payload: { index: i, isFirst: i === 0, isLast: i === options.length - 1, text: t, isRequired },
  }));
}

/* ---------- the form ----------
   Every question here earns its place by answering something a bank
   statement cannot:

     name / email / phone  who this is, and how to reach them to confirm
     track                 which cohort list they go on
     which payment         a N140,000 credit is a deposit and a N60,000 credit
                           is a balance, but the statement only shows a number
                           and a date — this removes the guess
     receipt               proof, and the transfer reference
     note                  THE IMPORTANT ONE. Transfers routinely arrive from
                           a sibling's or a parent's account, and then the name
                           on the statement matches nobody on the list. This
                           is where they say so, before it becomes a phone call.
*/
const blocks = [
  { uuid: g(), type: 'FORM_TITLE', groupUuid: g(), groupType: 'TEXT',
    payload: { title: 'Send your payment receipt', html: 'Send your payment receipt' } },

  text('You&rsquo;ve made a bank transfer for your tuition at The Film &amp; Content School Africa. ' +
       'Upload the receipt here and we&rsquo;ll confirm on WhatsApp, usually the same day.'),

  question('Full name'),
  input('INPUT_TEXT', { isRequired: true, placeholder: 'As it appears on your application' }),

  question('Email'),
  input('INPUT_EMAIL', { isRequired: true, placeholder: 'you@example.com' }),

  question('Phone / WhatsApp'),
  input('INPUT_PHONE_NUMBER', { isRequired: true, placeholder: '080…' }),

  question('Which track?'),
  ...choices(['Film Production', 'Content Creation', "The Finisher's Track", 'Not sure yet']),

  question('Which payment is this?'),
  ...choices(['Deposit — ₦140,000', 'Balance — ₦60,000', 'Full tuition — ₦200,000']),

  question('Your receipt'),
  input('FILE_UPLOAD', { isRequired: true, hasMultipleFiles: true, hasMaxFiles: true, maxFiles: 3 }),

  question('Anything we should know? (optional)'),
  input('TEXTAREA', { isRequired: false,
    placeholder: 'If the transfer came from someone else&rsquo;s account, tell us whose — otherwise the name on our statement will not match yours.' }),
];

/* Submission notifications. Tally keeps every submission in its own dashboard
   regardless; this is the copy that lands in an inbox. */
const notifyTo = (process.env.TALLY_NOTIFY_EMAIL || '').trim();

const body = {
  status: 'PUBLISHED',
  blocks,
  settings: {
    language: 'en',
    hasProgressBar: true,
    ...(notifyTo ? {
      hasSelfEmailNotifications: true,
      selfEmailTo: { html: notifyTo },
      selfEmailSubject: { html: 'Tuition receipt — new submission' },
    } : {}),
  },
};

/* ---------- run ---------- */
const me = await tally('/users/me');
console.log(`account: ${me.email}`);

/* Point an EXISTING form's notifications at an address, without recreating it.
   Recreating would mint a new form id, which would change the public URL, which
   would mean editing pay.js and redeploying — a lot of moving parts to add one
   email address. */
const notifyIdx = process.argv.indexOf('--notify');
if (notifyIdx !== -1) {
  const formId = process.argv[notifyIdx + 1];
  const addr = process.argv[notifyIdx + 2] || notifyTo;
  if (!formId || !addr) {
    console.error('usage: node tools/tally-form.mjs --notify <formId> <email>');
    process.exit(1);
  }
  await tally(`/forms/${formId}`, {
    method: 'PATCH',
    body: JSON.stringify({
      settings: {
        hasSelfEmailNotifications: true,
        selfEmailTo: { html: addr },
        selfEmailSubject: { html: 'Tuition receipt — new submission' },
      },
    }),
  });
  console.log(`\nnotifications for ${formId} now go to ${addr}`);
  process.exit(0);
}

const list = await tally('/forms?limit=50');
const existing = (list.items || []).filter((f) => f.name === 'Send your payment receipt' && f.status !== 'DELETED');
if (existing.length) {
  console.log('\nthis form already exists:');
  for (const f of existing) console.log(`  https://tally.so/r/${f.id}   (${f.status})`);
}

if (!process.argv.includes('--create')) {
  console.log('\nnothing created. Re-run with --create to make a new one.');
  if (!notifyTo) console.log('Set TALLY_NOTIFY_EMAIL in .env.local first, or notifications stay off.');
  process.exit(0);
}

const form = await tally('/forms', { method: 'POST', body: JSON.stringify(body) });
console.log(`\ncreated ${form.id} — ${form.status}`);
console.log(`\n  https://tally.so/r/${form.id}\n`);
console.log('Put that in TALLY_URL at the top of pay.js.');
if (!notifyTo) {
  console.log('\nNOTE: no email notifications — TALLY_NOTIFY_EMAIL was not set.');
  console.log('Submissions still appear in the Tally dashboard.');
}
