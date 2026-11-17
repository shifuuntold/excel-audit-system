-- Normalized outlets + location verification
-- =====================================================================
-- WHY: audits stored their outlet as a jsonb snapshot and the whole
-- system matched outlets by lower(trim(shop_name)). That cannot tell two
-- shops with the same name apart, cannot support repeat-problem analysis
-- per physical outlet, and gave nothing to verify a GPS reading against.
--
-- WHAT THIS MIGRATION DOES
--   1. app_settings           configurable values (location radius etc.)
--   2. outlets                stable outlet id, registered coordinates
--   3. audit_submissions      + outlet_id, captured coordinates, and the
--                             location-verification result
--   4. verify_audit_location  BEFORE INSERT/UPDATE trigger that computes the
--                             verification result on the server (a client
--                             cannot claim "verified")
--   5. conservative backfill  links only audits whose identity can be
--                             established; everything else goes to
--                             outlet_backfill_review for a person to decide
--
-- NOTHING IS DELETED OR REWRITTEN: the original `outlet` jsonb snapshot on
-- every audit is left exactly as it was.
--
-- ASSUMPTION (not verifiable from the repo, whose base schema is not
-- versioned): audit_submissions(id, user_id, created_at, outlet jsonb,
-- products jsonb, market jsonb) and profiles(id, full_name, role).
-- areas.id's type is unknown, so outlets.area_id is stored as text with no
-- foreign key; area_name is kept as a readable snapshot.
-- =====================================================================

-- gen_random_uuid() is built into PostgreSQL 13+, so no extension is needed.

-- ---------------------------------------------------------------------
-- Distance helper (great-circle, metres)
-- ---------------------------------------------------------------------
create or replace function public.haversine_m(
    lat1 double precision, lon1 double precision,
    lat2 double precision, lon2 double precision
) returns double precision
language sql immutable parallel safe
as $$
  select case
    when lat1 is null or lon1 is null or lat2 is null or lon2 is null then null
    else 2 * 6371000 * asin(least(1, sqrt(
      power(sin(radians(lat2 - lat1) / 2), 2) +
      cos(radians(lat1)) * cos(radians(lat2)) *
      power(sin(radians(lon2 - lon1) / 2), 2)
    )))
  end
$$;

-- ---------------------------------------------------------------------
-- Configurable settings
-- ---------------------------------------------------------------------
create table if not exists app_settings (
    key text primary key,
    value jsonb not null,
    description text,
    updated_by uuid references profiles(id) on delete set null,
    updated_at timestamptz not null default now()
);

alter table app_settings enable row level security;

drop policy if exists "Authenticated users read settings" on app_settings;
create policy "Authenticated users read settings"
    on app_settings for select
    using (auth.uid() is not null);

