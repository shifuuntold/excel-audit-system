import { supabase } from "../lib/supabase";
import { registerOutlet } from "./outletService";

/**
 * outletRef: { id, isNew, name, area_id, area_name, latitude, longitude }
 * capture:   { latitude, longitude, accuracy } - the device reading, stored
 *            as sent whatever the verification result turns out to be.
 * Both are optional so audits queued by an older version of the app
 * (which only had `outlet`) still sync; those stay unlinked and
 * unverified rather than being guessed at.
 *
 * The verification result itself is computed by the database
 * (verify_audit_location trigger); the client never sends one.
 */
export async function saveAudit({
    userId,
    outlet,
    products,
    market,
    outletRef = null,
    capture = null,
}) {
    if (outletRef?.isNew && outletRef.name?.trim()) {
        await registerOutlet(outletRef, userId);
    }

    const cap = capture ?? (outlet?.latitude != null ? { latitude: outlet.latitude, longitude: outlet.longitude, accuracy: null } : null);

    const { data, error } = await supabase
        .from("audit_submissions")
        .insert([
            {
                user_id: userId,
                outlet: outlet,
                products: products,
                market: market,
                outlet_id: outletRef?.id ?? null,
                captured_latitude: cap?.latitude ?? null,
                captured_longitude: cap?.longitude ?? null,
                captured_accuracy_m: cap?.accuracy ?? null,
                registers_outlet_location: !!(outletRef?.isNew && cap),
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

export async function updateAudit(id, { outlet, products, market, outletRef = null }) {
    // Editing never re-runs location verification, except to link an older
    // audit that had no outlet yet (then the database checks it against that
    // outlet's registered location).
    const changes = { outlet, products, market };
    if (outletRef?.name?.trim()) {
        if (outletRef.isNew) {
            const { data: authData } = await supabase.auth.getUser();
            await registerOutlet(outletRef, authData?.user?.id ?? null);
        }
        changes.outlet_id = outletRef.id;
    }
    const { data, error } = await supabase
        .from("audit_submissions")
        .update(changes)
        .eq("id", id)
        .select()
        .single();

    if (error) {
        console.error(error);
        throw error;
    }

    return data;
}

export async function deleteAudit(id) {
    const { error } = await supabase
        .from("audit_submissions")
        .delete()
        .eq("id", id);

    if (error) {
        console.error(error);
        throw error;
    }
}
