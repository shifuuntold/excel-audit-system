import { ALL_PRODUCT_GROUPS, auditHasProductGroup, totalProductsRecorded } from "../utils/productSummary";
import { resolveAreaName } from "./areaService";

function penetrationLabel(pct) {
    if (pct === 0) return "No penetration";
    if (pct < 10) return "Very poor penetration";
    if (pct < 25) return "Poor penetration";
    if (pct < 50) return "Moderate penetration";
    return "Good penetration";
}

function splitEntries(text) {
    if (!text) return [];
    return text
        .split(/,|;|&|\band\b/i)
        .map((s) => s.trim())
        .filter(Boolean);
}

function tally(values) {
    const counts = {};
    for (const v of values) {
        counts[v] = (counts[v] || 0) + 1;
    }
    return Object.entries(counts).sort((a, b) => b[1] - a[1]);
}

/**
 * Crunches a set of audits into every number the narrative report needs.
 */
export function buildReportData(audits, areaMap) {
    const totalOutlets = audits.length;

    const outletsWithNoProducts = audits.filter((a) => totalProductsRecorded(a.products) === 0);

    const areaNames = [...new Set(audits.map((a) => resolveAreaName(a.outlet, areaMap)))];

    const productPenetration = ALL_PRODUCT_GROUPS.map((group) => {
        const count = audits.filter((a) => auditHasProductGroup(a.products, group.key)).length;
        const pct = totalOutlets ? Math.round((count / totalOutlets) * 1000) / 10 : 0;
        return { ...group, count, missing: totalOutlets - count, pct, label2: penetrationLabel(pct) };
    }).sort((a, b) => b.pct - a.pct);

    const competitorMentions = audits.flatMap((a) => splitEntries(a.market?.competitor));
    const competitorTally = tally(competitorMentions);

    const distributorMentions = audits.map((a) => a.market?.distributor).filter(Boolean);
    const distributorTally = tally(distributorMentions);

    const promotionYes = audits.filter((a) => a.market?.promotion === "Yes").length;
    const promotionNo = audits.filter((a) => a.market?.promotion === "No").length;
    const promotionUnspecified = totalOutlets - promotionYes - promotionNo;

    const feedback = audits.map((a) => a.market?.feedback).filter(Boolean);
    const notes = audits.map((a) => a.market?.notes).filter(Boolean);

    return {
        totalOutlets,
        areaNames,
        outletsWithNoProducts,
        productPenetration,
        competitorTally,
        distributorTally,
        promotionYes,
        promotionNo,
        promotionUnspecified,
        feedback,
        notes,
    };
}

/**
 * Turns the crunched numbers into narrative sections — the same structure
 * is rendered on-screen and fed into the Word export, so they always match.
 * Returns: [{ heading, type: 'paragraph'|'bullets', text?, items? }]
 */
