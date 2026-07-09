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