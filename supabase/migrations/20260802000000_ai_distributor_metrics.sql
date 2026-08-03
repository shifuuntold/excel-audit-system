-- AI Audit Analyst — distributor intelligence
-- ---------------------------------------------------------------------
-- Adds get_ai_distributor_metrics(start, end), aggregating the
-- market->'distributors' jsonb array (a list of distributor names picked
-- per audit — see src/components/audit/MarketStep.jsx) by distributor
-- and by area, so the AI report can say things like "Wasoko dominates
-- supply in Pipeline and Kasarani" instead of just a raw count.
--
-- Same schema assumptions as the auditor/outlet migration: audit_submissions
-- (id, created_at, outlet jsonb, market jsonb), market->'distributors' is a
-- jsonb array of distributor name strings.
-- ---------------------------------------------------------------------

create or replace function get_ai_distributor_metrics(
    p_start_date date default null,
    p_end_date date default null
)
returns jsonb
language sql
stable
as $$
  with expanded as (
    select
      trim(both '"' from d::text) as distributor_name,
      coalesce(a.outlet->>'area_name', a.outlet->>'area_id') as area,
      a.created_at
    from audit_submissions a
    cross join lateral jsonb_array_elements(coalesce(a.market->'distributors', '[]'::jsonb)) as d
    where (p_start_date is null or a.created_at >= p_start_date::timestamptz)
      and (p_end_date is null or a.created_at < (p_end_date::date + 1)::timestamptz)
  )
  select coalesce(jsonb_agg(row_to_json(t)), '[]'::jsonb)
  from (
    select
      distributor_name,
      count(*) as mention_count,
      count(distinct area) as areas_covered,
      jsonb_agg(distinct area) filter (where area is not null) as areas,
      max(created_at)::date as last_seen_date
    from expanded
    where distributor_name is not null and distributor_name <> ''
    group by distributor_name
    order by mention_count desc
  ) t
$$;

grant execute on function get_ai_distributor_metrics(date, date) to service_role, authenticated;
