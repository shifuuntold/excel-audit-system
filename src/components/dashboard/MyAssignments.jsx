import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getMyAssignments, updateAssignmentStatus } from "../../services/assignmentService";
import { getOutletCoverage } from "../../services/coverageService";
import { nearestNeighborRoute, routeSummary } from "../../utils/routePlanning";
import { B } from "../../config/theme";
import { ClipboardList, MapPin, Check, Navigation, ExternalLink } from "lucide-react";

const STATUS_COLOR = {
    Pending: { color: B.muted, bg: B.blueFaint },
    "In Progress": { color: B.blue, bg: B.blueFaint },
    Overdue: { color: B.red, bg: B.redLight },
};

/** Shown only to Auditors — their assigned areas from a Supervisor, with
 * a one-tap way to mark one done and a suggested route through outlets in
 * that area needing attention. This is the actual answer to "how does the
 * auditor know they've been assigned something": it's the first thing on
 * their dashboard the moment they open the app, no separate notification
 * system needed. Nothing shows for a Supervisor/Admin; they assign work,
 * they don't get assigned it. */
export default function MyAssignments({ userId }) {
    const navigate = useNavigate();
    const [assignments, setAssignments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [updatingId, setUpdatingId] = useState(null);
    const [routeForId, setRouteForId] = useState(null);
    const [route, setRoute] = useState(null);
    const [routeLoading, setRouteLoading] = useState(false);
    const [routeError, setRouteError] = useState(null);

    async function load() {
        setLoading(true);
        try {
            const data = await getMyAssignments(userId);
            setAssignments(data.filter((a) => a.status !== "Completed"));
        } catch (err) {
            console.error("Failed to load assignments:", err);
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        if (!userId) return;
        // eslint-disable-next-line react-hooks/set-state-in-effect
        load();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [userId]);

    async function markComplete(id) {
        setUpdatingId(id);
        try {
            await updateAssignmentStatus(id, { status: "Completed" });
            setAssignments((prev) => prev.filter((a) => a.id !== id));
        } catch (err) {
            console.error(err);
            alert("Couldn't update that assignment. Please try again.");
        } finally {
            setUpdatingId(null);
        }
    }

    async function toggleRoute(assignment) {
        if (routeForId === assignment.id) {
            setRouteForId(null);
            return;
        }

        setRouteForId(assignment.id);
        setRoute(null);
        setRouteError(null);
        setRouteLoading(true);

        try {
            const outlets = await getOutletCoverage();
            const routable = outlets
                .filter((o) => o.area === assignment.area && (o.days_since_last_visit ?? 0) >= 14)
                .map((o) => {
                    const lat = parseFloat(o.coordinates?.latitude);
                    const lng = parseFloat(o.coordinates?.longitude);
                    if (Number.isNaN(lat) || Number.isNaN(lng)) return null;
                    return { ...o, latitude: lat, longitude: lng };
                })
                .filter(Boolean);

            if (routable.length === 0) {
                setRouteError("No outlets in this area have both a recorded location and a follow-up need right now.");
                setRouteLoading(false);
                return;
            }

            function computeFrom(start) {
                const ordered = nearestNeighborRoute(start, routable);
                setRoute({ stops: ordered, summary: routeSummary(ordered) });
                setRouteLoading(false);
            }

            if ("geolocation" in navigator) {
                navigator.geolocation.getCurrentPosition(
                    (pos) => computeFrom({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
                    () => {
                        const centroid = {
                            latitude: routable.reduce((s, o) => s + o.latitude, 0) / routable.length,
                            longitude: routable.reduce((s, o) => s + o.longitude, 0) / routable.length,
                        };
                        computeFrom(centroid);
                    },
                    { timeout: 5000 }
                );
            } else {
                const centroid = {
                    latitude: routable.reduce((s, o) => s + o.latitude, 0) / routable.length,
                    longitude: routable.reduce((s, o) => s + o.longitude, 0) / routable.length,
                };
                computeFrom(centroid);
            }
        } catch (err) {
            console.error(err);
            setRouteError("Couldn't load outlets for this area. Please try again.");
            setRouteLoading(false);
        }
    }

    if (loading || assignments.length === 0) return null;

    return (
        <div style={{ background: B.white, border: `1px solid ${B.blueLight}`, borderRadius: 16, padding: 16, marginBottom: 20 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 12 }}>
                <ClipboardList size={15} style={{ color: B.blue }} />
                <h2 style={{ fontSize: 14, fontWeight: 700, margin: 0 }}>
                    My Assignments ({assignments.length})
                </h2>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {assignments.map((a) => {
                    const statusStyle = STATUS_COLOR[a.status] || STATUS_COLOR.Pending;
                    const showingRoute = routeForId === a.id;
                    return (
                        <div key={a.id} style={{ background: B.blueFaint, borderRadius: 10, padding: "10px 12px" }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
                                <div style={{ minWidth: 0 }}>
                                    <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: B.text, display: "flex", alignItems: "center", gap: 4 }}>
                                        <MapPin size={12} /> {a.area}
                                    </p>
                                    <p style={{ margin: "2px 0 0", fontSize: 11, color: B.muted }}>
                                        {a.due_date ? `Due ${a.due_date}` : "No due date"}
                                        {a.outlet_name && ` · ${a.outlet_name}`}
                                    </p>
                                </div>
                                <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
                                    <span style={{ fontSize: 10, fontWeight: 700, color: statusStyle.color, background: statusStyle.bg, padding: "3px 8px", borderRadius: 20 }}>
                                        {a.status}
                                    </span>
                                    <button
                                        onClick={() => markComplete(a.id)}
                                        disabled={updatingId === a.id}
                                        title="Mark complete"
                                        style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 26, height: 26, borderRadius: 8, background: B.green, color: "#fff", border: 0, cursor: "pointer", opacity: updatingId === a.id ? 0.6 : 1 }}
                                    >
                                        <Check size={13} />
                                    </button>
                                </div>
                            </div>

                            <button
                                onClick={() => toggleRoute(a)}
                                style={{ display: "flex", alignItems: "center", gap: 5, background: "none", border: 0, color: B.blue, fontSize: 11.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", padding: 0, marginTop: 8 }}
                            >
                                <Navigation size={11} /> {showingRoute ? "Hide suggested route" : "View suggested route"}
                            </button>

                            {showingRoute && (
                                <div style={{ marginTop: 8, paddingTop: 8, borderTop: `1px solid ${B.blueLight}` }}>
                                    {routeLoading && <p style={{ margin: 0, fontSize: 11.5, color: B.muted }}>Building route...</p>}
                                    {routeError && <p style={{ margin: 0, fontSize: 11.5, color: B.muted }}>{routeError}</p>}
                                    {route && (
                                        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                                            <p style={{ margin: 0, fontSize: 10.5, color: B.muted }}>
                                                {route.stops.length} stops · ~{route.summary.totalKm} km · ~{route.summary.estimatedMinutes} min driving
                                            </p>
                                            {route.stops.map((stop, i) => (
                                                <a
                                                    key={stop.outlet_key}
                                                    href={`https://www.google.com/maps?q=${stop.latitude},${stop.longitude}`}
                                                    target="_blank"
                                                    rel="noreferrer"
                                                    style={{ display: "flex", alignItems: "center", gap: 8, background: B.white, borderRadius: 8, padding: "7px 9px", textDecoration: "none" }}
                                                >
                                                    <span style={{ flexShrink: 0, width: 18, height: 18, borderRadius: "50%", background: B.blueFaint, color: B.blue, fontSize: 10, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center" }}>
                                                        {i + 1}
                                                    </span>
                                                    <span style={{ flex: 1, minWidth: 0, fontSize: 12, fontWeight: 600, color: B.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                                        {stop.outlet_name}
                                                    </span>
                                                    <ExternalLink size={11} style={{ color: B.muted, flexShrink: 0 }} />
                                                </a>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            <button
                onClick={() => navigate("/audit/new")}
                style={{ marginTop: 12, width: "100%", background: "none", border: `1.5px solid ${B.blue}`, color: B.blue, borderRadius: 10, padding: "8px 0", fontSize: 12.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}
            >
                Start an Audit
            </button>
        </div>
    );
}
