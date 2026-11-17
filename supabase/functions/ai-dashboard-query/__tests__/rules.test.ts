// deno-lint-ignore-file no-explicit-any
import { describe, it, expect } from "vitest";
import { RULE_CATALOG, THRESHOLDS, computeConfidence, runRules } from "../rules.ts";
import { validateObject, validateRows } from "../contract.ts";
import { area, auditor, outlet, overall, period, repeat } from "./fixtures.ts";

const run = (input: any) => runRules({ ...input, period });
const ids = (r: ReturnType<typeof run>, rule: string) => r.flags.filter((f) => f.rule_id === rule);
const status = (r: ReturnType<typeof run>, rule: string) => r.outcomes.find((o) => o.rule_id === rule)!.status;

describe("contract validation", () => {
  it("accepts a conforming object", () => expect(validateObject("t", "overview_overall", overall())).toEqual([]));
  it("reports a missing field by name", () => {
    const { coverage_pct, ...rest } = overall();
    const d = validateObject("t", "overview_overall", rest);
    expect(d).toHaveLength(1);
    expect(d[0]).toMatchObject({ code: "missing_field", field: "coverage_pct" });
  });
  it("rejects a wrong type and a null that is not allowed", () => {
    const d = validateObject("t", "overview_overall", overall({ total_audits: "40", active_outlets: null }));
    expect(d.map((x) => x.code).sort()).toEqual(["unexpected_null", "wrong_type"]);
  });
  it("allows null only where the contract says so", () => {
    expect(validateObject("t", "overview_overall", overall({ coverage_pct: null }))).toEqual([]);
  });
  it("counts the same problem across rows once", () => {
    const rows = [area(), { ...area(), coverage_pct: undefined }, { ...area(), coverage_pct: undefined }];
    const d = validateRows("t", "overview_area", rows);
    expect(d).toHaveLength(1);
    expect(d[0].rows_affected).toBe(2);
  });
  it("rejects a non-array where rows are expected", () => {
    expect(validateRows("t", "overview_area", {})[0].code).toBe("not_array");
  });
});

describe("rule engine reports on every rule, never silently", () => {
  it("returns one outcome per catalogued rule", () => {
    const r = run({});
    expect(r.outcomes.map((o) => o.rule_id)).toEqual(RULE_CATALOG.map((c) => c.id));
    expect(r.outcomes.every((o) => o.status === "not_applicable")).toBe(true);
  });
  it("a renamed/guessed field yields an ERROR outcome with a diagnostic, not a skipped rule", () => {
    const r = run({ area_performance: [{ area_name: "Kangemi", coverage: 10 }] });
    expect(r.flags).toEqual([]);
    expect(status(r, "R01")).toBe("error");
    expect(r.diagnostics.some((d) => d.code === "missing_field" && d.field === "coverage_pct")).toBe(true);
    expect(r.outcomes.find((o) => o.rule_id === "R01")!.note).toMatch(/coverage_pct/);
  });
  it("the old guessed alternates are no longer accepted", () => {
    for (const key of ["coverage", "visit_coverage_pct", "sales_rep_coverage_pct"]) {
      const { coverage_pct, ...rest } = area();
      expect(status(run({ area_performance: [{ ...rest, [key]: 5 }] }), "R01")).toBe("error");
    }
  });
  it("a bad overall object marks R02, R03 and R11 as errors together", () => {
    const r = run({ overall: { total_audits: 10 } });
    expect(["R02", "R03", "R11"].map((x) => status(r, x))).toEqual(["error", "error", "error"]);
  });
  it("bad outlet rows error R04 and R05; bad auditor rows error R06 and R09", () => {
    const r = run({ outlet_intelligence: [{ name: "x" }], auditor_performance: [{ name: "y" }] });
    expect(["R04", "R05", "R06", "R09"].map((x) => status(r, x))).toEqual(["error", "error", "error", "error"]);
  });
  it("a section that was not requested is not_applicable, not an error", () => {
    expect(status(run({ overall: overall() }), "R01")).toBe("not_applicable");
  });
  it("every flag carries a rule id and a non-empty evidence line", () => {
    const r = run({
      overall: overall({ promotion_rate_pct: 2, missing_location: 20 }),
      area_performance: [area({ coverage_pct: 10 })],
      outlet_intelligence: [outlet({ days_since_last_visit: 40 })],
      auditor_performance: [auditor({ audit_count: 0 })],
      repeat_issues: [repeat()],
    });
    expect(r.flags.length).toBeGreaterThan(4);
    for (const f of r.flags) { expect(f.rule_id).toMatch(/^R\d\d$/); expect(f.evidence.length).toBeGreaterThan(10); }
  });
});

