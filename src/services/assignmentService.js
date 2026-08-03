import { supabase } from "../lib/supabase";

/** Refreshes any Pending/In Progress assignment past its due date to
 * Overdue — cheap to call opportunistically before reading the board. */
async function refreshOverdueStatuses() {
    const { error } = await supabase.rpc("mark_overdue_assignments");
    if (error) console.error("Failed to refresh overdue assignments:", error);
}

export async function createAssignment({ outletName, area, assignedTo, assignedBy, dueDate, priority, notes }) {
    const { data, error } = await supabase
        .from("outlet_assignments")
        .insert({
            outlet_name: outletName,
            area: area || null,
            assigned_to: assignedTo,
            assigned_by: assignedBy,
            due_date: dueDate || null,
            priority: priority || "Medium",
            notes: notes || null,
        })
        .select()
        .single();

    if (error) throw error;
    return data;
}

/** Every assignment, for the Supervisor/Admin board view. */
export async function getAllAssignments() {
    await refreshOverdueStatuses();
    const { data, error } = await supabase
        .from("outlet_assignments")
        .select("*")
        .order("due_date", { ascending: true, nullsFirst: false });

    if (error) throw error;
    return data || [];
}

/** Just the signed-in auditor's own assignments. */
export async function getMyAssignments(userId) {
    await refreshOverdueStatuses();
    const { data, error } = await supabase
        .from("outlet_assignments")
        .select("*")
        .eq("assigned_to", userId)
        .order("due_date", { ascending: true, nullsFirst: false });

    if (error) throw error;
    return data || [];
}

export async function updateAssignmentStatus(id, { status, notes }) {
    const patch = { status };
    if (status === "Completed") patch.completion_date = new Date().toISOString().slice(0, 10);
    if (notes !== undefined) patch.notes = notes;

    const { error } = await supabase.from("outlet_assignments").update(patch).eq("id", id);
    if (error) throw error;
}

export async function deleteAssignment(id) {
    const { error } = await supabase.from("outlet_assignments").delete().eq("id", id);
    if (error) throw error;
}
