import { supabase } from "../lib/supabase";
import { withOfflineCache } from "../utils/offlineCache";
import { DEFAULT_LOCATION_SETTINGS } from "../utils/location";

/** Active outlets, cached so the picker still works if the connection drops mid-audit. */
export async function getOutlets() {
    return withOfflineCache("outlets", async () => {
        const { data, error } = await supabase
            .from("outlets")
            .select("id, name, area_id, area_name, latitude, longitude, is_active, needs_review")
            .eq("is_active", true)
            .order("name");
        if (error) throw error;
        return data;
    });
}

export function invalidateOutletCache() {
    try { localStorage.removeItem("excel_audit_cache:outlets"); } catch { /* non-fatal */ }
}

/**
 * Registers a brand-new outlet. The id is generated on the device, so this
 * is safe to retry: a second attempt for the same id changes nothing.
 * The registered location is the first device capture for the outlet.
 */
export async function registerOutlet(outletRef, userId) {
    const { error } = await supabase.from("outlets").upsert(
        {
            id: outletRef.id,
            name: String(outletRef.name).trim(),
            area_id: outletRef.area_id ? String(outletRef.area_id) : null,
            area_name: outletRef.area_name || null,
            latitude: outletRef.latitude ?? null,
            longitude: outletRef.longitude ?? null,
            location_source: outletRef.latitude != null ? "device_capture" : null,
            created_by: userId,
        },
        { onConflict: "id", ignoreDuplicates: true },
    );
    if (error) throw error;
    invalidateOutletCache();
}

/** Admin-editable thresholds; falls back to the documented defaults if unreadable. */
export async function getLocationSettings() {
    try {
        return await withOfflineCache("location_settings", async () => {
            const { data, error } = await supabase
                .from("app_settings").select("value").eq("key", "location_verification").maybeSingle();
            if (error) throw error;
            return { ...DEFAULT_LOCATION_SETTINGS, ...(data?.value || {}) };
        });
    } catch {
        return { ...DEFAULT_LOCATION_SETTINGS };
    }
}
