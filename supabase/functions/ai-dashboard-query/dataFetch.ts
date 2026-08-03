// Expanded from the original 6 categories. Each new type maps to
// questions your original classifier had no home for — see the PR
// discussion / your own list of failing questions for the reasoning.
export const QUERY_TYPES = [
  "area_performance",
  "sales_rep_coverage",
  "promotions",
  "competitor_landscape",
  "product_availability",
  "audit_summary",
  "auditor_productivity", // NEW — "which auditor is most productive", "least active rep"
  "outlet_intelligence", // NEW — "which outlets are repeatedly missed", "outlets never promoted"
  "distributor_intelligence", // NEW — "which distributors are underperforming", "who supplies area X"
  "risk_summary", // NEW — "biggest risks", "what needs urgent attention", "what looks unusual"
  "trend_comparison", // NEW — "compared to last month", "is coverage improving"
  "unknown",
] as const;

export type QueryType = typeof QUERY_TYPES[number];

export const CLASSIFICATION_GUIDE = `
1. area_performance — questions about how specific areas/territories are doing
2. sales_rep_coverage — questions about visit coverage, outlets visited/missed
3. promotions — questions about promotional activity
4. competitor_landscape — questions about competitor presence/brands
5. product_availability — questions about product/SKU presence in outlets
6. audit_summary — general "summarize this period" style questions
7. auditor_productivity — questions about specific auditors: most/least active, most productive, area ownership, coverage per rep
8. outlet_intelligence — questions about specific outlets: repeatedly missed, never received a promotion, no confirmed sales-rep visit, due for a revisit
9. distributor_intelligence — questions about distributors: which are most/least active, which areas rely on which distributor, distributor coverage gaps
10. risk_summary — questions asking what's wrong, what needs urgent attention, what's risky, or what looks unusual right now
11. trend_comparison — questions comparing periods: "vs last month", "is X improving/getting worse", "what changed"
12. unknown — anything that doesn't clearly fit the above
`;

/** Equal-length window immediately preceding [startDate, endDate]. */
export function previousPeriod(startDate?: string | null, endDate?: string | null) {
  if (!startDate || !endDate) return { prevStart: null as string | null, prevEnd: null as string | null };

  const start = new Date(`${startDate}T00:00:00Z`);
  const end = new Date(`${endDate}T00:00:00Z`);
  const spanMs = Math.max(end.getTime() - start.getTime(), 0);

  const prevEnd = new Date(start.getTime() - 24 * 60 * 60 * 1000);
  const prevStart = new Date(prevEnd.getTime() - spanMs);

  return {
    prevStart: prevStart.toISOString().slice(0, 10),
    prevEnd: prevEnd.toISOString().slice(0, 10),
  };
}

interface FetchArgs {
  // deno-lint-ignore no-explicit-any
  supabase: any;
  queryType: QueryType;
  startDate: string | null;
  endDate: string | null;
}

/**
 * Dispatches to the right RPC(s) for a given query type and returns a data
 * bundle. Deliberately over-fetches for risk_summary and trend_comparison
 * since those need the fuller picture to be useful — a few extra RPC calls
 * is a rounding error next to a Gemini round trip.
 */
export async function fetchData({ supabase, queryType, startDate, endDate }: FetchArgs) {
  const base = { p_start_date: startDate || null, p_end_date: endDate || null };

  async function summary() {
    const { data, error } = await supabase.rpc("get_ai_audit_submission_metrics", base);
    if (error) throw error;
    return data || {};
  }

  async function auditors() {
    const { data, error } = await supabase.rpc("get_ai_auditor_metrics", base);
    if (error) throw error;
    return data || [];
  }

  async function outlets() {
    const { data, error } = await supabase.rpc("get_ai_outlet_metrics", base);
    if (error) throw error;
    return data || [];
  }

  async function distributors() {
    const { data, error } = await supabase.rpc("get_ai_distributor_metrics", base);
    if (error) throw error;
    return data || [];
  }

  switch (queryType) {
    case "area_performance": {
      const s = await summary();
      return { area_performance: s.area_performance || [] };
    }

    case "sales_rep_coverage": {
      const s = await summary();
      return { overall: s.overall || {}, area_performance: s.area_performance || [] };
    }

    case "promotions": {
      const s = await summary();
      return { overall: s.overall || {}, area_performance: s.area_performance || [] };
    }

    case "competitor_landscape": {
      const s = await summary();
      return { competitor_landscape: s.competitor_landscape || [] };
    }

    case "product_availability": {
      const s = await summary();
      return { product_availability: s.product_availability || [] };
    }

    case "audit_summary": {
      const s = await summary();
      return {
        overall: s.overall || {},
        area_performance: s.area_performance || [],
        product_availability: s.product_availability || [],
        competitor_landscape: s.competitor_landscape || [],
      };
    }

    case "auditor_productivity": {
      return { auditor_performance: await auditors() };
    }

    case "outlet_intelligence": {
      return { outlet_intelligence: await outlets() };
    }

    case "distributor_intelligence": {
      return { distributor_intelligence: await distributors() };
    }

    case "trend_comparison": {
      const { prevStart, prevEnd } = previousPeriod(startDate, endDate);
      const [current, previous] = await Promise.all([
        summary(),
        // deno-lint-ignore no-explicit-any
        prevStart ? supabase.rpc("get_ai_audit_submission_metrics", { p_start_date: prevStart, p_end_date: prevEnd }).then((r: any) => {
          if (r.error) throw r.error;
          return r.data || {};
        }) : Promise.resolve(null),
      ]);
      return {
        overall: current.overall || {},
        area_performance: current.area_performance || [],
        trend: previous
          ? { current: current.overall || {}, previous: previous.overall || {}, previousPeriod: { startDate: prevStart, endDate: prevEnd } }
          : null,
      };
    }

    case "risk_summary": {
      const { prevStart, prevEnd } = previousPeriod(startDate, endDate);
      const [s, auditorData, outletData, distributorData, previous] = await Promise.all([
        summary(),
        auditors(),
        outlets(),
        distributors(),
        // deno-lint-ignore no-explicit-any
        prevStart ? supabase.rpc("get_ai_audit_submission_metrics", { p_start_date: prevStart, p_end_date: prevEnd }).then((r: any) => {
          if (r.error) throw r.error;
          return r.data || {};
        }) : Promise.resolve(null),
      ]);
      return {
        overall: s.overall || {},
        area_performance: s.area_performance || [],
        product_availability: s.product_availability || [],
        competitor_landscape: s.competitor_landscape || [],
        auditor_performance: auditorData,
        outlet_intelligence: outletData,
        distributor_intelligence: distributorData,
        trend: previous ? { current: s.overall || {}, previous: previous.overall || {} } : null,
      };
    }

    default:
      return {};
  }
}
