const GEMINI_MODEL = "gemini-3.1-flash-lite";
const GEMINI_URL =
  `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

/**
 * Calls Gemini with a single text prompt and returns the raw response text.
 * Throws with the upstream error body attached (as .details) on a non-OK
 * response, so callers can decide status codes/messaging.
 */
export async function callGemini(apiKey: string, prompt: string): Promise<string> {
  const response = await fetch(GEMINI_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": apiKey,
    },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
    }),
  });

  if (!response.ok) {
    const details = await response.json().catch(() => null);
    const err = new Error("Gemini request failed") as Error & { details?: unknown; status?: number };
    err.details = details;
    err.status = response.status;
    throw err;
  }

  const payload = await response.json();
  const text = payload.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error("Gemini returned an empty response");
  return text;
}

/**
 * Extracts a JSON object from Gemini's text output.
 *
 * The original version of this function did
 *   text.replace(/json/g, "").replace(//g, "")
 * — the second replace was an empty regex (matched nothing, a typo for a
 * ```-fence stripper), and the first one blindly deleted every occurrence
 * of the literal word "json" anywhere in the text, including inside the
 * answer content itself. That's a real, silent-corruption bug: if Gemini's
 * answer ever legitimately contained the word "json" (e.g. "the audit data
 * export is in json format"), this would mangle it and could break
 * JSON.parse in subtler cases too.
 *
 * This version only strips a leading/trailing ```-style fence and then
 * extracts the first balanced {...} block, which is far more robust to
 * whatever formatting Gemini decides to wrap the JSON in.
 */
export function extractJson<T = unknown>(text: string, validate?: (value: unknown) => value is T): T {
  let cleaned = text.trim();

  // Strip a markdown code fence if present (```json ... ``` or ``` ... ```)
  cleaned = cleaned.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim();

  // If there is still prose around the JSON, take the first {...} block.
  const firstBrace = cleaned.indexOf("{");
  const lastBrace = cleaned.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    cleaned = cleaned.slice(firstBrace, lastBrace + 1);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    console.error("Failed to parse Gemini JSON output:", cleaned.slice(0, 500));
    throw new Error("The AI returned a response we couldn't parse. Please try rephrasing your question.");
  }

  // Valid JSON can still have the wrong shape; callers pass a guard for the
  // shape they expect so a malformed reply fails here, not in the UI.
  if (validate && !validate(parsed)) {
    console.error("Gemini JSON output failed shape validation:", cleaned.slice(0, 500));
    throw new Error("The AI returned a response in an unexpected format. Please try rephrasing your question.");
  }
  return parsed as T;
}

function isStringArray(v: unknown): v is string[] {
  return Array.isArray(v) && v.every((x) => typeof x === "string");
}

export function isReportFindingsShape(v: unknown): v is {
  key_observations: string[]; retailer_feedback: string[]; recommendations: string[];
} {
  if (typeof v !== "object" || v === null) return false;
  const o = v as Record<string, unknown>;
  return isStringArray(o.key_observations ?? []) && isStringArray(o.retailer_feedback ?? []) && isStringArray(o.recommendations ?? []);
}
