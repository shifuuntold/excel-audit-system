import * as XLSX from "xlsx";
import { buildProductSummary } from "../utils/productSummary";
import { competitorSummaryText } from "../utils/competitors";
import { distributorSummaryText } from "../utils/distributors";
import { resolveAreaName } from "./areaService";
import { fmtDate } from "../utils/format";

/**
 * Exports a filtered list of audits to an Excel workbook — one row per
 * audit, with a flattened, human-readable product list column.
 */
export function exportAuditsToExcel(audits, areaMap, filename = "audit-export.xlsx") {
    const rows = audits.map((a) => {
        const summary = buildProductSummary(a.products);
        return {
            "Submitted": fmtDate(a.created_at),
            "Outlet": a.outlet?.shop_name || "-",
            "Area": resolveAreaName(a.outlet, areaMap),
            "Visit Date": a.outlet?.visit_date || "-",
            "Person Met": a.outlet?.person_met || "-",
            "Position": a.outlet?.position || "-",
            "Mobile": a.outlet?.mobile || "-",
            "Distributor": distributorSummaryText(a.market),
            "Promotion Observed": a.market?.promotion || "-",
            "Competitor": competitorSummaryText(a.market),
            "Products Recorded": summary.reduce((s, g) => s + g.count, 0),
            "Product Detail": summary.map((g) => `${g.label}: ${g.items.join(", ")}`).join(" | "),
            "Feedback": a.market?.feedback || "-",
            "Notes": a.market?.notes || "-",
            "Latitude": a.outlet?.latitude ?? "-",
            "Longitude": a.outlet?.longitude ?? "-",
        };
    });

    const worksheet = XLSX.utils.json_to_sheet(rows);
    worksheet["!cols"] = Object.keys(rows[0] || {}).map((key) => ({
        wch: key === "Product Detail" ? 60 : 18,
    }));

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Audits");
    XLSX.writeFile(workbook, filename);
}
