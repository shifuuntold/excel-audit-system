import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../hooks/useAuth";
import { canViewAllAudits } from "../utils/roles";
import { getOutletCoverage, getAuditorCoverage } from "../services/coverageService";
import { getAreas } from "../services/areaService";
import { getAllAssignments, createAssignment, deleteAssignment } from "../services/assignmentService";
import { nearestNeighborRoute, routeSummary } from "../utils/routePlanning";
import { localIsoDate as isoDate } from "../utils/format";

import Header from "../components/layout/Header";
import PageContainer from "../components/layout/PageContainer";
import BottomNavigation from "../components/layout/BottomNavigation";
import Select from "../components/common/Select";
import { SkeletonAuditList, SkeletonBlock } from "../components/common/Skeleton";
import { B } from "../config/theme";
import { AlertTriangle, MapPin, Clock, Users, CheckCircle2, Info, Lock, ClipboardList, X, UserPlus, Navigation, ExternalLink } from "lucide-react";

const STALE_DAYS = 30;
const AT_RISK_DAYS = 14;
const STATUS_COLOR = {
    Pending: { color: B.muted, bg: B.blueFaint },
    "In Progress": { color: B.blue, bg: B.blueFaint },
    Completed: { color: B.green, bg: "#ECFDF5" },
    Overdue: { color: B.red, bg: B.redLight },
};

