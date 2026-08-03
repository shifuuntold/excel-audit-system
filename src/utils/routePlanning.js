// Smart Route Planning — the free tier.
//
// This computes a genuinely useful route ORDER (nearest-neighbor,
// as-the-crow-flies) using only coordinates already captured on audits —
// no Maps API key, no cost, no network call. What it does NOT do is real
// driving-time optimization (one-way streets, traffic, actual road
// distance) — that needs a routing provider.
//
// The abstraction point for that is `estimateDistance` below: right now
// it's haversineKm, a pure function with no external dependency. A real
// provider (Google Maps Distance Matrix, Mapbox Directions, OSRM) would
// slot in here as an alternative implementation of the same signature —
// (from, to) => Promise<km> — without changing anything else in
// nearestNeighborRoute. Swapping it in is future work; this file is
// deliberately built so that swap doesn't require touching the ordering
// logic itself.

const EARTH_RADIUS_KM = 6371;

function toRad(deg) {
    return (deg * Math.PI) / 180;
}

/** Straight-line distance between two {latitude, longitude} points, in km. */
export function haversineKm(a, b) {
    const dLat = toRad(b.latitude - a.latitude);
    const dLon = toRad(b.longitude - a.longitude);
    const lat1 = toRad(a.latitude);
    const lat2 = toRad(b.latitude);

    const h =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;

    return EARTH_RADIUS_KM * 2 * Math.asin(Math.sqrt(h));
}

/**
 * Orders a list of outlets into a suggested visit sequence using a greedy
 * nearest-neighbor heuristic starting from `start` — repeatedly picks the
 * closest not-yet-visited outlet to the current position. Not optimal
 * (true optimal routing is NP-hard), but a solid, instant, free
 * approximation that's dramatically better than an unordered list, which
 * is what a supervisor has today.
 *
 * @param {{latitude:number, longitude:number}} start
 * @param {Array<{latitude:number, longitude:number}>} outlets - must already be filtered to ones with coordinates
 * @returns {Array} outlets reordered into the suggested visit sequence, each with a `legDistanceKm` from the previous stop
 */
export function nearestNeighborRoute(start, outlets) {
    const remaining = [...outlets];
    const route = [];
    let current = start;

    while (remaining.length > 0) {
        let nearestIndex = 0;
        let nearestDist = haversineKm(current, remaining[0]);

        for (let i = 1; i < remaining.length; i++) {
            const dist = haversineKm(current, remaining[i]);
            if (dist < nearestDist) {
                nearestDist = dist;
                nearestIndex = i;
            }
        }

        const [next] = remaining.splice(nearestIndex, 1);
        route.push({ ...next, legDistanceKm: Math.round(nearestDist * 10) / 10 });
        current = next;
    }

    return route;
}

/** Total distance of a route, and a rough time estimate at a conservative
 * in-town average speed — genuinely just an estimate, not routed. */
export function routeSummary(route, avgSpeedKmh = 25) {
    const totalKm = route.reduce((sum, stop) => sum + (stop.legDistanceKm || 0), 0);
    return {
        totalKm: Math.round(totalKm * 10) / 10,
        estimatedMinutes: Math.round((totalKm / avgSpeedKmh) * 60),
    };
}
