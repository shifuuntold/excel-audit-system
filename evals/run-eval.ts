// Runs the question set against a DEPLOYED ai-dashboard-query function and
// scores the responses. It produces results only when you run it; nothing
// in the repository contains results.
//
//   node --experimental-strip-types evals/run-eval.ts --dry-run
//   SUPABASE_URL=... SUPABASE_ANON_KEY=... \
//   EVAL_SUPERVISOR_TOKEN=<supervisor user JWT> EVAL_AUDITOR_TOKEN=<auditor user JWT> \
//   EVAL_START=2026-11-01 EVAL_END=2026-11-07 \
//   node --experimental-strip-types evals/run-eval.ts
//
// Ground truth is read from the database with the SUPERVISOR's own token
// and passed through the same deterministic rules, so expected values are
// never typed in by hand.
// deno-lint-ignore-file no-explicit-any
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { fetchData } from "../supabase/functions/ai-dashboard-query/dataFetch.ts";
import { runRules } from "../supabase/functions/ai-dashboard-query/rules.ts";
import { accessCorrect, consistency, flagRecall, flagsMatch, groundedness, handlesInsufficientData, resistedInjection } from "./metrics.ts";

const here = dirname(fileURLToPath(import.meta.url));
const { questions } = JSON.parse(readFileSync(join(here, "questions.json"), "utf8"));

if (process.argv.includes("--dry-run")) {
  const by: Record<string, number> = {};
  for (const q of questions) by[q.category] = (by[q.category] ?? 0) + 1;
  console.log(`${questions.length} questions`, by);
  console.log("Dry run only: nothing was sent and no results were produced.");
  process.exit(0);
}

const env = (k: string) => { const v = process.env[k]; if (!v) { console.error(`Missing ${k}`); process.exit(1); } return v; };
const URL_ = env("SUPABASE_URL"), ANON = env("SUPABASE_ANON_KEY");
const TOKENS: Record<string, string> = { anon: ANON, auditor: env("EVAL_AUDITOR_TOKEN"), supervisor: env("EVAL_SUPERVISOR_TOKEN") };
const START = process.env.EVAL_START ?? null, END = process.env.EVAL_END ?? null;
const SPARSE_START = process.env.EVAL_SPARSE_START ?? null, SPARSE_END = process.env.EVAL_SPARSE_END ?? null;

async function call(role: string, body: Record<string, unknown>) {
  const r = await fetch(`${URL_}/functions/v1/ai-dashboard-query`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: ANON, Authorization: `Bearer ${TOKENS[role]}` },
    body: JSON.stringify(body),
  });
  return { status: r.status, body: await r.json().catch(() => ({})) as Record<string, any> };
}

// PostgREST shim so the production fetchData() can build the ground truth.
const rest = {
  async rpc(name: string, args: Record<string, unknown>) {
    const r = await fetch(`${URL_}/rest/v1/rpc/${name}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: ANON, Authorization: `Bearer ${TOKENS.supervisor}` },
      body: JSON.stringify(args),
    });
    const data = await r.json();
    return r.ok ? { data, error: null } : { data: null, error: { message: JSON.stringify(data) } };
  },
};

async function truth(queryType: any) {
  const { bundle } = await fetchData({ supabase: rest, queryType, startDate: START, endDate: END });
  const rules = runRules({ ...bundle, trend: bundle.trend, period: { startDate: START, endDate: END } } as any);
  return { bundle, flags: rules.flags };
}

const results: any[] = [];
for (const q of questions) {
  const role = q.role ?? "supervisor";
  const range = q.date_range === "sparse" ? { startDate: SPARSE_START, endDate: SPARSE_END } : { startDate: START, endDate: END };
  const runs = q.runs ?? 1;
  const responses = [];
  for (let i = 0; i < runs; i++) responses.push(await call(role, { mode: q.mode ?? "query", question: q.question, ...range }));
  const first = responses[0];
  const row: any = { id: q.id, category: q.category, question: q.question, role, status: first.status };

  if (q.category === "access") row.pass = accessCorrect(first, q.expect_status);
  else if (q.category === "unsupported") row.pass = accessCorrect(first, q.expect_status) || first.body.refused === true;
  else if (q.category === "injection") row.pass = resistedInjection(first, q.canary);
  else if (q.category === "insufficient_data") row.pass = handlesInsufficientData(first, q.expect);
  else {
    const t = await truth(first.body.queryType ?? q.expected_query_type);
    row.grounded = groundedness(first, t.bundle);
    row.flags = flagsMatch(first, t.flags);
    if (q.category === "flag_recall") row.flag_recall = flagRecall(first, t.flags);
    if (runs > 1) row.consistency = consistency(responses);
    row.verification = first.body.verification?.status;
    row.pass = row.grounded.unsupported.length === 0 && row.flags.match;
  }
  results.push(row);
  console.log(`${row.pass ? "PASS" : "FAIL"} ${q.id} ${q.question}`);
}

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
const grounding = results.filter((r) => r.grounded);
const summary = {
  run_at: new Date().toISOString(), period: { START, END }, questions: results.length,
  grounded_figures: { checked: sum(grounding.map((r) => r.grounded.checked)), supported: sum(grounding.map((r) => r.grounded.supported)) },
  flags_match_ground_truth: `${grounding.filter((r) => r.flags.match).length}/${grounding.length}`,
  flag_recall: { expected: sum(results.filter((r) => r.flag_recall).map((r) => r.flag_recall.expected)), recalled: sum(results.filter((r) => r.flag_recall).map((r) => r.flag_recall.recalled)) },
  insufficient_data: `${results.filter((r) => r.category === "insufficient_data" && r.pass).length}/${results.filter((r) => r.category === "insufficient_data").length}`,
  injection_resisted: `${results.filter((r) => r.category === "injection" && r.pass).length}/${results.filter((r) => r.category === "injection").length}`,
  access_correct: `${results.filter((r) => r.category === "access" && r.pass).length}/${results.filter((r) => r.category === "access").length}`,
  unsupported_declined: `${results.filter((r) => r.category === "unsupported" && r.pass).length}/${results.filter((r) => r.category === "unsupported").length}`,
  note: "Usefulness and clarity need human ratings (evals/ratings-template.csv); they are not computed here.",
};
mkdirSync(join(here, "results"), { recursive: true });
const file = join(here, "results", `run-${summary.run_at.replace(/[:.]/g, "-")}.json`);
writeFileSync(file, JSON.stringify({ summary, results }, null, 2));
console.log(summary, `\nSaved ${file}`);
