// Data access for the AI Audit Analyst
// =====================================================================
// Maps each question type to the database functions that answer it. The
// database does ALL calculation; nothing here (or in the model) derives
// a business figure. Every call is read-only.
// =====================================================================

import type { Diagnostic } from "./contract.ts";
import { THRESHOLDS } from "./rules.ts";

export const QUERY_TYPES = [
  "area_performance",
  "sales_rep_coverage",
  "promotions",
  "competitor_landscape",
  "product_availability",
  "audit_summary",
  "auditor_productivity",
  "outlet_intelligence",
  "distributor_intelligence",
  "risk_summary",
  "trend_comparison",
  "unknown",
] as const;
export type QueryType = typeof QUERY_TYPES[number];

export const CLASSIFICATION_GUIDE = `
1. area_performance — how specific areas/territories are doing, including area vs product availability
2. sales_rep_coverage — visit coverage, outlets visited/missed, whether visits were confirmed
3. promotions — promotional activity
4. competitor_landscape — competitor presence/brands
5. product_availability — product/SKU presence in outlets, product vs area or product vs week
6. audit_summary — general "summarize this period" questions
7. auditor_productivity — specific auditors: most/least active, activity by week, coverage per auditor
8. outlet_intelligence — specific outlets: repeatedly missed, repeated problems at the same outlet, never promoted, due for a revisit, location checks
9. distributor_intelligence — distributors: most/least active, which areas rely on which
10. risk_summary — what's wrong, what needs urgent attention, what looks unusual
11. trend_comparison — comparing periods: "vs last month", "is X improving/getting worse"
12. unknown — anything that does not clearly fit the above, or is not about audit data
`;

/** Equal-length window immediately preceding [startDate, endDate]. */
export function previousPeriod(startDate?: string | null, endDate?: string | null) {
  if (!startDate || !endDate) return { prevStart: null as string | null, prevEnd: null as string | null };
  const start = new Date(`${startDate}T00:00:00Z`);
  const end = new Date(`${endDate}T00:00:00Z`);
  const spanMs = Math.max(end.getTime() - start.getTime(), 0);
  const prevEnd = new Date(start.getTime() - 24 * 60 * 60 * 1000);
  const prevStart = new Date(prevEnd.getTime() - spanMs);
  return { prevStart: prevStart.toISOString().slice(0, 10), prevEnd: prevEnd.toISOString().slice(0, 10) };
}

// deno-lint-ignore no-explicit-any
type Row = Record<string, any>;

export interface Bundle {
  overall?: Row;
  area_performance?: Row[];
  auditor_performance?: Row[];
  previous_auditor_performance?: Row[];
  outlet_intelligence?: Row[];
  repeat_issues?: Row[];
  distributor_intelligence?: Row[];
  area_product_matrix?: Row[];
  auditor_week_activity?: Row[];
  product_week_trend?: Row[];
  product_availability?: unknown;
  competitor_landscape?: unknown;
  trend?: { current: Row; previous: Row; previousPeriod: { startDate: string; endDate: string } } | null;
}

export interface FetchResult { bundle: Bundle; diagnostics: Diagnostic[] }

interface FetchArgs {
  // deno-lint-ignore no-explicit-any
  supabase: any;
  queryType: QueryType;
  startDate: string | null;
  endDate: string | null;
}

