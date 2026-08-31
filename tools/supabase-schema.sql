-- ==========================================================================
-- THE PAYMENT RECORD
--
-- Paste into the Supabase SQL editor once, on a new project.
--   Supabase -> your project -> SQL Editor -> New query -> Run
--
-- ONE TABLE AND ONE VIEW. The table is every successful charge; the view
-- answers the only question anyone actually asks — who has finished paying
-- and who has not. Both are readable in the Table Editor without SQL, which
-- is the point: whoever runs admissions should not have to write a query to
-- find out who still owes ₦60,000.
-- ==========================================================================

create table if not exists payments (
  id                  uuid primary key default gen_random_uuid(),

  -- THE IDEMPOTENCY KEY. Paystack retries webhook delivery until it gets a
  -- 200, so the same charge arrives more than once. This constraint is what
  -- makes the retry harmless: the second insert is ignored instead of
  -- counting the money twice and recording an overpayment.
  reference           text        not null unique,

  -- Always stored lowercased and trimmed (api/_store.js does it). It is the
  -- join between a deposit and the balance paid weeks later, so
  -- "Ada@Example.com " and "ada@example.com" must not be two students.
  email               text        not null,
  name                text,
  phone               text,
  track               text,

  plan                text,                       -- 'full' | 'split'
  purpose             text        not null,       -- 'full' | 'deposit' | 'balance'
  amount_kobo         integer     not null check (amount_kobo > 0),

  -- What the whole course cost AT THE TIME THIS WAS PAID. Stored on the row
  -- rather than read from config later, so changing next year's price does
  -- not retroactively rewrite what this cohort owed.
  expected_total_kobo integer     not null,

  currency            text        not null default 'NGN',
  status              text        not null,
  paid_at             timestamptz,
  created_at          timestamptz not null default now()
);

create index if not exists payments_email_idx on payments (email);

-- ROW LEVEL SECURITY ON, WITH NO POLICIES.
-- Enabling RLS and granting nothing means the anon/public key can read
-- nothing at all. Only the service_role key — which lives in the server
-- environment and never in the browser — gets through, because it bypasses
-- RLS by design. Without this line, anyone who finds the project URL and the
-- public anon key can read every student's name, phone number and payments.
alter table payments enable row level security;

-- --------------------------------------------------------------------------
-- WHO STILL OWES. Open this in the Table Editor and it is the whole answer.
-- --------------------------------------------------------------------------
create or replace view enrolment_status as
select
  email,
  max(name)                                             as name,
  max(phone)                                            as phone,
  max(track)                                            as track,
  max(plan)                                             as plan,
  sum(amount_kobo)                                      as paid_kobo,
  (sum(amount_kobo) / 100.0)                            as paid_naira,
  max(expected_total_kobo)                              as expected_total_kobo,
  greatest(max(expected_total_kobo) - sum(amount_kobo), 0)          as outstanding_kobo,
  (greatest(max(expected_total_kobo) - sum(amount_kobo), 0) / 100.0) as outstanding_naira,
  case
    when sum(amount_kobo) >= max(expected_total_kobo) then 'paid in full'
    else 'balance due'
  end                                                   as state,
  count(*)                                              as payments,
  max(paid_at)                                          as last_payment
from payments
where status = 'success'
group by email
order by state, last_payment desc;

-- Everyone who has not finished. This is the reminder list.
create or replace view balances_outstanding as
select * from enrolment_status where state = 'balance due';
