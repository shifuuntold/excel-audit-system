import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import { buildProductSummary } from "../utils/productSummary";
import { resolveAreaName } from "./areaService";

function fmtDate(iso) {
    if (!iso) return "-";
    return new Date(iso).toLocaleString([], {
        year: "numeric", month: "short", day: "numeric",
        hour: "2-digit", minute: "2-digit",
    });
}

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
            "Distributor": a.market?.distributor || "-",
            "Competitor": a.market?.competitor || "-",
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

/**
 * Exports a single audit as a detailed PDF report.
 */
export function exportAuditToPDF(audit, areaMap, filename) {
    const doc = new jsPDF();
    const areaName = resolveAreaName(audit.outlet, areaMap);
    const summary = buildProductSummary(audit.products);

    doc.setFontSize(16);
    doc.setTextColor(0, 48, 135);
    doc.text("Excel Chemicals — Field Sales Audit Report", 14, 18);

    doc.setFontSize(10);
    doc.setTextColor(80, 80, 80);
    doc.text(`Submitted: ${fmtDate(audit.created_at)}`, 14, 25);

    autoTable(doc, {
        startY: 32,
        head: [["Outlet Information", ""]],
        body: [
            ["Shop Name", audit.outlet?.shop_name || "-"],
            ["Area", areaName],
            ["Visit Date", audit.outlet?.visit_date || "-"],
            ["Person Met", audit.outlet?.person_met || "-"],
            ["Position", audit.outlet?.position || "-"],
            ["Mobile", audit.outlet?.mobile || "-"],
            ["GPS", audit.outlet?.latitude ? `${audit.outlet.latitude}, ${audit.outlet.longitude}` : "-"],
        ],
        theme: "grid",
        headStyles: { fillColor: [0, 48, 135] },
        styles: { fontSize: 9 },
    });

    autoTable(doc, {
        startY: doc.lastAutoTable.finalY + 8,
        head: [["Market Information", ""]],
        body: [
            ["Distributor", audit.market?.distributor || "-"],
            ["Competitor", audit.market?.competitor || "-"],
            ["Feedback", audit.market?.feedback || "-"],
            ["Notes", audit.market?.notes || "-"],
        ],
        theme: "grid",
        headStyles: { fillColor: [0, 48, 135] },
        styles: { fontSize: 9 },
    });

    autoTable(doc, {
        startY: doc.lastAutoTable.finalY + 8,
        head: [["Product Line", "Count", "Items"]],
        body: summary.length
            ? summary.map((g) => [g.label, String(g.count), g.items.join(", ")])
            : [["No products recorded", "", ""]],
        theme: "grid",
        headStyles: { fillColor: [0, 48, 135] },
        styles: { fontSize: 8, cellWidth: "wrap" },
        columnStyles: { 2: { cellWidth: 100 } },
    });

    doc.save(filename || `audit-${audit.outlet?.shop_name || audit.id}.pdf`.replace(/\s+/g, "-"));
}

/**
 * Exports a filtered list of audits as a compact multi-audit PDF summary.
 */
export function exportAuditsToPDF(audits, areaMap, filename = "audit-summary.pdf") {
    const doc = new jsPDF();

    doc.setFontSize(16);
    doc.setTextColor(0, 48, 135);
    doc.text("Excel Chemicals — Audit Summary Report", 14, 18);

    doc.setFontSize(10);
    doc.setTextColor(80, 80, 80);
    doc.text(`Generated: ${fmtDate(new Date().toISOString())} · ${audits.length} audits`, 14, 25);

    autoTable(doc, {
        startY: 32,
        head: [["Submitted", "Outlet", "Area", "Person Met", "Products"]],
        body: audits.map((a) => [
            fmtDate(a.created_at),
            a.outlet?.shop_name || "-",
            resolveAreaName(a.outlet, areaMap),
            a.outlet?.person_met || "-",
            String(buildProductSummary(a.products).reduce((s, g) => s + g.count, 0)),
        ]),
        theme: "striped",
        headStyles: { fillColor: [0, 48, 135] },
        styles: { fontSize: 8 },
    });

    doc.save(filename);
}
