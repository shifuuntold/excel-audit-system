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
        id: "quality_issue",
        test: (t) => /\b(expired|expiry|spoilt|spoiled|bad\s+taste|off\s+taste|quality\s+(issue|concern|complaint))\b/i.test(t),
        phrase: (n, products) => {
            const productText = products.length ? ` with ${products.join(", ")}` : "";
            return `${countWord(n)} retailer${n === 1 ? "" : "s"} raised product quality or expiry concerns${productText}.`;
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
        id: "irregular_supply",
        test: (t) => /\b(irregular|inconsistent|unreliable)\s+(supply|deliver|stock)|supply\s+(is\s+)?(irregular|inconsistent|unreliable)/i.test(t),
        phrase: (n) => `${countWord(n)} retailer${n === 1 ? "" : "s"} described supply as irregular or unreliable.`,
    },
    {
        id: "pricing_concern",
        test: (t) => /\b(expensive|costly|pricey|too\s+high\s+a?\s*price|price\s+(is\s+)?(too\s+)?high|reduce\s+the\s+price)\b/i.test(t),
        phrase: (n, products) => {
            const productText = products.length ? ` for ${products.join(", ")}` : "";
            return `${countWord(n)} retailer${n === 1 ? "" : "s"} raised pricing concerns${productText}.`;
        },
    },
    {
        id: "wants_variety",
        test: (t) => /\b(more\s+(flavou?rs?|variety|options|sizes)|different\s+flavou?rs?|wider\s+range)\b/i.test(t),
        phrase: (n) => `${countWord(n)} retailer${n === 1 ? "" : "s"} requested more flavour or size variety.`,
    },
    {
        id: "credit_terms",
        test: (t) => /\b(credit\s+terms?|on\s+credit|payment\s+terms?|cash\s+only)\b/i.test(t),
        phrase: (n) => `${countWord(n)} retailer${n === 1 ? "" : "s"} raised credit or payment terms.`,
    },
    {
        id: "wants_rep_contact",
        test: (t) => /\b(need\s+a\s+rep|want\s+a\s+rep|rep\s+to\s+call|contact\s+(number|details)|assign\s+.{0,10}rep)\b/i.test(t),
        phrase: (n) => `${countWord(n)} retailer${n === 1 ? "" : "s"} asked for direct sales rep contact or a dedicated rep.`,
    },
    {
        id: "selling_well",
        test: (t) => /\b(sells?\s+well|fast[- ]moving|popular\s+with\s+customers|customers?\s+(love|like|prefer)\s+(it|this|the))\b/i.test(t),
        phrase: (n, products) => {
            const productText = products.length ? ` (${products.join(", ")})` : "";
            return `${countWord(n)} retailer${n === 1 ? "" : "s"} reported strong customer demand${productText}.`;
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

    const visitedYes = audits.filter((a) => a.market?.visited === "Yes").length;
    const visitedNo = audits.filter((a) => a.market?.visited === "No").length;
    const visitedUnspecified = totalOutlets - visitedYes - visitedNo;

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
        visitedYes,
        visitedNo,
        visitedUnspecified,
        feedback,
        notes,
    };
}

function formatReportDate(startDate, endDate) {
    const fmt = (d) => {
        const date = new Date(d + "T00:00:00");
        return `${String(date.getDate()).padStart(2, "0")}/${String(date.getMonth() + 1).padStart(2, "0")}/${date.getFullYear()}`;
    };
    if (!startDate || !endDate) return "-";
    if (startDate === endDate) return fmt(startDate);
    return `${fmt(startDate)} – ${fmt(endDate)}`;
}

/**
 * The "FIELD SALES AUDITOR REPORT" format — Area/Date/Total Outlets
 * header, then Executive Summary through Recommendations in a fixed
 * order matching a specific requested layout. Every section here is
 * deterministic (reuses the exact same buildReportData() numbers the
 * Quick Report is built from — same product penetration tiers, same
 * competitor-by-category grouping, same feedback theme detection) EXCEPT
 * keyObservations and recommendations, which are passed in already
 * generated (by Gemini, in the edge function) since those two genuinely
 * benefit from judgment/prioritization rather than a fixed rule — this
 * function only assembles them into the right place, it doesn't invent
 * them if they're missing.
 */
