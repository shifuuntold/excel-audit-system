import {
    DTT_FLAVOURS, RTD_FLAVOURS, CHAMP_FLAVOURS, GOFRUT_FLAVOURS,
    WB_FLAVOURS, FF_FLAVOURS, JP_FLAVOURS,
} from "../config/productCatalog";

// Matrix-type groups store keys as "size|flavourKey" -> true
const MATRIX_GROUPS = {
    dtt: { label: "Quencher DTT", icon: "🧃", flavours: DTT_FLAVOURS },
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
