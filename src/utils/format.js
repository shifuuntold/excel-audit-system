export function fmtDate(iso) {
    if (!iso) return "-";
    return new Date(iso).toLocaleString([], {
        year: "numeric", month: "short", day: "numeric",
        hour: "2-digit", minute: "2-digit",
    });
}
