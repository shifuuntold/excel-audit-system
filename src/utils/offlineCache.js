/**
 * Small localStorage-backed cache for "read-mostly" reference lists
 * (areas, distributors, competitors) — so that once a rep has loaded
 * the app while online, those lists are still usable if they later go
 * offline mid-audit, instead of silently falling back to whatever
 * static defaults happen to be hardcoded in the app.
 */

const PREFIX = "excel_audit_cache:";

export function readCache(key, fallback = null) {
    try {
        const raw = localStorage.getItem(PREFIX + key);
        return raw ? JSON.parse(raw) : fallback;
    } catch {
        return fallback;
    }
}

export function writeCache(key, value) {
    try {
        localStorage.setItem(PREFIX + key, JSON.stringify(value));
    } catch {
        // storage full/unavailable — non-fatal, just means no offline cache
    }
}

function hasContent(value) {
    if (!value) return false;
    if (Array.isArray(value)) return value.length > 0;
    if (typeof value === "object") return Object.keys(value).length > 0;
    return true;
}

/**
 * Runs `fetchFn`; on success, caches and returns the result. On failure
 * (e.g. offline), falls back to whatever was last cached, and only
 * rethrows if there's no cache to fall back to either.
 */
export async function withOfflineCache(key, fetchFn, fallback = []) {
    try {
        const data = await fetchFn();
        writeCache(key, data);
        return data;
    } catch (err) {
        const cached = readCache(key);
        if (hasContent(cached)) return cached;
        if (hasContent(fallback)) return fallback;
        throw err;
    }
}
