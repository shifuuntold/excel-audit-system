import { supabase } from "../lib/supabase";

export async function saveAudit({
    userId,
    outlet,
    products,
    market,
}) {

    const { data, error } = await supabase
        .from("audit_submissions")
        .insert([
            {
                user_id: userId,
                outlet: outlet,
                products: products,
                market: market,
            },
        ])
        .select()
        .single();

    if (error) {
        console.error(error);
        throw error;
    }

    return data;
}
