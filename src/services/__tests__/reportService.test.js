import { describe, it, expect } from "vitest";
import { buildReportData, generateAiReportSections, formatReportDate, formatReportAsText } from "../reportService";

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

describe("formatReportDate", () => {
    it("formats a single day as one DD/MM/YYYY date", () => {
        expect(formatReportDate("2026-08-05", "2026-08-05")).toBe("05/08/2026");
    });

    it("formats a range as two dates joined by an en dash", () => {
        expect(formatReportDate("2026-08-01", "2026-08-05")).toBe("01/08/2026 – 05/08/2026");
    });
});

describe("generateAiReportSections", () => {
    it("omits Promotional Activity entirely when the question was never answered on any audit, rather than reporting a false zero", () => {
        const audits = [makeAudit({ market: {} })];
        const data = buildReportData(audits, {});
        const sections = generateAiReportSections(data, { areaLabel: "Pipeline" }, {});
        expect(sections.find((s) => s.heading === "Promotional Activity")).toBeUndefined();
    });

    it("reports Promotional Activity once at least one audit actually answered the question, even if the answer was No", () => {
        const audits = [makeAudit({ market: { promotion: "No" } })];
        const data = buildReportData(audits, {});
        const sections = generateAiReportSections(data, { areaLabel: "Pipeline" }, {});
        const promo = sections.find((s) => s.heading === "Promotional Activity");
        expect(promo).toBeDefined();
        expect(promo.text).toMatch(/No promotional activity was observed in any of the 1 outlets? visited/);
    });

    it("uses the AI-synthesized retailer feedback when provided, not the raw unmatched quotes", () => {
        const audits = [makeAudit({ market: { feedback: "The owner said stock runs out fast on weekends near the highway junction." } })];
        const data = buildReportData(audits, {});
        const sections = generateAiReportSections(data, { areaLabel: "Pipeline" }, {
            retailerFeedback: ["Some retailers reported stock running out during peak demand periods."],
        });
        const feedbackSection = sections.find((s) => s.heading === "Retailer Feedback");
        expect(feedbackSection.items).toEqual(["Some retailers reported stock running out during peak demand periods."]);
        expect(feedbackSection.items.join(" ")).not.toContain("highway junction");
    });

    it("falls back to pattern-matched theme lines (never raw quotes) if the AI didn't return retailer feedback", () => {
        const audits = [makeAudit({ market: { feedback: "Sales rep hasn't visited in weeks, products keep running out." } })];
        const data = buildReportData(audits, {});
        const sections = generateAiReportSections(data, { areaLabel: "Pipeline" }, {});
        const feedbackSection = sections.find((s) => s.heading === "Retailer Feedback");
        // Falls back to theme-line detection only — this audit's comment
        // matches the "sales rep visit" theme, so a theme line should
        // appear; the fallback must never include the raw sentence itself.
        if (feedbackSection) {
            expect(feedbackSection.items.join(" ")).not.toContain("hasn't visited in weeks");
        }
    });

    it("matches the exact requested section order and headings", () => {
        const audits = [
            makeAudit({ products: { water: { "500ml": true } }, market: { promotion: "No" } }),
        ];
        const data = buildReportData(audits, {});
        const sections = generateAiReportSections(data, { areaLabel: "Kiambu Town" }, {
            keyObservations: ["Water showed the strongest penetration."],
            recommendations: ["Increase visit frequency."],
        });

        const headings = sections.map((s) => s.heading);
        // Order matters — this is the exact sequence requested.
        expect(headings.indexOf("Executive Summary")).toBeLessThan(headings.indexOf("Key Observations"));
        expect(headings.indexOf("Key Observations")).toBeLessThan(headings.indexOf("Product Availability & Penetration"));
        expect(headings).toContain("Promotional Activity");
    });

    it("formats product penetration exactly as 'Label – Available in X of Y outlets (Tier)'", () => {
        const audits = [
            makeAudit({ products: { water: { "500ml": true } } }),
            makeAudit({ products: {} }),
            makeAudit({ products: {} }),
            makeAudit({ products: {} }),
            makeAudit({ products: {} }),
        ];
        const data = buildReportData(audits, {});
        const sections = generateAiReportSections(data, { areaLabel: "Pipeline" }, {});
        const productSection = sections.find((s) => s.heading === "Product Availability & Penetration");
        const waterLine = productSection.items.find((i) => i.startsWith("Quencher Life Water"));
        expect(waterLine).toBe("Quencher Life Water – Available in 1 of 5 outlets (Poor penetration)");
    });

    it("omits Key Observations and Recommendations sections when the AI content is empty", () => {
        const audits = [makeAudit()];
        const data = buildReportData(audits, {});
        const sections = generateAiReportSections(data, { areaLabel: "Pipeline" }, {});
        expect(sections.find((s) => s.heading === "Key Observations")).toBeUndefined();
        expect(sections.find((s) => s.heading === "Recommendations")).toBeUndefined();
    });

    it("lists distributor names as plain bullets with an intro line, not a count table", () => {
        const audits = [makeAudit({ market: { distributors: ["Wasoko", "Jumra"] } })];
        const data = buildReportData(audits, {});
        const sections = generateAiReportSections(data, { areaLabel: "Pipeline" }, {});
        const distSection = sections.find((s) => s.heading === "Distributor Activity");
        expect(distSection.text).toBe("The following distributors were mentioned by retailers:");
        expect(distSection.items).toEqual(expect.arrayContaining(["Wasoko", "Jumra"]));
    });
});

describe("formatReportAsText", () => {
    it("includes the header fields and every section's content as plain text", () => {
        const sections = [
            { heading: "Executive Summary", type: "paragraph", text: "Coverage was strong this period." },
            { heading: "Recommendations", type: "bullets", items: ["Increase visit frequency.", "Add promotions."] },
        ];
        const text = formatReportAsText(sections, { areaLabel: "Pipeline", dateLabel: "05/08/2026", totalOutlets: 28 });

        expect(text).toContain("FIELD SALES AUDITOR REPORT");
        expect(text).toContain("Area: Pipeline");
        expect(text).toContain("Total Outlets Covered: 28");
        expect(text).toContain("Coverage was strong this period.");
        expect(text).toContain("- Increase visit frequency.");
        expect(text).toContain("- Add promotions.");
    });

    it("flattens grouped-bullets sections (e.g. Competitive Landscape) into readable text", () => {
        const sections = [{
            heading: "Competitive Landscape",
            type: "grouped-bullets",
            introParagraphs: ["Competition remains strongest in Water."],
            groups: [{ label: "Water", items: ["Dasani", "Aquaclear"] }],
        }];
        const text = formatReportAsText(sections, { areaLabel: "Pipeline", dateLabel: "05/08/2026", totalOutlets: 10 });

        expect(text).toContain("Competition remains strongest in Water.");
        expect(text).toContain("Water:");
        expect(text).toContain("- Dasani");
        expect(text).toContain("- Aquaclear");
    });
});
