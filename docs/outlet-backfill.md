# Applying the outlet migration and reviewing the backfill

Apply in order: `20260810…normalized_outlets_and_location_verification.sql`, then `20260811…ai_analytics_v2.sql`.
Deploy the new frontend only **after** both are applied (the new app writes `outlet_id` and `captured_*` columns), and deploy the Edge Function with the new code.

Nothing is deleted. Each audit's original `outlet` JSON is untouched.

| Audit group | What the migration does |
|---|---|
| Same name + area, captures within 150 m (or consistent) | One outlet created at the latest capture; audits linked; status `legacy_unverified`. |
| Same name + area, no coordinates at all | One outlet created with `needs_review = true`; audits linked (identity rests on name and area, the rule the system already used). |
| Same name + area but captures more than 150 m apart | **Not linked.** Rows added to `outlet_backfill_review`. |
| Generic or empty names (shop, duka, kiosk, store, …) | **Never linked.** Rows added to `outlet_backfill_review`. |

Review with (as a supervisor/admin):
```sql
select reason, shop_name, area, count(*) from outlet_backfill_review where resolved_at is null group by 1,2,3 order by 4 desc;
select id, name, area_name from outlets where needs_review;
```
Settings (edit as admin): `select * from app_settings;` → `location_verification` = `{radius_m, max_accuracy_m, backfill_cluster_m}`.
Defaults and the reasoning for them are in the migration header; they are engineering judgement, not an approved company rule.

Before running on production, take a backup and run the two `select` counts above on a copy first.
