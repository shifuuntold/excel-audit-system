-- AI Audit Analyst — auditor & outlet intelligence
-- ---------------------------------------------------------------------
-- Adds two new RPCs alongside your existing get_ai_audit_submission_metrics:
--   get_ai_auditor_metrics(start, end)  -> per-auditor productivity/coverage
--   get_ai_outlet_metrics(start, end)   -> per-outlet visit recency & promo history
--
-- Assumptions made from the client codebase (services/*.js), NOT verified
-- against your live schema — check these before running:
--   audit_submissions: id, user_id, created_at, outlet jsonb, market jsonb
--     outlet ->> 'shop_name', outlet ->> 'area_id', outlet ->> 'area_name'
--     market ->> 'visited'   ('Yes' / 'No')
--     market ->> 'promotion' ('Yes' / 'No')
--   profiles: id, full_name, role  ('auditor' / 'supervisor' / 'admin')
--
-- Outlets aren't a normalized table in this system — each audit stores its
-- own outlet snapshot as jsonb. This groups by lower(trim(shop_name)) as an
-- approximation, so two outlets typed slightly differently ("Julius Shop"
-- vs "Julius shop") will be treated as different outlets. Same caveat as
-- the duplicate-name detector already in the Admin panel — worth revisiting
-- if/when outlets become a normalized table with stable IDs.
-- ---------------------------------------------------------------------

create or replace function get_ai_auditor_metrics(
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
      p.id as auditor_id,
      p.full_name as auditor_name,
      count(a.id) as audit_count,
      count(distinct coalesce(a.outlet->>'area_name', a.outlet->>'area_id'))
        filter (where a.id is not null) as areas_covered,
      count(*) filter (where a.market->>'promotion' = 'Yes') as promotions_recorded,
      count(*) filter (where a.market->>'visited' = 'Yes') as visits_confirmed,
      max(a.created_at)::date as last_audit_date,
      (current_date - max(a.created_at)::date) as days_since_last_audit
    from profiles p
    left join audit_submissions a
      on a.user_id = p.id
      and (p_start_date is null or a.created_at >= p_start_date::timestamptz)
      and (p_end_date is null or a.created_at < (p_end_date::date + 1)::timestamptz)
    where p.role = 'auditor'
    group by p.id, p.full_name
    order by audit_count desc
  ) t
$$;

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
      lower(trim(a.outlet->>'shop_name')) as outlet_key,
      a.outlet->>'shop_name' as outlet_name,
      coalesce(a.outlet->>'area_name', a.outlet->>'area_id') as area,
      count(*) as visit_count,
      max(a.created_at)::date as last_visit_date,
      (current_date - max(a.created_at)::date) as days_since_last_visit,
      bool_or(a.market->>'promotion' = 'Yes') as ever_had_promotion,
      count(*) filter (
        where a.market->>'visited' = 'No' or a.market->>'visited' is null
      ) as visits_unconfirmed
    from audit_submissions a
    where a.outlet->>'shop_name' is not null
      and (p_start_date is null or a.created_at >= p_start_date::timestamptz)
      and (p_end_date is null or a.created_at < (p_end_date::date + 1)::timestamptz)
    group by 1, 2, 3
    order by visit_count asc
  ) t
$$;

grant execute on function get_ai_auditor_metrics(date, date) to service_role, authenticated;
grant execute on function get_ai_outlet_metrics(date, date) to service_role, authenticated;
