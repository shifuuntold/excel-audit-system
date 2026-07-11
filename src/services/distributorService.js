import { supabase } from "../lib/supabase";

export async function getDistributors() {
    const { data, error } = await supabase
        .from("distributors")
        .select("*")
        .order("name");

    if (error) throw error;

    return data;
}

/**
 * Finds an existing distributor by name (case-insensitive) or creates it,
 * so a rep can type a new distributor once and everyone can pick it after.
 */
export async function findOrCreateDistributor(name) {
    const clean = name.trim();
    if (!clean) throw new Error("Distributor name is required");

    const { data: existing, error: findError } = await supabase
        .from("distributors")
        .select("*")
        .ilike("name", clean)
        .limit(1)
        .maybeSingle();

    if (findError) throw findError;
    if (existing) return existing;

    const { data: created, error: insertError } = await supabase
        .from("distributors")
        .insert({ name: clean })
        .select()
        .single();

    if (insertError) throw insertError;

    return created;
}

export async function deleteDistributor(id) {
    const { error } = await supabase.from("distributors").delete().eq("id", id);
    if (error) throw error;
}
