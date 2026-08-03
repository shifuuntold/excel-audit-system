import { describe, it, expect, vi, beforeEach } from "vitest";
import { captureBaseline, isUpdateAvailable } from "../versionCheck";

describe("versionCheck", () => {
    beforeEach(() => {
        vi.restoreAllMocks();
    });

    it("reports no update available before a baseline has been captured", async () => {
        // Fresh module state isn't achievable across tests without a
        // reset, so this asserts the behavior contract rather than
        // literal first-ever-call state: calling isUpdateAvailable
        // without ever succeeding at captureBaseline should never throw
        // or false-positive.
        global.fetch = vi.fn().mockRejectedValue(new Error("network error"));
        const result = await isUpdateAvailable();
        expect(result).toBe(false);
    });

    it("reports no update when the fetched HTML matches the baseline", async () => {
        global.fetch = vi.fn().mockResolvedValue({ text: () => Promise.resolve("<html>same</html>") });
        await captureBaseline();
        const result = await isUpdateAvailable();
        expect(result).toBe(false);
    });

    it("reports an update when the fetched HTML differs from the baseline", async () => {
        global.fetch = vi
            .fn()
            .mockResolvedValueOnce({ text: () => Promise.resolve("<html>old-build-abc123</html>") })
            .mockResolvedValueOnce({ text: () => Promise.resolve("<html>new-build-xyz789</html>") });

        await captureBaseline();
        const result = await isUpdateAvailable();
        expect(result).toBe(true);
    });

    it("fails safe (no false positive) if the recheck fetch fails", async () => {
        global.fetch = vi
            .fn()
            .mockResolvedValueOnce({ text: () => Promise.resolve("<html>build-1</html>") })
            .mockRejectedValueOnce(new Error("offline"));

        await captureBaseline();
        const result = await isUpdateAvailable();
        expect(result).toBe(false);
    });

    it("uses cache: no-store so it never reads a stale cached response", async () => {
        global.fetch = vi.fn().mockResolvedValue({ text: () => Promise.resolve("<html>x</html>") });
        await captureBaseline();
        expect(global.fetch).toHaveBeenCalledWith("/index.html", { cache: "no-store" });
    });
});
