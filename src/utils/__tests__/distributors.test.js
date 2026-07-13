import { describe, it, expect } from "vitest";
import { flattenDistributors, distributorSummaryText } from "../distributors";

describe("flattenDistributors", () => {
    it("returns the multi-select array when present", () => {
        expect(flattenDistributors({ distributors: ["Twiga", "Jumra"] })).toEqual(["Twiga", "Jumra"]);
    });

    it("falls back to the legacy single-distributor string", () => {
        expect(flattenDistributors({ distributor: "Twiga" })).toEqual(["Twiga"]);
    });

    it("returns an empty array when nothing is set", () => {
        expect(flattenDistributors({})).toEqual([]);
    });
});

describe("distributorSummaryText", () => {
    it("joins multiple distributors with a comma", () => {
        expect(distributorSummaryText({ distributors: ["Twiga", "Jumra"] })).toBe("Twiga, Jumra");
    });

    it("returns a dash when empty", () => {
        expect(distributorSummaryText({})).toBe("-");
    });
});
