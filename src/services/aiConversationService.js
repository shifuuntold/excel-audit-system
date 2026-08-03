import { supabase } from "../lib/supabase";

/** Loads the signed-in user's persisted AI Assistant conversation, if any. */
export async function loadConversation(userId) {
    const { data, error } = await supabase
        .from("ai_conversations")
        .select("messages")
        .eq("user_id", userId)
        .maybeSingle();

    if (error) throw error;
    return data?.messages || [];
}

/** Upserts the full message list — the whole thread is small enough that
 * rewriting it on every new message is simpler and cheap enough compared
 * to maintaining per-message rows. */
export async function saveConversation(userId, messages) {
    const { error } = await supabase
        .from("ai_conversations")
        .upsert({ user_id: userId, messages, updated_at: new Date().toISOString() }, { onConflict: "user_id" });

    if (error) throw error;
}

/** Clears the persisted conversation (used by the "New conversation" action). */
export async function clearConversation(userId) {
    const { error } = await supabase
        .from("ai_conversations")
        .upsert({ user_id: userId, messages: [], updated_at: new Date().toISOString() }, { onConflict: "user_id" });

    if (error) throw error;
}
