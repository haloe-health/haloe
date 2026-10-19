-- Audience codes (YASMZEE25 / DB25 / POD25): allow many different people to use one code, still once each.
-- Run ONCE in Supabase → SQL editor BEFORE the matching site deploy (PR merge). Safe to re-run.
-- Nothing about existing rows or other code types changes: NULL = "same as enforce_limits".

alter table public.code_redemptions add column if not exists enforce_customer boolean;

drop index if exists public.code_redemptions_active_per_customer;
create unique index if not exists code_redemptions_active_per_customer
  on public.code_redemptions(code_id, customer_email)
  where status in ('reserved', 'confirmed') and coalesce(enforce_customer, enforce_limits);
