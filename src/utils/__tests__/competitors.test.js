import { describe, it, expect } from "vitest";
import { flattenCompetitors, competitorSummaryText } from "../competitors";

describe("flattenCompetitors", () => {
    it("flattens the new categorized structure", () => {
        const market = { competitors: { water: ["Dasani", "Keringet"], rtd: ["Afia"] } };
        const flat = flattenCompetitors(market);
        expect(flat).toHaveLength(3);
        expect(flat).toContainEqual({ category: "water", name: "Dasani" });
    });

    it("falls back to the legacy free-text field for old audits", () => {
        const market = { competitor: "Coca-Cola, Kevian and Del Monte" };
        const flat = flattenCompetitors(market);
        expect(flat.map((c) => c.name)).toEqual(["Coca-Cola", "Kevian", "Del Monte"]);
        expect(flat[0].category).toBeNull();
    });

    it("returns an empty array when there's no competitor data at all", () => {
        expect(flattenCompetitors({})).toEqual([]);
        expect(flattenCompetitors(null)).toEqual([]);
    });

    it("prefers the categorized field over the legacy one if both exist", () => {
        const market = { competitors: { water: ["Dasani"] }, competitor: "Old Value" };
        expect(flattenCompetitors(market)).toEqual([{ category: "water", name: "Dasani" }]);
    });
});

describe("competitorSummaryText", () => {
    it("groups by category label in the summary string", () => {
        const market = { competitors: { water: ["Dasani"], dtd: ["Savannah"] } };
        const text = competitorSummaryText(market);
        expect(text).toContain("Water: Dasani");
        expect(text).toContain("Savannah");
    });

    it("returns a dash when there are no competitors", () => {
        expect(competitorSummaryText({})).toBe("-");
    });
});
