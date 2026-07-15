import { supabase } from "../lib/supabase";

const AREAS_CACHE_KEY = "excel_audit_areas_cache_v1";

function readAreasCache() {
    try {
        const raw = localStorage.getItem(AREAS_CACHE_KEY);
        return raw ? JSON.parse(raw) : [];
    } catch {
        return [];
    }
}

function writeAreasCache(areas) {
    try {
        localStorage.setItem(AREAS_CACHE_KEY, JSON.stringify(areas));
    } catch {
        // storage full or unavailable — non-fatal, just means no offline cache
    }
}

export async function getAreas() {
    try {
        const { data, error } = await supabase
            .from("areas")
            .select("*")
            .order("name");

        if (error) throw error;

        writeAreasCache(data);
        return data;
    } catch (err) {
        // Offline or request failed — fall back to whatever we last saw,
        // so a rep who's already loaded the app once can still pick a
        // known area without a connection.
        const cached = readAreasCache();
        if (cached.length > 0) return cached;
        throw err;
    }
}

let _areaMapCache = null;

// id -> name lookup, cached for the session since areas rarely change
export async function getAreaMap() {
    if (_areaMapCache) return _areaMapCache;

    const areas = await getAreas();
    _areaMapCache = Object.fromEntries(areas.map((a) => [a.id, a.name]));
    return _areaMapCache;
}

export function resolveAreaName(outlet, areaMap) {
    if (!outlet) return "-";
    // Prefer a name snapshot stored on the audit itself (survives area renames),
    // fall back to resolving the id against the current areas table.
    return outlet.area_name || areaMap?.[outlet.area_id] || outlet.area_id || "-";
}

/**
 * Finds an existing area by name (case-insensitive) or creates it.
 * Used by the location search so any place a rep picks from the map
 * becomes available in the saved areas list for everyone else too.
 */
export async function findOrCreateArea(name, { latitude, longitude } = {}) {
    const clean = name.trim();
    if (!clean) throw new Error("Area name is required");

    const { data: existing, error: findError } = await supabase
        .from("areas")
        .select("*")
        .ilike("name", clean)
        .limit(1)
        .maybeSingle();

    if (findError) throw findError;
    if (existing) return existing;

    const { data: created, error: insertError } = await supabase
        .from("areas")
        .insert({ name: clean, latitude, longitude })
        .select()
        .single();

    if (insertError) throw insertError;

    // bust the cached id->name map so the new area shows up immediately
    _areaMapCache = null;

    return created;
}

export async function deleteArea(id) {
    const { error } = await supabase.from("areas").delete().eq("id", id);
    if (error) throw error;
    _areaMapCache = null;
}
