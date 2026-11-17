/**
 * Location capture vs location verification
 * -----------------------------------------
 * CAPTURE      = reading the device's coordinates (navigator.geolocation).
 * VERIFICATION = comparing that reading with the outlet's REGISTERED
 *                coordinates and a configurable radius.
 *
 * This file mirrors the rule in the database trigger
 * (supabase/migrations/20260810000000...). The database result is the
 * authoritative one stored with the audit; this copy only gives the
 * auditor an immediate preview, so the two must stay in step - the tests
 * in utils/__tests__/location.test.js pin the same cases the SQL tests do.
 *
 * Nothing here ever blocks an audit.
 */

export const DEFAULT_LOCATION_SETTINGS = Object.freeze({
    radius_m: 100,
    max_accuracy_m: 150,
});

export function haversineMeters(lat1, lon1, lat2, lon2) {
    if ([lat1, lon1, lat2, lon2].some((v) => typeof v !== "number" || !Number.isFinite(v))) return null;
    const rad = (d) => (d * Math.PI) / 180;
    const a =
        Math.sin(rad(lat2 - lat1) / 2) ** 2 +
        Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(rad(lon2 - lon1) / 2) ** 2;
    return 2 * 6371000 * Math.asin(Math.min(1, Math.sqrt(a)));
}

/**
 * @returns {{status: string, distance_m: number|null}}
 *   status: verified | outside_radius | low_accuracy | unavailable |
 *           no_registered_location | baseline_set
 */
export function evaluateLocation(
    { capturedLat, capturedLon, accuracy, outletLat, outletLon, registersOutlet = false },
    settings = DEFAULT_LOCATION_SETTINGS,
) {
    const radius = Number(settings.radius_m ?? DEFAULT_LOCATION_SETTINGS.radius_m);
    const maxAccuracy = Number(settings.max_accuracy_m ?? DEFAULT_LOCATION_SETTINGS.max_accuracy_m);

    if (capturedLat == null || capturedLon == null) return { status: "unavailable", distance_m: null };
    if (outletLat == null || outletLon == null) return { status: "no_registered_location", distance_m: null };

    const d = haversineMeters(capturedLat, capturedLon, outletLat, outletLon);
    const distance_m = Math.round(d * 10) / 10;
    if (registersOutlet && d <= 1) return { status: "baseline_set", distance_m };
    if (accuracy != null && accuracy > maxAccuracy) return { status: "low_accuracy", distance_m };
    if (d <= radius + (accuracy ?? 0)) return { status: "verified", distance_m };
    return { status: "outside_radius", distance_m };
}

export const LOCATION_STATUS_META = {
    verified: { label: "Location verified", tone: "good", help: "The captured location is consistent with the outlet's registered location." },
    outside_radius: { label: "Outside allowed radius", tone: "warn", help: "The captured location is further from the outlet than allowed. The audit is saved and flagged for review." },
    low_accuracy: { label: "GPS too imprecise to verify", tone: "neutral", help: "The device reported a very wide accuracy range, so the reading cannot confirm or contradict the outlet's location." },
    unavailable: { label: "No location captured", tone: "warn", help: "No device location was captured for this audit." },
    no_registered_location: { label: "Outlet has no registered location", tone: "neutral", help: "There is no registered location for this outlet to compare against." },
    baseline_set: { label: "Outlet location registered", tone: "neutral", help: "This visit set the outlet's registered location, so it is the reference, not a check." },
    legacy_unverified: { label: "Recorded before verification existed", tone: "neutral", help: "This audit pre-dates location verification and was not checked." },
};

export function describeLocationResult(result) {
    const meta = LOCATION_STATUS_META[result?.status];
    if (!meta) return null;
    const dist = result.distance_m != null ? ` (${Math.round(result.distance_m)} m from the registered location)` : "";
    return { ...meta, text: `${meta.label}${dist}` };
}
