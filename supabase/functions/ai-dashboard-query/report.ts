import { EXECUTIVE_STYLE_RULES } from "./promptRules.ts";

// The "AI Audit Analyst" executive report — restructured to read like a
// business review a Sales Director would actually forward to a Commercial
// Director, not an audit export with headings on it. Every section here
// exists because it answers a specific "why should management care"
// question, not because it's a table the database happens to have.

export interface ReportSection {
  heading: string;
  type: "paragraph" | "bullets" | "table";
  text?: string;
  items?: string[];
  columns?: string[];
  rows?: string[][];
}

const REQUIRED_SECTIONS = [
  { heading: "Executive Summary", type: "paragraph" as const, guidance: "Maximum 5 lines. What is happening and why it matters — not a table of contents for the rest of the report." },
  { heading: "Key Wins", type: "bullets" as const, guidance: "Top 3 genuinely positive findings, each one sentence, framed as a strength worth protecting (e.g. 'X remains a portfolio strength' rather than just a percentage)." },
  { heading: "Critical Risks", type: "bullets" as const, guidance: "Top 3-5 risks, ranked by severity, each explaining business impact not just the number." },
  { heading: "Area Watchlist", type: "table" as const, guidance: "Top 5 problem areas as a table with columns [\"Area\", \"Issue\", \"Priority\"]. Priority is High, Medium, or Low." },
  { heading: "Distributor Intelligence", type: "paragraph" as const, guidance: "Which distributors are most active, which areas rely heavily on a single distributor, and where distributor presence looks weak. Business insights (e.g. 'Wasoko dominates supply in Pipeline and Kasarani'), not a count table. If distributor data wasn't supplied, say distributor intelligence isn't available for this period rather than guessing." },
  { heading: "Competitive Landscape", type: "paragraph" as const, guidance: "Most commonly observed competitors, any growth pattern visible from the trend data if supplied, and the areas where competitors look strongest." },
  { heading: "Recommended Actions", type: "bullets" as const, guidance: "Maximum 5 actions, ranked by impact, each concrete enough to assign to someone this week." },
];

export function buildReportPrompt(args: {
  startDate: string | null;
  endDate: string | null;
  bundle: unknown;
  flags: unknown;
  confidence: unknown;
}): string {
  const { startDate, endDate, bundle, flags, confidence } = args;

  return `
You are the AI Audit Analyst for Excel Chemicals — a senior commercial
analyst producing a management business review, not a summarization tool.

${EXECUTIVE_STYLE_RULES}

DATA RULES
- Use only the supplied audit data and pre-computed findings below.
- Never invent figures, percentages, trends, market share, or observations.
- Distinguish between product availability, product penetration, product
  visibility, sales representative coverage, and promotional activity.
- Competitor observations are NOT market share — never describe them as such.
- If data is insufficient for a section, say so plainly in that section
  rather than filling it with speculation.
- The findings below were computed with fixed thresholds, not by you —
  treat them as verified facts to explain and weave into the narrative.
- If data confidence is Medium or Low, say so wherever it affects a claim.

REPORT PERIOD
${startDate || "All available dates"} to ${endDate || "All available dates"}

DATABASE DATA
${JSON.stringify(bundle)}

PRE-COMPUTED FINDINGS (already verified — explain and incorporate these, do not invent additional ones)
${Array.isArray(flags) && flags.length > 0 ? JSON.stringify(flags) : "None triggered for this period."}

DATA CONFIDENCE
${confidence ? JSON.stringify(confidence) : "Not assessed."}

OUTPUT FORMAT

Return ONLY valid JSON — an array of sections in this exact order, using
these exact headings and types:
${REQUIRED_SECTIONS.map((s) => `- "${s.heading}" (${s.type}): ${s.guidance}`).join("\n")}

{
  "sections": [
    { "heading": "Executive Summary", "type": "paragraph", "text": "..." },
    { "heading": "Key Wins", "type": "bullets", "items": ["...", "...", "..."] },
    { "heading": "Critical Risks", "type": "bullets", "items": ["...", "..."] },
    { "heading": "Area Watchlist", "type": "table", "columns": ["Area", "Issue", "Priority"], "rows": [["...", "...", "High"]] },
    { "heading": "Distributor Intelligence", "type": "paragraph", "text": "..." },
    { "heading": "Competitive Landscape", "type": "paragraph", "text": "..." },
    { "heading": "Recommended Actions", "type": "bullets", "items": ["...", "..."] }
  ]
}
`;
}
