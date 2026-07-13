import { describe, it, expect } from "vitest";
import {
    buildProductSummary,
    totalProductsRecorded,
    auditHasProductGroup,
    findMatchingGroups,
} from "../productSummary";

describe("buildProductSummary", () => {
    it("returns an empty array when no products are recorded", () => {
        expect(buildProductSummary({})).toEqual([]);
        expect(buildProductSummary(null)).toEqual([]);
    });

    it("decodes a matrix product key into a readable flavour + size", () => {
        // dtt keys are "size|flavourKey" — "500ml|O" should read back as "Orange 500ml"
        const products = {
            dtt: { "500ml|O": true, "1L|S": true, "1L|P": false },
        };
        const summary = buildProductSummary(products);
        expect(summary).toHaveLength(1);
        expect(summary[0].label).toBe("Quencher DTT");
        expect(summary[0].count).toBe(2);
        expect(summary[0].items).toEqual(["Orange 500ml", "Strawberry 1L"]);
    });

    it("ignores unchecked (false) entries", () => {
        const products = { water: { "500ml": false, "1L": true } };
        const summary = buildProductSummary(products);
        expect(summary[0].count).toBe(1);
        expect(summary[0].items).toEqual(["1L"]);
    });

    it("sorts groups by count, descending", () => {
        const products = {
            water: { "500ml": true },
            dtt: { "500ml|O": true, "1L|S": true },
        };
        const summary = buildProductSummary(products);
        expect(summary[0].label).toBe("Quencher DTT");
        expect(summary[0].count).toBe(2);
    });
});

describe("totalProductsRecorded", () => {
    it("sums counts across every product group", () => {
        const products = {
            water: { "500ml": true, "1L": true },
            dtt: { "500ml|O": true },
        };
        expect(totalProductsRecorded(products)).toBe(3);
    });

    it("returns 0 for an outlet with nothing recorded", () => {
        expect(totalProductsRecorded({})).toBe(0);
    });
});

describe("auditHasProductGroup", () => {
    it("is true when at least one item in the group is checked", () => {
        expect(auditHasProductGroup({ champ: { "500ml|O": true } }, "champ")).toBe(true);
    });

    it("is false when the group is missing or all unchecked", () => {
        expect(auditHasProductGroup({}, "champ")).toBe(false);
        expect(auditHasProductGroup({ champ: { "500ml|O": false } }, "champ")).toBe(false);
    });
});

describe("findMatchingGroups", () => {
    it("matches product lines by partial, case-insensitive label", () => {
        const results = findMatchingGroups("dtd");
        expect(results.some((g) => g.key === "dtt")).toBe(true);
    });

    it("returns an empty array for an empty query", () => {
        expect(findMatchingGroups("")).toEqual([]);
    });
});
