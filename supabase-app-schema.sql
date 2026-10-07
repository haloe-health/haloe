-- haloe admin app (/app) — phase 1 schema. Applied to the live project as the
-- migration "admin_app_phase1" on 7 Oct 2026; kept here as the source of truth.
-- Safe to read as documentation; to re-run on a fresh project, run the whole file once.
--
-- What it does:
--   * profiles(role 'admin'|'client') + is_admin() — the gate every policy uses
--   * trigger: new auth user -> profile; admin ONLY for iamhalimayasmin@gmail.com
--   * bookings.client_id (nullable, stored link to clients) + bookings.done_at
--     - backfilled by email, then phone (last 10 digits)
--     - kept current by two triggers, so the Workers need no change
--   * session_notes
--   * authenticated-role grants + admin-only RLS on clients, intake_forms,
--     bookings, code_redemptions, collaborators, discount_codes, session_notes,
--     and admin-only read of the private `signatures` Storage bucket
-- anon gets nothing. The service-role key (Workers) bypasses RLS as before.
--
-- Manual steps in the Supabase dashboard (not SQL):
--   1. Authentication -> URL configuration: Site URL https://haloe.health/app ;
--      add https://haloe.health/app/ (and http://localhost:8788/app/ for local) as redirect URLs
--   2. Sign-ups stay ON (clients sign in with the same email link). The admin is whoever signs in
--      with iamhalimayasmin@gmail.com (handle_new_user). Consider custom SMTP (e.g. Resend):
--      Supabase's built-in email sender is limited to a handful of emails per hour.

-- profiles + role gate -------------------------------------------------
create table if not exists public.profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  email      text,
  role       text not null default 'client' check (role in ('admin','client')),
  created_at timestamptz not null default now()
);
alter table public.profiles enable row level security;

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;
revoke all on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, role)
  values (new.id, new.email,
          case when lower(new.email) = 'iamhalimayasmin@gmail.com' then 'admin' else 'client' end)
  on conflict (id) do nothing;
  return new;
end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- bookings: stored client link + done flag ------------------------------
alter table public.bookings add column if not exists client_id bigint references public.clients(id) on delete set null;
alter table public.bookings add column if not exists done_at timestamptz;
create index if not exists bookings_client_id_idx on public.bookings(client_id);

create or replace function public.norm_phone(p text) returns text language sql immutable as $$
  select case when length(regexp_replace(coalesce(p,''),'\D','','g')) >= 10
              then right(regexp_replace(p,'\D','','g'), 10) end;
$$;

-- backfill: email first, then phone
update public.bookings b set client_id = c.id
from public.clients c
where b.client_id is null and lower(b.customer_email) = lower(c.email);
update public.bookings b set client_id = c.id
from public.clients c
where b.client_id is null and public.norm_phone(b.customer_phone) is not null
  and public.norm_phone(b.customer_phone) = public.norm_phone(c.phone);

-- keep the link stored going forward (no change to the Workers)
create or replace function public.link_booking_client() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.client_id is null then
    select id into new.client_id from public.clients where lower(email) = lower(new.customer_email) limit 1;
    if new.client_id is null and public.norm_phone(new.customer_phone) is not null then
      select id into new.client_id from public.clients
       where public.norm_phone(phone) = public.norm_phone(new.customer_phone) limit 1;
    end if;
  end if;
  return new;
end $$;
drop trigger if exists bookings_link_client on public.bookings;
create trigger bookings_link_client before insert on public.bookings
  for each row execute function public.link_booking_client();

create or replace function public.link_client_bookings() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update public.bookings set client_id = new.id
   where client_id is null
     and (lower(customer_email) = lower(new.email)
          or (public.norm_phone(customer_phone) is not null
              and public.norm_phone(customer_phone) = public.norm_phone(new.phone)));
  return new;
end $$;
drop trigger if exists clients_link_bookings on public.clients;
create trigger clients_link_bookings after insert on public.clients
  for each row execute function public.link_client_bookings();