export default function CoverageTracker() {
    const { user, profile } = useAuth();
    const canView = canViewAllAudits(profile?.role);

    const [outlets, setOutlets] = useState([]);
    const [auditors, setAuditors] = useState([]);
    const [areas, setAreas] = useState([]);
    const [assignments, setAssignments] = useState([]);
    const [areaFilter, setAreaFilter] = useState("");
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const [assigningOutlet, setAssigningOutlet] = useState(null); // the outlet row currently showing the assign form
    const [assignAuditorId, setAssignAuditorId] = useState("");
    const [assignDueDate, setAssignDueDate] = useState("");
    const [assignPriority, setAssignPriority] = useState("Medium");
    const [savingAssignment, setSavingAssignment] = useState(false);

    const today = isoDate(new Date());

    async function loadAll() {
        setLoading(true);
        setError(null);
        try {
            const [outletData, auditorData, areaData, assignmentData] = await Promise.all([
                getOutletCoverage(),
                getAuditorCoverage({ startDate: today, endDate: today }),
                getAreas(),
                getAllAssignments(),
            ]);
            setOutlets(outletData);
            setAuditors(auditorData);
            setAreas(areaData);
            setAssignments(assignmentData);
        } catch (err) {
            console.error(err);
            setError("Couldn't load coverage data. Please try again.");
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        if (!canView) return;
        // eslint-disable-next-line react-hooks/set-state-in-effect
        loadAll();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [canView]);

    function openAssignForm(outlet) {
        setAssigningOutlet(outlet);
        setAssignAuditorId("");
        setAssignDueDate("");
        setAssignPriority("Medium");
    }

    async function submitAssignment() {
        if (!assignAuditorId || !assigningOutlet) return;
        setSavingAssignment(true);
        try {
            await createAssignment({
                outletName: assigningOutlet.outlet_name,
                area: assigningOutlet.area,
                assignedTo: assignAuditorId,
                assignedBy: user.id,
                dueDate: assignDueDate,
                priority: assignPriority,
            });
            setAssigningOutlet(null);
            const fresh = await getAllAssignments();
            setAssignments(fresh);
        } catch (err) {
            console.error(err);
            alert("Couldn't create that assignment. Please try again.");
        } finally {
            setSavingAssignment(false);
        }
    }

    async function cancelAssignment(id) {
        if (!confirm("Cancel this assignment?")) return;
        try {
            await deleteAssignment(id);
            setAssignments((prev) => prev.filter((a) => a.id !== id));
        } catch (err) {
            console.error(err);
            alert("Couldn't cancel that assignment.");
        }
    }

    const [route, setRoute] = useState(null);
    const [buildingRoute, setBuildingRoute] = useState(false);
    const [routeError, setRouteError] = useState(null);

    function buildRoute() {
        setBuildingRoute(true);
        setRouteError(null);
        setRoute(null);

        const routable = staleOutlets
            .map((o) => {
                const lat = parseFloat(o.coordinates?.latitude);
                const lng = parseFloat(o.coordinates?.longitude);
                if (Number.isNaN(lat) || Number.isNaN(lng)) return null;
                return { ...o, latitude: lat, longitude: lng };
            })
            .filter(Boolean);

        if (routable.length === 0) {
            setRouteError("None of the outlets needing attention have a recorded location yet, so a route can't be suggested.");
            setBuildingRoute(false);
            return;
        }

        function computeFrom(start) {
            const ordered = nearestNeighborRoute(start, routable);
            setRoute({ stops: ordered, summary: routeSummary(ordered) });
            setBuildingRoute(false);
        }

        if ("geolocation" in navigator) {
            navigator.geolocation.getCurrentPosition(
                (pos) => computeFrom({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
                () => {
                    // Permission denied or unavailable — fall back to the
                    // centroid of the routable outlets as a reasonable start.
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
    }

    const filteredOutlets = useMemo(() => {
        if (!areaFilter) return outlets;
        return outlets.filter((o) => o.area === areaFilter);
    }, [outlets, areaFilter]);

    const assignmentBoard = useMemo(() => {
        const byAuditor = {};
        for (const a of assignments) {
            if (!byAuditor[a.assigned_to]) {
                const auditor = auditors.find((x) => x.auditor_id === a.assigned_to);
                byAuditor[a.assigned_to] = { auditorId: a.assigned_to, name: auditor?.auditor_name || "Unknown Auditor", assigned: 0, completed: 0 };
            }
            byAuditor[a.assigned_to].assigned++;
            if (a.status === "Completed") byAuditor[a.assigned_to].completed++;
        }
        return Object.values(byAuditor)
            .map((row) => ({ ...row, remaining: row.assigned - row.completed, rate: row.assigned ? Math.round((row.completed / row.assigned) * 100) : 0 }))
            .sort((a, b) => b.assigned - a.assigned);
    }, [assignments, auditors]);

    const visitedToday = filteredOutlets.filter((o) => o.last_visit_date === today).length;
    const staleOutlets = filteredOutlets
        .filter((o) => (o.days_since_last_visit ?? 0) >= AT_RISK_DAYS)
        .sort((a, b) => (b.days_since_last_visit ?? 0) - (a.days_since_last_visit ?? 0));
    const activeAuditorsToday = auditors.filter((a) => (a.audit_count ?? 0) > 0).length;

    function priorityFor(days) {
        if (days >= STALE_DAYS) return { label: "High", color: B.red, bg: B.redLight };
        if (days >= AT_RISK_DAYS) return { label: "Medium", color: B.amber, bg: "#FFFBEB" };
        return { label: "Low", color: B.muted, bg: B.blueFaint };
    }

    if (!canView) {
        return (
            <>
                <Header title="Coverage Tracker" backTo="/dashboard" />
                <PageContainer withNav={false}>
                    <div style={{ background: B.white, borderRadius: 16, border: `1px solid ${B.blueLight}`, padding: 40, textAlign: "center" }}>
                        <Lock size={32} style={{ color: B.muted, margin: "0 auto 12px" }} />
                        <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 6 }}>Supervisor access required</h2>
                        <p style={{ color: B.muted, fontSize: 13, margin: 0 }}>
                            This page is only available to Supervisor and Admin accounts.
                        </p>
                    </div>
                </PageContainer>
            </>
        );
    }

    return (
        <>
            <Header title="Coverage Tracker" subtitle="Field execution status" backTo="/supervisor" />
            <PageContainer withNav={false}>
                {/* This system doesn't have a master outlet list — an outlet only
                    exists once someone audits it, so "outlets never audited" can't
                    be shown here. What follows covers everything that's actually
                    knowable from audit history: visit recency and staleness. */}
                <div style={{ display: "flex", gap: 8, alignItems: "flex-start", background: B.blueFaint, border: `1px solid ${B.blueLight}`, borderRadius: 12, padding: 12, marginBottom: 16 }}>
                    <Info size={15} style={{ color: B.blue, flexShrink: 0, marginTop: 1 }} />
                    <p style={{ margin: 0, fontSize: 11.5, color: B.blue, lineHeight: 1.5 }}>
                        Outlets are created the first time they're audited — there's no master outlet list yet,
                        so this tracks visit recency for outlets with audit history, not outlets never yet seen.
                    </p>
                </div>

                <Select
                    label="Area"
                    placeholder="All areas"
                    value={areaFilter}
                    onChange={(e) => setAreaFilter(e.target.value)}
                    style={{ marginBottom: 18 }}
                >
                    {areas.map((a) => <option key={a.id} value={a.name}>{a.name}</option>)}
                </Select>

                {loading ? (
                    <>
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 12, marginBottom: 20 }}>
                            {Array.from({ length: 3 }).map((_, i) => <SkeletonBlock key={i} height={70} radius={14} />)}
                        </div>
                        <SkeletonAuditList count={3} />
                    </>
                ) : error ? (
                    <div style={{ background: B.redLight, border: "1px solid #FCA5A5", borderRadius: 12, padding: 16 }}>
                        <p style={{ margin: 0, fontSize: 13, color: B.red }}>{error}</p>
                    </div>
                ) : (
                    <>
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 12, marginBottom: 22 }}>
                            <StatCard icon={CheckCircle2} label="Visited Today" value={visitedToday} color={B.green} />
                            <StatCard icon={AlertTriangle} label="Need Follow-Up" value={staleOutlets.length} color={B.red} />
                            <StatCard icon={Users} label="Auditors Active Today" value={activeAuditorsToday} color={B.blue} />
                        </div>

                        <SectionHeading icon={AlertTriangle}>Outlets Requiring Attention</SectionHeading>
                        {staleOutlets.length === 0 ? (
                            <EmptyState text="No outlets are overdue — every audited outlet has been visited within the last 14 days." />
                        ) : (
                            <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 26 }}>
                                {staleOutlets.slice(0, 30).map((o) => {
                                    const priority = priorityFor(o.days_since_last_visit ?? 0);
                                    const isAssigning = assigningOutlet?.outlet_key === o.outlet_key;
                                    return (
                                        <div
                                            key={o.outlet_key}
                                            style={{
                                                background: B.white,
                                                border: `1px solid ${B.blueLight}`,
                                                borderRadius: 12,
                                                padding: 14,
                                            }}
                                        >
                                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
                                                <div style={{ minWidth: 0 }}>
                                                    <p style={{ margin: 0, fontSize: 13.5, fontWeight: 700, color: B.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                                        {o.outlet_name || "Unnamed Outlet"}
                                                    </p>
                                                    <p style={{ margin: "3px 0 0", fontSize: 11.5, color: B.muted, display: "flex", alignItems: "center", gap: 4 }}>
                                                        <MapPin size={11} /> {o.area || "Unknown area"}
                                                        <span style={{ margin: "0 2px" }}>·</span>
                                                        <Clock size={11} /> {o.days_since_last_visit} days ago
                                                    </p>
                                                </div>
                                                <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                                                    <span style={{ fontSize: 10.5, fontWeight: 700, color: priority.color, background: priority.bg, padding: "3px 10px", borderRadius: 20 }}>
                                                        {priority.label}
                                                    </span>
                                                    <button
                                                        onClick={() => (isAssigning ? setAssigningOutlet(null) : openAssignForm(o))}
                                                        style={{ display: "flex", alignItems: "center", gap: 4, background: B.blueFaint, color: B.blue, border: 0, borderRadius: 8, padding: "5px 9px", fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}
                                                    >
                                                        <UserPlus size={12} /> Assign
                                                    </button>
                                                </div>
                                            </div>

                                            {isAssigning && (
                                                <div style={{ marginTop: 12, paddingTop: 12, borderTop: `1px solid ${B.blueLight}`, display: "flex", flexDirection: "column", gap: 8 }}>
                                                    <Select label="Assign to" placeholder="Select auditor" value={assignAuditorId} onChange={(e) => setAssignAuditorId(e.target.value)}>
                                                        {auditors.map((a) => <option key={a.auditor_id} value={a.auditor_id}>{a.auditor_name}</option>)}
                                                    </Select>
                                                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                                                        <div>
                                                            <label style={{ fontSize: 11, fontWeight: 600, color: B.muted, display: "block", marginBottom: 4 }}>Due date</label>
                                                            <input type="date" className="eb-input" value={assignDueDate} onChange={(e) => setAssignDueDate(e.target.value)} style={{ fontSize: 13 }} />
                                                        </div>
                                                        <Select label="Priority" value={assignPriority} onChange={(e) => setAssignPriority(e.target.value)}>
                                                            <option value="High">High</option>
                                                            <option value="Medium">Medium</option>
                                                            <option value="Low">Low</option>
                                                        </Select>
                                                    </div>
                                                    <button
                                                        onClick={submitAssignment}
                                                        disabled={!assignAuditorId || savingAssignment}
                                                        style={{ background: B.blue, color: "#fff", border: 0, borderRadius: 8, padding: "8px 0", fontSize: 12.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", opacity: !assignAuditorId || savingAssignment ? 0.6 : 1 }}
                                                    >
                                                        {savingAssignment ? "Assigning..." : "Confirm Assignment"}
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                                {staleOutlets.length > 30 && (
                                    <p style={{ fontSize: 11.5, color: B.muted, textAlign: "center", margin: 0 }}>
                                        + {staleOutlets.length - 30} more
                                    </p>
                                )}
                            </div>
                        )}

                        <SectionHeading icon={Navigation}>Suggested Route</SectionHeading>
                        {!route && !buildingRoute && (
                            <div style={{ marginBottom: 26 }}>
                                <button
                                    onClick={buildRoute}
                                    disabled={staleOutlets.length === 0}
                                    style={{
                                        display: "flex", alignItems: "center", gap: 8, width: "100%",
                                        background: staleOutlets.length === 0 ? B.blueLight : B.blue,
                                        color: "#fff", border: 0, borderRadius: 12, padding: "12px 16px",
                                        fontSize: 13, fontWeight: 700, cursor: staleOutlets.length === 0 ? "default" : "pointer",
                                        fontFamily: "inherit", justifyContent: "center",
                                    }}
                                >
                                    <Navigation size={15} /> Build Route From My Location
                                </button>
                                <p style={{ fontSize: 11, color: B.muted, margin: "6px 0 0", textAlign: "center" }}>
                                    Orders overdue outlets by proximity — straight-line distance, not live traffic.
                                </p>
                            </div>
                        )}

                        {buildingRoute && (
                            <div style={{ marginBottom: 26 }}>
                                <SkeletonBlock height={60} radius={12} />
                            </div>
                        )}

                        {routeError && (
                            <div style={{ background: B.blueFaint, borderRadius: 12, padding: 16, marginBottom: 26 }}>
                                <p style={{ margin: 0, fontSize: 12.5, color: B.muted }}>{routeError}</p>
                            </div>
                        )}

                        {route && (
                            <div style={{ marginBottom: 26 }}>
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                                    <p style={{ margin: 0, fontSize: 12, color: B.muted }}>
                                        {route.stops.length} stops · ~{route.summary.totalKm} km · ~{route.summary.estimatedMinutes} min driving
                                    </p>
                                    <button onClick={() => setRoute(null)} style={{ background: "none", border: 0, color: B.blue, fontSize: 11.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
                                        Rebuild
                                    </button>
                                </div>
                                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                                    {route.stops.map((stop, i) => (
                                        <a
                                            key={stop.outlet_key}
                                            href={`https://www.google.com/maps?q=${stop.latitude},${stop.longitude}`}
                                            target="_blank"
                                            rel="noreferrer"
                                            style={{ display: "flex", alignItems: "center", gap: 10, background: B.white, border: `1px solid ${B.blueLight}`, borderRadius: 12, padding: "10px 12px", textDecoration: "none" }}
                                        >
                                            <span style={{ flexShrink: 0, width: 22, height: 22, borderRadius: "50%", background: B.blueFaint, color: B.blue, fontSize: 11, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center" }}>
                                                {i + 1}
                                            </span>
                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: B.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                                    {stop.outlet_name}
                                                </p>
                                                <p style={{ margin: "1px 0 0", fontSize: 11, color: B.muted }}>
                                                    {stop.legDistanceKm} km from previous stop
                                                </p>
                                            </div>
                                            <ExternalLink size={13} style={{ color: B.muted, flexShrink: 0 }} />
                                        </a>
                                    ))}
                                </div>
                            </div>
                        )}

                        <SectionHeading icon={Users}>Today's Auditor Activity</SectionHeading>
                        {auditors.every((a) => (a.audit_count ?? 0) === 0) ? (
                            <EmptyState text="No audits have been submitted yet today." />
                        ) : (
                            <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 26 }}>
                                {auditors
                                    .slice()
                                    .sort((a, b) => (b.audit_count ?? 0) - (a.audit_count ?? 0))
                                    .map((a) => (
                                        <div
                                            key={a.auditor_id}
                                            style={{
                                                background: B.white,
                                                border: `1px solid ${B.blueLight}`,
                                                borderRadius: 12,
                                                padding: "12px 14px",
                                                display: "flex",
                                                justifyContent: "space-between",
                                                alignItems: "center",
                                                gap: 10,
                                            }}
                                        >
                                            <span style={{ fontSize: 13, fontWeight: 600, color: B.text }}>{a.auditor_name}</span>
                                            <span style={{ fontSize: 12.5, fontWeight: 700, color: (a.audit_count ?? 0) > 0 ? B.green : B.muted }}>
                                                {a.audit_count ?? 0} audit{(a.audit_count ?? 0) === 1 ? "" : "s"} today
                                            </span>
                                        </div>
                                    ))}
                            </div>
                        )}

                        <SectionHeading icon={ClipboardList}>Daily Assignment Board</SectionHeading>
                        {assignmentBoard.length === 0 ? (
                            <EmptyState text="No outlets have been assigned yet — use 'Assign' above to start building today's board." />
                        ) : (
                            <div style={{ overflowX: "auto", marginBottom: 20 }}>
                                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
                                    <thead>
                                        <tr>
                                            {["Auditor", "Assigned", "Completed", "Remaining", "Completion"].map((h) => (
                                                <th key={h} style={{ textAlign: "left", padding: "6px 10px 6px 0", fontSize: 10.5, fontWeight: 700, color: B.muted, textTransform: "uppercase", borderBottom: `1px solid ${B.blueLight}` }}>
                                                    {h}
                                                </th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {assignmentBoard.map((row) => (
                                            <tr key={row.auditorId}>
                                                <td style={{ padding: "8px 10px 8px 0", borderBottom: `1px solid ${B.blueLight}`, fontWeight: 600, color: B.text }}>{row.name}</td>
                                                <td style={{ padding: "8px 10px 8px 0", borderBottom: `1px solid ${B.blueLight}` }}>{row.assigned}</td>
                                                <td style={{ padding: "8px 10px 8px 0", borderBottom: `1px solid ${B.blueLight}`, color: B.green, fontWeight: 600 }}>{row.completed}</td>
                                                <td style={{ padding: "8px 10px 8px 0", borderBottom: `1px solid ${B.blueLight}`, color: row.remaining > 0 ? B.amber : B.muted, fontWeight: 600 }}>{row.remaining}</td>
                                                <td style={{ padding: "8px 10px 8px 0", borderBottom: `1px solid ${B.blueLight}`, fontWeight: 700, color: B.blue }}>{row.rate}%</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}

                        {assignments.length > 0 && (
                            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                                {assignments.slice(0, 20).map((a) => {
                                    const auditor = auditors.find((x) => x.auditor_id === a.assigned_to);
                                    const statusStyle = STATUS_COLOR[a.status] || STATUS_COLOR.Pending;
                                    return (
                                        <div key={a.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, background: B.white, border: `1px solid ${B.blueLight}`, borderRadius: 10, padding: "10px 12px" }}>
                                            <div style={{ minWidth: 0 }}>
                                                <p style={{ margin: 0, fontSize: 12.5, fontWeight: 600, color: B.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                                    {a.outlet_name} {auditor ? `· ${auditor.auditor_name}` : ""}
                                                </p>
                                                <p style={{ margin: "2px 0 0", fontSize: 11, color: B.muted }}>
                                                    {a.due_date ? `Due ${a.due_date}` : "No due date"}
                                                </p>
                                            </div>
                                            <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
                                                <span style={{ fontSize: 10.5, fontWeight: 700, color: statusStyle.color, background: statusStyle.bg, padding: "3px 9px", borderRadius: 20 }}>
                                                    {a.status}
                                                </span>
                                                <button onClick={() => cancelAssignment(a.id)} title="Cancel assignment" style={{ background: "none", border: 0, color: B.muted, cursor: "pointer", display: "flex" }}>
                                                    <X size={13} />
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </>
                )}
            </PageContainer>

            <BottomNavigation />
        </>
    );
}

function StatCard({ icon: Icon, label, value, color }) {
    return (
        <div style={{ background: B.white, border: `1px solid ${B.blueLight}`, borderRadius: 14, padding: 14 }}>
            <Icon size={16} style={{ color }} />
            <p style={{ margin: "8px 0 0", fontSize: 20, fontWeight: 800, color: B.text }}>{value}</p>
            <p style={{ margin: "2px 0 0", fontSize: 11, color: B.muted, fontWeight: 600 }}>{label}</p>
        </div>
    );
}

function SectionHeading({ icon: Icon, children }) {
    return (
        <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 12 }}>
            <Icon size={15} style={{ color: B.blue }} />
            <h2 style={{ fontSize: 14, fontWeight: 700, color: B.text, margin: 0 }}>{children}</h2>
        </div>
    );
}

function EmptyState({ text }) {
    return (
        <div style={{ background: B.blueFaint, borderRadius: 12, padding: 20, textAlign: "center", marginBottom: 26 }}>
            <p style={{ margin: 0, fontSize: 12.5, color: B.muted }}>{text}</p>
        </div>
    );
}
