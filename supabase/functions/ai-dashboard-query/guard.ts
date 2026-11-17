// Safeguards around the language model
// =====================================================================
// Everything here is deterministic code. The prompt tells the model to
// stay inside the evidence; this file CHECKS that it did.
//   1. sampleGate          too little data -> no model call at all
//   2. sanitize / redact   database text is data, never instructions
//   3. parseModelAnswer    strict output structure
//   4. verifyNumbers       every figure in the answer must exist in the
//                          deterministic evidence
//   5. buildFallback       what the user sees when the answer cannot be
//                          trusted: the verified findings, unexplained
// =====================================================================

import type { Flag } from "./rules.ts";

// ---------- 1. minimum-sample gate ----------------------------------------
// DEFAULT_MIN_AUDITS = 5 is a rule of thumb, not a statistical result.
// With fewer than five audits, one audit moves any percentage by 20 points
// or more, so a "trend" or "rate" is mostly noise. It is business
// judgement, configurable through the AI_MIN_AUDITS environment variable.
export const DEFAULT_MIN_AUDITS = 5;

export interface SampleGateResult {
  sufficient: boolean;
  total: number;
  min: number;
  message?: string;
}

export function sampleGate(total: number | null | undefined, min = DEFAULT_MIN_AUDITS, periodText = "this period"): SampleGateResult {
  const n = typeof total === "number" && Number.isFinite(total) ? total : 0;
  if (n >= min) return { sufficient: true, total: n, min };
  return {
    sufficient: false,
    total: n,
    min,
    message:
      `Only ${n} audit${n === 1 ? " was" : "s were"} recorded for ${periodText}. ` +
      `At least ${min} are needed before this assistant will draw conclusions, so I can't give a reliable answer for this period. ` +
      `Try a longer date range.`,
  };
}

export function readMinAudits(raw: string | undefined | null): number {
  const n = Number(raw);
  return Number.isInteger(n) && n >= 1 && n <= 100 ? n : DEFAULT_MIN_AUDITS;
}

// ---------- 2. untrusted text ---------------------------------------------
const INVISIBLE = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F\u200B-\u200F\u202A-\u202E\u2066-\u2069\uFEFF]/g;

