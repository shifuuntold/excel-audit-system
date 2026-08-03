import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { canViewAllAudits } from "../utils/roles";
import { getAudits } from "../services/auditHistoryService";
import { getAreas, getAreaMap, resolveAreaName } from "../services/areaService";
import { getProfileMap } from "../services/profileService";
import { localIsoDate as isoDate, isOnLocalDate } from "../utils/format";
import { ALL_PRODUCT_GROUPS, auditHasProductGroup, totalProductsRecorded } from "../utils/productSummary";
import { flattenCompetitors } from "../utils/competitors";
import { COMPETITOR_CATEGORIES } from "../config/productCatalog";

import Header from "../components/layout/Header";
import PageContainer from "../components/layout/PageContainer";
import BottomNavigation from "../components/layout/BottomNavigation";
import AIAssistant from "../components/ai/AIAssistant";
import { SkeletonDashboard } from "../components/common/Skeleton";
import StatCard from "../components/dashboard/StatCard";
import TrendChart from "../components/dashboard/TrendChart";
import Input from "../components/common/Input";
import Select from "../components/common/Select";
import Button from "../components/common/Button";
import { B } from "../config/theme";
import {
    Users, MapPinned, ClipboardCheck, TrendingUp, Megaphone, ChevronRight,
    FileSpreadsheet, FileText, Lock,
} from "lucide-react";

