import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { callGemini, extractJson } from "./gemini.ts";
import { QUERY_TYPES, CLASSIFICATION_GUIDE, fetchData, type QueryType } from "./dataFetch.ts";
import { runRulesEngine, computeConfidence, type Flag } from "./rules.ts";
import { buildReportFindingsPrompt, type ReportFindingsInput } from "./report.ts";
import { EXECUTIVE_STYLE_RULES } from "./promptRules.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

interface HistoryTurn {
  question: string;
  answer: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    if (!GEMINI_API_KEY) {
      throw new Error("GEMINI_API_KEY is not configured");
    }

    const body = await req.json();
    const { question, startDate, endDate, mode, history, reportData } = body as {
      question?: string;
      startDate?: string;
      endDate?: string;
      mode?: "query" | "weekly_brief" | "full_report";
      history?: HistoryTurn[];
      reportData?: ReportFindingsInput;
    };

    if (mode === "weekly_brief") {
      return await handleWeeklyBrief(startDate, endDate);
    }

    if (mode === "full_report") {
      return await handleFullReport(reportData);
    }

    if (!question || !question.trim()) {
      return Response.json(
        { success: false, error: "A question is required" },
        { status: 400, headers: corsHeaders }
      );
    }

    // --- STEP 1: classify -------------------------------------------------
    const classificationPrompt = `
You are an AI assistant for the Excel Chemicals Field Sales Audit System.

Classify the user's question into exactly ONE of these query types:
${CLASSIFICATION_GUIDE}

User question:
"${question}"

Return ONLY valid JSON in this format:
{ "query_type": "area_performance", "reason": "brief explanation" }
`;

    const classificationText = await callGemini(GEMINI_API_KEY, classificationPrompt);
    const classification = extractJson<{ query_type: string; reason?: string }>(classificationText);

    const queryType = (QUERY_TYPES as readonly string[]).includes(classification.query_type)
      ? (classification.query_type as QueryType)
      : "unknown";

    if (queryType === "unknown") {
      return Response.json(
        {
          success: false,
          error:
            "I couldn't tell what you're asking about. Try a question about a specific area, auditor, outlet, competitor, product, promotions, or something like \"what needs urgent attention\" or \"what changed vs last month\".",
        },
        { status: 400, headers: corsHeaders }
      );
    }

    // --- STEP 2: fetch data (dispatches to the right RPC(s) per type) -----
    const bundle = await fetchData({ supabase, queryType, startDate: startDate || null, endDate: endDate || null });

    // --- STEP 3: deterministic findings, computed from real numbers -------
    // Always run this — even for a narrow question like "product
    // availability", a relevant flag or two adds useful context — but it's
    // cheap since it's pure computation, not another Gemini call.
    const flags: Flag[] = runRulesEngine(bundle);
    const confidence = computeConfidence(bundle.overall);

    // --- STEP 4: ask Gemini to explain the (already-computed) findings ----
    const historyContext = formatHistory(history);

    const answerPrompt = `
You are the AI Audit Analyst for Excel Chemicals.

${EXECUTIVE_STYLE_RULES}

${historyContext}

Answer the user's question using ONLY the supplied database data and the
pre-computed findings below. The findings were calculated with fixed
thresholds, not by you — treat them as verified facts, and explain them,
don't recompute or second-guess the numbers.

User question:
"${question}"

Date range:
${startDate || "All available dates"} to ${endDate || "All available dates"}

Query type: ${queryType}

Database data:
${JSON.stringify(bundle)}

Pre-computed findings (already verified, do not invent additional ones):
${flags.length > 0 ? JSON.stringify(flags) : "None triggered for this period."}

Data confidence: ${confidence ? `${confidence.level} — ${confidence.note}` : "Not assessed."}

Rules:
- Do not invent numbers not present in the data above.
- Do not claim competitor observations are market share.
- Do not confuse product availability with market penetration.
- If data confidence is Medium or Low, say so plainly in the answer.
- Be concise but useful. Give the direct answer first.
- Use percentages when available.
- If the data is insufficient to answer the question, say so clearly.

Return ONLY valid JSON:
{
  "answer": "direct natural-language answer",
  "key_points": ["point 1", "point 2"],
  "recommended_action": "one practical recommendation"
}
`;

    const answerText = await callGemini(GEMINI_API_KEY, answerPrompt);
    const answer = extractJson<{ answer: string; key_points?: string[]; recommended_action?: string }>(answerText);

