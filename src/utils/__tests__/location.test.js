import { describe, it, expect } from "vitest";
import { DEFAULT_LOCATION_SETTINGS, describeLocationResult, evaluateLocation, haversineMeters } from "../location";

// These cases mirror supabase/tests/sql.test.js so the preview shown to the
// auditor and the result stored by the database cannot drift apart.
const OUTLET = { outletLat: -1.3, outletLon: 36.8 };

describe("haversineMeters", () => {
    it("computes a known distance", () => {
        const d = haversineMeters(0, 0, 0, 1);
        expect(d).toBeGreaterThan(111000);
        expect(d).toBeLessThan(111400);
    });
    it("returns null for missing or invalid coordinates", () => {
        expect(haversineMeters(null, 0, 0, 1)).toBeNull();
        expect(haversineMeters(NaN, 0, 0, 1)).toBeNull();
        expect(haversineMeters("1", 0, 0, 1)).toBeNull();
    });
});

describe("evaluateLocation mirrors the database rule", () => {
    it("verified when ~40 m away", () => {
        expect(evaluateLocation({ capturedLat: -1.30036, capturedLon: 36.8, accuracy: 10, ...OUTLET }).status).toBe("verified");
    });
    it("outside_radius when ~1 km away", () => {
        expect(evaluateLocation({ capturedLat: -1.309, capturedLon: 36.8, accuracy: 10, ...OUTLET }).status).toBe("outside_radius");
    });
    it("low_accuracy when the reported accuracy is worse than the limit", () => {
        expect(evaluateLocation({ capturedLat: -1.309, capturedLon: 36.8, accuracy: 400, ...OUTLET }).status).toBe("low_accuracy");
    });
    it("reported accuracy widens the allowed distance", () => {
        expect(evaluateLocation({ capturedLat: -1.30117, capturedLon: 36.8, accuracy: 60, ...OUTLET }).status).toBe("verified");
    });
    it("unavailable without a capture", () => {
        expect(evaluateLocation({ capturedLat: null, capturedLon: null, ...OUTLET }).status).toBe("unavailable");
    });
    it("no_registered_location when the outlet has no coordinates", () => {
        expect(evaluateLocation({ capturedLat: -1.3, capturedLon: 36.8, outletLat: null, outletLon: null }).status).toBe("no_registered_location");
    });
    it("baseline_set only when the capture matches the registered point", () => {
        expect(evaluateLocation({ capturedLat: -1.3, capturedLon: 36.8, registersOutlet: true, ...OUTLET }).status).toBe("baseline_set");
        expect(evaluateLocation({ capturedLat: -1.309, capturedLon: 36.8, registersOutlet: true, ...OUTLET }).status).toBe("outside_radius");
    });
    it("uses a configured radius", () => {
        const far = { capturedLat: -1.309, capturedLon: 36.8, accuracy: 5, ...OUTLET };
        expect(evaluateLocation(far, { ...DEFAULT_LOCATION_SETTINGS, radius_m: 2000 }).status).toBe("verified");
        expect(evaluateLocation(far).status).toBe("outside_radius");
    });
    it("reports the distance", () => {
        const r = evaluateLocation({ capturedLat: -1.309, capturedLon: 36.8, accuracy: 5, ...OUTLET });
        expect(r.distance_m).toBeGreaterThan(990);
        expect(r.distance_m).toBeLessThan(1010);
    });
});

describe("describeLocationResult", () => {
    it("labels each status and never labels a failure as verified", () => {
        expect(describeLocationResult({ status: "outside_radius", distance_m: 840 }).text).toMatch(/Outside allowed radius \(840 m/);
        expect(describeLocationResult({ status: "outside_radius", distance_m: 840 }).tone).toBe("warn");
        expect(describeLocationResult({ status: "legacy_unverified" }).label).toMatch(/before verification existed/);
        expect(describeLocationResult({ status: "nonsense" })).toBeNull();
    });
});
