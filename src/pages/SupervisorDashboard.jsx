import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { getAudits } from "../services/auditHistoryService";
import { getAreas, getAreaMap, resolveAreaName } from "../services/areaService";
import { getProfileMap } from "../services/profileService";

import Header from "../components/layout/Header";
import PageContainer from "../components/layout/PageContainer";
import LoadingSpinner from "../components/common/LoadingSpinner";
import StatCard from "../components/dashboard/StatCard";
import Input from "../components/common/Input";
import Select from "../components/common/Select";
import Button from "../components/common/Button";
import { B } from "../config/theme";
import {
    Users, MapPinned, ClipboardCheck,
    FileSpreadsheet, FileText, Lock,
} from "lucide-react";

function isoDate(d) { return d.toISOString().split("T")[0]; }

export default function SupervisorDashboard() {
    const { profile } = useAuth();
    const navigate = useNavigate();

    const isSupervisor = profile?.role === "supervisor";

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

        for (const a of audits) {
            const repName = profileMap[a.user_id]?.full_name || "Unknown Rep";
            repCounts[repName] = (repCounts[repName] || 0) + 1;

            const area = resolveAreaName(a.outlet, areaMap);
            areaCounts[area] = (areaCounts[area] || 0) + 1;
        }

        const leaderboard = Object.entries(repCounts).sort((a, b) => b[1] - a[1]);
        const areaLeaderboard = Object.entries(areaCounts).sort((a, b) => b[1] - a[1]);

        return {
            totalAudits: audits.length,
            activeReps: leaderboard.length,
            areasCovered: areaLeaderboard.length,
            leaderboard,
            areaLeaderboard,
        };
    }, [audits, profileMap, areaMap]);

    if (!isSupervisor) {
        return (
            <>
                <Header title="Supervisor Dashboard" backTo="/dashboard" />
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
                            This dashboard is only available to accounts with the supervisor role.
                        </p>
                        <Button variant="secondary" size="sm" onClick={() => navigate("/dashboard")} style={{ marginTop: 16 }}>
                            Back to Dashboard
                        </Button>
                    </div>
                </PageContainer>
            </>
        );
    }

    return (
        <>
            <Header title="Supervisor Dashboard" subtitle="Team-wide audit overview" backTo="/dashboard" />

            <PageContainer withNav={false}>
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
                                const { exportAuditsToExcel } = await import("../services/exportService");
                                exportAuditsToExcel(audits, areaMap, `team-audits-${startDate}_to_${endDate}.xlsx`);
                            }}
                        >
                            Export Excel
                        </Button>
                        <Button
                            variant="secondary" size="sm" icon={FileText}
                            disabled={audits.length === 0}
                            onClick={async () => {
                                const { exportAuditsToPDF } = await import("../services/exportService");
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
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 16, marginBottom: 20 }}>
                            <StatCard title="Total Audits" value={stats.totalAudits} subtitle="In selected range" icon={ClipboardCheck} />
                            <StatCard title="Active Reps" value={stats.activeReps} subtitle="Submitted at least 1 audit" icon={Users} />
                            <StatCard title="Areas Covered" value={stats.areasCovered} subtitle="Distinct areas visited" icon={MapPinned} />
                        </div>

                        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16 }}>
                            <div style={{ background: B.white, borderRadius: 16, border: `1px solid ${B.blueLight}`, padding: 20 }}>
                                <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 14 }}>Rep Leaderboard</h3>
                                {stats.leaderboard.length === 0 ? (
                                    <p style={{ color: B.muted, fontSize: 13 }}>No audits in this range.</p>
                                ) : (
                                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                                        {stats.leaderboard.map(([name, count], i) => (
                                            <div key={name} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: i < stats.leaderboard.length - 1 ? `1px solid ${B.blueLight}` : "none" }}>
                                                <span style={{ fontSize: 13, fontWeight: 600 }}>{i + 1}. {name}</span>
                                                <span style={{ fontSize: 12, fontWeight: 700, color: B.blue, background: B.blueFaint, padding: "2px 10px", borderRadius: 10 }}>
                                                    {count}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            <div style={{ background: B.white, borderRadius: 16, border: `1px solid ${B.blueLight}`, padding: 20 }}>
                                <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 14 }}>Area Coverage</h3>
                                {stats.areaLeaderboard.length === 0 ? (
                                    <p style={{ color: B.muted, fontSize: 13 }}>No audits in this range.</p>
                                ) : (
                                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                                        {stats.areaLeaderboard.map(([name, count], i) => (
                                            <div key={name} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: i < stats.areaLeaderboard.length - 1 ? `1px solid ${B.blueLight}` : "none" }}>
                                                <span style={{ fontSize: 13, fontWeight: 600 }}>{name}</span>
                                                <span style={{ fontSize: 12, fontWeight: 700, color: B.blue, background: B.blueFaint, padding: "2px 10px", borderRadius: 10 }}>
                                                    {count}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    </>
                )}
            </PageContainer>
        </>
    );
}