    return Response.json(
      {
        success: true,
        question,
        queryType,
        period: { startDate: startDate || null, endDate: endDate || null },
        confidence,
        flags,
        ...answer,
      },
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error(error);
    return Response.json(
      { success: false, error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500, headers: corsHeaders }
    );
  }
});

function formatHistory(history?: HistoryTurn[]): string {
  if (!history || history.length === 0) return "";
  const recent = history.slice(-2);
  const lines = recent.map((t) => `Q: ${t.question}\nA: ${t.answer}`).join("\n\n");
  return `For context, here is the recent conversation (the new question may refer back to it, e.g. "why?" or "which ones?"):\n${lines}\n`;
}

/**
 * Generates the two judgment-requiring sections of the "FIELD SALES
 * AUDITOR REPORT" — Key Observations and Recommendations. Every other
 * section (product penetration, competitor landscape, distributor
 * activity, promotional activity, retailer feedback) is deterministic
 * and assembled entirely on the client from the same numbers the
 * rule-based Quick Report already uses — see
 * reportService.js's generateAiReportSections.
 *
 * Deliberately takes no startDate/endDate and does no database access of
 * its own: the client already fetched and scoped the underlying audits
 * (via the exact same getAudits() call the Quick Report is built from,
 * which is what actually enforces "an Auditor only ever sees their own
 * audits" — reusing that existing, proven scoping instead of re-deriving
 * caller identity/role here and trusting a client-supplied user id).
 */
async function handleFullReport(reportData?: ReportFindingsInput) {
  if (!reportData) {
    return Response.json(
      { success: false, error: "reportData is required for full_report mode" },
      { status: 400, headers: corsHeaders }
    );
  }

  const prompt = buildReportFindingsPrompt(reportData);
  const text = await callGemini(GEMINI_API_KEY!, prompt);
  const findings = extractJson<{ key_observations: string[]; recommendations: string[] }>(text);

  return Response.json(
    {
      success: true,
      mode: "full_report",
      key_observations: findings.key_observations || [],
      recommendations: findings.recommendations || [],
    },
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}

/**
 * The "killer feature" — a proactive, no-question-required weekly summary.
 * Runs the same rules engine used for risk_summary, but frames the output
 * as a standing report rather than an answer to a specific question.
 */
async function handleWeeklyBrief(startDate?: string, endDate?: string) {
  const bundle = await fetchData({
    supabase,
    queryType: "risk_summary",
    startDate: startDate || null,
    endDate: endDate || null,
  });

  const flags = runRulesEngine(bundle);
  const confidence = computeConfidence(bundle.overall);

  const briefPrompt = `
You are the AI Audit Analyst for Excel Chemicals, generating a Weekly
Sales Execution Report for management. This is a proactive brief, not an
answer to a question — write it as a standalone report.

${EXECUTIVE_STYLE_RULES}

Date range: ${startDate || "All available dates"} to ${endDate || "All available dates"}

Database data:
${JSON.stringify(bundle)}

Pre-computed findings (already verified — explain these, do not invent more):
${flags.length > 0 ? JSON.stringify(flags) : "None triggered for this period."}

Data confidence: ${confidence ? `${confidence.level} — ${confidence.note}` : "Not assessed."}

Rules:
- Do not invent numbers not present in the data.
- Do not claim competitor observations are market share.
- If data confidence is Medium or Low, mention it.
- Be direct and scannable — this is read by a CEO or Sales Director in under a minute.

Return ONLY valid JSON in this exact shape:
{
  "coverage_pct": <number or null>,
  "best_area": { "name": "...", "detail": "..." },
  "worst_area": { "name": "...", "detail": "..." },
  "promotion_activity_pct": <number or null>,
  "top_competitor": "...",
  "critical_risks": ["...", "..."],
  "recommended_actions": ["...", "...", "..."],
  "summary": "2-3 sentence executive summary"
}
`;

  const briefText = await callGemini(GEMINI_API_KEY!, briefPrompt);
  const brief = extractJson<{
    coverage_pct: number | null;
    best_area: { name: string; detail: string } | null;
    worst_area: { name: string; detail: string } | null;
    promotion_activity_pct: number | null;
    top_competitor: string | null;
    critical_risks: string[];
    recommended_actions: string[];
    summary: string;
  }>(briefText);

  return Response.json(
    {
      success: true,
      mode: "weekly_brief",
      period: { startDate: startDate || null, endDate: endDate || null },
      confidence,
      flags,
      ...brief,
    },
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}
