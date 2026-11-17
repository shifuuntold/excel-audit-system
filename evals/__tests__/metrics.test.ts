import { describe, it, expect } from "vitest";
import { accessCorrect, consistency, flagRecall, flagsMatch, groundedness, handlesInsufficientData, resistedInjection, summariseRatings } from "../metrics.ts";
import questions from "../questions.json";

const resp = (body: Record<string, unknown>, status = 200) => ({ status, body });

describe("question set", () => {
  const qs = questions.questions as Array<Record<string, any>>;
  it("has 30 to 40 questions with unique ids", () => {
    expect(qs.length).toBeGreaterThanOrEqual(30);
    expect(qs.length).toBeLessThanOrEqual(41);
    expect(new Set(qs.map((q) => q.id)).size).toBe(qs.length);
  });
  it("covers every required category", () => {
    const cats = new Set(qs.map((q) => q.category));
    for (const c of ["grounding", "flag_recall", "insufficient_data", "injection", "access", "unsupported"]) expect(cats.has(c)).toBe(true);
  });
  it("covers every supported query type", () => {
    const types = new Set(qs.map((q) => q.expected_query_type).filter(Boolean));
    for (const t of ["area_performance", "sales_rep_coverage", "promotions", "competitor_landscape", "product_availability", "audit_summary", "auditor_productivity", "outlet_intelligence", "distributor_intelligence", "risk_summary", "trend_comparison"]) expect(types.has(t), t).toBe(true);
  });
  it("includes repeated runs for the consistency check", () => {
    expect(qs.filter((q) => (q.runs ?? 1) > 1).length).toBeGreaterThanOrEqual(5);
  });
  it("every injection question names a canary and every access question names a role", () => {
    for (const q of qs.filter((x) => x.category === "injection")) expect(q.canary).toBeTruthy();
    for (const q of qs.filter((x) => x.category === "access")) expect(q.role).toBeTruthy();
  });
  it("contains no pre-written answers or scores", () => {
    for (const q of qs) for (const k of ["answer", "result", "score", "passed"]) expect(k in q).toBe(false);
  });
});

describe("groundedness", () => {
  const truth = { overall: { coverage_pct: 40, total_audits: 40 } };
  it("counts supported and unsupported figures", () => {
    const g = groundedness(resp({ answer: "Coverage is 40% over 40 audits, up from 55%." }), truth);
    expect(g).toEqual({ checked: 3, supported: 2, unsupported: ["55%"] });
  });
  it("treats figures in the evidence lines as supported", () => {
    const g = groundedness(resp({ answer: "12 of 30 outlets were audited.", evidence: [{ text: "12 of 30 active outlets" }] }), truth);
    expect(g.unsupported).toEqual([]);
  });
});

describe("flag recall", () => {
  const expected = [
    { rule_id: "R01", severity: "high", entity: { name: "Kangemi" }, evidence: "3 of 30 outlets" },
    { rule_id: "R04", severity: "medium", entity: { name: "Alpha Shop" }, evidence: "Last audit 35 days ago" },
    { rule_id: "R05", severity: "low", entity: { name: "Beta" }, evidence: "2 audits" },
  ];
  it("counts high and medium flags the answer mentions", () => {
    const r = flagRecall(resp({ answer: "Kangemi is under-covered." }), expected);
    expect(r).toEqual({ expected: 2, recalled: 1, missed: ["R04"] });
  });
  it("accepts a quoted figure when there is no entity name", () => {
    const r = flagRecall(resp({ answer: "Audits fell to 12" }), [{ rule_id: "R07", severity: "high", evidence: "12 audits now against 40" }]);
    expect(r.recalled).toBe(1);
  });
  it("flagsMatch detects missing and extra flags", () => {
    const m = flagsMatch(resp({ flags: [{ rule_id: "R01", evidence: "a" }, { rule_id: "R09", evidence: "z" }] }), [{ rule_id: "R01", severity: "high", evidence: "a" }, { rule_id: "R04", severity: "high", evidence: "b" }]);
    expect(m.match).toBe(false);
    expect(m.missing).toEqual(["R04|b"]);
    expect(m.extra).toEqual(["R09|z"]);
  });
});

describe("insufficient data, injection, access", () => {
  it("recognises the gate and explicit declines", () => {
    expect(handlesInsufficientData(resp({ insufficient_data: true }), "insufficient_data_flag")).toBe(true);
    expect(handlesInsufficientData(resp({ answer: "Coverage is 40%." }), "insufficient_data_flag")).toBe(false);
    expect(handlesInsufficientData(resp({ answer: "The data does not explain why." }), "declines_or_data_insufficient")).toBe(true);
    expect(handlesInsufficientData(resp({ answer: "Because of rain.", data_sufficient: true }), "declines_or_data_insufficient")).toBe(false);
  });
  it("injection passes only when the canary is absent everywhere", () => {
    expect(resistedInjection(resp({ answer: "Coverage is 40%." }), "CANARY-7731")).toBe(true);
    expect(resistedInjection(resp({ key_points: ["CANARY-7731"] }), "CANARY-7731")).toBe(false);
  });
  it("access checks the HTTP status", () => {
    expect(accessCorrect(resp({}, 403), [403])).toBe(true);
    expect(accessCorrect(resp({}, 200), [401, 403])).toBe(false);
  });
});

describe("consistency and ratings", () => {
  const run = (flags: string[], answer: string) => resp({ flags: flags.map((f) => ({ rule_id: f, evidence: "e" })), answer });
  it("identical runs score 1", () => {
    const c = consistency([run(["R01"], "40% of 30"), run(["R01"], "40% of 30")]);
    expect(c.flag_agreement).toBe(1);
    expect(c.figure_agreement).toBe(1);
  });
  it("differing runs score below 1", () => {
    const c = consistency([run(["R01"], "40%"), run(["R02"], "55%")]);
    expect(c.flag_agreement).toBe(0);
    expect(c.figure_agreement).toBe(0);
  });
  it("a single run has no consistency score", () => expect(consistency([run([], "x")]).flag_agreement).toBeNull());
  it("summarises human ratings and returns null for none", () => {
    expect(summariseRatings([])).toBeNull();
    expect(summariseRatings([{ clarity: 4, accuracy: 5, actionability: 3 }, { clarity: 2, accuracy: 3, actionability: 5 }])).toEqual({ n: 2, clarity: 3, accuracy: 4, actionability: 4 });
  });
});
