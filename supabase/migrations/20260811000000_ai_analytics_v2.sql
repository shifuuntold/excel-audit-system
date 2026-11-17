-- AI analytics v2: deterministic, outlet-id based, with a stable contract
-- =====================================================================
-- Every function below returns jsonb with a fixed set of field names.
-- Those names are the CONTRACT that supabase/functions/ai-dashboard-query/
-- contract.ts validates at runtime and that the tests in
-- supabase/functions/ai-dashboard-query/__tests__ check against the real
-- SQL output. Change a field here and the contract/tests must change too.
--
--   get_ai_overview_metrics     company-wide and per-area figures
--   get_ai_outlet_metrics       REPLACED: grouped by outlet_id, not by name
--   get_ai_outlet_repeat_issues repeated problems at one specific outlet
--   get_ai_cross_dimension      area x product, product x week, auditor x week
--
-- DEFINITIONS (used consistently in the report):
--   coverage_pct          distinct active outlets audited in the period /
--                         active outlets registered, x100
--   promotion_rate_pct    audits with a promotion recorded / audits, x100
--   visits_confirmed_pct  audits where the sales-rep visit was confirmed
--                         ("visited" = Yes) / audits, x100
--   product line "recorded" an audit has at least one item ticked for the
--                         line; "not recorded" means none was ticked. It does
--                         not prove the product is out of stock.
-- =====================================================================

create or replace function audit_has_product_group(p_products jsonb, p_group text)
returns boolean
language sql immutable
as $$
  select case
    when jsonb_typeof(p_products -> p_group) = 'object' then
      exists (select 1 from jsonb_each(p_products -> p_group) e where e.value = 'true'::jsonb)
    else false
  end
$$;

-- ---------------------------------------------------------------------
-- Overview
-- ---------------------------------------------------------------------
create or replace function get_ai_overview_metrics(
    p_start_date date default null,
    p_end_date date default null
)
returns jsonb
language sql
stable
as $$
  with a as (
    select s.*, coalesce(o.area_name, s.outlet->>'area_name', s.outlet->>'area_id') as area_label
    from audit_submissions s
    left join outlets o on o.id = s.outlet_id
    where (p_start_date is null or s.created_at >= p_start_date::timestamptz)
      and (p_end_date is null or s.created_at < (p_end_date::date + 1)::timestamptz)
  ),
  active as (select count(*) as n from outlets where is_active),
  overall as (
    select
      count(*) as total_audits,
      count(distinct a.outlet_id) filter (where a.outlet_id is not null) as outlets_audited,
      count(distinct a.user_id) as auditors_active,
      count(*) filter (where a.market->>'visited' = 'Yes') as visits_confirmed,
      count(*) filter (where a.market->>'promotion' = 'Yes') as promotions_recorded,
      count(*) filter (where a.location_status = 'verified') as location_verified,
      count(*) filter (where a.location_status = 'outside_radius') as location_outside_radius,
      count(*) filter (where a.location_status = 'low_accuracy') as location_low_accuracy,
      count(*) filter (where a.location_status = 'unavailable') as location_unavailable,
      count(*) filter (where a.outlet_id is null) as audits_without_outlet_link,
      count(*) filter (where coalesce(trim(a.outlet->>'person_met'), '') = '') as missing_person_met,
      count(*) filter (where coalesce(trim(a.outlet->>'mobile'), '') = '') as missing_mobile,
      count(*) filter (where a.captured_latitude is null) as missing_location
    from a
  ),
  by_area as (
    select
      area_label as area,
      count(*) as audits,
      count(distinct outlet_id) filter (where outlet_id is not null) as outlets_audited,
      count(*) filter (where market->>'visited' = 'Yes') as visits_confirmed,
      count(*) filter (where market->>'promotion' = 'Yes') as promotions_recorded
    from a
    where area_label is not null
    group by area_label
  )
  select jsonb_build_object(
    'overall', (
      select jsonb_build_object(
        'total_audits', o.total_audits,
        'outlets_audited', o.outlets_audited,
        'active_outlets', (select n from active),
        'coverage_pct', case when (select n from active) > 0
            then round(100.0 * o.outlets_audited / (select n from active), 1) end,
        'auditors_active', o.auditors_active,
        'visits_confirmed', o.visits_confirmed,
        'visits_confirmed_pct', case when o.total_audits > 0
            then round(100.0 * o.visits_confirmed / o.total_audits, 1) end,
        'promotions_recorded', o.promotions_recorded,
        'promotion_rate_pct', case when o.total_audits > 0
            then round(100.0 * o.promotions_recorded / o.total_audits, 1) end,
        'location_verified', o.location_verified,
        'location_outside_radius', o.location_outside_radius,
        'location_low_accuracy', o.location_low_accuracy,
        'location_unavailable', o.location_unavailable,
        'audits_without_outlet_link', o.audits_without_outlet_link,
        'missing_person_met', o.missing_person_met,
        'missing_mobile', o.missing_mobile,
        'missing_location', o.missing_location
      ) from overall o
    ),
    'area_performance', coalesce((
      select jsonb_agg(jsonb_build_object(
        'area', b.area,
        'audits', b.audits,
        'outlets_audited', b.outlets_audited,
        'active_outlets', ao.n,
        'coverage_pct', case when ao.n > 0 then round(100.0 * b.outlets_audited / ao.n, 1) end,
        'visits_confirmed_pct', round(100.0 * b.visits_confirmed / b.audits, 1),
        'promotion_rate_pct', round(100.0 * b.promotions_recorded / b.audits, 1)
      ) order by b.audits desc)
      from by_area b
      left join lateral (
        select count(*) as n from outlets o2
        where o2.is_active and coalesce(o2.area_name, o2.area_id) = b.area
      ) ao on true
    ), '[]'::jsonb)
  )
