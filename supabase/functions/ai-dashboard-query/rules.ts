// Deterministic findings engine
// =====================================================================
// The model never decides whether a problem exists. This file does, from
// verified database output and fixed thresholds. Gemini only explains the
// flags produced here.
//
// WHAT CHANGED FROM THE ORIGINAL
//   * No guessed field names. Every field read here is declared in
//     contract.ts and is checked against the real SQL output in tests.
//   * A rule can no longer fail silently. runRules() returns, besides the
//     flags, one RuleOutcome per rule: "evaluated", "not_applicable" (that
//     data section was not requested for this question) or "error" (the
//     section was present but did not match the contract, with the exact
//     diagnostics). Errors are also console.error'd by the caller.
//   * Every flag carries an evidence line built from the same numbers.
//   * The old auditorDropPct threshold existed but nothing used it; the
//     auditor period-over-period rule (R09) now does.
//
// THRESHOLDS: all values below were carried over from the original
// implementation. Nothing in the repository shows that Excel Chemicals
// approved them as company rules, so they are business judgement, are
// labelled as such everywhere they are surfaced, and should be confirmed
// with management.
// =====================================================================

import { CONTRACTS, type Diagnostic, validateObject, validateRows } from "./contract.ts";

export type Severity = "high" | "medium" | "low";

export interface Flag {
  rule_id: string;
  severity: Severity;
  category: string;
  message: string;
  /** Deterministic sentence stating the figures behind the flag. */
  evidence: string;
  entity?: { type: "company" | "area" | "outlet" | "auditor"; id?: string; name?: string };
}

export const THRESHOLDS = {
  lowCoveragePct: 30,
  criticalCoveragePct: 15,
  lowPromotionPct: 5,
  auditDropPct: 30,
  promotionDropPct: 40,
  auditorDropPct: 70,
  auditorDropMinPriorAudits: 5, // a "70% drop" from 1 audit to 0 is noise
  staleOutletDays: 14,
  criticalStaleOutletDays: 30,
  minMissingDataPct: 15,
  criticalMissingDataPct: 40,
  repeatMinOccurrences: 3, // also passed to get_ai_outlet_repeat_issues
  repeatProductMinPct: 75,
} as const;

export const THRESHOLD_BASIS =
  "Business judgement carried over from the original implementation; not a formally approved Excel Chemicals rule.";

export interface RuleInfo {
  id: string;
  name: string;
  category: string;
  purpose: string;
  inputs: string;
  thresholds: string;
}

export const RULE_CATALOG: readonly RuleInfo[] = [
  { id: "R01", name: "Low outlet coverage by area", category: "coverage", purpose: "Find areas where few of the registered outlets were audited.", inputs: "area_performance.coverage_pct", thresholds: "medium below 30%, high below 15%" },
  { id: "R02", name: "Low promotion rate", category: "promotions", purpose: "Find weak promotional execution company-wide.", inputs: "overall.promotion_rate_pct", thresholds: "high below 5%" },
  { id: "R03", name: "Incomplete audit data", category: "data_quality", purpose: "Warn when many audits lack contact details or GPS capture.", inputs: "overall.missing_person_met / missing_mobile / missing_location vs total_audits", thresholds: "medium from 15%, high from 40%" },
  { id: "R04", name: "Stale outlet", category: "coverage", purpose: "Find outlets not visited recently.", inputs: "outlet_intelligence.days_since_last_visit", thresholds: "medium from 14 days, high from 30 days" },
  { id: "R05", name: "Outlet with no promotion", category: "promotions", purpose: "Find outlets visited repeatedly that never had a promotion.", inputs: "outlet_intelligence.ever_had_promotion, visit_count", thresholds: "low at 2+ visits" },
  { id: "R06", name: "Inactive auditor", category: "auditor_activity", purpose: "Find auditors with no audits, or none for a while.", inputs: "auditor_performance.audit_count, days_since_last_audit", thresholds: "medium at 0 audits, low from 14 days" },
  { id: "R07", name: "Audit volume drop", category: "activity", purpose: "Find a sharp fall in audits against the previous equal period.", inputs: "trend.current/previous overall.total_audits", thresholds: "high at a 30% drop or more" },
  { id: "R08", name: "Promotion rate drop", category: "promotions", purpose: "Find a sharp fall in promotion rate against the previous period.", inputs: "trend.current/previous overall.promotion_rate_pct", thresholds: "medium at a 40% drop or more" },
  { id: "R09", name: "Auditor performance drop", category: "auditor_activity", purpose: "Find an auditor whose output collapsed against the previous period.", inputs: "auditor_performance vs previous_auditor_performance audit_count", thresholds: "medium at a 70% drop, previous period at least 5 audits" },
  { id: "R10", name: "Repeated problem at one outlet", category: "repeat_issue", purpose: "Find the same problem recurring at the same outlet (visit not confirmed, location outside radius, product line not recorded, contact details missing).", inputs: "repeat_issues.*", thresholds: "3+ occurrences; product line also 75%+ of visits" },
  { id: "R11", name: "Audits not linked to an outlet", category: "data_quality", purpose: "Warn that outlet-level figures exclude audits that could not be linked to an outlet.", inputs: "overall.audits_without_outlet_link vs total_audits", thresholds: "low from 15%" },
];