export function sanitizeText(value: unknown, maxLen = 300): string {
  if (value === null || value === undefined) return "";
  return String(value)
    .replace(INVISIBLE, "")
    .replace(/[<>`]/g, (c) => (c === "<" ? "\u2039" : c === ">" ? "\u203a" : "'"))
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLen);
}

const INJECTION_PATTERNS: Array<[string, RegExp]> = [
  ["ignore_instructions", /\b(ignore|disregard|forget|override)\b[^.]{0,30}\b(previous|prior|above|earlier|all|any|your|the)\b[^.]{0,20}\b(instructions?|rules?|prompts?|guidelines?)\b/i],
  ["reveal_prompt", /\b(reveal|show|print|repeat|output|display|leak)\b[^.]{0,25}\b(system|hidden|initial|your)\b[^.]{0,15}\b(prompt|instructions?|rules)\b/i],
  ["system_prompt", /\b(system|developer)\s+(prompt|message)\b/i],
  ["role_override", /\byou\s+are\s+now\b|\bnew\s+instructions?\s*:|\bpretend\s+(to\s+be|you\s+are)\b/i],
  ["secrets", /\b(api|secret|service[\s-]?role|private)\s*key\b|\bpassword\b.{0,20}\b(show|reveal|give|send)\b/i],
  ["chat_markup", /<\s*\/?\s*(system|assistant|instruction)s?\b|\[\s*(system|inst)\s*\]|<\|/i],
  ["jailbreak", /\bjailbreak\b|\bdo\s+anything\s+now\b/i],
  ["exfiltrate", /\b(email|send|post|upload)\b[^.]{0,30}\b(keys?|tokens?|credentials?|passwords?)\b/i],
];

export function detectInjection(text: string): string[] {
  const hits: string[] = [];
  for (const [id, re] of INJECTION_PATTERNS) if (re.test(text)) hits.push(id);
  return hits;
}

export const REDACTED = "[text removed: contained instruction-like content]";

export interface RedactionResult<T> { value: T; redactions: number }

/** Deep-sanitizes every string in a structure; instruction-like strings are replaced. */
export function redactUntrusted<T>(input: T, maxLen = 300): RedactionResult<T> {
  let redactions = 0;
  const walk = (v: unknown): unknown => {
    if (typeof v === "string") {
      const clean = sanitizeText(v, maxLen);
      if (detectInjection(clean).length) { redactions++; return REDACTED; }
      return clean;
    }
    if (Array.isArray(v)) return v.map(walk);
    if (v && typeof v === "object") {
      return Object.fromEntries(Object.entries(v as Record<string, unknown>).map(([k, x]) => [k, walk(x)]));
    }
    return v;
  };
  return { value: walk(input) as T, redactions };
}

export interface HistoryTurn { question: string; answer: string }

/** Previous turns come back from the browser, so they are untrusted too. */
export function cleanHistory(history: unknown, maxTurns = 2): HistoryTurn[] {
  if (!Array.isArray(history)) return [];
  return history.slice(-maxTurns).flatMap((t) => {
    if (!t || typeof t !== "object") return [];
    const q = sanitizeText((t as HistoryTurn).question, 300);
    const a = sanitizeText((t as HistoryTurn).answer, 600);
    if (!q || !a || detectInjection(q).length || detectInjection(a).length) return [];
    return [{ question: q, answer: a }];
  });
}

/** Keeps prompts a sensible size; reports what was left out. */
export function limitRows<T extends Record<string, unknown>>(bundle: T, maxRows = 40): { bundle: T; omitted: Record<string, number> } {
  const omitted: Record<string, number> = {};
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(bundle)) {
    if (Array.isArray(v) && v.length > maxRows) { omitted[k] = v.length - maxRows; out[k] = v.slice(0, maxRows); }
    else out[k] = v;
  }
  return { bundle: out as T, omitted };
}

// ---------- 3. output structure -------------------------------------------
export interface ModelAnswer {
  answer: string;
  key_points: string[];
  recommended_action: string | null;
  data_sufficient: boolean;
}

export type Parsed<T> = { ok: true; value: T } | { ok: false; reason: string };

export function parseModelAnswer(v: unknown): Parsed<ModelAnswer> {
  if (typeof v !== "object" || v === null || Array.isArray(v)) return { ok: false, reason: "response is not an object" };
  const o = v as Record<string, unknown>;
  if (typeof o.answer !== "string" || !o.answer.trim()) return { ok: false, reason: "answer is missing or empty" };
  if (o.answer.length > 1500) return { ok: false, reason: "answer is too long" };
  if (!Array.isArray(o.key_points) || !o.key_points.every((p) => typeof p === "string" && p.length <= 300)) {
    return { ok: false, reason: "key_points must be an array of short strings" };
  }
  if (o.key_points.length > 6) return { ok: false, reason: "too many key_points" };
  const action = o.recommended_action;
  if (action !== null && action !== undefined && (typeof action !== "string" || action.length > 400)) {
    return { ok: false, reason: "recommended_action must be a short string or null" };
  }
  if (typeof o.data_sufficient !== "boolean") return { ok: false, reason: "data_sufficient must be true or false" };
  return {
    ok: true,
    value: {
      answer: o.answer.trim(),
      key_points: o.key_points as string[],
      recommended_action: typeof action === "string" && action.trim() ? action.trim() : null,
      data_sufficient: o.data_sufficient,
    },
  };
}

// ---------- 4. numeric verification ---------------------------------------
const NUMBER_RE = /(\d[\d,]*(?:\.\d+)?)(\s*%)?/g;

export interface NumberClaim { value: number; raw: string; hasPercent: boolean }

export function numberClaims(text: string): NumberClaim[] {
  const out: NumberClaim[] = [];
  for (const m of text.matchAll(NUMBER_RE)) {
    const raw = m[1].replace(/,/g, "");
    const value = Number(raw);
    if (Number.isFinite(value)) out.push({ value, raw: m[0].trim(), hasPercent: !!m[2] });
  }
  return out;
}

/** Bare whole numbers 0-9 ("2 areas", "top 3") are wording, not business figures. */
function needsChecking(c: NumberClaim): boolean {
  return c.hasPercent || !Number.isInteger(c.value) || c.value >= 10;
}

export function allowedNumbers(...sources: unknown[]): number[] {
  const text = sources.map((s) => (typeof s === "string" ? s : JSON.stringify(s ?? null))).join(" ");
  return numberClaims(text).map((c) => c.value);
}

function matches(claim: number, allowed: number[]): boolean {
  return allowed.some(
    (a) =>
      Math.abs(a - claim) < 1e-9 ||
      (Number.isInteger(claim) && Math.round(a) === claim) ||
      Math.round(a * 10) / 10 === claim,
  );
}

export interface VerificationResult { ok: boolean; unsupported: string[]; checked: number }

/** Every figure in `texts` must appear (to rounding) in `allowed`. */
export function verifyNumbers(texts: Array<string | null | undefined>, allowed: number[]): VerificationResult {
  const unsupported: string[] = [];
  let checked = 0;
  for (const t of texts) {
    if (!t) continue;
    for (const c of numberClaims(t)) {
      if (!needsChecking(c)) continue;
      checked++;
      if (!matches(c.value, allowed) && !unsupported.includes(c.raw)) unsupported.push(c.raw);
    }
  }
  return { ok: unsupported.length === 0, unsupported, checked };
}

// ---------- 5. fallback ---------------------------------------------------
export function buildFallback(flags: Flag[], periodText: string): { answer: string; key_points: string[]; recommended_action: null } {
  const top = flags.slice(0, 5);
  return {
    answer: top.length
      ? `I could not produce a reliable written explanation for ${periodText}, so here are the verified findings from the audit data without commentary.`
      : `I could not produce a reliable written explanation for ${periodText}, and no rule-based findings were triggered for it.`,
    key_points: top.map((f) => f.message),
    recommended_action: null,
  };
}

export function evidenceLines(flags: Flag[], max = 8): Array<{ rule_id: string; severity: string; text: string }> {
  return flags.slice(0, max).map((f) => ({ rule_id: f.rule_id, severity: f.severity, text: f.evidence }));
}