drop policy if exists "Admins manage settings" on app_settings;
create policy "Admins manage settings"
    on app_settings for all
    using (exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin'))
    with check (exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin'));

-- DEFAULTS AND THE REASONING BEHIND THEM (engineering judgement, NOT an
-- approved Excel Chemicals rule - an admin can change them):
--   radius_m          100  Consumer phone GPS is typically good to roughly
--                          5-20 m outdoors but can drift to tens of metres
--                          between buildings; small shops in the same
--                          market can be only 10-30 m apart. 100 m keeps a
--                          reading inside the right block without
--                          rejecting honest readings from inside a shop.
--   max_accuracy_m    150  The browser reports an accuracy radius with each
--                          fix. Above this the reading is too imprecise to
--                          confirm or contradict anything, so the audit is
--                          marked 'low_accuracy' (flagged for review) rather
--                          than 'outside_radius'.
--   backfill_cluster_m 150 When linking old audits to an outlet, captures
--                          within this distance of each other are treated
--                          as the same place.
insert into app_settings (key, value, description) values (
    'location_verification',
    '{"radius_m": 100, "max_accuracy_m": 150, "backfill_cluster_m": 150}'::jsonb,
    'Location verification thresholds. See migration 20260810000000 for the reasoning behind the defaults.'
) on conflict (key) do nothing;

-- ---------------------------------------------------------------------
-- Outlets
-- ---------------------------------------------------------------------
create table if not exists outlets (
    id uuid primary key default gen_random_uuid(),
    name text not null check (length(trim(name)) > 0),
    normalized_name text generated always as (lower(regexp_replace(trim(name), '\s+', ' ', 'g'))) stored,
    area_id text,
    area_name text,
    address text,
    latitude double precision check (latitude between -90 and 90),
    longitude double precision check (longitude between -180 and 180),
    location_source text check (location_source in ('device_capture', 'map_search', 'manual', 'backfill')),
    primary_distributor text,
    is_active boolean not null default true,
    needs_review boolean not null default false,
    review_note text,
    created_by uuid references profiles(id) on delete set null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    check ((latitude is null) = (longitude is null))
);

-- Deliberately NOT unique: two real shops can share a name in one area
-- (e.g. "Mama Mboga"). The app warns about near-duplicates instead.
create index if not exists outlets_name_area_idx on outlets (normalized_name, area_id);
create index if not exists outlets_active_idx on outlets (is_active);

create or replace function outlets_touch_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists outlets_touch_updated_at_trg on outlets;
create trigger outlets_touch_updated_at_trg
    before update on outlets
    for each row execute function outlets_touch_updated_at();

alter table outlets enable row level security;

-- Everyone signed in can see outlets (an auditor needs them to pick the
-- right shop and avoid creating duplicates).
drop policy if exists "Authenticated users read outlets" on outlets;
create policy "Authenticated users read outlets"
    on outlets for select
    using (auth.uid() is not null);

-- Anyone signed in can register a NEW outlet (offline audits create their
-- outlet when they sync), but only as themselves.
drop policy if exists "Authenticated users register outlets" on outlets;
create policy "Authenticated users register outlets"
    on outlets for insert
    with check (auth.uid() is not null and created_by = auth.uid());

-- Only Supervisors/Admins may change an outlet afterwards. The registered
-- location is the REFERENCE that audits are verified against, so an
-- auditor must not be able to move it. There is no delete policy:
-- outlets are deactivated, never removed.
drop policy if exists "Supervisors manage outlets" on outlets;
create policy "Supervisors manage outlets"
    on outlets for update
    using (exists (select 1 from profiles p where p.id = auth.uid() and p.role in ('supervisor', 'admin')))
    with check (exists (select 1 from profiles p where p.id = auth.uid() and p.role in ('supervisor', 'admin')));

-- ---------------------------------------------------------------------
-- Audit columns
-- ---------------------------------------------------------------------
alter table audit_submissions
    add column if not exists outlet_id uuid references outlets(id) on delete restrict,
    add column if not exists captured_latitude double precision,
    add column if not exists captured_longitude double precision,
    add column if not exists captured_accuracy_m double precision,
    add column if not exists registers_outlet_location boolean not null default false,
    add column if not exists location_status text,
    add column if not exists location_distance_m numeric,
    add column if not exists location_radius_m numeric,
    add column if not exists location_checked_at timestamptz;

alter table audit_submissions drop constraint if exists audit_location_status_check;
alter table audit_submissions add constraint audit_location_status_check
    check (location_status is null or location_status in (
        'verified', 'outside_radius', 'low_accuracy', 'unavailable',
        'no_registered_location', 'baseline_set', 'legacy_unverified'
    ));

create index if not exists audit_submissions_outlet_id_idx on audit_submissions (outlet_id);
create index if not exists audit_submissions_location_status_idx on audit_submissions (location_status);

-- ---------------------------------------------------------------------
-- Server-side verification. The result is computed here so that a
-- modified client cannot submit "verified". The CAPTURED coordinates are
-- always stored as sent, whatever the result.
--   unavailable            no device coordinates were captured
--   no_registered_location the outlet has no registered coordinates (or
--                          the audit has no outlet link)
--   baseline_set           this audit's capture IS the outlet's registered
--                          location (distance ~0), so it is the reference,
--                          not a verification - honoured only if the
--                          coordinates really do match
--   low_accuracy           reported accuracy worse than max_accuracy_m
--   verified               distance <= radius + reported accuracy, i.e. the
--                          reading is consistent with being inside the radius
--   outside_radius         otherwise
-- No status blocks the audit; the status exists for later review.
-- ---------------------------------------------------------------------
create or replace function verify_audit_location() returns trigger
language plpgsql as $$
declare
  cfg jsonb;
  v_radius numeric;
  v_max_acc numeric;
  o_lat double precision;
  o_lon double precision;
  d double precision;
begin
  if current_setting('app.skip_location_verification', true) = 'on' then
    return new;
  end if;

  select value into cfg from app_settings where key = 'location_verification';
  v_radius := coalesce((cfg->>'radius_m')::numeric, 100);
  v_max_acc := coalesce((cfg->>'max_accuracy_m')::numeric, 150);

  new.location_radius_m := v_radius;
  new.location_checked_at := now();
  new.location_distance_m := null;

  if new.captured_latitude is null or new.captured_longitude is null then
    new.location_status := 'unavailable';
    return new;
  end if;

  if new.outlet_id is not null then
    select latitude, longitude into o_lat, o_lon from outlets where id = new.outlet_id;
  end if;

  if o_lat is null or o_lon is null then
    new.location_status := 'no_registered_location';
    return new;
  end if;

  d := haversine_m(new.captured_latitude, new.captured_longitude, o_lat, o_lon);
  new.location_distance_m := round(d::numeric, 1);

  if new.registers_outlet_location and d <= 1 then
    new.location_status := 'baseline_set';
  elsif new.captured_accuracy_m is not null and new.captured_accuracy_m > v_max_acc then
    new.location_status := 'low_accuracy';
  elsif d <= v_radius + coalesce(new.captured_accuracy_m, 0) then
    new.location_status := 'verified';
  else
    new.location_status := 'outside_radius';
  end if;

  return new;
end $$;

drop trigger if exists verify_audit_location_trg on audit_submissions;
create trigger verify_audit_location_trg
    before insert or update of outlet_id, captured_latitude, captured_longitude,
        captured_accuracy_m, registers_outlet_location
    on audit_submissions
    for each row execute function verify_audit_location();

-- ---------------------------------------------------------------------
-- Backfill review queue
-- ---------------------------------------------------------------------
create table if not exists outlet_backfill_review (
    id uuid primary key default gen_random_uuid(),
    audit_id uuid not null unique references audit_submissions(id) on delete cascade,
    shop_name text,
    area text,
    reason text not null,
    created_at timestamptz not null default now(),
    resolved_at timestamptz
);

alter table outlet_backfill_review enable row level security;
drop policy if exists "Supervisors read backfill review" on outlet_backfill_review;
create policy "Supervisors read backfill review"
    on outlet_backfill_review for select
    using (exists (select 1 from profiles p where p.id = auth.uid() and p.role in ('supervisor', 'admin')));

-- ---------------------------------------------------------------------
-- Conservative backfill (runs once; safe to re-run)
-- A group = same normalized name + same area, among audits with no
-- outlet_id yet.
--   * generic/placeholder or empty name  -> NEVER linked (review queue)
--   * captures spread wider than backfill_cluster_m -> ambiguous: NOT
--     linked (review queue); one name, several places
--   * captures clustered              -> one outlet at the latest capture
--   * no captures at all              -> one outlet, needs_review = true:
--     identity rests on name+area alone (the rule the system already used)
-- ---------------------------------------------------------------------
do $backfill$
declare
  v_cluster numeric;
begin
  perform set_config('app.skip_location_verification', 'on', true);

  select coalesce((value->>'backfill_cluster_m')::numeric, 150) into v_cluster
  from app_settings where key = 'location_verification';

  -- 1. copy the old device capture into the dedicated columns
  update audit_submissions
  set captured_latitude = (outlet->>'latitude')::double precision,
      captured_longitude = (outlet->>'longitude')::double precision
  where captured_latitude is null
    and outlet->>'latitude' ~ '^-?[0-9]+(\.[0-9]+)?$'
    and outlet->>'longitude' ~ '^-?[0-9]+(\.[0-9]+)?$';

  -- 2. candidate audits
  create temporary table _bf on commit drop as
  select
    a.id as audit_id,
    lower(regexp_replace(trim(a.outlet->>'shop_name'), '\s+', ' ', 'g')) as nkey,
    coalesce(nullif(a.outlet->>'area_id', ''), nullif(a.outlet->>'area_name', ''), '') as akey,
    a.outlet->>'shop_name' as shop_name,
    a.outlet->>'area_id' as area_id,
    a.outlet->>'area_name' as area_name,
    a.captured_latitude as lat,
    a.captured_longitude as lon,
    a.created_at,
    a.user_id
  from audit_submissions a
  where a.outlet_id is null;

  -- 3. never-link set
  insert into outlet_backfill_review (audit_id, shop_name, area, reason)
  select audit_id, shop_name, coalesce(area_name, area_id),
         'Generic or missing outlet name - cannot establish which outlet this was'
  from _bf
  where nkey is null or nkey in (
    'shop', 'duka', 'kiosk', 'store', 'general shop', 'general store',
    'n/a', 'na', 'unknown', 'unnamed', 'outlet', ''
  )
  on conflict (audit_id) do nothing;

  delete from _bf
  where nkey is null or nkey in (
    'shop', 'duka', 'kiosk', 'store', 'general shop', 'general store',
    'n/a', 'na', 'unknown', 'unnamed', 'outlet', ''
  );

  -- 4. group statistics
  create temporary table _grp on commit drop as
  with latest as (
    select distinct on (nkey, akey) nkey, akey, lat as llat, lon as llon,
           shop_name as lname, area_id as larea_id, area_name as larea_name, user_id as luser
    from _bf
    order by nkey, akey, (lat is not null) desc, created_at desc
  )
  select
    gen_random_uuid() as outlet_id,
    l.nkey, l.akey, l.llat, l.llon, l.lname, l.larea_id, l.larea_name, l.luser,
    (select count(*) from _bf b where b.nkey = l.nkey and b.akey = l.akey) as n_audits,
    (select count(*) from _bf b where b.nkey = l.nkey and b.akey = l.akey and b.lat is not null) as n_coords,
    (select coalesce(max(haversine_m(b.lat, b.lon, l.llat, l.llon)), 0)
       from _bf b where b.nkey = l.nkey and b.akey = l.akey and b.lat is not null) as spread_m
  from latest l;

  -- 5. ambiguous groups -> review, not linked
  insert into outlet_backfill_review (audit_id, shop_name, area, reason)
  select b.audit_id, b.shop_name, coalesce(b.area_name, b.area_id),
         'Same name and area but captures are ' || round(g.spread_m)::text ||
         ' m apart (limit ' || v_cluster::text || ' m) - may be different outlets'
  from _bf b join _grp g using (nkey, akey)
  where g.spread_m > v_cluster
  on conflict (audit_id) do nothing;

  delete from _grp where spread_m > v_cluster;

  -- 6. create outlets for the confident groups
  insert into outlets (id, name, area_id, area_name, latitude, longitude,
                       location_source, needs_review, review_note, created_by)
  select g.outlet_id, trim(g.lname), nullif(g.larea_id, ''), g.larea_name,
         g.llat, g.llon,
         case when g.llat is not null then 'backfill' end,
         g.n_coords = 0,
         case when g.n_coords = 0
              then 'Backfilled from name and area only; no coordinates were captured to confirm identity'
         end,
         (select p.id from profiles p where p.id = g.luser)
  from _grp g;

  -- 7. link audits, mark them as pre-migration (not verified)
  update audit_submissions a
  set outlet_id = g.outlet_id,
      location_status = 'legacy_unverified'
  from _bf b join _grp g using (nkey, akey)
  where a.id = b.audit_id;

  -- audits that stayed unlinked keep their old capture, unverified
  update audit_submissions
  set location_status = 'legacy_unverified'
  where outlet_id is null and location_status is null;
end
$backfill$;
