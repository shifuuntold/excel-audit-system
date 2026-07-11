import { Document, Packer, Paragraph, HeadingLevel, TextRun } from "docx";

/**
 * Renders a narrative report (from reportService.generateNarrativeSections)
 * into a downloadable Word document, mirroring a manually-written audit report.
 */
export async function exportReportToDocx(sections, meta, filename = "field-audit-report.docx") {
    const { areaLabel, startDate, endDate, generatedAt } = meta;

    const children = [
        new Paragraph({
            text: "Excel Chemicals — Field Sales Auditor Report",
            heading: HeadingLevel.TITLE,
        }),
        new Paragraph({ text: `Area: ${areaLabel}` }),
        new Paragraph({ text: `Period: ${startDate} to ${endDate}` }),
        new Paragraph({ text: `Generated: ${generatedAt}` }),
        new Paragraph({ text: "" }),
    ];

    for (const section of sections) {
        children.push(
            new Paragraph({ text: section.heading, heading: HeadingLevel.HEADING_1 })
        );

        if (section.type === "paragraph" && section.text) {
            children.push(new Paragraph({ children: [new TextRun(section.text)] }));
        }

        if (section.type === "bullets" && section.items) {
            for (const item of section.items) {
                children.push(new Paragraph({ text: item, bullet: { level: 0 } }));
            }
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
