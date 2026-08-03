import { useEffect, useState } from "react";
import { useAuth } from "../hooks/useAuth";
import { getDashboardStats } from "../services/dashboardService";
import { useNavigate } from "react-router-dom";
import { canViewAllAudits } from "../utils/roles";

import DashboardCard from "../components/dashboard/DashboardCard";
import StatCard from "../components/dashboard/StatCard";
import TrendChart from "../components/dashboard/TrendChart";
import MyAssignments from "../components/dashboard/MyAssignments";
import Header from "../components/layout/Header";
import PageContainer from "../components/layout/PageContainer";
import BottomNavigation from "../components/layout/BottomNavigation";
import AIAssistant from "../components/ai/AIAssistant";
import { SkeletonDashboard } from "../components/common/Skeleton";
import { B } from "../config/theme";

import {
    ClipboardPlus,
    Search,
    FileBarChart,
    ClipboardCheck,
    MapPinned,
    Package,
    TrendingUp,
    Users,
} from "lucide-react";

export default function Dashboard() {
    const { profile, user } = useAuth();
    const navigate = useNavigate();
    const orgWide = canViewAllAudits(profile?.role);

    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function loadDashboard() {
            if (!user) return;
            try {
                const data = await getDashboardStats(user.id, orgWide);
                setStats(data);
            } catch (error) {
                console.error(error);
            } finally {
                setLoading(false);
            }
        }

        loadDashboard();
    }, [user, orgWide]);

    return (
        <>
            <Header title="Excel Chemicals" subtitle="Field Sales Audit System" />

            <PageContainer>
                <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", flexWrap: "wrap", gap: 8, marginBottom: 20 }}>
                    <h2 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>
                        Welcome back, {profile.full_name}
                    </h2>
                    {orgWide && (
                        <span style={{ fontSize: 12, fontWeight: 700, color: B.blue, background: B.blueFaint, padding: "4px 12px", borderRadius: 20 }}>
                            Data through {new Date().toLocaleDateString([], { month: "short", day: "numeric" })}
                        </span>
                    )}
                </div>

                {!orgWide && <MyAssignments userId={user?.id} />}

                {loading ? (
                    <SkeletonDashboard />
                ) : (
                    <>
                        <div
                            style={{
                                display: "grid",
                                gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                                gap: 16,
                                marginBottom: 20,
                            }}
                        >
                            <StatCard
                                title={orgWide ? "Team Audits Today" : "Today's Audits"}
                                value={stats.todayCount}
                                subtitle={`${stats.weekCount} this week · ${stats.monthCount} this month`}
                                icon={ClipboardCheck}
                            />

                            <StatCard
                                title="Areas Covered Today"
                                value={stats.areasCoveredToday}
                                subtitle={
                                    stats.topArea
                                        ? `Top this month: ${stats.topArea.name}`
                                        : "No visits yet this month"
                                }
                                icon={MapPinned}
                            />

                            {orgWide ? (
                                <StatCard
                                    title="Active Auditors"
                                    value={stats.registeredAuditors ? `${stats.activeReps} / ${stats.registeredAuditors}` : stats.activeReps}
                                    subtitle="Submitted at least 1 audit this month"
                                    icon={Users}
                                />
                            ) : (
                                <StatCard
                                    title="Products Logged Today"
                                    value={stats.productsRecordedToday}
                                    subtitle="Across all today's outlets"
                                    icon={Package}
                                />
                            )}
                        </div>

                        <div
                            style={{
                                background: B.white,
                                borderRadius: 16,
                                border: `1px solid ${B.blueLight}`,
                                boxShadow: "0 2px 14px rgba(0,48,135,0.07)",
                                padding: 20,
                                marginBottom: 28,
                            }}
                        >
                            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
                                <TrendingUp size={16} style={{ color: B.blue }} />
                                <h3 style={{ fontSize: 14, fontWeight: 700, margin: 0, color: B.text }}>
                                    Last 7 Days{orgWide ? " · Whole Team" : ""}
                                </h3>
                            </div>
                            <TrendChart data={stats.last7Days} />
                        </div>
                    </>
                )}

                <div
                    style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                        gap: 16,
                    }}
                >
                    {/* An Admin or Supervisor isn't primarily out auditing outlets, so
                        starting a new audit isn't a primary action for them the way it
                        is for a field auditor — keep it off their home screen. */}
                    {!orgWide && (
                        <DashboardCard
                            title="New Audit"
                            description="Start a new outlet inspection."
                            icon={ClipboardPlus}
                            onClick={() => navigate("/audit/new")}
                        />
                    )}

                    <DashboardCard
                        title="Audit History"
                        description={orgWide ? "Search and investigate submitted audits." : "Search and filter past audits."}
                        icon={Search}
                        onClick={() => navigate("/audits/history")}
                    />

                    {orgWide && (
                        <DashboardCard
                            title="Team Dashboard"
                            description="Coverage, leaderboards, alerts and product penetration."
                            icon={Users}
                            onClick={() => navigate("/supervisor")}
                        />
                    )}

                    <DashboardCard
                        title="Reports"
                        description={orgWide ? "Generate management reports and export audit findings." : "Generate a written field audit report."}
                        icon={FileBarChart}
                        onClick={() => navigate("/reports")}
                    />
                </div>
            </PageContainer>

            <BottomNavigation />
            <AIAssistant pageContext="dashboard" />
        </>
    );
}
