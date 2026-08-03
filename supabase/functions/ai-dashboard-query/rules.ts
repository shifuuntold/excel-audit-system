// Deterministic findings engine.
//
// The original function asked Gemini to both find problems AND explain
// them in one pass — that's the least reliable way to do it, because an
// LLM can miscount or invent a threshold breach. This file computes flags
// from real numbers with fixed thresholds; Gemini's only job (in index.ts)
// is to explain findings that are already computed, in plain language.
//
// IMPORTANT — field name assumptions: this reads fields like
// `overall.coverage_pct`, `overall.promotion_rate`, and any `missing_*`
// key on `overall`, none of which I've seen your actual
// get_ai_audit_submission_metrics output. Each accessor below tries a
// couple of likely names and falls back to null if none match, so a wrong
// guess degrades to "skip that rule" rather than crashing — but you
// should check the field names against a real response and adjust the
// `pick()` calls if needed.

export type Severity = "high" | "medium" | "low";

export interface Flag {
  severity: Severity;
  category: string;
  message: string;
}

const THRESHOLDS = {
  lowCoveragePct: 30,
  criticalCoveragePct: 15,
  lowPromotionPct: 5,
  auditDropPct: 30, // a drop of this % or more between periods is flagged
  auditorDropPct: 70, // an individual auditor's drop that's this severe is flagged
  staleOutletDays: 14,
  criticalStaleOutletDays: 30,
  minMissingDataPct: 15, // % of records missing a field before it's worth flagging
};

// deno-lint-ignore no-explicit-any
function pick(obj: Record<string, any> | undefined, ...keys: string[]): number | null {
  if (!obj) return null;
  for (const key of keys) {
    const v = obj[key];
    if (typeof v === "number" && !Number.isNaN(v)) return v;
    if (typeof v === "string" && v.trim() !== "" && !Number.isNaN(Number(v))) return Number(v);
  }
  return null;
}

function pctChange(from: number | null, to: number | null): number | null {
  if (from == null || to == null || from === 0) return null;
  return Math.round(((to - from) / from) * 100);
}

interface Bundle {
  // deno-lint-ignore no-explicit-any
  overall?: Record<string, any>;
  // deno-lint-ignore no-explicit-any
  area_performance?: any[];
  // deno-lint-ignore no-explicit-any
  competitor_landscape?: any[];
  // deno-lint-ignore no-explicit-any
  auditor_performance?: any[];
  // deno-lint-ignore no-explicit-any
  outlet_intelligence?: any[];
  // deno-lint-ignore no-explicit-any
  trend?: { current?: Record<string, any>; previous?: Record<string, any> } | null;
}

