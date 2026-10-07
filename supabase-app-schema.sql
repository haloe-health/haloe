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
--   1. Authentication -> Users -> Invite user: iamhalimayasmin@gmail.com
--   2. Authentication -> URL configuration: Site URL https://haloe.health/app ;
--      add https://haloe.health/app/ (and http://localhost:8788/app/ for local) as redirect URLs
--   3. Authentication -> Providers -> Email: turn OFF "Allow new users to sign up"

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
