-- haloe — Supabase schema for discount codes (Sep 2026, HALOE20 launch code).
-- Run this in the Supabase SQL editor (Dashboard → SQL Editor → New query).
-- Safe to re-run: uses IF NOT EXISTS / CREATE OR REPLACE / ON CONFLICT throughout.
--
-- Deliberately its own small table (not hardcoded in the Functions) so new
-- codes can be added later with a SQL insert, no deploy needed.
--
-- Codes are always stored upper-cased. validateDiscountCode() (in
-- functions/_discounts.js) upper-cases whatever the client sends before
-- looking it up, so matching is effectively case-insensitive without
-- needing ILIKE on every request.

create table if not exists public.discount_codes (
  code                  text primary key,
  percent               integer not null,
  expires_at            bigint,              -- unix seconds; null = never expires
  single_use_per_email  boolean not null default true,
  active                boolean not null default true,
  created_at            bigint not null
);

-- HALOE20 — 20% off, online bookings only (book.html, not the homepage
-- WhatsApp widget), one redemption per customer email, valid until
-- 31 Oct 2026 23:59 UK time. That's 23:59 UTC: BST has already ended by then
-- (UK clocks go back on 25 Oct 2026), so UK time and UTC are the same.
insert into public.discount_codes (code, percent, expires_at, single_use_per_email, active, created_at)
values ('HALOE20', 20, 1793491140, true, true, extract(epoch from now())::bigint)
on conflict (code) do nothing;

-- ------------------------------------------------------------------ --
-- Row Level Security — deny-all by default, same lockdown as every other
-- table (clients, intake_forms, bookings). The Cloudflare Functions use the
-- service-role key, which bypasses RLS; the public anon key can read or
-- write nothing.
-- ------------------------------------------------------------------ --
alter table public.discount_codes enable row level security;
grant select on public.discount_codes to service_role;
