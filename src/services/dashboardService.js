import { getAudits } from "./auditHistoryService";
import { totalProductsRecorded } from "../utils/productSummary";

function isoDate(d) {
    return d.toISOString().split("T")[0];
}

function daysAgo(n) {
    const d = new Date();
    d.setDate(d.getDate() - n);
    return d;
}

/**
 * Pulls the last 30 days of audits once and derives every dashboard
 * number from it in memory (today / week / month / trend). Scoped to
 * one rep's own audits by default; pass allAudits for the org-wide view
 * shown to Supervisors and Admins (whose own personal audit count is
 * often zero, since their role isn't primarily about field auditing).
 */
export async function getDashboardStats(userId, allAudits = false) {
    const today = new Date();
    const todayStr = isoDate(today);
    const startOfMonth = isoDate(new Date(today.getFullYear(), today.getMonth(), 1));
    const thirtyDaysAgo = isoDate(daysAgo(29));

    const audits = await getAudits({
        userId,
        allAudits,
        startDate: thirtyDaysAgo,
        endDate: todayStr,
        limit: 1000,
    });

    const todaysAudits = audits.filter((a) => a.created_at.startsWith(todayStr));
    const weeksAudits = audits.filter((a) => a.created_at >= isoDate(daysAgo(6)));
    const monthsAudits = audits.filter((a) => a.created_at >= startOfMonth);

    const areasToday = new Set(
        todaysAudits.map((a) => a.outlet?.area_name || a.outlet?.area_id).filter(Boolean)
    );

    const productsToday = todaysAudits.reduce(
        (sum, a) => sum + totalProductsRecorded(a.products), 0
    );

    // last 7 days trend, oldest first
    const last7Days = Array.from({ length: 7 }).map((_, i) => {
        const date = isoDate(daysAgo(6 - i));
        const count = audits.filter((a) => a.created_at.startsWith(date)).length;
        return { date, count };
    });

    // most-visited area this month
    const areaCounts = {};
    for (const a of monthsAudits) {
        const name = a.outlet?.area_name || a.outlet?.area_id;
        if (!name) continue;
        areaCounts[name] = (areaCounts[name] || 0) + 1;
    }
    const topArea = Object.entries(areaCounts).sort((a, b) => b[1] - a[1])[0];

    const activeReps = new Set(monthsAudits.map((a) => a.user_id)).size;

    return {
        todayCount: todaysAudits.length,
        weekCount: weeksAudits.length,
        monthCount: monthsAudits.length,
        areasCoveredToday: areasToday.size,
        productsRecordedToday: productsToday,
        last7Days,
        topArea: topArea ? { name: topArea[0], count: topArea[1] } : null,
        activeReps,
    };
}

// kept for backward compatibility with any existing callers
export async function getTodaysAuditCount(userId) {
    const stats = await getDashboardStats(userId);
    return stats.todayCount;
}
