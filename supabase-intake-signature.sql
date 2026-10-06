-- haloe — draw-to-sign signature for the intake form (Oct 2026).
--
-- Run in the Supabase SQL editor BEFORE (or at the same time as) deploying the
-- intake-submit change. Safe to re-run. The Function tolerates this not being
-- applied yet: the intake row is saved first, and the signature path is a
-- separate best-effort update.
--
-- 1. The path of the drawn signature, e.g. 'signatures/42.png' (bucket/object).
alter table public.intake_forms add column if not exists signature_path text;

-- 2. A PRIVATE bucket (public = false). Objects are named <intake_forms.id>.png.
--    No storage.objects policies are created on purpose: with RLS on and no
--    policy, the anon key can neither read nor write. Only the Function's
--    service-role key (which bypasses RLS) can, and Halima via the dashboard.
insert into storage.buckets (id, name, public)
values ('signatures', 'signatures', false)
on conflict (id) do update set public = false;