-- session notes ---------------------------------------------------------
create table if not exists public.session_notes (
  id         bigint generated always as identity primary key,
  client_id  bigint not null references public.clients(id) on delete cascade,
  booking_id bigint references public.bookings(id) on delete set null,
  note       text not null,
  created_at timestamptz not null default now()
);
create index if not exists session_notes_client_idx on public.session_notes(client_id);
alter table public.session_notes enable row level security;

-- grants (authenticated only; anon gets nothing) -------------------------
grant select on public.profiles, public.clients, public.intake_forms, public.bookings,
  public.code_redemptions, public.collaborators, public.discount_codes to authenticated;
grant insert, update on public.discount_codes, public.collaborators to authenticated;
grant update (done_at) on public.bookings to authenticated;
grant select, insert, update, delete on public.session_notes to authenticated;
grant select, insert, update, delete on public.profiles, public.session_notes to service_role;

-- policies: admin only ---------------------------------------------------
create policy profiles_self on public.profiles for select to authenticated using (id = auth.uid());
create policy admin_read_clients  on public.clients          for select to authenticated using (public.is_admin());
create policy admin_read_intake   on public.intake_forms     for select to authenticated using (public.is_admin());
create policy admin_read_bookings on public.bookings         for select to authenticated using (public.is_admin());
create policy admin_mark_done     on public.bookings         for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy admin_read_redeem   on public.code_redemptions for select to authenticated using (public.is_admin());
create policy admin_collab_all    on public.collaborators    for select to authenticated using (public.is_admin());
create policy admin_collab_ins    on public.collaborators    for insert to authenticated with check (public.is_admin());
create policy admin_collab_upd    on public.collaborators    for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy admin_codes_read    on public.discount_codes   for select to authenticated using (public.is_admin());
create policy admin_codes_ins     on public.discount_codes   for insert to authenticated with check (public.is_admin());
create policy admin_codes_upd     on public.discount_codes   for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy admin_notes_all     on public.session_notes    for all    to authenticated using (public.is_admin()) with check (public.is_admin());

-- signatures bucket: admin can read objects
create policy admin_read_signatures on storage.objects for select to authenticated
  using (bucket_id = 'signatures' and public.is_admin());

-- check-ins (client progress) — migration "check_ins", 7 Oct 2026 --------
-- Scores are 0-10 and nullable: an untouched slider saves NULL, never a default.
-- Concern: 0 none, 10 worst. Energy / Sleep: 0 low/poor, 10 high/great.
create table if not exists public.check_ins (
  id            bigint generated always as identity primary key,
  client_id     bigint not null references public.clients(id) on delete cascade,
  booking_id    bigint references public.bookings(id) on delete set null,
  taken_at      timestamptz not null default now(),
  concern_score int check (concern_score between 0 and 10),
  energy        int check (energy between 0 and 10),
  sleep         int check (sleep between 0 and 10),
  pain_areas    text,
  note          text,
  created_at    timestamptz not null default now()
);
create index if not exists check_ins_client_idx on public.check_ins(client_id, taken_at);
alter table public.check_ins enable row level security;
grant select, insert, update, delete on public.check_ins to authenticated;
grant select, insert, update, delete on public.check_ins to service_role;
create policy admin_checkins_all on public.check_ins for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- client login (phase 2) — migration "client_login", 7 Oct 2026 -----------
-- profiles.client_id links a signed-in client to their clients row: case-insensitive email first,
-- then phone (last 10 digits; only when the auth account itself has a phone). We deliberately do NOT
-- link through bookings: a booking's phone->client link is unverified, so someone could book with a
-- victim's number and then read the victim's intake. Email links only after the user proves the inbox.
alter table public.profiles add column if not exists client_id bigint references public.clients(id) on delete set null;
create index if not exists profiles_client_idx on public.profiles(client_id);

