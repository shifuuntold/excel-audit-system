import { supabase } from "../lib/supabase";

export async function getTodaysAudits(userId) {

    const today = new Date().toISOString().split("T")[0];

    const { data, error } = await supabase
        .from("audit_submissions")
        .select(`
            *,
            outlet,
            products,
            market
        `)
        .eq("user_id", userId)
        .gte("created_at", `${today}T00:00:00`)
        .lt("created_at", `${today}T23:59:59`)
        .order("created_at", { ascending: false });

    if (error) throw error;

    return data || [];

}