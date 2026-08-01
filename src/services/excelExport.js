import * as XLSX from "xlsx";
import { buildProductSummary, totalProductsRecorded } from "../utils/productSummary";
import { flattenCompetitors, competitorSummaryText } from "../utils/competitors";
import { flattenDistributors, distributorSummaryText } from "../utils/distributors";
import { resolveAreaName } from "./areaService";
import { buildReportData } from "./reportService";
import { fmtDate } from "../utils/format";
import { COMPETITOR_CATEGORIES } from "../config/productCatalog";

const categoryLabels = Object.fromEntries(COMPETITOR_CATEGORIES.map((category) => [category.key, category.label]));
const pct = (value, total) => (total ? Math.round((value / total) * 1000) / 10 : 0);

function appendTable(workbook, name, rows, widths, hyperlinkColumn) {
    const sheet = XLSX.utils.json_to_sheet(rows);
    sheet["!cols"] = widths.map((wch) => ({ wch }));
    if (rows.length) sheet["!autofilter"] = { ref: XLSX.utils.encode_range({ s: { c: 0, r: 0 }, e: { c: Object.keys(rows[0]).length - 1, r: rows.length } }) };

    // Turns a column's cell text into a real clickable Excel hyperlink
    // (not just a URL sitting there as text) for any row that has one —
    // e.g. Location -> Google Maps. json_to_sheet has no concept of
    // hyperlinks on its own, so this is a post-processing pass using
    // SheetJS's cell.l = { Target } hyperlink format.
    if (hyperlinkColumn) {
        const headers = Object.keys(rows[0] || {});
        const colIndex = headers.indexOf(hyperlinkColumn.column);
        if (colIndex !== -1) {
            rows.forEach((_row, i) => {
                const url = hyperlinkColumn.urls[i];
                if (!url) return;
                const cellRef = XLSX.utils.encode_cell({ r: i + 1, c: colIndex }); // +1 skips the header row
                if (sheet[cellRef]) {
                    sheet[cellRef].l = { Target: url, Tooltip: "Open in Google Maps" };
                }
            });
        }
    }

    XLSX.utils.book_append_sheet(workbook, sheet, name);
}

function skuRows(audits) {
    const grouped = new Map();
    audits.forEach((audit) => buildProductSummary(audit.products).forEach((group) => group.items.forEach((item) => {
        const key = `${group.label}\u0000${item}`;
        if (!grouped.has(key)) grouped.set(key, new Set());
        grouped.get(key).add(audit.id);
    })));
    return [...grouped.entries()].map(([key, ids]) => {
        const [Product, Size] = key.split("\u0000");
        return { Product, "SKU / Size": Size, Outlets: ids.size, Penetration: `${pct(ids.size, audits.length)}%` };
    }).sort((a, b) => b.Outlets - a.Outlets || a.Product.localeCompare(b.Product));
}

