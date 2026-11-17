-- TEST-ONLY stand-in for the live base schema.
-- The real tables (profiles, areas, audit_submissions) and their policies
-- are NOT versioned in this repository, so tests rebuild just enough of
-- them, using the column names the migrations and client code rely on.
create schema if not exists auth;
create table auth.users (id uuid primary key);
create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin; end if;
end $$;

create table profiles (id uuid primary key references auth.users(id), full_name text, role text);
create table areas (id uuid primary key default gen_random_uuid(), name text, latitude double precision, longitude double precision);
create table audit_submissions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id),
  created_at timestamptz not null default now(),
  outlet jsonb, products jsonb, market jsonb
);
grant usage on schema public, auth to authenticated, service_role;
grant all on all tables in schema public to authenticated, service_role;
-- Supabase grants new public tables to these roles by default; mirror that.
alter default privileges in schema public grant all on tables to authenticated, service_role;
