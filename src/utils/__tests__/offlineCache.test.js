import { describe, it, expect, beforeEach, vi } from "vitest";
import { readCache, writeCache, withOfflineCache } from "../offlineCache";

// jsdom's localStorage isn't available under the "node" test environment
// this project uses — a tiny in-memory stand-in is enough for these tests.
beforeEach(() => {
    const store = {};
    global.localStorage = {
        getItem: (k) => (k in store ? store[k] : null),
        setItem: (k, v) => { store[k] = v; },
        removeItem: (k) => { delete store[k]; },
    };
});

describe("readCache / writeCache", () => {
    it("round-trips both arrays and objects", () => {
        writeCache("list", [{ id: 1 }, { id: 2 }]);
        expect(readCache("list")).toEqual([{ id: 1 }, { id: 2 }]);

        writeCache("grouped", { water: ["Dasani"], rtd: [] });
        expect(readCache("grouped")).toEqual({ water: ["Dasani"], rtd: [] });
    });

    it("returns the given fallback when nothing is cached yet", () => {
        expect(readCache("missing", "fallback")).toBe("fallback");
    });
});

describe("withOfflineCache", () => {
    it("caches a successful fetch and returns it", async () => {
        const fetchFn = vi.fn().mockResolvedValue([{ id: 1, name: "Twiga" }]);
        const result = await withOfflineCache("distributors", fetchFn);
        expect(result).toEqual([{ id: 1, name: "Twiga" }]);
        expect(readCache("distributors")).toEqual([{ id: 1, name: "Twiga" }]);
    });

    it("falls back to the cache when the fetch fails (array shape)", async () => {
        writeCache("distributors", [{ id: 1, name: "Twiga" }]);
        const fetchFn = vi.fn().mockRejectedValue(new Error("offline"));
        const result = await withOfflineCache("distributors", fetchFn);
        expect(result).toEqual([{ id: 1, name: "Twiga" }]);
    });

    it("falls back to the cache when the fetch fails (object shape — this is the exact bug that shipped: an object cache was treated as empty because of a .length check)", async () => {
        writeCache("competitors_by_category", { water: ["Dasani"], rtd: ["Afia"] });
        const fetchFn = vi.fn().mockRejectedValue(new Error("offline"));
        const result = await withOfflineCache("competitors_by_category", fetchFn, {});
        expect(result).toEqual({ water: ["Dasani"], rtd: ["Afia"] });
    });

    it("rethrows when the fetch fails and there is no cache or fallback", async () => {
        const fetchFn = vi.fn().mockRejectedValue(new Error("offline"));
        await expect(withOfflineCache("nothing-cached", fetchFn)).rejects.toThrow("offline");
    });

    it("uses the provided fallback when there's no cache yet", async () => {
        const fetchFn = vi.fn().mockRejectedValue(new Error("offline"));
        const result = await withOfflineCache("brand-new-key", fetchFn, { defaultCat: ["A"] });
        expect(result).toEqual({ defaultCat: ["A"] });
    });
});
