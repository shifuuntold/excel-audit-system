# AI Audit Analyst: design as implemented

Flow: **user question → router → deterministic database analytics → deterministic rules → minimum-sample gate → grounded prompt → model → structure check → numeric check → user**.
The model never calculates a business figure.

## Access
| Mode | Who | Why |
|---|---|---|
| `query`, `weekly_brief` | supervisor, admin | They return team-wide aggregates; the function reads with the service-role key. |
| `full_report` | any signed-in role | Narrates a report the browser built from data that user may already read; no database access. |
The role is read from `profiles` on the server. The anon key alone is rejected (401).
Supervisors currently see all audits in this application, so "supervisor" means organisation-wide.

## Rules (all thresholds are business judgement carried over from the original code, not approved company rules)
| ID | Rule | Field(s) | Threshold |
|---|---|---|---|
| R01 | Low outlet coverage by area | `area_performance.coverage_pct` | medium < 30%, high < 15% |
| R02 | Low promotion rate | `overall.promotion_rate_pct` | high < 5% |
| R03 | Incomplete audit data | `overall.missing_person_met / missing_mobile / missing_location` | medium ≥ 15%, high ≥ 40% |
| R04 | Stale outlet | `outlet.days_since_last_visit` | medium ≥ 14 d, high ≥ 30 d |
| R05 | Outlet with no promotion | `ever_had_promotion`, `visit_count` | ≥ 2 visits |
| R06 | Inactive auditor | `audit_count`, `days_since_last_audit` | 0 audits; ≥ 14 d |
| R07 | Audit volume drop | `trend.total_audits` | ≥ 30% fall |
| R08 | Promotion rate drop | `trend.promotion_rate_pct` | ≥ 40% fall |
| R09 | Auditor performance drop | `auditor audit_count` vs previous | ≥ 70% fall, previous ≥ 5 audits |
| R10 | Repeated problem at one outlet | `repeat_issues.*` | ≥ 3 occurrences; product line also ≥ 75% of visits |
| R11 | Audits not linked to an outlet | `overall.audits_without_outlet_link` | ≥ 15% |
New in this work: R09's minimum-prior (5), R10's thresholds and R11 are judgement values introduced here and are labelled as such.

Definitions: *coverage* = distinct active outlets audited ÷ active outlets registered. A product line is *not recorded* in an audit when no item for it was ticked; this does not prove it is out of stock.

## Safeguards
| Layer | Mechanism |
|---|---|
| Scope | Model sees aggregates only (no raw rows); row counts capped (40 per section). |
| Facts | Flags computed in code; every flag carries a deterministic evidence line. |
| Minimum sample | Fewer than 5 audits in the period (env `AI_MIN_AUDITS`) → "insufficient data", no model call. 5 is a rule of thumb: one audit moves a percentage by ≥ 20 points. Trend questions also need ≥ 5 audits in the previous period. |
| Injection | Questions, history and every database string are sanitised; instruction-like text is replaced before it reaches the model; a question that tries to override instructions is refused without a model call. This is pattern-based defence in depth, not a guarantee. |
| Structure | Strict JSON shape (`answer`, `key_points`, `recommended_action`, `data_sufficient`); invalid replies are rejected. |
| Numbers | Every figure ≥ 10, any decimal or any percentage in the reply must exist (to rounding) in the supplied data. Failure → one retry naming the figure → otherwise the verified findings are shown without commentary. Bare digits 0–9 are treated as wording and not checked. |

## Limitations
Aggregates only; rules are thresholds, not statistics; outlet-level figures leave out audits that could not be linked to an outlet; figures the model derives by arithmetic are rejected rather than checked; pattern-based injection filtering can miss novel attacks; needs connectivity; not yet evaluated with the real model or real users.
