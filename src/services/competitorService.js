import { supabase } from "../lib/supabase";
import { withOfflineCache } from "../utils/offlineCache";

/**
 * Returns competitors grouped by category: { water: ["Dasani", ...], rtd: [...] }
 * Falls back to the last-cached result when offline, so custom brands a
 * rep has seen before (not just the hardcoded starter list) are still
 * selectable without a connection.
 */
export async function getCompetitorsByCategory() {
    return withOfflineCache("competitors_by_category", async () => {
        const { data, error } = await supabase
            .from("competitors")
            .select("*")
            .order("name");

        if (error) throw error;

        const grouped = {};
        for (const row of data || []) {
            if (!grouped[row.category]) grouped[row.category] = [];
            grouped[row.category].push(row.name);
        }
        return grouped;
    }, {});
}

/**
 * Finds an existing competitor within a category (case-insensitive) or
 * creates it, so a rep can add a brand once and the whole team can
 * select it after — solving the typed-name inconsistency at the source.
 */
export async function findOrCreateCompetitor(category, name) {
    const clean = name.trim();
    if (!clean) throw new Error("Competitor name is required");

    const { data: existing, error: findError } = await supabase
        .from("competitors")
        .select("*")
        .eq("category", category)
        .ilike("name", clean)
        .limit(1)
        .maybeSingle();

    if (findError) throw findError;
    if (existing) return existing;

    const { data: created, error: insertError } = await supabase
        .from("competitors")
        .insert({ category, name: clean })
        .select()
        .single();

    if (insertError) throw insertError;

    return created;
}

export async function deleteCompetitor(id) {
    const { error } = await supabase.from("competitors").delete().eq("id", id);
    if (error) throw error;
}

export async function getAllCompetitorsFlat() {
    const { data, error } = await supabase
        .from("competitors")
        .select("*")
        .order("category")
        .order("name");

    if (error) throw error;

    return data || [];
}