create or replace function public.find_client_for(p_email text, p_phone text) returns bigint
language sql stable security definer set search_path = public as $$
  select coalesce(
    (select id from public.clients where lower(email) = lower(p_email) order by id limit 1),
    (select id from public.clients
       where public.norm_phone(p_phone) is not null
         and public.norm_phone(phone) = public.norm_phone(p_phone) order by id limit 1));
$$;
revoke all on function public.find_client_for(text, text) from public, anon, authenticated;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, role, client_id)
  values (new.id, new.email,
          case when lower(new.email) = 'iamhalimayasmin@gmail.com' then 'admin' else 'client' end,
          public.find_client_for(new.email, new.phone))
  on conflict (id) do nothing;
  return new;
end $$;

-- re-link on login (a client may submit their intake after their first sign-in)
create or replace function public.link_my_client() returns bigint
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); em text; ph text; cid bigint;
begin
  if uid is null then return null; end if;
  select client_id into cid from public.profiles where id = uid;
  if cid is not null then return cid; end if;
  select email, phone into em, ph from auth.users where id = uid;
  cid := public.find_client_for(em, ph);
  if cid is not null then update public.profiles set client_id = cid where id = uid; end if;
  return cid;
end $$;
revoke all on function public.link_my_client() from public, anon;
grant execute on function public.link_my_client() to authenticated;

-- a new clients row (intake submitted) links any waiting profile with that email
create or replace function public.link_client_profiles() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update public.profiles set client_id = new.id where client_id is null and lower(email) = lower(new.email);
  return new;
end $$;
drop trigger if exists clients_link_profiles on public.clients;
create trigger clients_link_profiles after insert on public.clients
  for each row execute function public.link_client_profiles();

-- backfill existing profiles
update public.profiles p set client_id = public.find_client_for(p.email, (select phone from auth.users u where u.id = p.id))
where p.client_id is null;

create or replace function public.my_client_id() returns bigint
language sql stable security definer set search_path = public as $$
  select client_id from public.profiles where id = auth.uid();
$$;
create or replace function public.my_email() returns text
language sql stable security definer set search_path = public as $$
  select lower(email) from public.profiles where id = auth.uid();
$$;
revoke all on function public.my_client_id(), public.my_email() from public, anon;
grant execute on function public.my_client_id(), public.my_email() to authenticated;

-- client policies: SELECT own rows only. No client policy exists on session_notes, discount_codes,
-- collaborators, code_redemptions or the signatures bucket, and no client write policy anywhere.
create policy client_read_own_client   on public.clients      for select to authenticated using (id = public.my_client_id());
create policy client_read_own_intake   on public.intake_forms for select to authenticated using (client_id = public.my_client_id());
create policy client_read_own_bookings on public.bookings     for select to authenticated
  using (client_id = public.my_client_id() or lower(customer_email) = public.my_email());
create policy client_read_own_checkins on public.check_ins    for select to authenticated using (client_id = public.my_client_id());

-- reschedule — migration "reschedule", 7 Oct 2026 ---------------------------
-- Admin proposes a new time; the booking goes to status 'reschedule_pending' and KEEPS HOLDING its
-- original slot (booking_date/start_min/end_min are untouched, payment is untouched). The client
-- accepts in her account (via /reschedule-accept, which also emails Halima); only then do
-- booking_date/start_min/end_min move, status -> 'confirmed', confirmed_at is stamped.
-- original_starts_at / proposed_starts_at are London-time instants kept for display and history.
-- No reason for the move is stored anywhere.
alter table public.bookings add column if not exists original_starts_at timestamptz;
alter table public.bookings add column if not exists proposed_starts_at timestamptz;
alter table public.bookings add column if not exists confirmed_at timestamptz;