describe("each rule applies its threshold to the correct field", () => {
  it("R01 coverage: 30 is fine, 29.9 is medium, 14.9 is high; null is skipped and noted", () => {
    expect(ids(run({ area_performance: [area({ coverage_pct: 30 })] }), "R01")).toHaveLength(0);
    expect(ids(run({ area_performance: [area({ coverage_pct: 29.9 })] }), "R01")[0].severity).toBe("medium");
    expect(ids(run({ area_performance: [area({ coverage_pct: 14.9 })] }), "R01")[0].severity).toBe("high");
    const r = run({ area_performance: [area({ coverage_pct: null })] });
    expect(r.flags).toHaveLength(0);
    expect(r.outcomes.find((o) => o.rule_id === "R01")!.note).toMatch(/no active outlets/);
  });
  it("R02 promotion rate below 5% is high; 5% is not flagged", () => {
    expect(ids(run({ overall: overall({ promotion_rate_pct: 4.9 }) }), "R02")[0].severity).toBe("high");
    expect(ids(run({ overall: overall({ promotion_rate_pct: 5 }) }), "R02")).toHaveLength(0);
  });
  it("R03 incomplete data: 14% quiet, 15% medium, 40% high, per field", () => {
    const f = (n: number) => ids(run({ overall: overall({ total_audits: 100, missing_mobile: n, missing_person_met: 0, missing_location: 0, audits_without_outlet_link: 0 }) }), "R03");
    expect(f(14)).toHaveLength(0);
    expect(f(15)[0].severity).toBe("medium");
    expect(f(40)[0].severity).toBe("high");
    expect(f(15)[0].message).toMatch(/mobile number/);
  });
  it("R11 unlinked audits flagged from 15%", () => {
    const f = (n: number) => ids(run({ overall: overall({ total_audits: 100, audits_without_outlet_link: n, missing_location: 0, missing_mobile: 0, missing_person_met: 0 }) }), "R11");
    expect(f(14)).toHaveLength(0);
    expect(f(15)).toHaveLength(1);
  });
  it("R04 stale outlet: 13 quiet, 14 medium, 30 high; null days ignored", () => {
    const f = (d: number | null) => ids(run({ outlet_intelligence: [outlet({ days_since_last_visit: d })] }), "R04");
    expect(f(13)).toHaveLength(0);
    expect(f(14)[0].severity).toBe("medium");
    expect(f(30)[0].severity).toBe("high");
    expect(f(null)).toHaveLength(0);
    expect(f(14)[0].entity).toMatchObject({ type: "outlet", id: "o-1" });
  });
  it("R05 never-promoted outlet needs 2+ visits", () => {
    const f = (v: number, p: boolean) => ids(run({ outlet_intelligence: [outlet({ visit_count: v, ever_had_promotion: p })] }), "R05");
    expect(f(1, false)).toHaveLength(0);
    expect(f(2, false)).toHaveLength(1);
    expect(f(5, true)).toHaveLength(0);
  });
  it("R06 inactive auditor: zero audits medium; 14+ days since last audit low", () => {
    expect(ids(run({ auditor_performance: [auditor({ audit_count: 0, days_since_last_audit: null })] }), "R06")[0].severity).toBe("medium");
    expect(ids(run({ auditor_performance: [auditor({ days_since_last_audit: 14 })] }), "R06")[0].severity).toBe("low");
    expect(ids(run({ auditor_performance: [auditor({ days_since_last_audit: 13 })] }), "R06")).toHaveLength(0);
  });
  it("R07 audit volume: a 30% fall is flagged, 29% is not; no previous period = not applicable", () => {
    const f = (cur: number) => run({ trend: { current: overall({ total_audits: cur }), previous: overall({ total_audits: 100 }) } });
    expect(ids(f(70), "R07")).toHaveLength(1);
    expect(ids(f(71), "R07")).toHaveLength(0);
    expect(status(run({ trend: null }), "R07")).toBe("not_applicable");
  });
  it("R08 promotion rate fall of 40% is flagged", () => {
    const f = (cur: number) => run({ trend: { current: overall({ promotion_rate_pct: cur }), previous: overall({ promotion_rate_pct: 50 }) } });
    expect(ids(f(30), "R08")).toHaveLength(1);
    expect(ids(f(31), "R08")).toHaveLength(0);
  });
  it("R09 auditor drop: 70% fall flagged only with 5+ audits in the previous period (and uses the unused-before threshold)", () => {
    const f = (cur: number, prev: number) => run({
      auditor_performance: [auditor({ audit_count: cur })],
      previous_auditor_performance: [auditor({ audit_count: prev })],
    });
    expect(ids(f(3, 10), "R09")).toHaveLength(1);
    expect(ids(f(4, 10), "R09")).toHaveLength(0);
    expect(ids(f(0, 4), "R09")).toHaveLength(0);
    expect(THRESHOLDS.auditorDropPct).toBe(70);
  });
  it("R09 matches auditors by id, not name", () => {
    const r = run({
      auditor_performance: [auditor({ auditor_id: "a", audit_count: 0 })],
      previous_auditor_performance: [auditor({ auditor_id: "b", audit_count: 20 })],
    });
    expect(ids(r, "R09")).toHaveLength(0);
  });
  it("R10 repeated problems: location outside radius high; product line needs >= 75%", () => {
    const loc = run({ repeat_issues: [repeat({ issue_type: "location_outside_radius", occurrences: 3 })] });
    expect(ids(loc, "R10")[0].severity).toBe("high");
    const prod = (pct: number) => ids(run({ repeat_issues: [repeat({ issue_type: "product_line_not_recorded", issue_detail: "champ", occurrence_pct: pct })] }), "R10");
    expect(prod(74.9)).toHaveLength(0);
    expect(prod(75)).toHaveLength(1);
    expect(prod(75)[0].message).toMatch(/champ/);
    expect(ids(run({ repeat_issues: [repeat({ occurrences: 2 })] }), "R10")).toHaveLength(0);
  });
  it("R10 ties the pattern to a specific outlet id", () => {
    const f = ids(run({ repeat_issues: [repeat({ outlet_id: "abc", outlet_name: "Alpha Shop" })] }), "R10")[0];
    expect(f.entity).toMatchObject({ type: "outlet", id: "abc", name: "Alpha Shop" });
  });
  it("flags are sorted high before medium before low", () => {
    const r = run({
      overall: overall({ promotion_rate_pct: 1 }),
      outlet_intelligence: [outlet({ visit_count: 4, ever_had_promotion: false }), outlet({ days_since_last_visit: 20 })],
    });
    const rank = { high: 0, medium: 1, low: 2 } as any;
    const sev = r.flags.map((f) => rank[f.severity]);
    expect(sev).toEqual([...sev].sort());
  });
});

describe("confidence", () => {
  it("is null when data cannot be validated", () => expect(computeConfidence({ total_audits: 3 })).toBeNull());
  it("High when outlet links and GPS are complete", () => {
    expect(computeConfidence(overall({ audits_without_outlet_link: 0, missing_location: 0 }))!.level).toBe("High");
  });
  it("Medium from 15% and Low from 40% missing outlet link or location", () => {
    expect(computeConfidence(overall({ total_audits: 100, audits_without_outlet_link: 15, missing_location: 0 }))!.level).toBe("Medium");
    expect(computeConfidence(overall({ total_audits: 100, audits_without_outlet_link: 0, missing_location: 40 }))!.level).toBe("Low");
  });
  it("contact-detail gaps do not lower confidence (nothing analysed uses them)", () => {
    expect(computeConfidence(overall({ total_audits: 100, missing_mobile: 90, missing_person_met: 90, audits_without_outlet_link: 0, missing_location: 0 }))!.level).toBe("High");
  });
});
