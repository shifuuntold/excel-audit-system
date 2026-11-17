# System status (verified against the repository)

Labels: **Implemented and verified** (code in the repo and covered by passing tests) ·
**Implemented but not fully verified** (code exists; something it depends on has not been exercised) ·
**Patch prepared** · **Not implemented** · **Future work**.

Test evidence: `npx vitest run` → 20 files, 250 tests passing (73 existed before this work).
The SQL tests run the real migrations on PostgreSQL (PGlite) against a **stand-in** base schema,
because the live base schema (`profiles`, `areas`, `audit_submissions`, their policies) is not versioned in this repository.

| Area | Status | Evidence / caveat |
|---|---|---|
| Audit capture wizard, drafts, offline queue | Implemented and verified (pre-existing) | Existing Vitest suites for the queue and cache. |
| Role model (auditor / supervisor / admin) | Implemented but not fully verified | `profiles.role`; client route guards in `utils/roles.js`. Live row-level-security policies are not in the repo. |
| Normalized `outlets` table, stable outlet id | Implemented but not fully verified | Migration `20260810…`; 33 SQL tests incl. backfill and RLS on the stand-in schema. **Not yet applied to the live database.** |
| Conservative backfill + review queue | Implemented but not fully verified | Tested on seeded legacy data; real records unseen. See `outlet-backfill.md`. |
| Outlet picker, new-outlet registration (offline-safe ids) | Implemented but not fully verified | Pure logic tested; UI not exercised in a browser here. |
| Location **capture** (device coordinates + accuracy) | Implemented and verified (capture pre-existed; accuracy now stored) | |
| Location **verification** (distance vs registered point, configurable radius) | Implemented but not fully verified | Database trigger is authoritative; SQL + client-preview tests. Needs the migration applied and a field test with real devices. |
| Admin screen to edit the radius / review backfill queue | Not implemented | Settings are rows in `app_settings`; review queue is a table. |
| Rules engine on a single data contract | Implemented and verified | `contract.ts`; each contract is checked against the SQL output in tests; 31 rule tests. |
| `get_ai_audit_submission_metrics` | Not verifiable | Its SQL is not in the repo; used only for pass-through context (product availability, competitors). No rule reads it. |
| Silent rule failure | Fixed and verified | Every rule returns `evaluated`, `not_applicable` or `error` with diagnostics. |
| AI Edge Function authorization | Implemented but not fully verified | 13 tests of the decision logic. Whether JWT verification is enabled for the deployed function cannot be seen from the repo (no `config.toml`). |
| Service-role key kept server-side | Verified in source | Only `Deno.env` in the Edge Function; no occurrence in `src/`, `scripts/` or build config. Deployed environment variables not inspected. |
| Trust/scope prompt, strict output structure, numeric verification, minimum-sample gate, injection redaction | Implemented and verified | `guard.ts`, `pipeline.ts`; 60 tests with a fake model. |
| Repeat-problem detection per outlet | Implemented but not fully verified | SQL function + rule R10 tested; depends on the outlet migration. |
| Cross-dimension analytics | Implemented but not fully verified | Three dimensions tested in SQL. Used only for area×product, product×week and auditor×week. |
| Weekly brief with evidence | Implemented but not fully verified | Figures computed in code; tested with a fake model. Not run against the real model. |
| General-knowledge route | Not implemented (by design) | Unnecessary; unsupported questions are declined rather than mixed with company data. |
| AI evaluation framework | Implemented; **results pending** | `evals/`; 40 questions, metrics unit-tested; no run has been made. |
| AI accuracy / usefulness / user-study results | None exist | Do not report any. |
| Per-supervisor area scoping | Future work | No team/area model exists; supervisors see all audits. |

## Defects found and what was done

| Finding | Action |
|---|---|
| The AI endpoint used the service-role key and checked nothing about the caller. | Authorization added (`auth.ts`); auditors and anonymous callers rejected for team-wide modes. |
| Rules read guessed field names; a wrong guess silently skipped a rule. | Replaced with a single contract and explicit diagnostics. |
| `auditorDropPct` threshold existed but no rule used it. | Rule R09 now uses it. |
| `get_ai_audit_submission_metrics` is not defined anywhere in the repo. | Rules now use `get_ai_overview_metrics` (defined and tested here). The old function is pass-through only. |
| Migrations `20260805` and `20260807` cannot be replayed on a fresh database (invalid SQL, later hotfixed by `20260808`). | Left untouched (already applied in production); pinned by a test. |
| Confidence level was driven by contact-detail gaps that no analysis uses. | Now driven by missing outlet link and missing GPS only. |
| Report-mode text and conversation history from the browser were trusted. | Sanitised, injection-redacted and, for reports, number-verified. |
