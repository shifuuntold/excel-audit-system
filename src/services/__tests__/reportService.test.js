import { describe, it, expect } from "vitest";
import { buildReportData } from "../reportService";

function makeAudit(overrides = {}) {
    return {
        outlet: { shop_name: "Test Shop", area_id: "a1", area_name: "Test Area" },
        products: {},
        market: {},
        ...overrides,
    };
}

describe("buildReportData", () => {
    it("counts total outlets and outlets with no products", () => {
        const audits = [
            makeAudit({ products: { water: { "500ml": true } } }),
            makeAudit({ products: {} }),
        ];
        const data = buildReportData(audits, {});
        expect(data.totalOutlets).toBe(2);
        expect(data.outletsWithNoProducts).toHaveLength(1);
        expect(data.noProductPct).toBe(50);
    });

    it("merges competitor names that only differ by case or spacing", () => {
        const audits = [
            makeAudit({ market: { competitors: { water: ["Afia"] } } }),
            makeAudit({ market: { competitors: { water: ["afia"] } } }),
            makeAudit({ market: { competitors: { water: ["  AFIA  "] } } }),
        ];
        const data = buildReportData(audits, {});
        const waterTally = data.competitorTallyByCategory.find(([cat]) => cat === "water");
        expect(waterTally[1]).toEqual([["Afia", 3]]);
    });

    it("keeps distinct categories separate in the competitor tally", () => {
        const audits = [
            makeAudit({ market: { competitors: { water: ["Dasani"], rtd: ["Minute Maid"] } } }),
        ];
        const data = buildReportData(audits, {});
        const categories = data.competitorTallyByCategory.map(([cat]) => cat);
        expect(categories).toContain("water");
        expect(categories).toContain("rtd");
    });

    it("computes product penetration percentage per product line", () => {
        const audits = [
            makeAudit({ products: { water: { "500ml": true } } }),
            makeAudit({ products: { water: { "500ml": true } } }),
            makeAudit({ products: {} }),
            makeAudit({ products: {} }),
        ];
        const data = buildReportData(audits, {});
        const water = data.productPenetration.find((p) => p.key === "water");
        expect(water.count).toBe(2);
        expect(water.pct).toBe(50);
        expect(water.tier).toBe("Good penetration");
    });

    it("tallies distributors across the multi-select array", () => {
        const audits = [
            makeAudit({ market: { distributors: ["Twiga", "Jumra"] } }),
            makeAudit({ market: { distributors: ["Twiga"] } }),
        ];
        const data = buildReportData(audits, {});
        expect(data.distributorTally[0]).toEqual(["Twiga", 2]);
    });

    it("counts visited yes/no responses", () => {
        const audits = [
            makeAudit({ market: { visited: "Yes" } }),
            makeAudit({ market: { visited: "No" } }),
            makeAudit({ market: {} }),
        ];
        const data = buildReportData(audits, {});
        expect(data.visitedYes).toBe(1);
        expect(data.visitedNo).toBe(1);
        expect(data.visitedUnspecified).toBe(1);
    });
});
