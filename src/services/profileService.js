import { supabase } from "../lib/supabase";

export async function createProfile(user) {
    const { data: existing } = await supabase
        .from("profiles")
        .select("id")
        .eq("id", user.id)
        .maybeSingle();

    if (!existing) {
        await supabase.from("profiles").insert({
            id: user.id,
            full_name:
                user.user_metadata?.full_name ||
                user.email.split("@")[0],
        });
    }
}

export async function getProfile(userId) {
    const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .single();

    if (error) throw error;

    return data;
}

// id -> full_name lookup, used by the supervisor dashboard to label
// audits by rep. Requires an RLS policy allowing supervisors to read
// all profiles (see supabase/supervisor_setup.sql).
export async function getProfileMap() {
    const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, role");

    if (error) throw error;

    return Object.fromEntries((data || []).map((p) => [p.id, p]));
}