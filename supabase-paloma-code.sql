-- PALOMA-FREE: a free (100% off) code Paloma can use again and again. Run once in Supabase → SQL editor.
-- type 'promo' is what makes a code reusable (no use limits). It has no end date.
-- To lock it to her so nobody else can use it, replace NULL with her booking email in quotes, e.g. 'paloma@example.com'
-- (or run it later: update public.discount_codes set allowed_email = '...' where code = 'PALOMA-FREE';).
-- To switch it off later: update public.discount_codes set active = false where code = 'PALOMA-FREE';

insert into public.discount_codes (code, type, percent_off, collaborator_id, max_uses_total, max_uses_per_customer, first_time_only, valid_from, valid_until, period, allowed_email, active, created_at)
values ('PALOMA-FREE', 'promo', 100, null, null, null, false, extract(epoch from now())::bigint, null, null, NULL, true, extract(epoch from now())::bigint)
on conflict (code) do update set
  type = 'promo', percent_off = 100, valid_until = null, first_time_only = false,
  max_uses_total = null, max_uses_per_customer = null, active = true;

select code, type, percent_off, active, allowed_email from public.discount_codes where code in ('PALOMA-FREE', 'HALOE20', 'NOV20');