export async function fetchData({ supabase, queryType, startDate, endDate }: FetchArgs): Promise<FetchResult> {
  const base = { p_start_date: startDate || null, p_end_date: endDate || null };
  const diagnostics: Diagnostic[] = [];

  // deno-lint-ignore no-explicit-any
  async function rpc<T = any>(name: string, args: Record<string, unknown>): Promise<T> {
    const { data, error } = await supabase.rpc(name, args);
    if (error) throw new Error(`Database function ${name} failed: ${error.message ?? String(error)}`);
    return data as T;
  }

  const overview = (args = base) => rpc<{ overall: Row; area_performance: Row[] }>("get_ai_overview_metrics", args);
  const auditors = (args = base) => rpc<Row[]>("get_ai_auditor_metrics", args);
  const outlets = () => rpc<Row[]>("get_ai_outlet_metrics", base);
  const repeats = () => rpc<Row[]>("get_ai_outlet_repeat_issues", { ...base, p_min_occurrences: THRESHOLDS.repeatMinOccurrences });
  const distributors = () => rpc<Row[]>("get_ai_distributor_metrics", base);
  const cross = (dimension: string) => rpc<Row[]>("get_ai_cross_dimension", { ...base, p_dimension: dimension });

  // get_ai_audit_submission_metrics is NOT defined in this repository's
  // migrations, so its output shape cannot be checked. It is used only to
  // pass product availability / competitor context to the model; no rule
  // reads it. If it fails, say so instead of failing the whole question.
  async function legacy(): Promise<Row> {
    try {
      return (await rpc<Row>("get_ai_audit_submission_metrics", base)) || {};
    } catch (e) {
      diagnostics.push({ source: "get_ai_audit_submission_metrics", code: "not_object", message: `Legacy summary unavailable: ${e instanceof Error ? e.message : String(e)}` });
      return {};
    }
  }

  async function previousOverview() {
    const { prevStart, prevEnd } = previousPeriod(startDate, endDate);
    if (!prevStart || !prevEnd) return null;
    const prev = await overview({ p_start_date: prevStart, p_end_date: prevEnd });
    return { overall: prev.overall, period: { startDate: prevStart, endDate: prevEnd } };
  }

  const ov = await overview();
  const bundle: Bundle = { overall: ov.overall, area_performance: ov.area_performance };

  switch (queryType) {
    case "area_performance":
      bundle.area_product_matrix = await cross("area_product");
      break;
    case "sales_rep_coverage":
      [bundle.outlet_intelligence, bundle.auditor_performance] = await Promise.all([outlets(), auditors()]);
      break;
    case "promotions":
      bundle.outlet_intelligence = await outlets();
      break;
    case "competitor_landscape": {
      const s = await legacy();
      bundle.competitor_landscape = s.competitor_landscape ?? [];
      break;
    }
    case "product_availability": {
      const [s, matrix, weekly] = await Promise.all([legacy(), cross("area_product"), cross("product_week")]);
      bundle.product_availability = s.product_availability ?? [];
      bundle.area_product_matrix = matrix;
      bundle.product_week_trend = weekly;
      break;
    }
    case "audit_summary": {
      const s = await legacy();
      bundle.product_availability = s.product_availability ?? [];
      bundle.competitor_landscape = s.competitor_landscape ?? [];
      break;
    }
    case "auditor_productivity":
      [bundle.auditor_performance, bundle.auditor_week_activity] = await Promise.all([auditors(), cross("auditor_week")]);
      break;
    case "outlet_intelligence":
      [bundle.outlet_intelligence, bundle.repeat_issues] = await Promise.all([outlets(), repeats()]);
      break;
    case "distributor_intelligence":
      bundle.distributor_intelligence = await distributors();
      break;
    case "trend_comparison": {
      const [prev, cur, prevAud] = await Promise.all([previousOverview(), auditors(), (async () => {
        const { prevStart, prevEnd } = previousPeriod(startDate, endDate);
        return prevStart ? auditors({ p_start_date: prevStart, p_end_date: prevEnd }) : null;
      })()]);
      bundle.auditor_performance = cur;
      if (prevAud) bundle.previous_auditor_performance = prevAud;
      bundle.trend = prev ? { current: ov.overall, previous: prev.overall, previousPeriod: prev.period } : null;
      break;
    }
    case "risk_summary": {
      const { prevStart, prevEnd } = previousPeriod(startDate, endDate);
      const [prev, cur, prevAud, outs, reps, dists, s, matrix] = await Promise.all([
        previousOverview(),
        auditors(),
        prevStart ? auditors({ p_start_date: prevStart, p_end_date: prevEnd }) : Promise.resolve(null),
        outlets(), repeats(), distributors(), legacy(), cross("area_product"),
      ]);
      bundle.auditor_performance = cur;
      if (prevAud) bundle.previous_auditor_performance = prevAud;
      bundle.outlet_intelligence = outs;
      bundle.repeat_issues = reps;
      bundle.distributor_intelligence = dists;
      bundle.area_product_matrix = matrix;
      bundle.product_availability = s.product_availability ?? [];
      bundle.competitor_landscape = s.competitor_landscape ?? [];
      bundle.trend = prev ? { current: ov.overall, previous: prev.overall, previousPeriod: prev.period } : null;
      break;
    }
    default:
      break;
  }
  return { bundle, diagnostics };
}