-- reserve_slot: identical to before except 'reschedule_pending' now also blocks the calendar.
create or replace function public.reserve_slot(p_booking_date date, p_start_min integer, p_end_min integer, p_treatment text, p_customer_name text, p_customer_email text, p_customer_phone text, p_location text, p_address text, p_amount_pence integer, p_hold_expires_at bigint, p_now bigint, p_discount_code text default null, p_discount_pence integer default null, p_travel_zone text default null, p_travel_pence integer default null, p_treatments jsonb default null)
returns bigint
language plpgsql
as $function$
declare
  v_id bigint;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_booking_date::text, 0));

  if exists (
    select 1 from public.bookings
    where booking_date = p_booking_date
      and start_min < p_end_min
      and end_min > p_start_min
      and (status in ('confirmed', 'reschedule_pending') or (status = 'pending' and hold_expires_at > p_now))
  ) then
    return null;
  end if;

  insert into public.bookings
    (booking_date, start_min, end_min, treatment, customer_name, customer_email,
     customer_phone, location, address, amount_pence, status, hold_expires_at, created_at,
     discount_code, discount_pence, travel_zone, travel_pence, treatments)
  values
    (p_booking_date, p_start_min, p_end_min, p_treatment, p_customer_name, p_customer_email,
     p_customer_phone, p_location, p_address, p_amount_pence, 'pending', p_hold_expires_at, p_now,
     p_discount_code, p_discount_pence, p_travel_zone, p_travel_pence, p_treatments)
  returning id into v_id;

  return v_id;
end;
$function$;

-- internal: propose a new time (no auth check; only the admin wrapper and the service role reach it)
create or replace function public._propose_reschedule(p_booking bigint, p_date date, p_start_min int)
returns jsonb language plpgsql security definer set search_path = public as $$
declare b public.bookings; dur int; new_end int; clash bigint; ts timestamptz; cur timestamptz;
begin
  select * into b from public.bookings where id = p_booking for update;
  if not found then raise exception 'not_found'; end if;
  if b.status not in ('confirmed', 'reschedule_pending') then raise exception 'bad_status'; end if;
  dur := b.end_min - b.start_min; new_end := p_start_min + dur;
  perform pg_advisory_xact_lock(hashtextextended(p_date::text, 0));
  select id into clash from public.bookings
   where id <> b.id and booking_date = p_date and start_min < new_end and end_min > p_start_min
     and (status in ('confirmed', 'reschedule_pending')
          or (status = 'pending' and hold_expires_at > extract(epoch from now())::bigint))
   limit 1;
  if clash is not null then raise exception 'clash'; end if;
  ts  := (p_date + make_interval(mins => p_start_min)) at time zone 'Europe/London';
  cur := (b.booking_date + make_interval(mins => b.start_min)) at time zone 'Europe/London';
  update public.bookings
     set original_starts_at = case when b.status = 'confirmed' then cur else coalesce(original_starts_at, cur) end,
         proposed_starts_at = ts, status = 'reschedule_pending', done_at = null
   where id = b.id;
  return jsonb_build_object('id', b.id, 'proposed_starts_at', ts);
end $$;
revoke all on function public._propose_reschedule(bigint, date, int) from public, anon, authenticated;

create or replace function public.propose_reschedule(p_booking bigint, p_date date, p_start_min int)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  return public._propose_reschedule(p_booking, p_date, p_start_min);
end $$;

create or replace function public.cancel_reschedule(p_booking bigint)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  update public.bookings set status = 'confirmed', proposed_starts_at = null, original_starts_at = null
   where id = p_booking and status = 'reschedule_pending';
end $$;

