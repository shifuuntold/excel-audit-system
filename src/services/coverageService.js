import { supabase } from "../lib/supabase";

/**
 * Per-outlet visit recency and promotion history, derived from every audit
 * ever submitted for that outlet (grouped by shop name + area — see the
 * caveat in the migration SQL about outlets not being a normalized table).
 *
 * Calls the same get_ai_outlet_metrics RPC the AI Analyst uses, but
 * directly — this is operational data a Supervisor needs on every page
 * load, not something worth spending a Gemini call on.
 */
export async function getOutletCoverage({ startDate = null, endDate = null } = {}) {
    const { data, error } = await supabase.rpc("get_ai_outlet_metrics", {
        p_start_date: startDate,
        p_end_date: endDate,
    });
    if (error) throw error;
    return data || [];
}

/** Per-auditor productivity/coverage — same RPC the AI Analyst uses. */
export async function getAuditorCoverage({ startDate = null, endDate = null } = {}) {
    const { data, error } = await supabase.rpc("get_ai_auditor_metrics", {
        p_start_date: startDate,
        p_end_date: endDate,
    });
    if (error) throw error;
    return data || [];
}
