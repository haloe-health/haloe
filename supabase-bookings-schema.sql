-- haloe — Supabase schema for the booking system.
-- Migrated from Cloudflare D1 (Sep 2026). No data migration needed — the
-- only rows in D1 were Halima's own £1 live-mode tests, discarded rather
-- than carried over. This table starts empty.
--
-- Run this in the Supabase SQL editor (Dashboard → SQL Editor → New query).
-- Safe to re-run: uses IF NOT EXISTS / CREATE OR REPLACE throughout.

-- ------------------------------------------------------------------ --
-- bookings — one row per hold/booking. Same shape as the old D1 table,
-- minus stripe_session_id (defined there but never populated or read).
-- ------------------------------------------------------------------ --
create table if not exists public.bookings (
  id              bigint generated always as identity primary key,
  booking_date    date not null,
  start_min       integer not null,
  end_min         integer not null,
  treatment       text,
  customer_name   text,
  customer_email  text,
  customer_phone  text,
  location        text,                              -- 'clinic' | 'mobile'
  address         text,
  amount_pence    integer,
  status          text not null default 'pending',    -- 'pending' | 'confirmed'
  hold_expires_at bigint,                              -- unix seconds
  created_at      bigint not null
);

create index if not exists bookings_date_idx on public.bookings(booking_date);

-- ------------------------------------------------------------------ --
-- reserve_slot — atomic check-then-insert, called via PostgREST RPC
-- (POST /rest/v1/rpc/reserve_slot). D1/SQLite serializes all writes, so the
-- old "INSERT...SELECT...WHERE NOT EXISTS" pattern was safe on its own;
-- Postgres has real concurrent writers, so the same pattern run as two
-- separate REST calls could let two requests both pass the overlap check
-- before either commits. This function closes that gap with a
-- transaction-scoped advisory lock keyed by booking_date — every
-- reservation attempt for the same day is serialized, same guarantee D1
-- gave us for free, without serializing different days against each other.
-- Returns the new row's id, or NULL if the slot was already taken.
-- ------------------------------------------------------------------ --
create or replace function public.reserve_slot(
  p_booking_date date,
  p_start_min integer,
  p_end_min integer,
  p_treatment text,
  p_customer_name text,
  p_customer_email text,
  p_customer_phone text,
  p_location text,
  p_address text,
  p_amount_pence integer,
  p_hold_expires_at bigint,
  p_now bigint
) returns bigint
language plpgsql
as $$
declare
  v_id bigint;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_booking_date::text, 0));

  if exists (
    select 1 from public.bookings
    where booking_date = p_booking_date
      and start_min < p_end_min
      and end_min > p_start_min
      and (status = 'confirmed' or (status = 'pending' and hold_expires_at > p_now))
  ) then
    return null;
  end if;

  insert into public.bookings
    (booking_date, start_min, end_min, treatment, customer_name, customer_email,
     customer_phone, location, address, amount_pence, status, hold_expires_at, created_at)
  values
    (p_booking_date, p_start_min, p_end_min, p_treatment, p_customer_name, p_customer_email,
     p_customer_phone, p_location, p_address, p_amount_pence, 'pending', p_hold_expires_at, p_now)
  returning id into v_id;

  return v_id;
end;
$$;

-- ------------------------------------------------------------------ --
-- Row Level Security — deny-all by default, same lockdown as clients/
-- intake_forms. The Cloudflare Functions use the service-role key, which
-- bypasses RLS, so reservation/confirm/release/list all keep working; the
-- public anon key can read or write nothing.
-- ------------------------------------------------------------------ --
alter table public.bookings enable row level security;

grant select, insert, update, delete on public.bookings to service_role;
grant usage, select on sequence public.bookings_id_seq to service_role;
grant execute on function public.reserve_slot to service_role;