-- client accepts: only the booking's own client, only while pending, only if the time is still free
create or replace function public.accept_reschedule(p_booking bigint)
returns jsonb language plpgsql security definer set search_path = public as $$
declare b public.bookings; loc timestamp; d date; m int; dur int; clash bigint;
begin
  if auth.uid() is null then raise exception 'forbidden'; end if;
  select * into b from public.bookings where id = p_booking for update;
  if not found or not coalesce(b.client_id = public.my_client_id() or lower(b.customer_email) = public.my_email(), false) then
    raise exception 'not_found';
  end if;
  if b.status <> 'reschedule_pending' or b.proposed_starts_at is null then raise exception 'not_pending'; end if;
  loc := b.proposed_starts_at at time zone 'Europe/London';
  d := loc::date; m := extract(hour from loc)::int * 60 + extract(minute from loc)::int; dur := b.end_min - b.start_min;
  perform pg_advisory_xact_lock(hashtextextended(d::text, 0));
  select id into clash from public.bookings
   where id <> b.id and booking_date = d and start_min < m + dur and end_min > m
     and (status in ('confirmed', 'reschedule_pending')
          or (status = 'pending' and hold_expires_at > extract(epoch from now())::bigint))
   limit 1;
  if clash is not null then raise exception 'time_taken'; end if;
  update public.bookings
     set booking_date = d, start_min = m, end_min = m + dur, status = 'confirmed',
         confirmed_at = now(), proposed_starts_at = null
   where id = b.id;
  return jsonb_build_object('id', b.id, 'name', b.customer_name, 'email', b.customer_email, 'phone', b.customer_phone,
    'treatment', b.treatment, 'location', b.location, 'date', d, 'start_min', m,
    'original_starts_at', b.original_starts_at);
end $$;

revoke all on function public.propose_reschedule(bigint, date, int), public.cancel_reschedule(bigint), public.accept_reschedule(bigint) from public, anon;
grant execute on function public.propose_reschedule(bigint, date, int), public.cancel_reschedule(bigint), public.accept_reschedule(bigint) to authenticated;

-- test-data marker — migration "test_data_marker", 7 Oct 2026 -------------
-- Rehearsal rows are flagged is_test. The app hides them (Today, Clients, Codes, Stats, revenue) unless
-- Settings -> "Show test data" is on; supabase-delete-test-data.sql removes them in one go.
-- A booking linked to a test client is flagged automatically (link_booking_client), and test bookings
-- never block a REAL client's reschedule (the clash checks in _propose_reschedule / accept_reschedule
-- ignore test rows unless the booking being moved is itself a test row). Test bookings are created with
-- NO code_redemptions row, so a real code such as GUEST-TEST is never left "used".
alter table public.clients  add column if not exists is_test boolean not null default false;
alter table public.bookings add column if not exists is_test boolean not null default false;
-- (link_booking_client, _propose_reschedule and accept_reschedule were re-created with the is_test
--  handling described above; their current definitions are in the live database.)

-- web push (admin alerts) — migration "push_subscriptions", 7 Oct 2026 ------------------------------
-- One row per admin device. Admin-only, and an admin can only see / change / create their OWN rows
-- (policy: is_admin() AND user_id = auth.uid(), for reads and writes). anon has no grant. The Functions
-- read them with the service role and delete a row when the push service answers 404/410.
create table if not exists public.push_subscriptions (
  id                 bigint generated always as identity primary key,
  user_id            uuid not null references auth.users(id) on delete cascade,
  endpoint           text not null unique,
  p256dh             text not null,
  auth               text not null,
  user_agent         text,
  notify_reschedule  boolean not null default true,
  notify_booking     boolean not null default true,
  created_at         timestamptz not null default now(),
  last_ok            timestamptz
);
create index if not exists push_subscriptions_user_idx on public.push_subscriptions(user_id);
alter table public.push_subscriptions enable row level security;
grant select, insert, update, delete on public.push_subscriptions to authenticated;
grant select, insert, update, delete on public.push_subscriptions to service_role;
create policy admin_own_push on public.push_subscriptions for all to authenticated
  using (public.is_admin() and user_id = auth.uid())
  with check (public.is_admin() and user_id = auth.uid());

-- push: third switch — migration "push_notify_intake", 7 Oct 2026
alter table public.push_subscriptions add column if not exists notify_intake boolean not null default true;
