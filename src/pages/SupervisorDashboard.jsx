import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { canViewAllAudits } from "../utils/roles";
import { getAudits } from "../services/auditHistoryService";
import { getAreas, getAreaMap, resolveAreaName } from "../services/areaService";
import { getProfileMap } from "../services/profileService";

import Header from "../components/layout/Header";
import PageContainer from "../components/layout/PageContainer";
import BottomNavigation from "../components/layout/BottomNavigation";
import LoadingSpinner from "../components/common/LoadingSpinner";
import StatCard from "../components/dashboard/StatCard";
import TrendChart from "../components/dashboard/TrendChart";
import Input from "../components/common/Input";
import Select from "../components/common/Select";
import Button from "../components/common/Button";
import { B } from "../config/theme";
import {
    Users, MapPinned, ClipboardCheck, TrendingUp, Megaphone,
    FileSpreadsheet, FileText, Lock,
} from "lucide-react";

function isoDate(d) { return d.toISOString().split("T")[0]; }

function initials(name) {
    if (!name) return "?";
    const parts = name.trim().split(/\s+/);
    return ((parts[0]?.[0] || "") + (parts[1]?.[0] || "")).toUpperCase();
}

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

export default function SupervisorDashboard() {
    const { profile } = useAuth();
    const navigate = useNavigate();

    const isSupervisor = canViewAllAudits(profile?.role);

    const [audits, setAudits] = useState([]);
    const [areas, setAreas] = useState([]);
    const [areaMap, setAreaMap] = useState({});
    const [profileMap, setProfileMap] = useState({});
    const [loading, setLoading] = useState(true);

    const [startDate, setStartDate] = useState(() => {
        const d = new Date();
        d.setDate(d.getDate() - 6);
        return isoDate(d);
    });
    const [endDate, setEndDate] = useState(isoDate(new Date()));
    const [areaId, setAreaId] = useState("");

    useEffect(() => {
        if (!isSupervisor) return;
        getAreas().then(setAreas).catch(console.error);
        getAreaMap().then(setAreaMap).catch(console.error);
        getProfileMap().then(setProfileMap).catch(console.error);
        // eslint-disable-next-line react-hooks/exhaustive-deps
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
        loadAudits();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isSupervisor, startDate, endDate, areaId]);

    const stats = useMemo(() => {
        const repCounts = {};
        const areaCounts = {};
        let promotionYes = 0;
        let visitedNo = 0;

        for (const a of audits) {
            const repName = profileMap[a.user_id]?.full_name || "Unknown Rep";
            repCounts[repName] = (repCounts[repName] || 0) + 1;

            const area = resolveAreaName(a.outlet, areaMap);
            areaCounts[area] = (areaCounts[area] || 0) + 1;

            if (a.market?.promotion === "Yes") promotionYes++;
            if (a.market?.visited === "No") visitedNo++;
        }

        const leaderboard = Object.entries(repCounts).sort((a, b) => b[1] - a[1]);
        const areaLeaderboard = Object.entries(areaCounts).sort((a, b) => b[1] - a[1]);

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
                    return { date: dateStr, count: audits.filter((a) => a.created_at.startsWith(dateStr)).length };
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
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12 }}>
                        <Input label="From" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
                        <Input label="To" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
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
                </div>

                {loading ? (
                    <LoadingSpinner label="Loading team data..." />
                ) : (
                    <>
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 14, marginBottom: 20 }}>
                            <StatCard title="Total Audits" value={stats.totalAudits} subtitle="In selected range" icon={ClipboardCheck} />
                            <StatCard title="Active Auditors" value={stats.activeReps} subtitle="Submitted at least 1 audit" icon={Users} />
                            <StatCard title="Areas Covered" value={stats.areasCovered} subtitle="Distinct areas visited" icon={MapPinned} />
                            <StatCard title="Promotions Observed" value={stats.promotionYes} subtitle={`${stats.visitedNo} outlets not visited by reps`} icon={Megaphone} />
                        </div>

                        {stats.trend.length > 0 && (
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
                                <TrendChart data={stats.trend} />
                            </div>
                        )}

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
                    </>
                )}
            </PageContainer>

            <BottomNavigation />
        </>
    );
}
