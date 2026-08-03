import { describe, it, expect } from "vitest";
import { haversineKm, nearestNeighborRoute, routeSummary } from "../routePlanning";

describe("haversineKm", () => {
    it("returns 0 for the same point", () => {
        const p = { latitude: -1.2921, longitude: 36.8219 };
        expect(haversineKm(p, p)).toBe(0);
    });

    it("returns roughly the known distance between two real cities", () => {
        // Nairobi to Mombasa is ~440km as the crow flies
        const nairobi = { latitude: -1.2921, longitude: 36.8219 };
        const mombasa = { latitude: -4.0435, longitude: 39.6682 };
        const km = haversineKm(nairobi, mombasa);
        expect(km).toBeGreaterThan(400);
        expect(km).toBeLessThan(480);
    });
});

describe("nearestNeighborRoute", () => {
    it("visits the closest outlet first, not just in list order", () => {
        const start = { latitude: 0, longitude: 0 };
        const far = { name: "Far", latitude: 1, longitude: 1 };
        const near = { name: "Near", latitude: 0.01, longitude: 0.01 };

        // Deliberately listed far-first, so a naive "keep order" bug
        // would visit Far before Near.
        const route = nearestNeighborRoute(start, [far, near]);

        expect(route[0].name).toBe("Near");
        expect(route[1].name).toBe("Far");
    });

    it("visits every outlet exactly once", () => {
        const start = { latitude: 0, longitude: 0 };
        const outlets = [
            { name: "A", latitude: 0.1, longitude: 0.1 },
            { name: "B", latitude: 0.2, longitude: -0.1 },
            { name: "C", latitude: -0.1, longitude: 0.2 },
        ];
        const route = nearestNeighborRoute(start, outlets);
        expect(route.map((r) => r.name).sort()).toEqual(["A", "B", "C"]);
    });

    it("attaches a legDistanceKm to each stop", () => {
        const start = { latitude: 0, longitude: 0 };
        const outlets = [{ name: "A", latitude: 0.05, longitude: 0.05 }];
        const route = nearestNeighborRoute(start, outlets);
        expect(route[0].legDistanceKm).toBeGreaterThan(0);
    });
});

describe("routeSummary", () => {
    it("sums leg distances and estimates a travel time", () => {
        const route = [{ legDistanceKm: 5 }, { legDistanceKm: 3 }];
        const summary = routeSummary(route, 30);
        expect(summary.totalKm).toBe(8);
        expect(summary.estimatedMinutes).toBe(16); // 8km at 30km/h = 16 minutes
    });
});
