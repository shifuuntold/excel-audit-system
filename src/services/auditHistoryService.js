import { supabase } from "../lib/supabase";

/**
 * General-purpose audit query with optional filters.
 * @param {Object} opts
 * @param {string} opts.userId - required unless allAudits is true
 * @param {boolean} opts.allAudits - if true, skips the user_id filter (supervisor view)
 * @param {string} opts.startDate - ISO date (YYYY-MM-DD), inclusive
 * @param {string} opts.endDate - ISO date (YYYY-MM-DD), inclusive
 * @param {string} opts.areaId
 * @param {string} opts.search - matched against outlet shop_name (case-insensitive)
 * @param {number} opts.limit
 */
export async function getAudits({
    userId,
    allAudits = false,
    startDate,
    endDate,
    areaId,
    search,
    limit = 200,
} = {}) {

    let query = supabase
        .from("audit_submissions")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(limit);

    if (!allAudits) {
        if (!userId) return [];
        query = query.eq("user_id", userId);
    }

    if (startDate) {
        query = query.gte("created_at", `${startDate}T00:00:00`);
    }

    if (endDate) {
        query = query.lte("created_at", `${endDate}T23:59:59`);
    }

    if (areaId) {
        query = query.eq("outlet->>area_id", areaId);
    }

    if (search && search.trim()) {
        query = query.ilike("outlet->>shop_name", `%${search.trim()}%`);
    }

    const { data, error } = await query;

    if (error) throw error;

    return data || [];
}

export async function getTodaysAudits(userId) {
    const today = new Date().toISOString().split("T")[0];
    return getAudits({ userId, startDate: today, endDate: today });
}