export type RuleStatus = "evaluated" | "not_applicable" | "error";
export interface RuleOutcome { rule_id: string; status: RuleStatus; flags_raised: number; note?: string }

// deno-lint-ignore no-explicit-any
type Row = Record<string, any>;

export interface RuleInput {
  overall?: Row;
  area_performance?: Row[];
  auditor_performance?: Row[];
  previous_auditor_performance?: Row[];
  outlet_intelligence?: Row[];
  repeat_issues?: Row[];
  trend?: { current?: Row; previous?: Row } | null;
  period?: { startDate?: string | null; endDate?: string | null };
}

export interface RulesResult { flags: Flag[]; diagnostics: Diagnostic[]; outcomes: RuleOutcome[] }

export function periodLabel(p?: { startDate?: string | null; endDate?: string | null }): string {
  return p?.startDate && p?.endDate ? `${p.startDate} to ${p.endDate}` : "all available dates";
}

function pctChange(from: number | null, to: number | null): number | null {
  if (from == null || to == null || from === 0) return null;
  return Math.round(((to - from) / from) * 100);
}

const ISSUE_LABEL: Record<string, string> = {
  visit_not_confirmed: "sales-rep visit not confirmed",
  location_outside_radius: "location outside the allowed radius",
  missing_contact_details: "contact details missing",
  product_line_not_recorded: "product line not recorded as available",
};

