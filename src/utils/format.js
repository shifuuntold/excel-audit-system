export function fmtDate(iso) {
    if (!iso) return "-";
    return new Date(iso).toLocaleString([], {
        year: "numeric", month: "short", day: "numeric",
        hour: "2-digit", minute: "2-digit",
    });
}

/**
 * Returns YYYY-MM-DD in the browser's LOCAL timezone.
 *
 * Don't use `date.toISOString().split("T")[0]` for this — toISOString()
 * converts to UTC first, which silently shifts the date backward by a
 * day during early morning hours in any timezone ahead of UTC (e.g.
 * Kenya/EAT, UTC+3: 1:00 AM local on the 15th is still 10:00 PM UTC on
 * the 14th). That mismatch can misattribute an audit submitted just
 * after midnight to the previous day everywhere "today" is computed —
 * dashboard stats, trend charts, and default report/history date ranges.
 */
export function localIsoDate(d = new Date()) {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
}

/**
 * Checks whether a stored UTC timestamp (e.g. an audit's created_at)
 * falls on the given LOCAL calendar date string (YYYY-MM-DD). Comparing
 * created_at.startsWith(dateStr) directly compares a UTC date against a
 * local one and misattributes anything submitted in the UTC-to-local
 * offset window (e.g. just after midnight in Kenya/EAT) to the wrong day.
 */
export function isOnLocalDate(isoTimestamp, dateStr) {
    if (!isoTimestamp || !dateStr) return false;
    return localIsoDate(new Date(isoTimestamp)) === dateStr;
}
