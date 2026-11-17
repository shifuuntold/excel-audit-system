import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { callGemini, extractJson, isReportFindingsShape } from "./gemini.ts";
import { fetchData } from "./dataFetch.ts";
import { authorize } from "./auth.ts";
import { answerQuestion, buildBrief } from "./pipeline.ts";
import { buildReportFindingsPrompt, finalizeReportFindings, prepareReportInput } from "./report.ts";
import { readMinAudits } from "./guard.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (body: unknown, status = 200) =>
  Response.json(body, { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
// SERVER-SIDE ONLY. This key bypasses row-level security, which is why no
// request reaches a database call before authorize() has run.
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const MIN_AUDITS = readMinAudits(Deno.env.get("AI_MIN_AUDITS"));

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ success: false, error: "Method not allowed." }, 405);

  try {
    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return json({ success: false, error: "Request body must be JSON." }, 400);
    }

    // 1. Who is calling, and may they use this mode? Nothing else runs first.
    const decision = await authorize(req.headers.get("Authorization"), body.mode, {
      getUser: async (token) => {
        const { data, error } = await supabase.auth.getUser(token);
        return error || !data?.user ? null : { id: data.user.id };
      },
      getRole: async (userId) => {
        const { data } = await supabase.from("profiles").select("role").eq("id", userId).maybeSingle();
        return data?.role ?? null;
      },
    });
    if (!decision.allowed) return json({ success: false, error: decision.error }, decision.status);

    if (!GEMINI_API_KEY) throw new Error("GEMINI_API_KEY is not configured");

    const deps = {
      llm: (prompt: string) => callGemini(GEMINI_API_KEY, prompt),
      fetchData: (queryType: Parameters<typeof fetchData>[0]["queryType"], startDate: string | null, endDate: string | null) =>
        fetchData({ supabase, queryType, startDate, endDate }),
      minAudits: MIN_AUDITS,
      log: (message: string, detail?: unknown) => console.error(`[ai-dashboard-query] ${message}`, detail ?? ""),
    };
    const startDate = typeof body.startDate === "string" ? body.startDate : null;
    const endDate = typeof body.endDate === "string" ? body.endDate : null;

    if (decision.mode === "weekly_brief") {
      const r = await buildBrief({ startDate, endDate }, deps);
      return json(r.body, r.status);
    }

    if (decision.mode === "full_report") {
      const prepared = prepareReportInput(body.reportData);
      if (!prepared) return json({ success: false, error: "reportData is required for full_report mode" }, 400);
      const text = await callGemini(GEMINI_API_KEY, buildReportFindingsPrompt(prepared.input));
      const findings = extractJson<{ key_observations: string[]; retailer_feedback: string[]; recommendations: string[] }>(text, isReportFindingsShape);
      const final = finalizeReportFindings(
        { key_observations: findings.key_observations || [], retailer_feedback: findings.retailer_feedback || [], recommendations: findings.recommendations || [] },
        prepared.input,
      );
      return json({ success: true, mode: "full_report", ...final, redactions: prepared.redactions });
    }

    const r = await answerQuestion({ question: body.question, startDate, endDate, history: body.history }, deps);
    return json(r.body, r.status);
  } catch (error) {
    console.error(error);
    return json({ success: false, error: error instanceof Error ? error.message : "Unknown error" }, 500);
  }
});