export function runRulesEngine(bundle: Bundle): Flag[] {
  const flags: Flag[] = [];
  const { overall, area_performance = [], auditor_performance = [], outlet_intelligence = [], trend } = bundle;

  // --- Coverage per area ---
  for (const area of area_performance) {
    const coverage = pick(area, "coverage_pct", "coverage", "visit_coverage_pct", "sales_rep_coverage_pct");
    const name = area.area_name || area.name || area.area || "An area";
    if (coverage != null && coverage < THRESHOLDS.lowCoveragePct) {
      flags.push({
        severity: coverage < THRESHOLDS.criticalCoveragePct ? "high" : "medium",
        category: "coverage",
        message: `${name} has sales-rep coverage of ${coverage}%, below the ${THRESHOLDS.lowCoveragePct}% target.`,
      });
    }
  }

  // --- Promotion activity, company-wide ---
  const promoPct = pick(overall, "promotion_rate", "promotion_pct", "promotions_pct");
  if (promoPct != null && promoPct < THRESHOLDS.lowPromotionPct) {
    flags.push({
      severity: "high",
      category: "promotions",
      message: `Only ${promoPct}% of audited outlets recorded a promotion this period — trade marketing execution looks weak.`,
    });
  }

  // --- Data completeness ("missing_*" counters on overall) ---
  const totalAudits = pick(overall, "total_audits", "audit_count", "totalAudits");
  if (overall && totalAudits) {
    for (const [key, value] of Object.entries(overall)) {
      if (!key.startsWith("missing_") || typeof value !== "number" || value <= 0) continue;
      const pctMissing = Math.round((value / totalAudits) * 100);
      if (pctMissing >= THRESHOLDS.minMissingDataPct) {
        flags.push({
          severity: pctMissing >= 40 ? "high" : "medium",
          category: "data_quality",
          message: `${value} audits (${pctMissing}%) are missing ${key.replace("missing_", "").replace(/_/g, " ")} — treat related numbers with caution.`,
        });
      }
    }
  }

  // --- Stale outlets (no recent visit) ---
  for (const outlet of outlet_intelligence) {
    const days = outlet.days_since_last_visit;
    if (typeof days === "number" && days >= THRESHOLDS.staleOutletDays) {
      flags.push({
        severity: days >= THRESHOLDS.criticalStaleOutletDays ? "high" : "medium",
        category: "coverage",
        message: `${outlet.outlet_name || "An outlet"}${outlet.area ? ` (${outlet.area})` : ""} hasn't been visited in ${days} days.`,
      });
    }
    if (outlet.ever_had_promotion === false && (outlet.visit_count ?? 0) >= 2) {
      flags.push({
        severity: "low",
        category: "promotions",
        message: `${outlet.outlet_name || "An outlet"} has been visited ${outlet.visit_count} times with no promotion ever recorded.`,
      });
    }
  }

  // --- Auditor activity: near-zero output, or a period-over-period collapse ---
  for (const auditor of auditor_performance) {
    if ((auditor.audit_count ?? 0) === 0) {
      flags.push({
        severity: "medium",
        category: "auditor_activity",
        message: `${auditor.auditor_name || "An auditor"} recorded no audits this period.`,
      });
    } else if (typeof auditor.days_since_last_audit === "number" && auditor.days_since_last_audit >= THRESHOLDS.staleOutletDays) {
      flags.push({
        severity: "low",
        category: "auditor_activity",
        message: `${auditor.auditor_name}'s last audit was ${auditor.days_since_last_audit} days ago.`,
      });
    }
  }

  // --- Trend-based anomalies (need a previous period to compare against) ---
  if (trend?.current && trend?.previous) {
    const currentTotal = pick(trend.current, "total_audits", "audit_count");
    const previousTotal = pick(trend.previous, "total_audits", "audit_count");
    const change = pctChange(previousTotal, currentTotal);
    if (change != null && change <= -THRESHOLDS.auditDropPct) {
      flags.push({
        severity: "high",
        category: "activity",
        message: `Audit volume dropped ${Math.abs(change)}% compared to the previous period of the same length.`,
      });
    }

    const currentPromo = pick(trend.current, "promotion_rate", "promotion_pct");
    const previousPromo = pick(trend.previous, "promotion_rate", "promotion_pct");
    const promoChange = pctChange(previousPromo, currentPromo);
    if (promoChange != null && promoChange <= -40) {
      flags.push({
        severity: "medium",
        category: "promotions",
        message: `Promotion activity fell ${Math.abs(promoChange)}% compared to the previous period.`,
      });
    }
  }

  const severityRank: Record<Severity, number> = { high: 0, medium: 1, low: 2 };
  return flags.sort((a, b) => severityRank[a.severity] - severityRank[b.severity]);
}

/**
 * Rough confidence signal from any `missing_*` counters on `overall`.
 * Not a statistical measure — just "how much of the underlying data is
 * actually filled in", surfaced so the AI's answer doesn't read as more
 * authoritative than the data supports.
 */
// deno-lint-ignore no-explicit-any
export function computeConfidence(overall?: Record<string, any>): { level: "High" | "Medium" | "Low"; note: string } | null {
  if (!overall) return null;

  const total = pick(overall, "total_audits", "audit_count", "totalAudits");
  if (!total) return null;

  const missingEntries = Object.entries(overall).filter(
    ([key, value]) => key.startsWith("missing_") && typeof value === "number"
  );
  if (missingEntries.length === 0) return { level: "High", note: "No data-completeness issues detected." };

  const worst = missingEntries.reduce((max, [key, value]) => (value > max.value ? { key, value } : max), { key: "", value: 0 });
  const pctMissing = Math.round((worst.value / total) * 100);

  const level: "High" | "Medium" | "Low" = pctMissing >= 40 ? "Low" : pctMissing >= 15 ? "Medium" : "High";
  const label = worst.key.replace("missing_", "").replace(/_/g, " ");

  return {
    level,
    note: pctMissing > 0
      ? `${pctMissing}% of audits are missing ${label} — figures involving it should be read as directional, not exact.`
      : "No data-completeness issues detected.",
  };
}
