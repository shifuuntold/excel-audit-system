import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { buildProductSummary } from "../utils/productSummary";
import { competitorSummaryText } from "../utils/competitors";
import { distributorSummaryText } from "../utils/distributors";
import { resolveAreaName } from "./areaService";
import { fmtDate } from "../utils/format";

/**
 * Exports a single audit as a detailed PDF report.
 */
export function exportAuditToPDF(audit, areaMap, filename) {
    const doc = new jsPDF();
    const areaName = resolveAreaName(audit.outlet, areaMap);
    const summary = buildProductSummary(audit.products);

    const lat = audit.outlet?.latitude;
    const lng = audit.outlet?.longitude;
    const mapsUrl = (lat && lng) ? `https://www.google.com/maps/search/?api=1&query=${lat},${lng}` : null;

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
            ["GPS", mapsUrl ? "Open Outlet Location" : "No GPS recorded"],
        ],
        theme: "grid",
        headStyles: { fillColor: [0, 48, 135] },
        styles: { fontSize: 9, cellPadding: 5 },
        didParseCell: (data) => {
            if (data.section === "body" && data.column.index === 1 && data.row.raw[0] === "GPS" && mapsUrl) {
                data.cell.styles.textColor = [26, 79, 160];
                data.cell.styles.fontStyle = "bold";
            }
        },
        didDrawCell: (data) => {
            if (data.section === "body" && data.column.index === 1 && data.row.raw[0] === "GPS" && mapsUrl) {
                doc.link(data.cell.x, data.cell.y, data.cell.width, data.cell.height, { url: mapsUrl });
            }
        },
    });

    autoTable(doc, {
        startY: doc.lastAutoTable.finalY + 8,
        head: [["Market Information", ""]],
        body: [
            ["Distributor", distributorSummaryText(audit.market)],
            ["Promotion Observed", audit.market?.promotion || "-"],
            ["Competitor", competitorSummaryText(audit.market)],
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

    const mapsUrls = audits.map((a) => {
        const lat = a.outlet?.latitude;
        const lng = a.outlet?.longitude;
        return (lat && lng) ? `https://www.google.com/maps/search/?api=1&query=${lat},${lng}` : null;
    });

    doc.setFontSize(16);
    doc.setTextColor(0, 48, 135);
    doc.text("Excel Chemicals — Audit Summary Report", 14, 18);

    doc.setFontSize(10);
    doc.setTextColor(80, 80, 80);
    doc.text(`Generated: ${fmtDate(new Date().toISOString())} · ${audits.length} audits`, 14, 25);

    doc.setFontSize(8);
    doc.setTextColor(130, 130, 130);
    doc.text("Tip: tap \"Open Outlet Location\" in a PDF viewer to open that outlet's GPS pin in Google Maps.", 14, 30);

    autoTable(doc, {
        startY: 35,
        head: [["Submitted", "Outlet", "Area", "Person Met", "Outlet Location"]],
        body: audits.map((a, i) => [
            fmtDate(a.created_at),
            a.outlet?.shop_name || "-",
            resolveAreaName(a.outlet, areaMap),
            a.outlet?.person_met || "-",
            mapsUrls[i] ? "Open Outlet Location" : "No GPS recorded",
        ]),
        theme: "striped",
        headStyles: { fillColor: [0, 48, 135], fontSize: 9 },
        styles: { fontSize: 9, cellPadding: 5, valign: "middle", overflow: "linebreak" },
        columnStyles: {
            0: { cellWidth: 32 },
            1: { cellWidth: 46 },
            2: { cellWidth: 34 },
            3: { cellWidth: 34 },
            4: { cellWidth: 36 },
        },
        didParseCell: (data) => {
            if (data.section === "body" && data.column.index === 4) {
                if (mapsUrls[data.row.index]) {
                    data.cell.styles.textColor = [26, 79, 160];
                    data.cell.styles.fontStyle = "bold";
                } else {
                    data.cell.styles.textColor = [160, 160, 160];
                    data.cell.styles.fontStyle = "italic";
                }
            }
        },
        didDrawCell: (data) => {
            if (data.section === "body" && data.column.index === 4) {
                const url = mapsUrls[data.row.index];
                if (url) {
                    doc.link(data.cell.x, data.cell.y, data.cell.width, data.cell.height, { url });
                }
            }
        },
    });

    doc.save(filename);
}
