import { Document, Packer, Paragraph, HeadingLevel, TextRun, Table, TableCell, TableRow, WidthType } from "docx";

function reportTable(headers, rows) {
    const makeCell = (text, bold = false) => new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: String(text), bold })] })] });
    return new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: [
            new TableRow({ children: headers.map((header) => makeCell(header, true)) }),
            ...rows.map((row) => new TableRow({ children: row.map((value) => makeCell(value)) })),
        ],
    });
}

/**
 * Renders a narrative report (from reportService.generateNarrativeSections)
 * into a downloadable Word document, mirroring a manually-written audit report.
 */
export async function exportReportToDocx(sections, meta, filename = "field-audit-report.docx", reportData) {
    const { areaLabel, startDate, endDate, generatedAt } = meta;

    const children = [
        new Paragraph({
            text: "Excel Chemicals — Field Sales Auditor Report",
            heading: HeadingLevel.TITLE,
        }),
        new Paragraph({ text: `Area: ${areaLabel}` }),
        new Paragraph({ text: `Period: ${startDate === endDate ? startDate : `${startDate} to ${endDate}`}` }),
        new Paragraph({ text: `Generated: ${generatedAt}` }),
        new Paragraph({ text: "" }),
    ];

    if (reportData) {
        const productOutlets = reportData.totalOutlets - reportData.outletsWithNoProducts.length;
        children.push(new Paragraph({ text: "Key Performance Indicators", heading: HeadingLevel.HEADING_1 }));
        children.push(reportTable(["Metric", "Result"], [
            ["Outlets Audited", reportData.totalOutlets],
            ["Areas Covered", reportData.areaNames.length],
            ["Outlets With Excel Products", `${productOutlets} (${reportData.totalOutlets ? Math.round((productOutlets / reportData.totalOutlets) * 100) : 0}%)`],
            ["Outlets Not Previously Visited", `${reportData.visitedNo} (${reportData.totalOutlets ? Math.round((reportData.visitedNo / reportData.totalOutlets) * 100) : 0}%)`],
            ["Promotional Activity", `${reportData.promotionYes} (${reportData.totalOutlets ? Math.round((reportData.promotionYes / reportData.totalOutlets) * 100) : 0}%)`],
        ]));
        children.push(new Paragraph({ text: "" }));
        children.push(new Paragraph({ text: "Product Availability & Penetration", heading: HeadingLevel.HEADING_1 }));
        children.push(reportTable(["Product", "Outlets", "Penetration", "Rating"], reportData.productPenetration.map((product) => [product.label, product.count, `${product.pct}%`, product.tier])));
        children.push(new Paragraph({ text: "" }));
    }

    for (const section of sections) {
        children.push(
            new Paragraph({ text: section.heading, heading: HeadingLevel.HEADING_1 })
        );

        if (section.type === "paragraph" && section.text) {
            children.push(new Paragraph({ children: [new TextRun(section.text)] }));
        }

        if (section.type === "bullets" && section.items) {
            if (section.text) {
                children.push(new Paragraph({ children: [new TextRun(section.text)] }));
            }
            for (const item of section.items) {
                children.push(new Paragraph({ text: item, bullet: { level: 0 } }));
            }
        }

        if (section.type === "grouped-bullets") {
            for (const p of section.introParagraphs || []) {
                children.push(new Paragraph({ children: [new TextRun(p)] }));
            }
            for (const group of section.groups) {
                children.push(new Paragraph({
                    children: [new TextRun({ text: group.label, bold: true })],
                    spacing: { before: 100 },
                }));
                for (const item of group.items) {
                    children.push(new Paragraph({ text: item, bullet: { level: 0 } }));
                }
            }
            if (section.outro) {
                children.push(new Paragraph({
                    children: [new TextRun(section.outro)],
                    spacing: { before: 100 },
                }));
            }
        }

        if (section.type === "table" && section.rows) {
            children.push(reportTable(section.columns || [], section.rows));
        }

        children.push(new Paragraph({ text: "" }));
    }

    const doc = new Document({
        sections: [{ properties: {}, children }],
    });

    const blob = await Packer.toBlob(doc);
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}
