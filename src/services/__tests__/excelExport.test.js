import { describe, it, expect, vi } from "vitest";
import * as XLSX from "xlsx";
import { exportAuditsToExcel } from "../excelExport";

let capturedWorkbook = null;

vi.mock("xlsx", async (importOriginal) => {
    const actual = await importOriginal();
    return {
        ...actual,
        writeFile: (wb) => {
            capturedWorkbook = wb;
        },
    };
});

describe("exportAuditsToExcel — Location column", () => {
    it("replaces Latitude/Longitude with a single hyperlinked Location column", () => {
        const audits = [
            {
                id: "1",
                created_at: "2026-07-20T10:00:00Z",
                outlet: {
                    shop_name: "Julius Shop",
                    area_id: "a1",
                    latitude: -1.2921,
                    longitude: 36.8219,
                    visit_date: "2026-07-20",
                    person_met: "Julius",
                    position: "Owner",
                    mobile: "0700000000",
                },
                market: { visited: "Yes", promotion: "No", feedback: "", notes: "" },
                products: {},
            },
            {
                id: "2",
                created_at: "2026-07-21T10:00:00Z",
                outlet: {
                    shop_name: "No Location Shop",
                    area_id: "a1",
                    visit_date: "2026-07-21",
                    person_met: "Amos",
                    position: "Manager",
                    mobile: "0700000001",
                },
                market: { visited: "No", promotion: "No", feedback: "", notes: "" },
                products: {},
            },
        ];

        exportAuditsToExcel(audits, {}, "test.xlsx");

        const sheet = capturedWorkbook.Sheets["Raw Audit Data"];
        const [headers] = XLSX.utils.sheet_to_json(sheet, { header: 1 });

        expect(headers).not.toContain("Latitude");
        expect(headers).not.toContain("Longitude");
        expect(headers).toContain("Location");

        const locationCol = XLSX.utils.encode_col(headers.indexOf("Location"));

        const withCoords = sheet[`${locationCol}2`];
        expect(withCoords.v).toBe("View on Map");
        expect(withCoords.l?.Target).toBe("https://www.google.com/maps?q=-1.2921,36.8219");

        const withoutCoords = sheet[`${locationCol}3`];
        expect(withoutCoords.v).toBe("No location recorded");
        expect(withoutCoords.l).toBeUndefined();
    });
});
