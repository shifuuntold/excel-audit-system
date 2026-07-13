import {
    DTT_FLAVOURS, RTD_FLAVOURS, CHAMP_FLAVOURS, GOFRUT_FLAVOURS,
    WB_FLAVOURS, FF_FLAVOURS, JP_FLAVOURS,
} from "../config/productCatalog";

// Matrix-type groups store keys as "size|flavourKey" -> true
const MATRIX_GROUPS = {
    // "DTD" is the term used in your field reports and competitor
    // categories for this line — kept as a search alias so it's findable
    // by either name without changing the display label.
    dtt: { label: "Quencher DTT", icon: "🧃", flavours: DTT_FLAVOURS, aliases: ["DTD"] },
    rtd: { label: "Quencher RTD", icon: "🧃", flavours: RTD_FLAVOURS },
    champ: { label: "Champ", icon: "🥤", flavours: CHAMP_FLAVOURS },
    gofrut: { label: "GoFrut", icon: "🍹", flavours: GOFRUT_FLAVOURS },
    wb: { label: "Warner Bros", icon: "🎬", flavours: WB_FLAVOURS },
    jp: { label: "Jelly Pop", icon: "🍬", flavours: JP_FLAVOURS },
};

// Flat groups store keys as just the size string -> true
const FLAT_GROUPS = {
    water: { label: "Quencher Life Water", icon: "💧" },
    dc: { label: "Raha Drinking Chocolate", icon: "🍫" },
    cocoa: { label: "Raha Cocoa Powder", icon: "🫙" },
    gluc: { label: "Excel Glucose", icon: "⚡" },
    energy: { label: "Energy Drink", icon: "🔋" },
    reload: { label: "Reload Isotonic", icon: "🏃" },
};

// Labeled-flat: keys are a flavour code -> true, needs a lookup for the label
const LABELED_FLAT_GROUPS = {
    ff: { label: "Fruit Full", icon: "🍓", flavours: FF_FLAVOURS },
};

/**
 * Turns the raw `products` jsonb blob from an audit into a clean,
 * human-readable summary grouped by product line.
 *
 * Returns: [{ key, label, icon, count, items: string[] }]
 */
export function buildProductSummary(products) {
    if (!products) return [];

    const groups = [];

    for (const [key, entries] of Object.entries(products)) {
        if (!entries || typeof entries !== "object") continue;

        const checkedKeys = Object.entries(entries)
            .filter(([, checked]) => !!checked)
            .map(([k]) => k);

        if (checkedKeys.length === 0) continue;

        if (MATRIX_GROUPS[key]) {
            const { label, icon, flavours } = MATRIX_GROUPS[key];
            const flavourMap = Object.fromEntries(flavours.map((f) => [f.k, f.l]));

            const items = checkedKeys.map((combo) => {
                const [size, flavourKey] = combo.split("|");
                return `${flavourMap[flavourKey] || flavourKey} ${size}`;
            });

            groups.push({ key, label, icon, count: items.length, items: items.sort() });
            continue;
        }

        if (LABELED_FLAT_GROUPS[key]) {
            const { label, icon, flavours } = LABELED_FLAT_GROUPS[key];
            const flavourMap = Object.fromEntries(flavours.map((f) => [f.k, f.l]));
            const items = checkedKeys.map((k) => flavourMap[k] || k);
            groups.push({ key, label, icon, count: items.length, items: items.sort() });
            continue;
        }

        if (FLAT_GROUPS[key]) {
            const { label, icon } = FLAT_GROUPS[key];
            groups.push({ key, label, icon, count: checkedKeys.length, items: checkedKeys.sort() });
            continue;
        }

        // Unknown/future group: fall back to raw keys so nothing is silently dropped
        groups.push({ key, label: key, icon: "📦", count: checkedKeys.length, items: checkedKeys.sort() });
    }

    return groups.sort((a, b) => b.count - a.count);
}

export function totalProductsRecorded(products) {
    return buildProductSummary(products).reduce((sum, g) => sum + g.count, 0);
}

// Every known product line, keyed the same way audits store them —
// used by product search/filtering and the reports page so groups with
// zero hits still show up (e.g. "Champ – not available in any outlet").
export const ALL_PRODUCT_GROUPS = Object.entries({ ...MATRIX_GROUPS, ...FLAT_GROUPS, ...LABELED_FLAT_GROUPS })
    .map(([key, meta]) => ({ key, label: meta.label, icon: meta.icon, aliases: meta.aliases || [] }));

/**
 * Returns true if a given audit's products include at least one checked
 * item belonging to the given group key.
 */
export function auditHasProductGroup(products, groupKey) {
    const entries = products?.[groupKey];
    if (!entries) return false;
    return Object.values(entries).some(Boolean);
}

/**
 * Finds product groups whose label, key, or known alias matches a
 * free-text search term (e.g. "dtd", "champ", "water") — used for the
 * product penetration search.
 */
export function findMatchingGroups(query) {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return ALL_PRODUCT_GROUPS.filter(
        (g) =>
            g.label.toLowerCase().includes(q) ||
            g.key.toLowerCase().includes(q) ||
            g.aliases.some((a) => a.toLowerCase().includes(q))
    );
}
