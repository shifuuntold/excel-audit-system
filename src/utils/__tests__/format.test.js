import { describe, it, expect, beforeAll } from "vitest";
import { localIsoDate, isOnLocalDate } from "../format";

// These tests specifically verify behaviour that differs by timezone, so
// pin the timezone rather than relying on whatever the test runner
// happens to be set to (which would make the "does it match UTC or
// local" distinction untestable in a UTC-based CI environment).
beforeAll(() => {
    process.env.TZ = "Africa/Nairobi"; // UTC+3, no daylight saving
});

describe("localIsoDate", () => {
    it("returns the local calendar date, not the UTC one", () => {
        // 1:00 AM Nairobi time (UTC+3) on the 15th is 22:00 UTC on the
        // 14th — toISOString().split("T")[0] would wrongly report the
        // 14th. localIsoDate must report the 15th, using local date parts.
        const d = new Date("2026-07-14T22:30:00.000Z");
        expect(localIsoDate(d)).toBe("2026-07-15");
    });

    it("pads single-digit months and days", () => {
        const d = new Date("2026-01-05T10:00:00.000Z"); // safely midday UTC, no boundary risk
        expect(localIsoDate(d)).toBe("2026-01-05");
    });
});

describe("isOnLocalDate", () => {
    it("matches a UTC timestamp to the correct local calendar day", () => {
        // Same case as above: 22:30 UTC on the 14th is 01:30 on the 15th
        // in Nairobi — this should count as "the 15th," not "the 14th."
        const utcTimestamp = "2026-07-14T22:30:00.000Z";
        expect(isOnLocalDate(utcTimestamp, "2026-07-15")).toBe(true);
        expect(isOnLocalDate(utcTimestamp, "2026-07-14")).toBe(false);
    });

    it("returns false for a non-matching date", () => {
        expect(isOnLocalDate("2026-07-14T10:00:00.000Z", "2026-07-20")).toBe(false);
    });

    it("returns false for missing input", () => {
        expect(isOnLocalDate(null, "2026-07-14")).toBe(false);
        expect(isOnLocalDate("2026-07-14T10:00:00.000Z", null)).toBe(false);
    });
});
