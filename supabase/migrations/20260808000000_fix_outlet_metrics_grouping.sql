-- Fix: "subquery uses ungrouped column a.outlet from outer query"
-- ---------------------------------------------------------------------
-- The previous version of this function put a correlated subquery
-- (looking up the latest known coordinates per outlet) directly in the
-- SELECT list of an aggregated query. PostgreSQL rejects that: the
-- subquery referenced a2.outlet->>'shop_name' = a.outlet->>'shop_name',
-- and even though `a.outlet->>'shop_name'` exactly matches one of the
-- GROUP BY expressions (group by 1, 2, 3), Postgres's rule for allowing
-- an outer-query reference inside a subquery checks whether the actual
-- table COLUMN (a.outlet, the raw jsonb) is grouped — not whether some
-- expression built from it happens to match a GROUP BY entry. Since the
-- group by list has expressions derived from a.outlet, not the bare
-- column itself, Postgres considers a.outlet ungrouped and refuses.
--
-- Fix: compute "latest coordinates per outlet" as its own independent
-- step (a CTE using DISTINCT ON, no correlation to the outer query at
-- all) and LEFT JOIN it in. The join produces at most one coordinates
-- row per outlet_key, so wrapping it in max() below is just a
-- non-aggregating pass-through — not an actual aggregation choice — and
-- avoids having to touch the existing GROUP BY list at all.
-- ---------------------------------------------------------------------

create or replace function get_ai_outlet_metrics(
    p_start_date date default null,
    p_end_date date default null
)
returns jsonb
language sql
stable
as $$
  with latest_coordinates as (
    select distinct on (lower(trim(outlet->>'shop_name')))
      lower(trim(outlet->>'shop_name')) as outlet_key,
      outlet->>'latitude' as latitude,
      outlet->>'longitude' as longitude
    from audit_submissions
    where outlet->>'shop_name' is not null
      and outlet->>'latitude' is not null
      and outlet->>'longitude' is not null
    order by lower(trim(outlet->>'shop_name')), created_at desc
  )
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
      jsonb_build_object(
        'latitude', max(c.latitude),
        'longitude', max(c.longitude)
      ) as coordinates
    from audit_submissions a
    left join latest_coordinates c
      on c.outlet_key = lower(trim(a.outlet->>'shop_name'))
    where a.outlet->>'shop_name' is not null
      and lower(trim(a.outlet->>'shop_name')) not in (
        'shop', 'duka', 'kiosk', 'store', 'general shop', 'general store',
        'n/a', 'na', 'unknown', 'unnamed', 'outlet', ''
      )
      and (p_start_date is null or a.created_at >= p_start_date::timestamptz)
      and (p_end_date is null or a.created_at < (p_end_date::date + 1)::timestamptz)
    group by 1, 2, 3
    order by visit_count asc
  ) t
$$;

grant execute on function get_ai_outlet_metrics(date, date) to service_role, authenticated;