export function generateNarrativeSections(data, meta) {
    const { areaLabel, startDate, endDate } = meta;
    const {
        totalOutlets, outletsWithNoProducts, productPenetration,
        competitorTally, distributorTally, promotionYes, promotionNo,
        promotionUnspecified, feedback,
    } = data;

    const sections = [];

    if (totalOutlets === 0) {
        sections.push({
            heading: "Executive Summary",
            type: "paragraph",
            text: `No audits were recorded for ${areaLabel} between ${startDate} and ${endDate}.`,
        });
        return sections;
    }

    const goodProducts = productPenetration.filter((p) => p.pct >= 50).map((p) => p.label);
    const zeroProducts = productPenetration.filter((p) => p.pct === 0).map((p) => p.label);
    const lowProducts = productPenetration.filter((p) => p.pct > 0 && p.pct < 25).map((p) => p.label);

    // Executive Summary
    let summary = `A field audit was conducted across ${totalOutlets} retail outlet${totalOutlets === 1 ? "" : "s"} in ${areaLabel} between ${startDate} and ${endDate} to assess product availability, market penetration, competitive activity, distributor presence and retailer feedback.`;
    if (goodProducts.length > 0) {
        summary += ` The audit revealed good penetration for ${goodProducts.join(" and ")}.`;
    }
    if (zeroProducts.length > 0) {
        summary += ` However, ${zeroProducts.join(" and ")} recorded no penetration and were not found in any outlet.`;
    }
    if (outletsWithNoProducts.length > 0) {
        summary += ` ${outletsWithNoProducts.length} outlet${outletsWithNoProducts.length === 1 ? "" : "s"} visited did not stock any Excel products at all.`;
    }
    sections.push({ heading: "Executive Summary", type: "paragraph", text: summary });

    // Observations
    const observations = [];
    if (outletsWithNoProducts.length > 0) {
        observations.push(`${outletsWithNoProducts.length} outlet${outletsWithNoProducts.length === 1 ? "" : "s"} visited did not stock any Excel products.`);
    }
    if (lowProducts.length > 0) {
        observations.push(`${lowProducts.join(", ")} continue to record low market presence.`);
    }
    if (promotionNo > promotionYes) {
        observations.push(`Promotional activity was observed in only ${promotionYes} of ${totalOutlets} outlets visited.`);
    }
    if (observations.length > 0) {
        sections.push({ heading: "Observations", type: "bullets", items: observations });
    }

    // Product Availability & Penetration
    sections.push({
        heading: "Product Availability & Penetration",
        type: "bullets",
        items: productPenetration.map((p) =>
            `${p.label} – Available in ${p.count} of ${totalOutlets} outlets (${p.label2})`
        ),
    });

    // Competitive Landscape
    sections.push({
        heading: "Competitive Landscape",
        type: competitorTally.length > 0 ? "bullets" : "paragraph",
        items: competitorTally.length > 0
            ? competitorTally.map(([name, count]) => `${name} — mentioned as main competitor in ${count} outlet${count === 1 ? "" : "s"}`)
            : undefined,
        text: competitorTally.length === 0 ? "No competitor information was recorded for this period." : undefined,
    });

    // Distributor Activity
    sections.push({
        heading: "Distributor Activity",
        type: distributorTally.length > 0 ? "bullets" : "paragraph",
        items: distributorTally.length > 0
            ? distributorTally.map(([name, count]) => `${name} — supplying ${count} of ${totalOutlets} outlets visited`)
            : undefined,
        text: distributorTally.length === 0 ? "No distributor information was recorded for this period." : undefined,
    });

    // Promotional Activity
    const promoParts = [];
    if (promotionYes > 0) promoParts.push(`Promotional activity was observed in ${promotionYes} of ${totalOutlets} outlets.`);
    if (promotionNo > 0) promoParts.push(`No promotional activity was observed in ${promotionNo} outlets.`);
    if (promotionUnspecified > 0) promoParts.push(`Promotion status was not recorded for ${promotionUnspecified} outlet${promotionUnspecified === 1 ? "" : "s"}.`);
    sections.push({
        heading: "Promotional Activity",
        type: "paragraph",
        text: promoParts.length > 0
            ? promoParts.join(" ")
            : "No promotional activity data was recorded during this period.",
    });

    // Retailer Feedback Highlights
    if (feedback.length > 0) {
        sections.push({
            heading: "Retailer Feedback Highlights",
            type: "bullets",
            items: feedback.slice(0, 12),
        });
    }

    // Recommendations
    const recommendations = [];
    if (lowProducts.length > 0 || zeroProducts.length > 0) {
        recommendations.push(`Increase distribution of low-penetration products including ${[...zeroProducts, ...lowProducts].join(", ")}.`);
    }
    if (outletsWithNoProducts.length > 0) {
        recommendations.push("Follow up on outlets currently stocking no Excel products to identify and remove barriers to listing.");
    }
    if (promotionNo > promotionYes) {
        recommendations.push("Introduce promotional activities and point-of-sale materials to improve product visibility.");
    }
    recommendations.push("Continue monitoring route execution through regular field audits to ensure balanced market coverage.");
    sections.push({ heading: "Recommendations", type: "bullets", items: recommendations });

    return sections;
}
