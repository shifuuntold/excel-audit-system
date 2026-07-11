import { COMPETITOR_CATEGORIES } from "../config/productCatalog";

const CATEGORY_LABELS = Object.fromEntries(COMPETITOR_CATEGORIES.map((c) => [c.key, c.label]));

/**
 * Returns a flat list of { category, name } from an audit's market data.
 * Supports both the new categorized `market.competitors` object and the
 * old free-text `market.competitor` string (kept working for historical
 * audits — those just come back with category: null).
 */
export function flattenCompetitors(market) {
    if (!market) return [];

    if (market.competitors && Object.keys(market.competitors).length > 0) {
        return Object.entries(market.competitors).flatMap(([category, names]) =>
            (names || []).map((name) => ({ category, name }))
        );
    }

    if (market.competitor) {
        return market.competitor
            .split(/,|;|&|\band\b/i)
            .map((s) => s.trim())
            .filter(Boolean)
            .map((name) => ({ category: null, name }));
    }

    return [];
}

/** One-line "Category: Brand, Brand | Category: Brand" summary for tables/exports. */
export function competitorSummaryText(market) {
    const flat = flattenCompetitors(market);
    if (flat.length === 0) return "-";

    const byCategory = {};
    for (const { category, name } of flat) {
        const key = category || "General";
        if (!byCategory[key]) byCategory[key] = [];
        byCategory[key].push(name);
    }

    return Object.entries(byCategory)
        .map(([key, names]) => `${CATEGORY_LABELS[key] || key}: ${names.join(", ")}`)
        .join(" | ");
}
