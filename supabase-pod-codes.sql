-- POD-FREE: one free (100% off) session for a POD Football guest, single use.
-- POD25: 25% off for POD's referrals, first-time clients only, many people can use it (once each).
-- Run once in Supabase -> SQL editor. Safe to re-run.
-- To lock POD-FREE to the guest: update public.discount_codes set allowed_email = 'their@email' where code = 'POD-FREE';

insert into public.discount_codes (code, type, percent_off, collaborator_id, max_uses_total, max_uses_per_customer, first_time_only, valid_from, valid_until, period, allowed_email, active, created_at)
select 'POD-FREE', 'gift', 100, c.id, 1, 1, false, extract(epoch from now())::bigint, null, null, null, true, extract(epoch from now())::bigint
from public.collaborators c where c.name = 'POD Football'
on conflict (code) do update set
  type = 'gift', percent_off = 100, max_uses_total = 1, max_uses_per_customer = 1,
  first_time_only = false, valid_until = null, active = true;

insert into public.discount_codes (code, type, percent_off, collaborator_id, max_uses_total, max_uses_per_customer, first_time_only, valid_from, valid_until, period, allowed_email, active, created_at)
select 'POD25', 'audience', 25, c.id, null, 1, true, extract(epoch from now())::bigint, null, null, null, true, extract(epoch from now())::bigint
from public.collaborators c where c.name = 'POD Football'
on conflict (code) do update set
  type = 'audience', percent_off = 25, max_uses_total = null, max_uses_per_customer = 1,
  first_time_only = true, valid_until = null, active = true;

select code, type, percent_off, max_uses_total, first_time_only, active, allowed_email
from public.discount_codes where code in ('POD-FREE', 'POD25');
