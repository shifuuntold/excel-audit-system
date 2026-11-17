import { haversineMeters } from "./location";

/** Same placeholders the database backfill and analytics refuse to treat as an outlet identity. */
export const GENERIC_OUTLET_NAMES = [
    "shop", "duka", "kiosk", "store", "general shop", "general store",
    "n/a", "na", "unknown", "unnamed", "outlet", "",
];

export function normalizeOutletName(name) {
    return String(name ?? "").trim().replace(/\s+/g, " ").toLowerCase();
}

export function isGenericOutletName(name) {
    return GENERIC_OUTLET_NAMES.includes(normalizeOutletName(name));
}

/** Client-generated id so a brand-new outlet can be created while offline. */
export function newOutletId() {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
    const hex = (n) => Array.from({ length: n }, () => Math.floor(Math.random() * 16).toString(16)).join("");
    return `${hex(8)}-${hex(4)}-4${hex(3)}-${"89ab"[Math.floor(Math.random() * 4)]}${hex(3)}-${hex(12)}`;
}

/**
 * Suggestions for the outlet picker: active outlets whose name contains the
 * typed text, preferring the chosen area. Never invents a match.
 */
export function suggestOutlets(outlets, { text, areaId, areaName, limit = 6 }) {
    const needle = normalizeOutletName(text);
    if (needle.length < 2) return [];
    const sameArea = (o) =>
        (areaId && o.area_id && String(o.area_id) === String(areaId)) ||
        (areaName && o.area_name && normalizeOutletName(o.area_name) === normalizeOutletName(areaName));
    return (outlets || [])
        .filter((o) => o.is_active !== false && normalizeOutletName(o.name).includes(needle))
        .map((o) => ({ o, area: !!sameArea(o), exact: normalizeOutletName(o.name) === needle }))
        .sort((a, b) => Number(b.exact) - Number(a.exact) || Number(b.area) - Number(a.area) || a.o.name.localeCompare(b.o.name))
        .slice(0, limit)
        .map((x) => x.o);
}

/**
 * Existing outlets that could be the same shop as a NEW one being typed:
 * same normalized name in the same area, or the same name within
 * `radiusM` of the captured location.
 */
export function findPossibleDuplicates(outlets, { name, areaId, areaName, latitude, longitude, radiusM = 150 }) {
    const key = normalizeOutletName(name);
    if (!key) return [];
    return (outlets || []).filter((o) => {
        if (o.is_active === false || normalizeOutletName(o.name) !== key) return false;
        const sameArea =
            (areaId && o.area_id && String(o.area_id) === String(areaId)) ||
            (areaName && o.area_name && normalizeOutletName(o.area_name) === normalizeOutletName(areaName));
        const d = haversineMeters(latitude, longitude, o.latitude, o.longitude);
        return !!sameArea || (d != null && d <= radiusM);
    });
}
