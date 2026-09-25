-- haloe — Supabase schema for the collaborator / discount-code system.
-- Replaces the original single-table HALOE20-only version of this file
-- (Sep 2026). Run this in the Supabase SQL editor (Dashboard → SQL Editor →
-- New query). Safe to re-run: uses IF NOT EXISTS / ON CONFLICT throughout.
--
-- Five code types share one `discount_codes` table (see functions/_discounts.js
-- for the validation logic that interprets these rows):
--   promo       public launch offer, no collaborator, expires
--   gift        100% off, locked to one collaborator's email, one use total
--   audience    a collaborator's followers, first-time clients only
--   reward      auto-created every 5 completed audience-code bookings
--   competition POD Football GOTW/POTM winners, one use per period
--
-- All money/eligibility logic still lives in the Functions — this file only
-- defines storage and locks it down with RLS.

-- ------------------------------------------------------------------ --
-- collaborators
-- ------------------------------------------------------------------ --
create table if not exists public.collaborators (
  id                  bigint generated always as identity primary key,
  name                text not null,
  business_name       text,
  type                text not null,           -- 'influencer' | 'business' | 'club'
  email               text,
  phone               text,
  instagram           text,
  tiktok              text,
  notes               text,
  deliverables_agreed boolean not null default false,
  created_at          bigint not null           -- unix seconds, matches bookings/discount_codes convention
);

-- ------------------------------------------------------------------ --
-- discount_codes
--
-- This table already existed (the original HALOE20-only version: code,
-- percent, expires_at, single_use_per_email, active, created_at, with
-- `code` as the primary key). Rather than drop and recreate — which would
-- also mean dropping and recreating the primary key that code_redemptions
-- doesn't reference but future code might — this block creates the table
-- fresh on a database that's never seen it, and migrates an existing one
-- in place: add every new column, backfill from the old ones, then drop
-- the old ones. Safe to re-run at any point in that migration.
-- ------------------------------------------------------------------ --
create table if not exists public.discount_codes (
  code                   text primary key,        -- always stored upper-cased
  percent                integer not null,
  expires_at             bigint,
  single_use_per_email   boolean not null default true,
  active                 boolean not null default true,
  created_at             bigint not null
);

alter table public.discount_codes add column if not exists id bigint generated always as identity;
alter table public.discount_codes add column if not exists type text;
alter table public.discount_codes add column if not exists percent_off integer;
alter table public.discount_codes add column if not exists collaborator_id bigint references public.collaborators(id);
alter table public.discount_codes add column if not exists max_uses_total integer;
alter table public.discount_codes add column if not exists max_uses_per_customer integer;
alter table public.discount_codes add column if not exists first_time_only boolean not null default false;
alter table public.discount_codes add column if not exists valid_from bigint;
alter table public.discount_codes add column if not exists valid_until bigint;
alter table public.discount_codes add column if not exists period text;
alter table public.discount_codes add column if not exists allowed_email text;

-- Backfill the new columns from the old ones wherever the new ones are
-- still empty (a fresh table has no rows, so this is a no-op there).
update public.discount_codes
   set type = coalesce(type, 'promo'),
       percent_off = coalesce(percent_off, percent),
       valid_from = coalesce(valid_from, created_at),
       valid_until = coalesce(valid_until, expires_at),
       max_uses_per_customer = case when single_use_per_email then 1 else max_uses_per_customer end
 where percent_off is null;

alter table public.discount_codes alter column percent_off set not null;
alter table public.discount_codes alter column valid_from set not null;
alter table public.discount_codes alter column type set not null;

alter table public.discount_codes drop column if exists percent;
alter table public.discount_codes drop column if exists expires_at;
alter table public.discount_codes drop column if exists single_use_per_email;

create unique index if not exists discount_codes_id_unique on public.discount_codes(id);
create index if not exists discount_codes_collaborator_idx on public.discount_codes(collaborator_id);

-- ------------------------------------------------------------------ --
-- code_redemptions — one row per attempted use. 'reserved' when a checkout
-- session is created, flipped to 'confirmed' by the Stripe webhook, or
-- 'released' if the hold lapses unpaid (mirrors the bookings pending/confirmed
-- pattern in supabase-bookings-schema.sql). A partial unique index enforces
-- "no double use" at the database level for single-use codes without
-- blocking a code that's legitimately reused after a prior redemption was
-- released.
-- ------------------------------------------------------------------ --
create table if not exists public.code_redemptions (
  id               bigint generated always as identity primary key,
  code_id          bigint not null references public.discount_codes(id),
  booking_id       bigint references public.bookings(id),
  customer_email   text not null,
  discount_amount  integer not null,       -- pence
  status           text not null default 'reserved',  -- 'reserved' | 'confirmed' | 'released'
  period_key       text,                    -- e.g. '2026-W41' or '2026-10', competition codes only
  created_at       bigint not null
);

create index if not exists code_redemptions_code_idx on public.code_redemptions(code_id);
create index if not exists code_redemptions_booking_idx on public.code_redemptions(booking_id);

-- Blocks two simultaneous 'reserved'/'confirmed' redemptions of the same
-- single-use code (gift/reward/competition codes, max_uses_total = 1) — the
-- concurrency guard the brief asks for. Released holds don't count, so a
-- lapsed attempt doesn't permanently lock the code.
create unique index if not exists code_redemptions_active_per_code
  on public.code_redemptions(code_id)
  where status in ('reserved', 'confirmed');

