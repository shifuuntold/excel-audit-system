import { describe, it, expect } from "vitest";
import { buildReportData, generateNarrativeSections } from "../reportService";

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

describe("generateNarrativeSections", () => {
    it("uses natural single-day phrasing instead of 'between X and X'", () => {
        const audits = [makeAudit({ products: { water: { "500ml": true } } })];
        const data = buildReportData(audits, {});
        const sections = generateNarrativeSections(data, {
            areaLabel: "Pipeline",
            startDate: "2026-07-13",
            endDate: "2026-07-13",
        });
        const summary = sections.find((s) => s.heading === "Executive Summary");
        expect(summary.text).not.toMatch(/between/i);
        expect(summary.text).toMatch(/on July 13, 2026/);
    });

    it("uses a 'between X and Y' range for multi-day periods", () => {
        const audits = [makeAudit({ products: { water: { "500ml": true } } })];
        const data = buildReportData(audits, {});
        const sections = generateNarrativeSections(data, {
            areaLabel: "Pipeline",
            startDate: "2026-07-07",
            endDate: "2026-07-13",
        });
        const summary = sections.find((s) => s.heading === "Executive Summary");
        expect(summary.text).toMatch(/between July 7, 2026 and July 13, 2026/);
    });

    it("omits Distributor Activity entirely when nothing was recorded, rather than stating the gap", () => {
        const audits = [makeAudit({ market: {} })];
        const data = buildReportData(audits, {});
        const sections = generateNarrativeSections(data, { areaLabel: "Pipeline", startDate: "2026-07-13", endDate: "2026-07-13" });
        expect(sections.find((s) => s.heading === "Distributor Activity")).toBeUndefined();
    });

    it("omits Promotional Activity entirely when nothing was recorded either way", () => {
        const audits = [makeAudit({ market: {} })];
        const data = buildReportData(audits, {});
        const sections = generateNarrativeSections(data, { areaLabel: "Pipeline", startDate: "2026-07-13", endDate: "2026-07-13" });
        expect(sections.find((s) => s.heading === "Promotional Activity")).toBeUndefined();
    });

    it("still reports Promotional Activity when at least one real answer was recorded", () => {
        const audits = [makeAudit({ market: { promotion: "No" } })];
        const data = buildReportData(audits, {});
        const sections = generateNarrativeSections(data, { areaLabel: "Pipeline", startDate: "2026-07-13", endDate: "2026-07-13" });
        const promo = sections.find((s) => s.heading === "Promotional Activity");
        expect(promo).toBeDefined();
        expect(promo.text).toMatch(/No promotional activity was observed in 1 outlet/);
    });
});
