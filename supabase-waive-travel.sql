-- Codes that also cover home-visit travel (Halima pays the Uber, e.g. NESSA-FREE).
-- Run once in Supabase -> SQL editor. Safe to re-run.
alter table public.discount_codes add column if not exists waive_travel boolean not null default false;
update public.discount_codes set waive_travel = true where code = 'NESSA-FREE';
select code, percent_off, waive_travel, active from public.discount_codes where code = 'NESSA-FREE';