-- One redemption per (code, period) for competition codes — a second
-- GOTW/POTM winner attempt in the same week/month is blocked even though the
-- code itself is reused across periods.
create unique index if not exists code_redemptions_active_per_period
  on public.code_redemptions(code_id, period_key)
  where status in ('reserved', 'confirmed') and period_key is not null;

-- ------------------------------------------------------------------ --
-- Seed collaborators and codes.
-- ------------------------------------------------------------------ --
insert into public.collaborators (name, business_name, type, email, instagram, deliverables_agreed, created_at)
values
  ('Yasmin', null, 'influencer', null, 'yasmzee', true, extract(epoch from now())::bigint),
  ('Dog Business', 'Dog Business', 'business', null, null, true, extract(epoch from now())::bigint),
  ('POD Football', 'POD Football', 'club', null, null, true, extract(epoch from now())::bigint)
on conflict do nothing;

-- HALOE20 — public launch offer, 20% off all treatments, expires 31 Oct 2026
-- 23:59 UK time (= 23:59 UTC; BST has ended by then).
insert into public.discount_codes (code, type, percent_off, collaborator_id, max_uses_total, max_uses_per_customer, first_time_only, valid_from, valid_until, period, allowed_email, active, created_at)
values ('HALOE20', 'promo', 20, null, null, null, false, extract(epoch from now())::bigint, 1793491140, null, null, true, extract(epoch from now())::bigint)
on conflict (code) do update set
  type = excluded.type, percent_off = excluded.percent_off, valid_until = excluded.valid_until,
  first_time_only = excluded.first_time_only, active = true;

insert into public.discount_codes (code, type, percent_off, collaborator_id, max_uses_total, max_uses_per_customer, first_time_only, valid_from, allowed_email, active, created_at)
select 'HALOE-YASMZEE', 'gift', 100, c.id, 1, 1, false, extract(epoch from now())::bigint, null, true, extract(epoch from now())::bigint
from public.collaborators c where c.name = 'Yasmin'
on conflict (code) do nothing;

insert into public.discount_codes (code, type, percent_off, collaborator_id, max_uses_total, max_uses_per_customer, first_time_only, valid_from, active, created_at)
select 'YASMZEE25', 'audience', 25, c.id, null, 1, true, extract(epoch from now())::bigint, true, extract(epoch from now())::bigint
from public.collaborators c where c.name = 'Yasmin'
on conflict (code) do nothing;

insert into public.discount_codes (code, type, percent_off, collaborator_id, max_uses_total, max_uses_per_customer, first_time_only, valid_from, allowed_email, active, created_at)
select 'HALOE-DB', 'gift', 100, c.id, 1, 1, false, extract(epoch from now())::bigint, null, true, extract(epoch from now())::bigint
from public.collaborators c where c.name = 'Dog Business'
on conflict (code) do nothing;

insert into public.discount_codes (code, type, percent_off, collaborator_id, max_uses_total, max_uses_per_customer, first_time_only, valid_from, active, created_at)
select 'DB25', 'audience', 25, c.id, null, 1, true, extract(epoch from now())::bigint, true, extract(epoch from now())::bigint
from public.collaborators c where c.name = 'Dog Business'
on conflict (code) do nothing;

insert into public.discount_codes (code, type, percent_off, collaborator_id, max_uses_total, max_uses_per_customer, first_time_only, valid_from, allowed_email, active, created_at)
select 'HALOE-POD', 'gift', 100, c.id, 1, 1, false, extract(epoch from now())::bigint, null, true, extract(epoch from now())::bigint
from public.collaborators c where c.name = 'POD Football'
on conflict (code) do nothing;

insert into public.discount_codes (code, type, percent_off, collaborator_id, max_uses_total, max_uses_per_customer, first_time_only, valid_from, active, created_at)
select 'POD25', 'audience', 25, c.id, null, 1, true, extract(epoch from now())::bigint, true, extract(epoch from now())::bigint
from public.collaborators c where c.name = 'POD Football'
on conflict (code) do nothing;

insert into public.discount_codes (code, type, percent_off, collaborator_id, max_uses_total, max_uses_per_customer, first_time_only, valid_from, period, active, created_at)
select 'POD-GOTW', 'competition', 100, c.id, null, 1, false, extract(epoch from now())::bigint, 'week', true, extract(epoch from now())::bigint
from public.collaborators c where c.name = 'POD Football'
on conflict (code) do nothing;

insert into public.discount_codes (code, type, percent_off, collaborator_id, max_uses_total, max_uses_per_customer, first_time_only, valid_from, period, active, created_at)
select 'POD-POTM', 'competition', 100, c.id, null, 1, false, extract(epoch from now())::bigint, 'month', true, extract(epoch from now())::bigint
from public.collaborators c where c.name = 'POD Football'
on conflict (code) do nothing;

-- ------------------------------------------------------------------ --
-- Row Level Security — deny-all by default. The Cloudflare Functions use
-- the service-role key, which bypasses RLS; the public anon key (used by
-- nothing here) can read or write none of this.
-- ------------------------------------------------------------------ --
alter table public.collaborators enable row level security;
alter table public.discount_codes enable row level security;
alter table public.code_redemptions enable row level security;

grant select, insert, update on public.collaborators to service_role;
grant select, insert, update on public.discount_codes to service_role;
grant select, insert, update on public.code_redemptions to service_role;
grant usage on all sequences in schema public to service_role;
