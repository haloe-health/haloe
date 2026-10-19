-- Codes reset for November 2026 (run once in Supabase → SQL editor).
--
-- 1. Switch OFF every code except HALOE20. Rows are kept (not deleted) so past
--    bookings, redemptions and revenue stats still point at them; a switched-off
--    code is refused at checkout and hidden in the app under "Show inactive".
--    To bring one back: update public.discount_codes set active = true where code = '...';
-- 2. Add NOV20: 20% off all treatments, reusable without limit, valid from
--    1 Nov 2026 00:00 to 30 Nov 2026 23:59:59 UK (GMT, so = UTC).
--    HALOE20 runs to 31 Oct 23:59:59, so there is no gap and no overlap.
--    Same shape as HALOE20: type 'promo' (that is what makes it reusable),
--    no caps, not first-time-only.

update public.discount_codes
   set active = false
 where code <> 'HALOE20' and active = true;

insert into public.discount_codes (code, type, percent_off, collaborator_id, max_uses_total, max_uses_per_customer, first_time_only, valid_from, valid_until, period, allowed_email, active, created_at)
values ('NOV20', 'promo', 20, null, null, null, false, 1793491200, 1796083199, null, null, true, extract(epoch from now())::bigint)
on conflict (code) do update set
  type = 'promo', percent_off = 20, valid_from = 1793491200, valid_until = 1796083199,
  first_time_only = false, max_uses_total = null, max_uses_per_customer = null, active = true;

-- Check: HALOE20 and NOV20 should be the only active rows.
select code, type, percent_off, active, to_timestamp(valid_from) as valid_from, to_timestamp(valid_until) as valid_until
  from public.discount_codes order by active desc, code;