$$;

grant execute on function get_ai_overview_metrics(date, date) to service_role, authenticated;

-- ---------------------------------------------------------------------
-- Outlet metrics, grouped by outlet_id (replaces the name-based version).
-- visit_count / promotion / unconfirmed are counted inside the period;
-- last_visit_date and days_since_last_visit look at ALL history so an
-- outlet is not mistaken for "stale" or "new" just because of the filter.
-- Audits with no outlet link (generic names, ambiguous backfill) are not
-- attributed to any outlet.
-- ---------------------------------------------------------------------
create or replace function get_ai_outlet_metrics(
    p_start_date date default null,
    p_end_date date default null
)
returns jsonb
language sql
stable
as $$
  select coalesce(jsonb_agg(row_to_json(t)), '[]'::jsonb)
  from (
    select
      o.id as outlet_id,
      o.id::text as outlet_key,
      o.name as outlet_name,
      coalesce(o.area_name, o.area_id) as area,
      count(a.id) filter (where
          (p_start_date is null or a.created_at >= p_start_date::timestamptz)
          and (p_end_date is null or a.created_at < (p_end_date::date + 1)::timestamptz)
      ) as visit_count,
      max(a.created_at)::date as last_visit_date,
      (current_date - max(a.created_at)::date) as days_since_last_visit,
      coalesce(bool_or(a.market->>'promotion' = 'Yes'), false) as ever_had_promotion,
      count(a.id) filter (where
          (a.market->>'visited' is distinct from 'Yes')
          and (p_start_date is null or a.created_at >= p_start_date::timestamptz)
          and (p_end_date is null or a.created_at < (p_end_date::date + 1)::timestamptz)
      ) as visits_unconfirmed,
      count(a.id) filter (where a.location_status = 'outside_radius'
          and (p_start_date is null or a.created_at >= p_start_date::timestamptz)
          and (p_end_date is null or a.created_at < (p_end_date::date + 1)::timestamptz)
      ) as location_outside_radius,
      case when o.latitude is not null
        then jsonb_build_object('latitude', o.latitude, 'longitude', o.longitude) end as coordinates,
      o.needs_review as needs_review
    from outlets o
    left join audit_submissions a on a.outlet_id = o.id
    where o.is_active
    group by o.id, o.name, o.area_name, o.area_id, o.latitude, o.longitude, o.needs_review
    order by visit_count asc, o.name
  ) t
$$;

grant execute on function get_ai_outlet_metrics(date, date) to service_role, authenticated;