/** Creates a layered management report and retains complete detailed audit evidence. */
export function exportAuditsToExcel(audits, areaMap, filename = "audit-report.xlsx") {
    const report = buildReportData(audits, areaMap);
    const areaNames = [...new Set(audits.map((audit) => resolveAreaName(audit.outlet, areaMap)))].filter(Boolean);
    const dates = audits.map((audit) => audit.created_at).filter(Boolean).sort();
    const period = dates.length ? `${new Date(dates[0]).toLocaleDateString()}${dates[0].slice(0, 10) === dates.at(-1).slice(0, 10) ? "" : ` - ${new Date(dates.at(-1)).toLocaleDateString()}`}` : "No audits selected";
    const averageProducts = audits.length ? Math.round((audits.reduce((sum, audit) => sum + totalProductsRecorded(audit.products), 0) / audits.length) * 10) / 10 : 0;
    const workbook = XLSX.utils.book_new();
    const summary = XLSX.utils.aoa_to_sheet([
        ["FIELD SALES AUDIT SUMMARY"], [],
        ["Reporting Period", period], ["Area", areaNames.length <= 3 ? areaNames.join(", ") : `${areaNames.length} areas`], [],
        ["KPI", "Result"], ["Total Audits", report.totalOutlets], ["Areas Covered", areaNames.length],
        ["New / Not Previously Visited Outlets", report.visitedNo], ["Previously Visited Outlets", report.visitedYes],
        ["Promotions Observed", report.promotionYes], ["Promotion Penetration", `${pct(report.promotionYes, report.totalOutlets)}%`],
        ["Outlets With Products", report.totalOutlets - report.outletsWithNoProducts.length], ["Average Products / Outlet", averageProducts],
        ["Outlets With Excel Products", report.totalOutlets - report.outletsWithNoProducts.length],
    ]);
    summary["!cols"] = [{ wch: 36 }, { wch: 45 }];
    summary["!merges"] = [{ s: { c: 0, r: 0 }, e: { c: 1, r: 0 } }];
    XLSX.utils.book_append_sheet(workbook, summary, "Executive Summary");

    appendTable(workbook, "Product Availability", report.productPenetration.map((product) => ({ Product: product.label, "Outlets Stocking": product.count, Penetration: `${product.pct}%`, Status: product.tier })), [30, 18, 14, 28]);
    appendTable(workbook, "SKU Analysis", skuRows(audits), [30, 28, 12, 14]);
    const competitorCounts = new Map();
    audits.flatMap((audit) => flattenCompetitors(audit.market)).forEach(({ category, name }) => {
        const key = `${category || "general"}\u0000${name.trim().toLowerCase()}`;
        const row = competitorCounts.get(key) || { Category: categoryLabels[category] || (category ? category : "General"), Brand: name, Outlets: 0 };
        row.Outlets++;
        competitorCounts.set(key, row);
    });
    appendTable(workbook, "Competitive Landscape", [...competitorCounts.values()].map((row) => ({ ...row, "Share of Audited Outlets": `${pct(row.Outlets, report.totalOutlets)}%` })).sort((a, b) => b.Outlets - a.Outlets), [24, 28, 12, 26]);
    const distributorCounts = new Map();
    audits.flatMap((audit) => flattenDistributors(audit.market)).forEach((distributor) => distributorCounts.set(distributor, (distributorCounts.get(distributor) || 0) + 1));
    appendTable(workbook, "Distributor Analysis", [...distributorCounts.entries()].map(([Distributor, Outlets]) => ({ Distributor, Outlets, "% of Audits": `${pct(Outlets, report.totalOutlets)}%` })).sort((a, b) => b.Outlets - a.Outlets), [32, 14, 16]);
    appendTable(workbook, "Promotional Activity", [
        { Metric: "Promotions observed", Outlets: report.promotionYes, Penetration: `${pct(report.promotionYes, report.totalOutlets)}%` },
        { Metric: "No promotion observed", Outlets: report.promotionNo, Penetration: `${pct(report.promotionNo, report.totalOutlets)}%` },
        { Metric: "Not recorded", Outlets: report.promotionUnspecified, Penetration: `${pct(report.promotionUnspecified, report.totalOutlets)}%` },
    ], [28, 14, 16]);
    appendTable(workbook, "Outlet Coverage", [
        { "Visit Type": "Previously visited by sales rep", Outlets: report.visitedYes, "% of Audits": `${pct(report.visitedYes, report.totalOutlets)}%` },
        { "Visit Type": "Not previously visited by sales rep", Outlets: report.visitedNo, "% of Audits": `${pct(report.visitedNo, report.totalOutlets)}%` },
        { "Visit Type": "Not recorded", Outlets: report.visitedUnspecified, "% of Audits": `${pct(report.visitedUnspecified, report.totalOutlets)}%` },
    ], [38, 14, 16]);

    const locationUrls = [];
    const rawRows = audits.map((audit) => {
        const products = buildProductSummary(audit.products);
        const latitude = audit.outlet?.latitude;
        const longitude = audit.outlet?.longitude;
        const hasLocation = latitude != null && longitude != null;
        locationUrls.push(hasLocation ? `https://www.google.com/maps?q=${latitude},${longitude}` : null);
        return {
            Submitted: fmtDate(audit.created_at), Outlet: audit.outlet?.shop_name || "-", Area: resolveAreaName(audit.outlet, areaMap),
            "Visit Date": audit.outlet?.visit_date || "-", "Person Met": audit.outlet?.person_met || "-", Position: audit.outlet?.position || "-", Mobile: audit.outlet?.mobile || "-",
            "Visited by Sales Rep": audit.market?.visited || "-", Distributor: distributorSummaryText(audit.market), "Promotion Observed": audit.market?.promotion || "-", Competitor: competitorSummaryText(audit.market),
            "Products Recorded": products.reduce((sum, group) => sum + group.count, 0), "Product Detail": products.map((group) => `${group.label}: ${group.items.join(", ")}`).join(" | "),
            Feedback: audit.market?.feedback || "-", Notes: audit.market?.notes || "-",
            Location: hasLocation ? "View on Map" : "No location recorded",
        };
    });
    appendTable(
        workbook, "Raw Audit Data", rawRows,
        Object.keys(rawRows[0] || {}).map((key) => ({ "Product Detail": 60, Competitor: 50, Feedback: 50, Notes: 50, Location: 20 }[key] || 18)),
        { column: "Location", urls: locationUrls }
    );
    const lowProducts = report.productPenetration.filter((product) => product.pct > 0 && product.pct < 25).slice(0, 5).map((product) => product.label).join(", ");
    appendTable(workbook, "Recommendations", [
        { Priority: "High", Issue: `${report.visitedNo} outlets not previously visited`, Action: "Review route coverage and assign follow-up visits to uncovered outlets.", "Responsible Team": "Sales" },
        { Priority: "High", Issue: `Promotion penetration is ${pct(report.promotionYes, report.totalOutlets)}%`, Action: "Deploy targeted promotions and point-of-sale materials in low-activation areas.", "Responsible Team": "Marketing / Sales" },
        { Priority: "High", Issue: `Low product penetration: ${lowProducts || "No low-penetration products recorded"}`, Action: "Create outlet-level distribution and replenishment plans for low-penetration lines.", "Responsible Team": "Sales / Distribution" },
        { Priority: "Medium", Issue: `${report.outletsWithNoProducts.length} outlets with no Excel products`, Action: "Investigate listing barriers and convert viable outlets.", "Responsible Team": "Sales" },
    ], [14, 52, 66, 24]);
    XLSX.writeFile(workbook, filename);
}
