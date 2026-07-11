import { ALL_PRODUCT_GROUPS, auditHasProductGroup, totalProductsRecorded } from "../utils/productSummary";
import { resolveAreaName } from "./areaService";
import { flattenCompetitors } from "../utils/competitors";
import { flattenDistributors } from "../utils/distributors";
import { COMPETITOR_CATEGORIES } from "../config/productCatalog";

const COMPETITOR_CATEGORY_LABELS = Object.fromEntries(COMPETITOR_CATEGORIES.map((c) => [c.key, c.label]));

// 6-tier penetration scale
function penetrationLabel(pct) {
    if (pct === 0) return "No penetration";
    if (pct < 10) return "Very poor penetration";
    if (pct < 25) return "Poor penetration";
    if (pct < 50) return "Moderate penetration";
    if (pct < 80) return "Good penetration";
    return "Excellent penetration";
}

function normalizeName(name) {
    return name
        .trim()
        .replace(/\s+/g, " ")
        .toLowerCase();
}

function toTitleCase(name) {
    return name.replace(/\b\w/g, (c) => c.toUpperCase());
}

function tally(values) {
    const counts = {};
    const displayNames = {};

    for (const raw of values) {
        const key = normalizeName(raw);
        if (!key) continue;
        counts[key] = (counts[key] || 0) + 1;
        // keep the first-seen casing as the display form, title-cased for consistency
        if (!displayNames[key]) displayNames[key] = toTitleCase(key);
    }

    return Object.entries(counts)
        .map(([key, count]) => [displayNames[key], count])
        .sort((a, b) => b[1] - a[1]);
}

function countWord(n) {
    if (n === 1) return "One";
    if (n <= 3) return "A few";
    if (n <= 6) return "Some";
    return "Several";
}

// Scans free text for mentions of known Excel product lines, so themed
// feedback (stock-outs, packaging issues) can name the specific product.
function detectProductMentions(text) {
    const lower = text.toLowerCase();
    return ALL_PRODUCT_GROUPS
        .filter((g) => lower.includes(g.label.toLowerCase()))
        .map((g) => g.label);
}