-- ---------------------------------------------------------------------
-- Repeated problems at ONE outlet. This only DETECTS the pattern; the AI
-- explains it. p_min_occurrences (default 3) is a judgement, not an
-- approved company rule.
-- ---------------------------------------------------------------------
create or replace function get_ai_outlet_repeat_issues(
    p_start_date date default null,
    p_end_date date default null,
    p_min_occurrences integer default 3
)
returns jsonb
language sql
stable
as $$
  with a as (
    select s.id, s.outlet_id, s.created_at, s.market, s.products, s.outlet, s.location_status
    from audit_submissions s
    where s.outlet_id is not null
      and (p_start_date is null or s.created_at >= p_start_date::timestamptz)
      and (p_end_date is null or s.created_at < (p_end_date::date + 1)::timestamptz)
  ),
  visits as (
    select outlet_id, count(*) as total_visits, max(created_at)::date as last_visit_date
    from a group by outlet_id
  ),
  issues as (
    select outlet_id, 'visit_not_confirmed'::text as issue_type, null::text as issue_detail,
           count(*) filter (where market->>'visited' is distinct from 'Yes') as occurrences
    from a group by outlet_id
    union all
    select outlet_id, 'location_outside_radius', null,
           count(*) filter (where location_status = 'outside_radius')
    from a group by outlet_id
    union all
    select outlet_id, 'missing_contact_details', null,
           count(*) filter (where coalesce(trim(outlet->>'person_met'), '') = ''
                              or coalesce(trim(outlet->>'mobile'), '') = '')
    from a group by outlet_id
    union all
    select a.outlet_id, 'product_line_not_recorded', g,
           count(*) filter (where not audit_has_product_group(a.products, g))
    from a
    cross join unnest(array['dtt','rtd','champ','gofrut','wb','jp','water','dc',
                            'cocoa','gluc','energy','reload','ff']) as g
    group by a.outlet_id, g
  )
  select coalesce(jsonb_agg(row_to_json(t)), '[]'::jsonb)
  from (
    select
      o.id as outlet_id,
      o.name as outlet_name,
      coalesce(o.area_name, o.area_id) as area,
      i.issue_type,
      i.issue_detail,
      i.occurrences,
      v.total_visits,
      round(100.0 * i.occurrences / v.total_visits, 1) as occurrence_pct,
      v.last_visit_date
    from issues i
    join visits v using (outlet_id)
    join outlets o on o.id = i.outlet_id
    where o.is_active and i.occurrences >= p_min_occurrences
    order by i.occurrences desc, o.name, i.issue_type, i.issue_detail
  ) t
$$;

grant execute on function get_ai_outlet_repeat_issues(date, date, integer) to service_role, authenticated;

-- ---------------------------------------------------------------------
-- Cross-dimension tables. One row per (row_label, col_label).
--   area_product  row = area,          col = product line
--   product_week  row = product line,  col = week starting (Monday)
--   auditor_week  row = auditor name,  col = week starting (Monday)
-- audits = audits in the cell; hits = audits where the thing was true
-- (product line recorded / sales-rep visit confirmed); pct = hits/audits.
-- ---------------------------------------------------------------------
create or replace function get_ai_cross_dimension(
    p_start_date date default null,
    p_end_date date default null,
    p_dimension text default 'area_product'
)
returns jsonb
language plpgsql
stable
as $$
declare
  v_groups text[] := array['dtt','rtd','champ','gofrut','wb','jp','water','dc',
                         'cocoa','gluc','energy','reload','ff'];
  result jsonb;
begin
  if p_dimension not in ('area_product', 'product_week', 'auditor_week') then
    raise exception 'Unknown dimension: %', p_dimension;
  end if;

  with a as (
    select s.*, coalesce(o.area_name, s.outlet->>'area_name', s.outlet->>'area_id') as area_label
    from audit_submissions s
    left join outlets o on o.id = s.outlet_id
    where (p_start_date is null or s.created_at >= p_start_date::timestamptz)
      and (p_end_date is null or s.created_at < (p_end_date::date + 1)::timestamptz)
  ),
  cells as (
    select a.area_label as row_label, g as col_label,
           count(*) as audits,
           count(*) filter (where audit_has_product_group(a.products, g)) as hits
    from a cross join unnest(v_groups) g
    where p_dimension = 'area_product' and a.area_label is not null
    group by a.area_label, g
    union all
    select g, date_trunc('week', a.created_at)::date::text,
           count(*), count(*) filter (where audit_has_product_group(a.products, g))
    from a cross join unnest(v_groups) g
    where p_dimension = 'product_week'
    group by g, date_trunc('week', a.created_at)::date
    union all
    select p.full_name, date_trunc('week', a.created_at)::date::text,
           count(*), count(*) filter (where a.market->>'visited' = 'Yes')
    from a join profiles p on p.id = a.user_id
    where p_dimension = 'auditor_week'
    group by p.full_name, date_trunc('week', a.created_at)::date
  )
  select coalesce(jsonb_agg(jsonb_build_object(
      'row_label', row_label, 'col_label', col_label,
      'audits', audits, 'hits', hits,
      'pct', round(100.0 * hits / nullif(audits, 0), 1)
  ) order by row_label, col_label), '[]'::jsonb)
  into result from cells;

  return result;
end
$$;

grant execute on function get_ai_cross_dimension(date, date, text) to service_role, authenticated;
