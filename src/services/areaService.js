import { supabase } from "../lib/supabase";

export async function getAreas() {

    const { data, error } = await supabase
        .from("areas")
        .select("*")
        .order("name");

    if (error) throw error;

    return data;
}