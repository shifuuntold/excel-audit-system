/**
 * Supports both the new multi-select `market.distributors` array and the
 * old single `market.distributor` string (historical audits keep working).
 */
export function flattenDistributors(market) {
    if (!market) return [];
    if (market.distributors && market.distributors.length > 0) return market.distributors;
    if (market.distributor) return [market.distributor];
    return [];
}

export function distributorSummaryText(market) {
    const list = flattenDistributors(market);
    return list.length > 0 ? list.join(", ") : "-";
}
