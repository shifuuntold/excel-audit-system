import { describe, it, expect, vi, beforeEach } from "vitest";
import { queueAudit, getQueuedAudits, getQueueCount } from "../offlineQueue";

function mockLocalStorage() {
    let store = {};
    return {
        getItem: vi.fn((key) => (key in store ? store[key] : null)),
        setItem: vi.fn((key, value) => { store[key] = value; }),
        removeItem: vi.fn((key) => { delete store[key]; }),
        clear: () => { store = {}; },
    };
}

describe("queueAudit", () => {
    beforeEach(() => {
        global.window = global.window || {};
        global.window.dispatchEvent = vi.fn();
        global.CustomEvent = class CustomEvent {};
        global.localStorage = mockLocalStorage();
    });

    it("returns true and actually stores the audit when localStorage succeeds", () => {
        const result = queueAudit({ outlet: { shop_name: "Test Shop" } });
        expect(result).toBe(true);
        expect(getQueueCount()).toBe(1);
        expect(getQueuedAudits()[0].payload.outlet.shop_name).toBe("Test Shop");
    });

    it("this is the actual bug being fixed: returns false instead of throwing when storage fails, so the caller can tell the truth about it", () => {
        global.localStorage.setItem = vi.fn(() => {
            throw new Error("QuotaExceededError");
        });

        let result;
        expect(() => { result = queueAudit({ outlet: { shop_name: "Test Shop" } }); }).not.toThrow();
        expect(result).toBe(false);
    });

    it("does not dispatch the queue-changed event when the write actually failed", () => {
        global.localStorage.setItem = vi.fn(() => {
            throw new Error("QuotaExceededError");
        });

        queueAudit({ outlet: { shop_name: "Test Shop" } });
        expect(global.window.dispatchEvent).not.toHaveBeenCalled();
    });

    it("falls back to an empty queue instead of throwing if stored JSON is corrupted", () => {
        global.localStorage.getItem = vi.fn(() => "{not valid json");
        expect(() => getQueuedAudits()).not.toThrow();
        expect(getQueuedAudits()).toEqual([]);
    });
});
