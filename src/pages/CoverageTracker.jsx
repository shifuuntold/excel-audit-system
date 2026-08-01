import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../hooks/useAuth";
import { canViewAllAudits } from "../utils/roles";
import { getOutletCoverage, getAuditorCoverage } from "../services/coverageService";
import { getAreas } from "../services/areaService";
import { localIsoDate as isoDate } from "../utils/format";

import Header from "../components/layout/Header";
import PageContainer from "../components/layout/PageContainer";
import BottomNavigation from "../components/layout/BottomNavigation";
import Select from "../components/common/Select";
import { SkeletonAuditList, SkeletonBlock } from "../components/common/Skeleton";
import { B } from "../config/theme";
import { AlertTriangle, MapPin, Clock, Users, CheckCircle2, Info, Lock } from "lucide-react";

const STALE_DAYS = 30;
const AT_RISK_DAYS = 14;

export default function CoverageTracker() {
    const { profile } = useAuth();
    const canView = canViewAllAudits(profile?.role);

    const [outlets, setOutlets] = useState([]);
    const [auditors, setAuditors] = useState([]);
    const [areas, setAreas] = useState([]);
    const [areaFilter, setAreaFilter] = useState("");
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const today = isoDate(new Date());

    useEffect(() => {
        if (!canView) return;
        let cancelled = false;
        async function load() {
            setLoading(true);
            setError(null);
            try {
                const [outletData, auditorData, areaData] = await Promise.all([
                    getOutletCoverage(),
                    getAuditorCoverage({ startDate: today, endDate: today }),
                    getAreas(),
                ]);
                if (cancelled) return;
                setOutlets(outletData);
                setAuditors(auditorData);
                setAreas(areaData);
            } catch (err) {
                console.error(err);
                if (!cancelled) setError("Couldn't load coverage data. Please try again.");
            } finally {
                if (!cancelled) setLoading(false);
            }
        }
        load();
        return () => { cancelled = true; };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [canView]);

    const filteredOutlets = useMemo(() => {
        if (!areaFilter) return outlets;
        return outlets.filter((o) => o.area === areaFilter);
    }, [outlets, areaFilter]);

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
                                    return (
                                        <div
                                            key={o.outlet_key}
                                            style={{
                                                background: B.white,
                                                border: `1px solid ${B.blueLight}`,
                                                borderRadius: 12,
                                                padding: 14,
                                                display: "flex",
                                                justifyContent: "space-between",
                                                alignItems: "flex-start",
                                                gap: 10,
                                            }}
                                        >
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
                                            <span style={{ flexShrink: 0, fontSize: 10.5, fontWeight: 700, color: priority.color, background: priority.bg, padding: "3px 10px", borderRadius: 20 }}>
                                                {priority.label}
                                            </span>
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

                        <SectionHeading icon={Users}>Today's Auditor Activity</SectionHeading>
                        {auditors.every((a) => (a.audit_count ?? 0) === 0) ? (
                            <EmptyState text="No audits have been submitted yet today." />
                        ) : (
                            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
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
