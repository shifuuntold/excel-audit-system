import { describe, it, expect } from "vitest";
import { findPossibleDuplicates, isGenericOutletName, newOutletId, normalizeOutletName, suggestOutlets } from "../outlets";

const outlets = [
    { id: "1", name: "Kim's Shop", area_id: "a1", area_name: "Kangemi", latitude: -1.265, longitude: 36.75, is_active: true },
    { id: "2", name: "Kim's Shop", area_id: "a2", area_name: "Kibera", latitude: -1.31, longitude: 36.78, is_active: true },
    { id: "3", name: "Kimani Stores", area_id: "a1", area_name: "Kangemi", latitude: null, longitude: null, is_active: true },
    { id: "4", name: "Old Kim Kiosk", area_id: "a1", area_name: "Kangemi", latitude: null, longitude: null, is_active: false },
];

describe("outlet names", () => {
    it("normalises case and whitespace", () => expect(normalizeOutletName("  Kim's   SHOP ")).toBe("kim's shop"));
    it("recognises generic placeholder names", () => {
        for (const n of ["Shop", " DUKA ", "kiosk", "N/A", ""]) expect(isGenericOutletName(n)).toBe(true);
        expect(isGenericOutletName("Kim's Shop")).toBe(false);
    });
    it("generates distinct ids", () => expect(newOutletId()).not.toBe(newOutletId()));
});

describe("suggestOutlets", () => {
    it("needs at least two characters", () => expect(suggestOutlets(outlets, { text: "k" })).toEqual([]));
    it("matches by name, ignores inactive outlets, and prefers the chosen area", () => {
        const r = suggestOutlets(outlets, { text: "kim", areaName: "Kibera" });
        expect(r.map((o) => o.id)).toEqual(["2", "1", "3"]);
    });
    it("puts an exact name match first", () => {
        expect(suggestOutlets(outlets, { text: "kimani stores" })[0].id).toBe("3");
    });
    it("never invents a match", () => expect(suggestOutlets(outlets, { text: "zzz" })).toEqual([]));
});

describe("findPossibleDuplicates", () => {
    it("flags the same name in the same area", () => {
        expect(findPossibleDuplicates(outlets, { name: "kim's shop", areaName: "Kangemi" }).map((o) => o.id)).toEqual(["1"]);
    });
    it("flags the same name close to the captured location even if the area differs", () => {
        expect(findPossibleDuplicates(outlets, { name: "Kim's Shop", areaName: "Elsewhere", latitude: -1.3101, longitude: 36.78 }).map((o) => o.id)).toEqual(["2"]);
    });
    it("does not flag a different shop with the same name far away in another area", () => {
        expect(findPossibleDuplicates(outlets, { name: "Kim's Shop", areaName: "Elsewhere", latitude: 0, longitude: 0 })).toEqual([]);
    });
});
