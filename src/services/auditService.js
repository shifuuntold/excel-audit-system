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

export async function getAuditById(id) {
    const { data, error } = await supabase
        .from("audit_submissions")
        .select("*")
        .eq("id", id)
        .single();

    if (error) throw error;

    return data;
}

export async function updateAudit(id, { outlet, products, market }) {
    const { data, error } = await supabase
        .from("audit_submissions")
        .update({ outlet, products, market })
        .eq("id", id)
        .select()
        .single();

    if (error) {
        console.error(error);
        throw error;
    }

    return data;
}
