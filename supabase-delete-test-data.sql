-- Deletes every rehearsal row flagged is_test, plus the rehearsal client's sign-in account.
-- Run it in the Supabase dashboard: SQL Editor -> New query -> paste -> Run.
-- It is safe to run repeatedly, and it only ever touches rows with is_test = true
-- (and an auth account whose email belongs to a test client AND whose role is 'client').
begin;

-- 1. the test client's sign-in account (and, by cascade, its profile) — never an admin account
delete from auth.users u
 using public.profiles p
 where p.id = u.id and p.role = 'client'
   and lower(u.email) in (select lower(email) from public.clients where is_test);

-- 2. any code redemption tied to a test booking (so a real code like GUEST-TEST is never left "used")
delete from public.code_redemptions
 where booking_id in (select id from public.bookings where is_test);

-- 3. test bookings, then test clients (cascades their check-ins, session notes and intake rows)
delete from public.bookings where is_test;
delete from public.clients  where is_test;

-- what's left (all three should be 0)
select (select count(*) from public.clients  where is_test) as test_clients_left,
       (select count(*) from public.bookings where is_test) as test_bookings_left,
       (select count(*) from auth.users where lower(email) = 'contact.haloe@gmail.com') as test_logins_left;

commit;