const FEEDBACK_THEMES = [
    {
        id: "not_visited",
        test: (t) => /\b(not\s+(been\s+)?visit|no\s+visit|never\s+(been\s+)?visit|haven'?t\s+.{0,15}visit)/i.test(t),
        phrase: (n) => `${countWord(n)} retailer${n === 1 ? "" : "s"} reported not being visited.`,
    },
    {
        id: "unsure_visited",
        test: (t) => /(not\s+sure|unsure|don'?t\s+know|uncertain).{0,30}visit/i.test(t),
        phrase: (n) => `${countWord(n)} retailer${n === 1 ? "" : "s"} ${n === 1 ? "was" : "were"} unsure whether sales representatives visited their outlet${n === 1 ? "" : "s"}.`,
    },
    {
        id: "order_not_delivered",
        test: (t) => /order/i.test(t) && /(not|never|n't|awaiting|pending)\s*.{0,10}deliver/i.test(t),
        phrase: (n) => `${countWord(n)} order${n === 1 ? " was" : "s were"} placed but not delivered.`,
    },
    {
        id: "packaging_issue",
        test: (t) => /packag|damaged|leak|torn|defect|broken\s+seal/i.test(t),
        phrase: (n, products) => {
            const productText = products.length ? ` with ${products.join(", ")}` : "";
            return n === 1
                ? `One retailer reported a packaging issue${productText}.`
                : `${countWord(n)} retailers reported packaging issues${productText}.`;
        },
    },
    {
        id: "stock_depleted",
        test: (t) => /(stock|stocks)\b.{0,15}(depleted|finished|sold out|run out|ran out)|out\s+of\s+stock|restock|reorder/i.test(t),
        phrase: (n, products) => {
            const productText = products.length ? `${products.join(" and ")} ` : "";
            return `${countWord(n)} outlet${n === 1 ? "" : "s"} had depleted ${productText}stock${n === 1 ? "" : "s"} and wished to reorder.`;
        },
    },
    {
        id: "positive",
        test: (t) => /\b(happy|satisfied|great|excellent|good\s+service|impressed|pleased)\b/i.test(t),
        phrase: (n) => `${countWord(n)} retailer${n === 1 ? "" : "s"} expressed satisfaction with Excel products or service.`,
    },
];

/**
 * Groups raw feedback comments into narrative themes instead of listing
 * every comment individually. Anything that doesn't match a known theme
 * is kept verbatim under "Other Feedback" so nothing gets silently dropped.
 */
function groupFeedbackThemes(feedbackList) {
    const matchedIndexes = new Set();
    const themeLines = [];

    for (const theme of FEEDBACK_THEMES) {
        const matches = [];
        feedbackList.forEach((text, i) => {
            if (theme.test(text)) {
                matches.push(text);
                matchedIndexes.add(i);
            }
        });

        if (matches.length > 0) {
            const products = [...new Set(matches.flatMap(detectProductMentions))];
            themeLines.push(theme.phrase(matches.length, products));
        }
    }

    const unmatched = feedbackList.filter((_, i) => !matchedIndexes.has(i));

    return { themeLines, unmatched };
}

/**
 * Public helper: summarizes retailer feedback across a set of audits into
 * theme lines, for use anywhere (History page, dashboards) without needing
 * the full report pipeline.
 */
export function summarizeFeedback(audits) {
    const feedback = audits.map((a) => a.market?.feedback).filter(Boolean);
    if (feedback.length === 0) return { themeLines: [], unmatched: [], total: 0 };
    return { ...groupFeedbackThemes(feedback), total: feedback.length };
}

/**
 * Crunches a set of audits into every number the narrative report needs.
 */
export function buildReportData(audits, areaMap) {
    const totalOutlets = audits.length;

    const outletsWithNoProducts = audits.filter((a) => totalProductsRecorded(a.products) === 0);
    const noProductPct = totalOutlets ? Math.round((outletsWithNoProducts.length / totalOutlets) * 100) : 0;

    const areaNames = [...new Set(audits.map((a) => resolveAreaName(a.outlet, areaMap)))];

    const productPenetration = ALL_PRODUCT_GROUPS.map((group) => {
        const count = audits.filter((a) => auditHasProductGroup(a.products, group.key)).length;
        const pct = totalOutlets ? Math.round((count / totalOutlets) * 1000) / 10 : 0;
        return { ...group, count, missing: totalOutlets - count, pct, tier: penetrationLabel(pct) };
    }).sort((a, b) => b.pct - a.pct);

    const competitorMentions = audits.flatMap((a) => flattenCompetitors(a.market));
    const competitorsByCategory = {};
    for (const { category, name } of competitorMentions) {
        const key = category || "general";
        if (!competitorsByCategory[key]) competitorsByCategory[key] = [];
        competitorsByCategory[key].push(name);
    }
    const competitorTallyByCategory = Object.entries(competitorsByCategory)
        .map(([key, names]) => [key, tally(names)])
        .sort((a, b) => a[0].localeCompare(b[0]));
    // flat overall tally too, kept for anything that wants a single ranked list
    const competitorTally = tally(competitorMentions.map((c) => c.name));

    const distributorMentions = audits.flatMap((a) => flattenDistributors(a.market));
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
        noProductPct,
        productPenetration,
        competitorTally,
        competitorTallyByCategory,
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
        totalOutlets, outletsWithNoProducts, noProductPct, productPenetration,
        competitorTallyByCategory, distributorTally, promotionYes, promotionNo,
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

    const excellentOrGood = productPenetration.filter((p) => p.pct >= 50).map((p) => p.label);
    const zeroProducts = productPenetration.filter((p) => p.pct === 0).map((p) => p.label);
    const lowProducts = productPenetration.filter((p) => p.pct > 0 && p.pct < 25).map((p) => p.label);

    // Executive Summary
    let summary = `A field audit was conducted across ${totalOutlets} retail outlet${totalOutlets === 1 ? "" : "s"} in ${areaLabel} between ${startDate} and ${endDate} to assess product availability, market penetration, competitive activity, distributor presence and retailer feedback.`;
    if (excellentOrGood.length > 0) {
        summary += ` The audit revealed strong penetration for ${excellentOrGood.join(" and ")}.`;
    }
    if (zeroProducts.length > 0) {
        summary += ` However, ${zeroProducts.join(" and ")} recorded no penetration and were not found in any outlet.`;
    }

    // Outlets with no Excel products at all: frame as positive when the
    // share is low, as a concern only when it's a meaningful share.
    if (outletsWithNoProducts.length === 0) {
        summary += " Every outlet visited stocked at least one Excel product, a positive indicator of overall market presence.";
    } else if (noProductPct <= 15) {
        summary += ` Only ${outletsWithNoProducts.length} outlet${outletsWithNoProducts.length === 1 ? "" : "s"} (${noProductPct}%) did not stock any Excel products, a positive indicator of overall market presence.`;
    } else {
        summary += ` ${outletsWithNoProducts.length} outlets (${noProductPct}%) visited did not stock any Excel products at all, suggesting missed distribution opportunities.`;
    }
    sections.push({ heading: "Executive Summary", type: "paragraph", text: summary });

    // Observations
    const observations = [];
    if (outletsWithNoProducts.length > 0 && noProductPct > 15) {
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
            `${p.label} – Available in ${p.count} of ${totalOutlets} outlets (${p.tier})`
        ),
    });

    // Competitive Landscape — broken down by product category, matching
    // how a manually-written field report groups competitors (Water
    // competitors vs RTD competitors, etc.)
    sections.push({
        heading: "Competitive Landscape",
        type: competitorTallyByCategory.length > 0 ? "bullets" : "paragraph",
        items: competitorTallyByCategory.length > 0
            ? competitorTallyByCategory.map(([catKey, names]) => {
                const label = COMPETITOR_CATEGORY_LABELS[catKey] || "General";
                const brands = names.map(([name, count]) => `${name} (${count})`).join(", ");
                return `${label} competitors: ${brands}`;
            })
            : undefined,
        text: competitorTallyByCategory.length === 0 ? "No competitor information was recorded for this period." : undefined,
    });

    // Distributor Activity
    sections.push({
        heading: "Distributor Activity",
        type: distributorTally.length > 0 ? "bullets" : "paragraph",
        items: distributorTally.length > 0
            ? distributorTally.map(([name, count]) => `${name} — supplying ${count} of ${totalOutlets} outlets visited`)
            : undefined,
        text: distributorTally.length === 0
            ? "No distributor feedback was captured during this audit. Future audits should include distributor information to better understand product supply channels."
            : undefined,
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

    // Retailer Feedback — grouped into themes, not listed individually
    if (feedback.length > 0) {
        const { themeLines, unmatched } = groupFeedbackThemes(feedback);
        const items = [...themeLines];

        if (unmatched.length > 0) {
            if (unmatched.length <= 5) {
                items.push(...unmatched);
            } else {
                items.push(`${unmatched.length} additional retailer comments were recorded that did not fit a common theme.`);
            }
        }

        if (items.length > 0) {
            sections.push({ heading: "Retailer Feedback", type: "bullets", items });
        }
    }

    // Recommendations
    const recommendations = [];
    if (lowProducts.length > 0 || zeroProducts.length > 0) {
        recommendations.push(`Increase distribution of low-penetration products including ${[...zeroProducts, ...lowProducts].join(", ")}.`);
    }
    if (outletsWithNoProducts.length > 0 && noProductPct > 15) {
        recommendations.push("Follow up on outlets currently stocking no Excel products to identify and remove barriers to listing.");
    }
    if (promotionNo > promotionYes) {
        recommendations.push("Introduce promotional activities and point-of-sale materials to improve product visibility.");
    }
    if (distributorTally.length === 0) {
        recommendations.push("Capture distributor information consistently in future audits to better understand supply channels.");
    }
    recommendations.push("Continue monitoring route execution through regular field audits to ensure balanced market coverage.");
    sections.push({ heading: "Recommendations", type: "bullets", items: recommendations });

    return sections;
}
