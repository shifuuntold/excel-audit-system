import { EXECUTIVE_STYLE_RULES } from "./promptRules.ts";

// The "FIELD SALES AUDITOR REPORT" — every factual section (product
// penetration, competitor landscape, distributor activity, promotional
// activity, retailer feedback themes) is computed deterministically on
// the client from the exact same numbers the rule-based Quick Report
// already uses (see reportService.js's generateAiReportSections) — this
// prompt's only job is the two sections that genuinely need judgment
// rather than a fixed formula: which findings are worth highlighting as
// "key observations", and what to recommend given all of it.
//
// Deliberately does NOT receive raw audit rows or individual outlet
// names — only the same aggregate numbers a human reading the report
// would see. That's also why this doesn't need its own database access:
// the client already fetched and scoped the underlying audits (via the
// same getAudits() call the Quick Report uses, which is what actually
// enforces "an Auditor only sees their own data" — this prompt just
// narrates numbers it's handed, nothing more).

export interface ReportFindingsInput {
  areaLabel: string;
  totalOutlets: number;
  productPenetration: Array<{ label: string; count: number; pct: number; tier: string }>;
  topCompetitorCategories: string[];
  distributorCount: number;
  promotionYes: number;
  promotionNo: number;
  visitedNo: number;
  feedbackThemes: string[];
}

export function buildReportFindingsPrompt(input: ReportFindingsInput): string {
  return `
You are the AI Audit Analyst for Excel Chemicals, writing two sections of a
Field Sales Auditor Report: Key Observations and Recommendations.

${EXECUTIVE_STYLE_RULES}

The rest of the report (product penetration figures, competitor list,
distributor list, promotional activity, retailer feedback) is already
written elsewhere with exact numbers — do not repeat those numbers
verbatim here. Your job is to say what's actually worth someone's
attention and what to do about it.

DATA FOR THIS AUDIT
${JSON.stringify(input)}

Rules:
- Key Observations: 3-6 bullets, each one sentence. Mix genuine strengths
  and genuine concerns — don't only list problems. Name specific products
  by their label when relevant. If a product has 0% penetration, that's
  always worth a dedicated observation.
- Recommendations: 3-5 bullets, ranked by impact, each concrete enough to
  hand to someone as a task this week. Ground each one in something from
  the data above (coverage gaps, promotion activity, specific low/zero
  penetration products, retailer feedback themes) — don't give generic
  advice unconnected to what was actually found.
- Do not invent numbers, outlets, or findings not implied by the data above.

Return ONLY valid JSON:
{
  "key_observations": ["...", "..."],
  "recommendations": ["...", "..."]
}
`;
}
