// Analytics data contract
// =====================================================================
// One place that states exactly which fields every database function
// returns. Each contract below is checked against the REAL SQL output by
// supabase/tests/sql.test.js (run in an in-process Postgres), and against
// live data at runtime by validateRows()/validateObject() so that a
// missing or renamed field produces an explicit diagnostic instead of a
// rule quietly doing nothing.
//
// SCOPE OF VERIFICATION
//   verified against SQL in this repo: overview, outlet_metrics,
//   auditor_metrics, distributor_metrics, repeat_issues, cross_dimension.
//   NOT contract-checked: get_ai_audit_submission_metrics. Its SQL is not
//   in the repository, so its product_availability / competitor_landscape
//   output is only passed through to the model as context; no rule reads
//   it. See PASS_THROUGH_SOURCES.
// =====================================================================

export type FieldType = "string" | "number" | "boolean" | "object" | "array";

export interface FieldSpec {
  name: string;
  type: FieldType;
  nullable?: boolean;
}

export interface Diagnostic {
  source: string;
  code: "missing_field" | "wrong_type" | "unexpected_null" | "not_array" | "not_object";
  field?: string;
  rows_affected?: number;
  message: string;
}

const f = (name: string, type: FieldType, nullable = false): FieldSpec => ({ name, type, nullable });

export const CONTRACTS = {
  overview_overall: [
    f("total_audits", "number"), f("outlets_audited", "number"), f("active_outlets", "number"),
    f("coverage_pct", "number", true), f("auditors_active", "number"),
    f("visits_confirmed", "number"), f("visits_confirmed_pct", "number", true),
    f("promotions_recorded", "number"), f("promotion_rate_pct", "number", true),
    f("location_verified", "number"), f("location_outside_radius", "number"),
    f("location_low_accuracy", "number"), f("location_unavailable", "number"),
    f("audits_without_outlet_link", "number"),
    f("missing_person_met", "number"), f("missing_mobile", "number"), f("missing_location", "number"),
  ],
  overview_area: [
    f("area", "string"), f("audits", "number"), f("outlets_audited", "number"),
    f("active_outlets", "number"), f("coverage_pct", "number", true),
    f("visits_confirmed_pct", "number"), f("promotion_rate_pct", "number"),
  ],
  outlet_metrics: [
    f("outlet_id", "string"), f("outlet_key", "string"), f("outlet_name", "string"),
    f("area", "string", true), f("visit_count", "number"),
    f("last_visit_date", "string", true), f("days_since_last_visit", "number", true),
    f("ever_had_promotion", "boolean"), f("visits_unconfirmed", "number"),
    f("location_outside_radius", "number"), f("coordinates", "object", true),
    f("needs_review", "boolean"),
  ],
  auditor_metrics: [
    f("auditor_id", "string"), f("auditor_name", "string", true), f("audit_count", "number"),
    f("areas_covered", "number"), f("promotions_recorded", "number"), f("visits_confirmed", "number"),
    f("last_audit_date", "string", true), f("days_since_last_audit", "number", true),
  ],
  distributor_metrics: [
    f("distributor_name", "string"), f("mention_count", "number"), f("areas_covered", "number"),
    f("areas", "array", true), f("last_seen_date", "string", true),
  ],
  repeat_issues: [
    f("outlet_id", "string"), f("outlet_name", "string"), f("area", "string", true),
    f("issue_type", "string"), f("issue_detail", "string", true),
    f("occurrences", "number"), f("total_visits", "number"), f("occurrence_pct", "number"),
    f("last_visit_date", "string"),
  ],
  cross_dimension: [
    f("row_label", "string"), f("col_label", "string"), f("audits", "number"),
    f("hits", "number"), f("pct", "number", true),
  ],
} as const satisfies Record<string, readonly FieldSpec[]>;

export type ContractName = keyof typeof CONTRACTS;

/** Bundle sections that reach the model but are NOT contract-checked. */
export const PASS_THROUGH_SOURCES = ["product_availability", "competitor_landscape"] as const;

function typeMatches(value: unknown, type: FieldType): boolean {
  switch (type) {
    case "string": return typeof value === "string";
    case "number": return typeof value === "number" && Number.isFinite(value);
    case "boolean": return typeof value === "boolean";
    case "array": return Array.isArray(value);
    case "object": return typeof value === "object" && value !== null && !Array.isArray(value);
  }
}

// deno-lint-ignore no-explicit-any
type Row = Record<string, any>;

/** Checks one object against a contract. Returns [] when it conforms. */
export function validateObject(source: string, name: ContractName, value: unknown): Diagnostic[] {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return [{ source, code: "not_object", message: `${source}: expected an object, got ${Array.isArray(value) ? "array" : typeof value}.` }];
  }
  const row = value as Row;
  const out: Diagnostic[] = [];
  for (const spec of CONTRACTS[name] as readonly FieldSpec[]) {
    if (!(spec.name in row) || row[spec.name] === undefined) {
      out.push({ source, code: "missing_field", field: spec.name, message: `${source}: field "${spec.name}" is missing from the database function output.` });
    } else if (row[spec.name] === null) {
      if (!spec.nullable) out.push({ source, code: "unexpected_null", field: spec.name, message: `${source}: field "${spec.name}" is null but the contract does not allow null.` });
    } else if (!typeMatches(row[spec.name], spec.type)) {
      out.push({ source, code: "wrong_type", field: spec.name, message: `${source}: field "${spec.name}" should be ${spec.type}, got ${typeof row[spec.name]}.` });
    }
  }
  return out;
}

/** Checks every row of an array; identical problems are reported once with a count. */
export function validateRows(source: string, name: ContractName, value: unknown): Diagnostic[] {
  if (!Array.isArray(value)) {
    return [{ source, code: "not_array", message: `${source}: expected an array of rows, got ${typeof value}.` }];
  }
  const merged = new Map<string, Diagnostic>();
  for (const row of value) {
    for (const d of validateObject(source, name, row)) {
      const key = `${d.code}:${d.field ?? ""}`;
      const existing = merged.get(key);
      if (existing) existing.rows_affected = (existing.rows_affected ?? 1) + 1;
      else merged.set(key, { ...d, rows_affected: 1 });
    }
  }
  return [...merged.values()];
}
