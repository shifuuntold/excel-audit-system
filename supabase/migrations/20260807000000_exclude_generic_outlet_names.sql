-- Exclude generic/placeholder outlet names from outlet-identity grouping
-- ---------------------------------------------------------------------
-- get_ai_outlet_metrics groups audits by lower(trim(shop_name)) as a
-- stand-in for outlet identity, since there's no normalized outlets
-- table (see the original migration's caveat about this). That
-- assumption breaks down badly for a generic placeholder name like
-- "Shop" — every outlet an auditor didn't give a specific name to gets
-- lumped together into one fake "outlet" with an absurdly high visit
-- count, when in reality they're all different physical locations that
-- just happen to share a non-name. Excluding these from outlet-level
-- aggregation entirely rather than trying to guess at a better identity
-- for them — there isn't one available in the current data.
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
