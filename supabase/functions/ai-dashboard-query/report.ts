import { EXECUTIVE_STYLE_RULES } from "./promptRules.ts";

// The "FIELD SALES AUDITOR REPORT" — every factual, numeric section
// (product penetration, competitor landscape, distributor activity,
// promotional activity) is computed deterministically on the client from
// the exact same numbers the rule-based Quick Report already uses (see
// reportService.js's generateAiReportSections) — this prompt's job is
// the three sections that genuinely need judgment rather than a fixed
// formula: which findings are worth highlighting as "key observations",
// what retailers' free-text comments actually mean in aggregate (never
// quoted verbatim in the output — see the Retailer Feedback rule below),
// and what to recommend given all of it.
//
// Does NOT receive raw audit rows or individual outlet names — only
// aggregate numbers, plus the raw retailer feedback *text* (no names, no
// outlet attribution) so it can be paraphrased into readable themes
// instead of dumped as quotes. The aggregate numbers are why this
// doesn't need its own database access for those: the client already
// fetched and scoped the underlying audits (via the same getAudits()
// call the Quick Report uses, which is what actually enforces "an
// Auditor only sees their own data" — this prompt just narrates and
// paraphrases what it's handed, nothing more).

export interface ReportFindingsInput {
  areaLabel: string;
  totalOutlets: number;
  productPenetration: Array<{ label: string; count: number; pct: number; tier: string }>;
  topCompetitorCategories: string[];
  distributorCount: number;
  promotionYes: number;
  promotionNo: number;
  visitedNo: number;
  rawFeedback: string[];
}

export function buildReportFindingsPrompt(input: ReportFindingsInput): string {
  return `
You are the AI Audit Analyst for Excel Chemicals, writing three sections of a
Field Sales Auditor Report: Key Observations, Retailer Feedback, and
Recommendations.

${EXECUTIVE_STYLE_RULES}

The rest of the report (product penetration figures, competitor list,
distributor list, promotional activity) is already written elsewhere with
exact numbers — do not repeat those numbers verbatim here. Your job is to
say what's actually worth someone's attention and what to do about it.

DATA FOR THIS AUDIT
${JSON.stringify(input)}

Rules:
- Key Observations: 3-6 bullets, each one sentence. Mix genuine strengths
  and genuine concerns — don't only list problems. Name specific products
  by their label when relevant. If a product has 0% penetration, that's
  always worth a dedicated observation.
- Retailer Feedback: "rawFeedback" above is the raw, unedited text
  auditors recorded from individual retailer conversations. Never quote
  it verbatim and never attribute a specific comment to an identifiable
  person or outlet — synthesize it into 2-5 bullets describing the
  patterns a reader would actually want to know about (e.g. "Some
  retailers indicated that certain products become unavailable when
  sales representatives do not visit consistently" rather than repeating
  someone's exact words). If a genuinely distinct one-off issue is worth
  flagging (e.g. one specific undelivered order), describe it in your
  own words as a general observation, not a quotation. If rawFeedback
  is empty, return an empty array for this field rather than inventing
  feedback.
- Recommendations: 3-5 bullets, ranked by impact, each concrete enough to
  hand to someone as a task this week. Ground each one in something from
  the data above (coverage gaps, promotion activity, specific low/zero
  penetration products, retailer feedback themes) — don't give generic
  advice unconnected to what was actually found.
- Do not invent numbers, outlets, or findings not implied by the data above.

Return ONLY valid JSON:
{
  "key_observations": ["...", "..."],
  "retailer_feedback": ["...", "..."],
  "recommendations": ["...", "..."]
}
`;
}
