-- Smart Route Planning — add coordinates to outlet metrics
-- ---------------------------------------------------------------------
-- get_ai_outlet_metrics didn't return coordinates, so there was nothing
-- for a route planner to work with even though outlets already carry
-- outlet->>'latitude' / outlet->>'longitude' on audits where GPS was
-- captured (see NewAudit's location step). This replaces that function
-- (create or replace — safe, no data migration needed) adding the most
-- recent known coordinates per outlet, and only that: not every audit of
-- an outlet necessarily has GPS, so this takes the latest one that does.
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
      lower(trim(a.outlet->>'shop_name')) as outlet_key,
      a.outlet->>'shop_name' as outlet_name,
      coalesce(a.outlet->>'area_name', a.outlet->>'area_id') as area,
      count(*) as visit_count,
      max(a.created_at)::date as last_visit_date,
      (current_date - max(a.created_at)::date) as days_since_last_visit,
      bool_or(a.market->>'promotion' = 'Yes') as ever_had_promotion,
      count(*) filter (
        where a.market->>'visited' = 'No' or a.market->>'visited' is null
      ) as visits_unconfirmed,
      -- Most recent audit of this outlet that actually captured GPS —
      -- not every visit will have it, so this isn't "latest audit",
      -- it's "latest audit with coordinates, if any exist at all".
      (
        select jsonb_build_object(
          'latitude', a2.outlet->>'latitude',
          'longitude', a2.outlet->>'longitude'
        )
        from audit_submissions a2
        where lower(trim(a2.outlet->>'shop_name')) = lower(trim(a.outlet->>'shop_name'))
          and a2.outlet->>'latitude' is not null
          and a2.outlet->>'longitude' is not null
        order by a2.created_at desc
        limit 1
      ) as coordinates
    from audit_submissions a
    where a.outlet->>'shop_name' is not null
      and (p_start_date is null or a.created_at >= p_start_date::timestamptz)
      and (p_end_date is null or a.created_at < (p_end_date::date + 1)::timestamptz)
    group by 1, 2, 3
    order by visit_count asc
  ) t
$$;

grant execute on function get_ai_outlet_metrics(date, date) to service_role, authenticated;