export function runRules(input: RuleInput): RulesResult {
  const flags: Flag[] = [];
  const diagnostics: Diagnostic[] = [];
  const outcomes = new Map<string, RuleOutcome>(
    RULE_CATALOG.map((r) => [r.id, { rule_id: r.id, status: "not_applicable" as RuleStatus, flags_raised: 0 }]),
  );
  const per = periodLabel(input.period);

  const mark = (id: string, status: RuleStatus, note?: string) => {
    const o = outcomes.get(id)!;
    o.status = status;
    if (note) o.note = note;
  };
  const push = (id: string, flag: Omit<Flag, "rule_id">) => {
    flags.push({ rule_id: id, ...flag });
    outcomes.get(id)!.flags_raised++;
  };
  const fail = (ids: string[], d: Diagnostic[]) => {
    diagnostics.push(...d);
    for (const id of ids) mark(id, "error", d.map((x) => x.message).join(" "));
  };

  // ---- company-wide rules: R02, R03, R11 --------------------------------
  const o = input.overall;
  if (o !== undefined) {
    const d = validateObject("overview.overall", "overview_overall", o);
    if (d.length) fail(["R02", "R03", "R11"], d);
    else {
      const total = o.total_audits as number;
      mark("R02", "evaluated"); mark("R03", "evaluated"); mark("R11", "evaluated");

      if (total > 0 && o.promotion_rate_pct !== null && o.promotion_rate_pct < THRESHOLDS.lowPromotionPct) {
        push("R02", {
          severity: "high", category: "promotions",
          message: `Only ${o.promotion_rate_pct}% of audits in this period recorded a promotion, so trade marketing execution looks weak.`,
          evidence: `${o.promotions_recorded} of ${total} audits recorded a promotion (${o.promotion_rate_pct}%), ${per}.`,
          entity: { type: "company" },
        });
      }
      if (total > 0) {
        const fields: Array<[string, string]> = [
          ["missing_person_met", "the person met"],
          ["missing_mobile", "a mobile number"],
          ["missing_location", "a captured GPS location"],
        ];
        for (const [key, label] of fields) {
          const value = o[key] as number;
          const pct = Math.round((value / total) * 100);
          if (value > 0 && pct >= THRESHOLDS.minMissingDataPct) {
            push("R03", {
              severity: pct >= THRESHOLDS.criticalMissingDataPct ? "high" : "medium",
              category: "data_quality",
              message: `${value} audits (${pct}%) are missing ${label}, so figures that depend on it should be read with caution.`,
              evidence: `${value} of ${total} audits have no ${label}, ${per}.`,
              entity: { type: "company" },
            });
          }
        }
        const unlinked = o.audits_without_outlet_link as number;
        const unlinkedPct = Math.round((unlinked / total) * 100);
        if (unlinked > 0 && unlinkedPct >= THRESHOLDS.minMissingDataPct) {
          push("R11", {
            severity: "low", category: "data_quality",
            message: `${unlinked} audits (${unlinkedPct}%) are not linked to an outlet, so outlet-level figures leave them out.`,
            evidence: `${unlinked} of ${total} audits have no outlet link, ${per}.`,
            entity: { type: "company" },
          });
        }
      }
    }
  }

  // ---- R01 area coverage ------------------------------------------------
  if (input.area_performance !== undefined) {
    const d = validateRows("overview.area_performance", "overview_area", input.area_performance);
    if (d.length) fail(["R01"], d);
    else {
      mark("R01", "evaluated");
      let skipped = 0;
      for (const a of input.area_performance) {
        if (a.coverage_pct === null) { skipped++; continue; }
        if (a.coverage_pct < THRESHOLDS.lowCoveragePct) {
          push("R01", {
            severity: a.coverage_pct < THRESHOLDS.criticalCoveragePct ? "high" : "medium",
            category: "coverage",
            message: `${a.area} has outlet coverage of ${a.coverage_pct}%, below the ${THRESHOLDS.lowCoveragePct}% level.`,
            evidence: `${a.outlets_audited} of ${a.active_outlets} active outlets in ${a.area} were audited (${a.coverage_pct}%), ${per}.`,
            entity: { type: "area", name: a.area },
          });
        }
      }
      if (skipped) outcomes.get("R01")!.note = `${skipped} area(s) skipped: no active outlets registered, so coverage cannot be calculated.`;
    }
  }

  // ---- R04/R05 outlets --------------------------------------------------
  if (input.outlet_intelligence !== undefined) {
    const d = validateRows("outlet_metrics", "outlet_metrics", input.outlet_intelligence);
    if (d.length) fail(["R04", "R05"], d);
    else {
      mark("R04", "evaluated"); mark("R05", "evaluated");
      for (const ou of input.outlet_intelligence) {
        const days = ou.days_since_last_visit as number | null;
        const where = ou.area ? ` (${ou.area})` : "";
        if (days !== null && days >= THRESHOLDS.staleOutletDays) {
          push("R04", {
            severity: days >= THRESHOLDS.criticalStaleOutletDays ? "high" : "medium",
            category: "coverage",
            message: `${ou.outlet_name}${where} has not been visited in ${days} days.`,
            evidence: `Last audit of ${ou.outlet_name} was on ${ou.last_visit_date} (${days} days ago).`,
            entity: { type: "outlet", id: ou.outlet_id, name: ou.outlet_name },
          });
        }
        if (ou.ever_had_promotion === false && ou.visit_count >= 2) {
          push("R05", {
            severity: "low", category: "promotions",
            message: `${ou.outlet_name}${where} has been visited ${ou.visit_count} times with no promotion ever recorded.`,
            evidence: `${ou.visit_count} audits of ${ou.outlet_name} in ${per}; no promotion recorded at this outlet.`,
            entity: { type: "outlet", id: ou.outlet_id, name: ou.outlet_name },
          });
        }
      }
    }
  }

  // ---- R06/R09 auditors -------------------------------------------------
  if (input.auditor_performance !== undefined) {
    const d = validateRows("auditor_metrics", "auditor_metrics", input.auditor_performance);
    if (d.length) fail(["R06", "R09"], d);
    else {
      mark("R06", "evaluated");
      for (const au of input.auditor_performance) {
        const name = au.auditor_name ?? "An auditor";
        if (au.audit_count === 0) {
          push("R06", {
            severity: "medium", category: "auditor_activity",
            message: `${name} recorded no audits in this period.`,
            evidence: `${name}: 0 audits, ${per}.`,
            entity: { type: "auditor", id: au.auditor_id, name },
          });
        } else if (au.days_since_last_audit !== null && au.days_since_last_audit >= THRESHOLDS.staleOutletDays) {
          push("R06", {
            severity: "low", category: "auditor_activity",
            message: `${name}'s last audit was ${au.days_since_last_audit} days ago.`,
            evidence: `${name}: last audit on ${au.last_audit_date}.`,
            entity: { type: "auditor", id: au.auditor_id, name },
          });
        }
      }

      if (input.previous_auditor_performance === undefined) {
        mark("R09", "not_applicable", "No previous period supplied.");
      } else {
        const dp = validateRows("previous_auditor_metrics", "auditor_metrics", input.previous_auditor_performance);
        if (dp.length) fail(["R09"], dp);
        else {
          mark("R09", "evaluated");
          const prevById = new Map(input.previous_auditor_performance.map((p) => [p.auditor_id, p]));
          for (const au of input.auditor_performance) {
            const prev = prevById.get(au.auditor_id);
            if (!prev || prev.audit_count < THRESHOLDS.auditorDropMinPriorAudits) continue;
            const change = pctChange(prev.audit_count, au.audit_count);
            if (change !== null && change <= -THRESHOLDS.auditorDropPct) {
              const name = au.auditor_name ?? "An auditor";
              push("R09", {
                severity: "medium", category: "auditor_activity",
                message: `${name}'s audits fell ${Math.abs(change)}% compared with the previous period.`,
                evidence: `${name}: ${au.audit_count} audits now against ${prev.audit_count} in the previous period.`,
                entity: { type: "auditor", id: au.auditor_id, name },
              });
            }
          }
        }
      }
    }
  }

  // ---- R07/R08 trend ----------------------------------------------------
  if (input.trend !== undefined) {
    if (!input.trend?.current || !input.trend?.previous) {
      mark("R07", "not_applicable", "No previous period to compare against.");
      mark("R08", "not_applicable", "No previous period to compare against.");
    } else {
      const dc = validateObject("trend.current", "overview_overall", input.trend.current);
      const dpv = validateObject("trend.previous", "overview_overall", input.trend.previous);
      if (dc.length || dpv.length) fail(["R07", "R08"], [...dc, ...dpv]);
      else {
        mark("R07", "evaluated"); mark("R08", "evaluated");
        const cur = input.trend.current, prev = input.trend.previous;
        const change = pctChange(prev.total_audits, cur.total_audits);
        if (change !== null && change <= -THRESHOLDS.auditDropPct) {
          push("R07", {
            severity: "high", category: "activity",
            message: `Audit volume dropped ${Math.abs(change)}% compared with the previous period of the same length.`,
            evidence: `${cur.total_audits} audits now against ${prev.total_audits} in the previous period.`,
            entity: { type: "company" },
          });
        }
        const pchange = pctChange(prev.promotion_rate_pct, cur.promotion_rate_pct);
        if (pchange !== null && pchange <= -THRESHOLDS.promotionDropPct) {
          push("R08", {
            severity: "medium", category: "promotions",
            message: `Promotion activity fell ${Math.abs(pchange)}% compared with the previous period.`,
            evidence: `Promotion rate ${cur.promotion_rate_pct}% now against ${prev.promotion_rate_pct}% in the previous period.`,
            entity: { type: "company" },
          });
        }
      }
    }
  }

  // ---- R10 repeat issues ------------------------------------------------
  if (input.repeat_issues !== undefined) {
    const d = validateRows("repeat_issues", "repeat_issues", input.repeat_issues);
    if (d.length) fail(["R10"], d);
    else {
      mark("R10", "evaluated");
      for (const r of input.repeat_issues) {
        if (r.occurrences < THRESHOLDS.repeatMinOccurrences) continue;
        if (r.issue_type === "product_line_not_recorded" && r.occurrence_pct < THRESHOLDS.repeatProductMinPct) continue;
        const label = ISSUE_LABEL[r.issue_type] ?? r.issue_type;
        const detail = r.issue_detail ? ` (${r.issue_detail})` : "";
        const where = r.area ? ` (${r.area})` : "";
        push("R10", {
          severity: r.issue_type === "location_outside_radius" ? "high" : "medium",
          category: "repeat_issue",
          message: `${r.outlet_name}${where}: ${label}${detail} on ${r.occurrences} of ${r.total_visits} visits.`,
          evidence: `${r.occurrences} of ${r.total_visits} audits of ${r.outlet_name} (${r.occurrence_pct}%) show: ${label}${detail}, ${per}.`,
          entity: { type: "outlet", id: r.outlet_id, name: r.outlet_name },
        });
      }
    }
  }

  const rank: Record<Severity, number> = { high: 0, medium: 1, low: 2 };
  flags.sort((a, b) => rank[a.severity] - rank[b.severity]);
  return { flags, diagnostics, outcomes: [...outcomes.values()] };
}

/**
 * How far the figures can be trusted, from completeness of the data that
 * outlet-level and location analysis depend on (outlet link, GPS capture).
 * Contact-detail gaps are reported by R03 but do not lower confidence,
 * because nothing in the analysis uses them.
 */
export function computeConfidence(overall?: Row): { level: "High" | "Medium" | "Low"; note: string } | null {
  if (!overall || validateObject("overview.overall", "overview_overall", overall).length) return null;
  const total = overall.total_audits as number;
  if (!total) return null;
  const candidates: Array<[string, number]> = [
    ["a linked outlet", overall.audits_without_outlet_link],
    ["a captured location", overall.missing_location],
  ];
  const [label, count] = candidates.reduce((m, c) => (c[1] > m[1] ? c : m));
  const pct = Math.round((count / total) * 100);
  const level = pct >= THRESHOLDS.criticalMissingDataPct ? "Low" : pct >= THRESHOLDS.minMissingDataPct ? "Medium" : "High";
  return {
    level,
    note: pct > 0
      ? `${pct}% of audits have no ${label.replace("a ", "")} - figures that depend on it are directional, not exact.`
      : "No data-completeness issues detected.",
  };
}

export { CONTRACTS };