function LeaderRow({ label, count, max, rank }) {
    const pct = max ? Math.max((count / max) * 100, 6) : 0;
    return (
        <div style={{ marginBottom: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 5 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                    {rank !== undefined && (
                        <div style={{
                            width: 22, height: 22, borderRadius: "50%", flexShrink: 0,
                            background: rank === 0 ? B.blue : B.blueFaint, color: rank === 0 ? "#fff" : B.blue,
                            display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10.5, fontWeight: 800,
                        }}>
                            {rank + 1}
                        </div>
                    )}
                    <span style={{ fontSize: 13, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {label}
                    </span>
                </div>
                <span style={{ fontSize: 12.5, fontWeight: 800, color: B.blue, flexShrink: 0 }}>{count}</span>
            </div>
            <div style={{ height: 6, background: B.blueFaint, borderRadius: 3, overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${pct}%`, background: B.blue, borderRadius: 3, transition: "width .3s ease" }} />
            </div>
        </div>
    );
}

const competitorCategoryLabels = Object.fromEntries(COMPETITOR_CATEGORIES.map((category) => [category.key, category.label]));

function SimpleTable({ columns, rows, emptyText = "No data in this range." }) {
    if (!rows.length) return <p style={{ color: B.muted, fontSize: 13, margin: 0 }}>{emptyText}</p>;
    return (
        <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
                <thead><tr>{columns.map((column) => <th key={column.key} style={{ textAlign: column.align || "left", color: B.muted, fontWeight: 700, padding: "0 8px 9px", whiteSpace: "nowrap" }}>{column.label}</th>)}</tr></thead>
                <tbody>{rows.map((row, index) => <tr key={row.id || row.name || index}>{columns.map((column) => <td key={column.key} style={{ padding: "9px 8px", borderTop: `1px solid ${B.border}`, color: B.text, textAlign: column.align || "left", whiteSpace: "nowrap" }}>{row[column.key]}</td>)}</tr>)}</tbody>
            </table>
        </div>
    );
}

export default function SupervisorDashboard() {
    const { profile } = useAuth();
    const navigate = useNavigate();

    const isSupervisor = canViewAllAudits(profile?.role);

    const [audits, setAudits] = useState([]);
    const [areas, setAreas] = useState([]);
    const [areaMap, setAreaMap] = useState({});
    const [profileMap, setProfileMap] = useState({});
    const [loading, setLoading] = useState(true);

    // Defaults to "all time" (no filter) rather than a trailing window —
    // narrowing the default silently hides historical audits and makes
    // it look like data or an auditor is missing when it's just outside
    // the visible range. The date pickers below still let you narrow it.
    const today = isoDate(new Date());
    const sevenDaysAgo = (() => { const d = new Date(); d.setDate(d.getDate() - 6); return isoDate(d); })();
    const monthStart = `${today.slice(0, 8)}01`;
    const [startDate, setStartDate] = useState(sevenDaysAgo);
    const [endDate, setEndDate] = useState(today);
    const [period, setPeriod] = useState("7days");
    const [areaId, setAreaId] = useState("");

    useEffect(() => {
        if (!isSupervisor) return;
        getAreas().then(setAreas).catch(console.error);
        getAreaMap().then(setAreaMap).catch(console.error);
        getProfileMap().then(setProfileMap).catch(console.error);
    }, [isSupervisor]);

    async function loadAudits() {
        setLoading(true);
        try {
            const data = await getAudits({
                allAudits: true,
                startDate: startDate || undefined,
                endDate: endDate || undefined,
                areaId: areaId || undefined,
                limit: 1000,
            });
            setAudits(data);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        if (!isSupervisor) return;
        // eslint-disable-next-line react-hooks/set-state-in-effect
        loadAudits();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isSupervisor, startDate, endDate, areaId]);

    function setQuickPeriod(nextPeriod) {
        setPeriod(nextPeriod);
        if (nextPeriod === "all") { setStartDate(""); setEndDate(""); return; }
        if (nextPeriod === "month") { setStartDate(monthStart); setEndDate(today); return; }
        setStartDate(sevenDaysAgo);
        setEndDate(today);
    }

    const stats = useMemo(() => {
        const repCounts = {};
        const areaCounts = {};
        const repMetrics = {};
        const coverageByArea = {};
        let promotionYes = 0;
        let visitedNo = 0;

        for (const a of audits) {
            const repName = profileMap[a.user_id]?.full_name || "Unknown Rep";
            repCounts[repName] = (repCounts[repName] || 0) + 1;
            if (!repMetrics[repName]) repMetrics[repName] = { name: repName, audits: 0, areas: new Set(), products: 0, lastActive: "" };
            repMetrics[repName].audits++;
            repMetrics[repName].products += totalProductsRecorded(a.products);
            if (!repMetrics[repName].lastActive || a.created_at > repMetrics[repName].lastActive) repMetrics[repName].lastActive = a.created_at;

            const area = resolveAreaName(a.outlet, areaMap);
            areaCounts[area] = (areaCounts[area] || 0) + 1;
            repMetrics[repName].areas.add(area);
            if (!coverageByArea[area]) coverageByArea[area] = { name: area, audits: 0, notVisited: 0 };
            coverageByArea[area].audits++;

            if (a.market?.promotion === "Yes") promotionYes++;
            if (a.market?.visited === "No") { visitedNo++; coverageByArea[area].notVisited++; }
        }

        const leaderboard = Object.entries(repCounts).sort((a, b) => b[1] - a[1]);
        const areaLeaderboard = Object.entries(areaCounts).sort((a, b) => b[1] - a[1]);
        const auditorPerformance = Object.values(repMetrics).map((rep) => ({
            ...rep,
            areas: rep.areas.size,
            lastActive: rep.lastActive ? new Date(rep.lastActive).toLocaleDateString([], { month: "short", day: "numeric" }) : "-",
        })).sort((a, b) => b.audits - a.audits);
        const areaCoverage = Object.values(coverageByArea).sort((a, b) => b.notVisited - a.notVisited || b.audits - a.audits);
        const productAvailability = ALL_PRODUCT_GROUPS.map((product) => {
            const outlets = audits.filter((audit) => auditHasProductGroup(audit.products, product.key)).length;
            const penetration = audits.length ? Math.round((outlets / audits.length) * 100) : 0;
            return { name: product.label, outlets, penetration, status: penetration >= 80 ? "Good" : penetration >= 50 ? "Moderate" : "Poor" };
        }).sort((a, b) => b.outlets - a.outlets).slice(0, 6);
        const competitorCounts = {};
        audits.flatMap((audit) => flattenCompetitors(audit.market)).forEach(({ category, name }) => {
            const key = category || "general";
            if (!competitorCounts[key]) competitorCounts[key] = {};
            competitorCounts[key][name] = (competitorCounts[key][name] || 0) + 1;
        });
        const topCompetitors = Object.entries(competitorCounts).map(([category, brands]) => {
            const [brand, outlets] = Object.entries(brands).sort((a, b) => b[1] - a[1])[0];
            return { category: competitorCategoryLabels[category] || (category === "general" ? "General" : category), brand, outlets, presence: audits.length ? Math.round((outlets / audits.length) * 100) : 0 };
        }).sort((a, b) => b.outlets - a.outlets).slice(0, 6);
        const recentActivity = [...audits].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 6).map((audit) => ({
            id: audit.id,
            outlet: audit.outlet?.shop_name || "Unnamed Outlet",
            area: resolveAreaName(audit.outlet, areaMap),
            auditor: profileMap[audit.user_id]?.full_name || "Unknown Auditor",
            time: new Date(audit.created_at).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }),
        }));
        const alerts = [];
        if (visitedNo > 0) alerts.push(`${visitedNo} outlet${visitedNo === 1 ? "" : "s"} were not previously visited by a sales representative.`);
        if (audits.length && promotionYes === 0) alerts.push("No promotional activity was reported in the selected range.");
        if (audits.length && promotionYes > 0 && (promotionYes / audits.length) < 0.1) alerts.push(`Promotional activity is low at ${Math.round((promotionYes / audits.length) * 100)}% of audited outlets.`);

        // day-by-day trend across the selected range, capped so the chart
        // doesn't get unreadably dense for long ranges
        const start = startDate ? new Date(startDate + "T00:00:00") : null;
        const end = endDate ? new Date(endDate + "T00:00:00") : null;
        let trend = [];
        if (start && end) {
            const days = Math.round((end - start) / 86400000) + 1;
            if (days > 0 && days <= 21) {
                trend = Array.from({ length: days }).map((_, i) => {
                    const d = new Date(start);
                    d.setDate(d.getDate() + i);
                    const dateStr = isoDate(d);
                    return { date: dateStr, count: audits.filter((a) => isOnLocalDate(a.created_at, dateStr)).length };
                });
            }
        }

        return {
            totalAudits: audits.length,
            activeReps: leaderboard.length,
            areasCovered: areaLeaderboard.length,
            leaderboard,
            areaLeaderboard,
            trend,
            promotionYes,
            visitedNo,
            visitedYes: audits.filter((a) => a.market?.visited === "Yes").length,
            registeredAuditors: Object.values(profileMap).filter((p) => p.role === "auditor").length,
            auditorPerformance,
            areaCoverage,
            productAvailability,
            topCompetitors,
            recentActivity,
            alerts,
        };
    }, [audits, profileMap, areaMap, startDate, endDate]);

    if (!isSupervisor) {
        return (
            <>
                <Header title="Team Dashboard" backTo="/dashboard" />
                <PageContainer withNav={false}>
                    <div
                        style={{
                            background: B.white,
                            borderRadius: 16,
                            border: `1px solid ${B.blueLight}`,
                            padding: 40,
                            textAlign: "center",
                        }}
                    >
                        <Lock size={32} style={{ color: B.muted, margin: "0 auto 12px" }} />
                        <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 6 }}>
                            Supervisor access required
                        </h2>
                        <p style={{ color: B.muted, fontSize: 13, margin: 0 }}>
                            This dashboard is only available to Supervisor or Admin accounts.
                        </p>
                        <Button variant="secondary" size="sm" onClick={() => navigate("/dashboard")} style={{ marginTop: 16 }}>
                            Back to Dashboard
                        </Button>
                    </div>
                </PageContainer>
            </>
        );
    }

    const topRepCount = stats.leaderboard[0]?.[1] || 0;
    const topAreaCount = stats.areaLeaderboard[0]?.[1] || 0;

    return (
        <>
            <Header title="Team Dashboard" subtitle="Team-wide audit overview" backTo="/dashboard" />

            <PageContainer>
                <button
                    onClick={() => navigate("/supervisor/coverage")}
                    style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: 12,
                        width: "100%",
                        background: `linear-gradient(135deg, ${B.blue}, ${B.blueMid})`,
                        color: "#fff",
                        border: 0,
                        borderRadius: 16,
                        padding: "16px 18px",
                        marginBottom: 20,
                        cursor: "pointer",
                        fontFamily: "inherit",
                        textAlign: "left",
                    }}
                >
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                        <div style={{ width: 38, height: 38, borderRadius: 10, background: "rgba(255,255,255,0.15)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                            <MapPinned size={19} />
                        </div>
                        <div>
                            <p style={{ margin: 0, fontSize: 14, fontWeight: 800 }}>Coverage Tracker</p>
                            <p style={{ margin: "2px 0 0", fontSize: 12, opacity: 0.85 }}>See which outlets need a follow-up visit today</p>
                        </div>
                    </div>
                    <ChevronRight size={18} style={{ flexShrink: 0, opacity: 0.85 }} />
                </button>

                <div
                    style={{
                        background: B.white,
                        borderRadius: 16,
                        border: `1px solid ${B.blueLight}`,
                        boxShadow: "0 2px 14px rgba(0,48,135,0.07)",
                        padding: 18,
                        marginBottom: 20,
                    }}
                >
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
                        {[ ["7days", "Last 7 Days"], ["month", "This Month"], ["all", "All Time"] ].map(([key, label]) => (
                            <button key={key} onClick={() => setQuickPeriod(key)} style={{ padding: "6px 12px", borderRadius: 18, border: `1px solid ${period === key ? B.blue : B.border}`, background: period === key ? B.blue : B.white, color: period === key ? B.white : B.muted, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>{label}</button>
                        ))}
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12 }}>
                        <Input label="From" type="date" value={startDate} onChange={(e) => { setStartDate(e.target.value); setPeriod("custom"); }} />
                        <Input label="To" type="date" value={endDate} onChange={(e) => { setEndDate(e.target.value); setPeriod("custom"); }} />
                        <Select label="Area" placeholder="All Areas" value={areaId} onChange={(e) => setAreaId(e.target.value)}>
                            {areas.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                        </Select>
                    </div>

                    <div style={{ display: "flex", gap: 10, marginTop: 16, flexWrap: "wrap" }}>
                        <Button
                            variant="secondary" size="sm" icon={FileSpreadsheet}
                            disabled={audits.length === 0}
                            onClick={async () => {
                                const { exportAuditsToExcel } = await import("../services/excelExport");
                                exportAuditsToExcel(audits, areaMap, `team-audits-${startDate}_to_${endDate}.xlsx`);
                            }}
                        >
                            Export Excel
                        </Button>
                        <Button
                            variant="secondary" size="sm" icon={FileText}
                            disabled={audits.length === 0}
                            onClick={async () => {
                                const { exportAuditsToPDF } = await import("../services/pdfExport");
                                exportAuditsToPDF(audits, areaMap, `team-audits-${startDate}_to_${endDate}.pdf`);
                            }}
                        >
                            Export PDF
                        </Button>
                    </div>
                    <p style={{ margin: "12px 0 0", fontSize: 12, color: B.muted, fontWeight: 600 }}>
                        Export scope: {startDate && endDate ? `${startDate} to ${endDate}` : "All time"} · {areaId ? "Selected area" : "All areas"}
                    </p>
                </div>

                {loading ? (
                    <SkeletonDashboard />
                ) : (
                    <>
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 14, marginBottom: 20 }}>
                            <StatCard title="Total Audits" value={stats.totalAudits} subtitle="In selected range" icon={ClipboardCheck} />
                            <StatCard title="Active Auditors" value={stats.activeReps} subtitle={`Submitted at least 1 audit · ${stats.registeredAuditors} registered`} icon={Users} />
                            <StatCard title="Areas Covered" value={stats.areasCovered} subtitle="Distinct areas visited" icon={MapPinned} />
                            <StatCard title="Promotions Observed" value={stats.promotionYes} subtitle={`${stats.promotionYes} of ${stats.totalAudits} outlets reported activity`} icon={Megaphone} />
                        </div>

                        <div style={{ background: B.white, borderRadius: 16, border: `1px solid ${B.blueLight}`, boxShadow: "0 2px 14px rgba(0,48,135,0.07)", padding: 18, marginBottom: 20 }}>
                            <h3 style={{ fontSize: 14, fontWeight: 700, margin: "0 0 10px" }}>Coverage Insights</h3>
                            <div style={{ display: "flex", gap: 18, flexWrap: "wrap", fontSize: 13 }}>
                                <span>Previously visited: <strong>{stats.visitedYes}</strong></span>
                                <span>New / not previously visited: <strong>{stats.visitedNo}</strong></span>
                                <span>Areas covered: <strong>{stats.areasCovered}</strong></span>
                            </div>
                        </div>

                        {stats.alerts.length > 0 && (
                            <div style={{ background: "#FFFBEB", borderRadius: 16, border: "1px solid #FDE68A", padding: 18, marginBottom: 20 }}>
                                <h3 style={{ fontSize: 14, fontWeight: 800, margin: "0 0 8px", color: "#92400E" }}>Management Alerts</h3>
                                <ul style={{ margin: 0, paddingLeft: 18, display: "flex", flexDirection: "column", gap: 5 }}>
                                    {stats.alerts.map((alert) => <li key={alert} style={{ fontSize: 13, color: "#78350F", lineHeight: 1.5 }}>{alert}</li>)}
                                </ul>
                            </div>
                        )}

                        <div
                            style={{
                                background: B.white,
                                borderRadius: 16,
                                border: `1px solid ${B.blueLight}`,
                                boxShadow: "0 2px 14px rgba(0,48,135,0.07)",
                                padding: 20,
                                marginBottom: 20,
                            }}
                        >
                            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
                                <TrendingUp size={16} style={{ color: B.blue }} />
                                <h3 style={{ fontSize: 14, fontWeight: 700, margin: 0, color: B.text }}>
                                    Audits Over Time · Whole Team
                                </h3>
                            </div>
                            {stats.trend.length > 0 ? (
                                <TrendChart data={stats.trend} />
                            ) : (
                                <p style={{ fontSize: 12.5, color: B.muted, margin: 0 }}>
                                    Pick a From/To date range of 21 days or fewer above to see the day-by-day trend here.
                                </p>
                            )}
                        </div>

                        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16 }}>
                            <div style={{ background: B.white, borderRadius: 16, border: `1px solid ${B.blueLight}`, boxShadow: "0 2px 14px rgba(0,48,135,0.07)", padding: 20 }}>
                                <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 16 }}>Auditor Leaderboard</h3>
                                {stats.leaderboard.length === 0 ? (
                                    <p style={{ color: B.muted, fontSize: 13 }}>No audits in this range.</p>
                                ) : (
                                    stats.leaderboard.map(([name, count], i) => (
                                        <LeaderRow key={name} label={name} count={count} max={topRepCount} rank={i} />
                                    ))
                                )}
                            </div>

                            <div style={{ background: B.white, borderRadius: 16, border: `1px solid ${B.blueLight}`, boxShadow: "0 2px 14px rgba(0,48,135,0.07)", padding: 20 }}>
                                <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 16 }}>Area Coverage</h3>
                                {stats.areaLeaderboard.length === 0 ? (
                                    <p style={{ color: B.muted, fontSize: 13 }}>No audits in this range.</p>
                                ) : (
                                    stats.areaLeaderboard.map(([name, count]) => (
                                        <LeaderRow key={name} label={name} count={count} max={topAreaCount} />
                                    ))
                                )}
                            </div>
                        </div>

                        <div style={{ background: B.white, borderRadius: 16, border: `1px solid ${B.blueLight}`, boxShadow: "0 2px 14px rgba(0,48,135,0.07)", padding: 20, marginTop: 16 }}>
                            <h3 style={{ fontSize: 14, fontWeight: 700, margin: "0 0 16px" }}>Auditor Performance</h3>
                            <SimpleTable
                                columns={[{ key: "name", label: "Auditor" }, { key: "audits", label: "Audits", align: "right" }, { key: "areas", label: "Areas", align: "right" }, { key: "products", label: "Products", align: "right" }, { key: "lastActive", label: "Last Active", align: "right" }]}
                                rows={stats.auditorPerformance}
                            />
                        </div>

                        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 16, marginTop: 16 }}>
                            <div style={{ background: B.white, borderRadius: 16, border: `1px solid ${B.blueLight}`, boxShadow: "0 2px 14px rgba(0,48,135,0.07)", padding: 20 }}>
                                <h3 style={{ fontSize: 14, fontWeight: 700, margin: "0 0 16px" }}>Coverage Gaps by Area</h3>
                                <SimpleTable
                                    columns={[{ key: "name", label: "Area" }, { key: "audits", label: "Audits", align: "right" }, { key: "notVisited", label: "Not Previously Visited", align: "right" }]}
                                    rows={stats.areaCoverage}
                                />
                            </div>
                            <div style={{ background: B.white, borderRadius: 16, border: `1px solid ${B.blueLight}`, boxShadow: "0 2px 14px rgba(0,48,135,0.07)", padding: 20 }}>
                                <h3 style={{ fontSize: 14, fontWeight: 700, margin: "0 0 16px" }}>Product Availability</h3>
                                <SimpleTable
                                    columns={[{ key: "name", label: "Product" }, { key: "outlets", label: "Outlets", align: "right" }, { key: "penetration", label: "Penetration", align: "right" }, { key: "status", label: "Status", align: "right" }]}
                                    rows={stats.productAvailability.map((product) => ({ ...product, penetration: `${product.penetration}%` }))}
                                />
                            </div>
                        </div>

                        <div style={{ background: B.white, borderRadius: 16, border: `1px solid ${B.blueLight}`, boxShadow: "0 2px 14px rgba(0,48,135,0.07)", padding: 20, marginTop: 16 }}>
                            <h3 style={{ fontSize: 14, fontWeight: 700, margin: "0 0 16px" }}>Competitive Landscape</h3>
                            <SimpleTable
                                columns={[{ key: "category", label: "Category" }, { key: "brand", label: "Top Competitor" }, { key: "outlets", label: "Outlets", align: "right" }, { key: "presence", label: "Presence", align: "right" }]}
                                rows={stats.topCompetitors.map((competitor) => ({ ...competitor, presence: `${competitor.presence}%` }))}
                                emptyText="No competitor data recorded in this range."
                            />
                        </div>

                        <div style={{ background: B.white, borderRadius: 16, border: `1px solid ${B.blueLight}`, boxShadow: "0 2px 14px rgba(0,48,135,0.07)", padding: 20, marginTop: 16 }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, marginBottom: 12 }}>
                                <h3 style={{ fontSize: 14, fontWeight: 700, margin: 0 }}>Recent Activity</h3>
                                <button onClick={() => navigate("/audits/history?preset=all")} style={{ border: 0, background: "transparent", color: B.blue, cursor: "pointer", fontWeight: 700, fontFamily: "inherit", fontSize: 12 }}>View all audits</button>
                            </div>
                            {stats.recentActivity.length === 0 ? <p style={{ color: B.muted, fontSize: 13, margin: 0 }}>No recent audits in this range.</p> : (
                                <div style={{ display: "flex", flexDirection: "column" }}>
                                    {stats.recentActivity.map((activity) => (
                                        <button key={activity.id} onClick={() => navigate(`/audit/${activity.id}`)} style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", border: 0, borderTop: `1px solid ${B.border}`, padding: "11px 0", background: "transparent", cursor: "pointer", fontFamily: "inherit", textAlign: "left" }}>
                                            <span style={{ minWidth: 0 }}><strong style={{ display: "block", fontSize: 13, color: B.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{activity.outlet}</strong><span style={{ fontSize: 12, color: B.muted }}>{activity.auditor} · {activity.area}</span></span>
                                            <span style={{ fontSize: 11.5, color: B.muted, whiteSpace: "nowrap" }}>{activity.time}</span>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    </>
                )}
            </PageContainer>

            <BottomNavigation />
            <AIAssistant pageContext="team" />
        </>
    );
}