export function generateAiReportSections(data, meta, aiContent = {}) {
    const { areaLabel } = meta;
    const { keyObservations = [], retailerFeedback = [], recommendations = [] } = aiContent;
    const {
        totalOutlets, productPenetration, competitorTallyByCategory,
        distributorTally, promotionYes, promotionNo, feedback,
    } = data;

    const sections = [];

    let summary = `A field audit was conducted across ${totalOutlets} retail outlet${totalOutlets === 1 ? "" : "s"} in ${areaLabel} to assess product availability, market penetration, competitive activity, distributor presence and retailer feedback.`;

    const excellentOrGood = productPenetration.filter((p) => p.pct >= 50).map((p) => p.label);
    const moderate = productPenetration.filter((p) => p.pct >= 25 && p.pct < 50).map((p) => p.label);
    const zeroProducts = productPenetration.filter((p) => p.pct === 0).map((p) => p.label);
    const lowProducts = productPenetration.filter((p) => p.pct > 0 && p.pct < 25).map((p) => p.label);

    if (excellentOrGood.length > 0) {
        summary += ` The audit revealed excellent penetration for ${excellentOrGood.join(" and ")}.`;
    }
    if (moderate.length > 0) {
        summary += ` ${moderate.join(" and ")} recorded moderate penetration, while most of the remaining portfolio maintained low market presence.`;
    }
    if (zeroProducts.length > 0) {
        summary += ` ${zeroProducts.join(" and ")} ${zeroProducts.length === 1 ? "was" : "were"} not found in any outlet visited`;
        summary += lowProducts.length > 0 ? `, while ${lowProducts.join(" and ")} recorded minimal presence.` : ".";
    } else if (lowProducts.length > 0) {
        summary += ` ${lowProducts.join(" and ")} recorded minimal presence.`;
    }
    sections.push({ heading: "Executive Summary", type: "paragraph", text: summary });

    if (keyObservations.length > 0) {
        sections.push({ heading: "Key Observations", type: "bullets", items: keyObservations });
    }

    sections.push({
        heading: "Product Availability & Penetration",
        type: "bullets",
        items: productPenetration.map((p) => `${p.label} – Available in ${p.count} of ${totalOutlets} outlets (${p.tier})`),
    });

    const categoryEntries = competitorTallyByCategory.filter(([catKey]) => catKey !== "other");
    const otherEntry = competitorTallyByCategory.find(([catKey]) => catKey === "other");
    if (categoryEntries.length > 0 || otherEntry) {
        const rankedCategories = [...categoryEntries].sort((a, b) => {
            const totalA = a[1].reduce((s, [, c]) => s + c, 0);
            const totalB = b[1].reduce((s, [, c]) => s + c, 0);
            return totalB - totalA;
        });
        const topLabels = rankedCategories.slice(0, 3).map(([catKey]) => COMPETITOR_CATEGORY_LABELS[catKey] || catKey);

        const introParagraphs = [];
        if (topLabels.length === 1) introParagraphs.push(`Competition remains strongest in the ${topLabels[0]} category.`);
        else if (topLabels.length === 2) introParagraphs.push(`Competition remains strongest in the ${topLabels[0]} and ${topLabels[1]} categories.`);
        else if (topLabels.length >= 3) introParagraphs.push(`Competition remains strongest in the ${topLabels[0]}, ${topLabels[1]} and ${topLabels[2]} categories.`);
        if (categoryEntries.length > 0) introParagraphs.push("Key competitors observed include:");

        const groups = categoryEntries
            .sort((a, b) => a[0].localeCompare(b[0]))
            .map(([catKey, names]) => ({
                label: COMPETITOR_CATEGORY_LABELS[catKey] || catKey,
                items: names.map(([name]) => name),
            }));

        sections.push({
            heading: "Competitive Landscape",
            type: "grouped-bullets",
            introParagraphs,
            groups,
            outro: otherEntry ? `Other notable competing brands observed include ${otherEntry[1].map(([name]) => name).join(", ")}.` : undefined,
        });
    }

    if (distributorTally.length > 0) {
        sections.push({
            heading: "Distributor Activity",
            type: "bullets",
            text: "The following distributors were mentioned by retailers:",
            items: distributorTally.map(([name]) => name),
        });
    }

    // Don't state "no promotional activity" as if that's a finding when
    // the question was never actually answered on any audit — a
    // genuinely recorded zero and a field nobody filled in are different
    // facts, and reporting the second as the first would be exactly the
    // "zero confused with null" mistake worth avoiding in this kind of
    // report.
    if (promotionYes > 0 || promotionNo > 0) {
        sections.push({
            heading: "Promotional Activity",
            type: "paragraph",
            text: promotionYes > 0
                ? `Promotional activity was observed in ${promotionYes} of ${totalOutlets} outlets visited.`
                : `No promotional activity was observed in any of the ${totalOutlets} outlets visited.`,
        });
    }

    if (retailerFeedback.length > 0) {
        // Preferred path — Gemini has already paraphrased the raw feedback
        // text into readable, non-attributable themes (see report.ts's
        // prompt). This is what actually fixes retailer feedback reading
        // like a list of verbatim quotes instead of a human summary.
        sections.push({ heading: "Retailer Feedback", type: "bullets", items: retailerFeedback });
    } else if (feedback.length > 0) {
        // Fallback if the AI didn't return anything for this section —
        // pattern-matched theme lines only, deliberately never the raw
        // "unmatched" quotes, since dumping someone's exact words back
        // into a report is the behavior being fixed here.
        const { themeLines } = groupFeedbackThemes(feedback);
        if (themeLines.length > 0) sections.push({ heading: "Retailer Feedback", type: "bullets", items: themeLines });
    }

    if (recommendations.length > 0) {
        sections.push({ heading: "Recommendations", type: "bullets", items: recommendations });
    }

    return sections;
}

/**
 * Flattens a report (header meta + sections) into plain text — used for
 * both the Copy button and Read Aloud, so what gets copied and what gets
 * spoken are always the same content, just consumed differently.
 */
export function formatReportAsText(sections, meta) {
    const { areaLabel, dateLabel, totalOutlets } = meta;
    const lines = [
        "FIELD SALES AUDITOR REPORT",
        `Area: ${areaLabel}`,
        `Date: ${dateLabel}`,
        `Total Outlets Covered: ${totalOutlets}`,
        "",
    ];

    for (const section of sections) {
        lines.push(section.heading.toUpperCase(), "");

        if (section.type === "paragraph") {
            lines.push(section.text);
        } else if (section.type === "bullets") {
            if (section.text) lines.push(section.text);
            for (const item of section.items) lines.push(`- ${item}`);
        } else if (section.type === "grouped-bullets") {
            for (const p of section.introParagraphs || []) lines.push(p);
            for (const group of section.groups) {
                lines.push(`${group.label}:`);
                for (const item of group.items) lines.push(`- ${item}`);
            }
            if (section.outro) lines.push(section.outro);
        } else if (section.type === "table") {
            lines.push(section.columns.join(" | "));
            for (const row of section.rows) lines.push(row.join(" | "));
        }

        lines.push("");
    }

    return lines.join("\n").trim();
}

export { formatReportDate };
