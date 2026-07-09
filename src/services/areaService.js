import { supabase } from "../lib/supabase";

export async function getAreas() {

    const { data, error } = await supabase
        .from("areas")
        .select("*")
        .order("name");

    if (error) throw error;

    return data;
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
