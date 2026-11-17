// Fixtures shaped exactly like the contracted database output.
// deno-lint-ignore-file no-explicit-any
export const overall = (o: Record<string, any> = {}) => ({
  total_audits: 40, outlets_audited: 24, active_outlets: 60, coverage_pct: 40, auditors_active: 4,
  visits_confirmed: 30, visits_confirmed_pct: 75, promotions_recorded: 12, promotion_rate_pct: 30,
  location_verified: 25, location_outside_radius: 3, location_low_accuracy: 2, location_unavailable: 1,
  audits_without_outlet_link: 2, missing_person_met: 2, missing_mobile: 3, missing_location: 1, ...o,
});
export const area = (o: Record<string, any> = {}) => ({
  area: "Kangemi", audits: 20, outlets_audited: 12, active_outlets: 30, coverage_pct: 40,
  visits_confirmed_pct: 80, promotion_rate_pct: 25, ...o,
});
export const outlet = (o: Record<string, any> = {}) => ({
  outlet_id: "o-1", outlet_key: "o-1", outlet_name: "Alpha Shop", area: "Kangemi", visit_count: 3,
  last_visit_date: "2026-11-01", days_since_last_visit: 5, ever_had_promotion: true, visits_unconfirmed: 0,
  location_outside_radius: 0, coordinates: { latitude: -1.3, longitude: 36.8 }, needs_review: false, ...o,
});
export const auditor = (o: Record<string, any> = {}) => ({
  auditor_id: "u-1", auditor_name: "Ann Auditor", audit_count: 10, areas_covered: 2, promotions_recorded: 3,
  visits_confirmed: 8, last_audit_date: "2026-11-05", days_since_last_audit: 2, ...o,
});
export const repeat = (o: Record<string, any> = {}) => ({
  outlet_id: "o-1", outlet_name: "Alpha Shop", area: "Kangemi", issue_type: "visit_not_confirmed",
  issue_detail: null, occurrences: 3, total_visits: 4, occurrence_pct: 75, last_visit_date: "2026-11-05", ...o,
});
export const period = { startDate: "2026-11-01", endDate: "2026-11-07" };
