import { useEffect, useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { getDashboardStats } from "../services/dashboardService";
import { useNavigate } from "react-router-dom";

import DashboardCard from "../components/dashboard/DashboardCard";
import StatCard from "../components/dashboard/StatCard";
import TrendChart from "../components/dashboard/TrendChart";
import Header from "../components/layout/Header";
import PageContainer from "../components/layout/PageContainer";
import BottomNavigation from "../components/layout/BottomNavigation";
import LoadingSpinner from "../components/common/LoadingSpinner";
import { B } from "../config/theme";

import {
    ClipboardPlus,
    Search,
    FileBarChart,
    ClipboardCheck,
    MapPinned,
    Package,
    TrendingUp,
} from "lucide-react";

export default function Dashboard() {
    const { profile, user } = useAuth();
    const navigate = useNavigate();

    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function loadDashboard() {
            if (!user) return;
            try {
                const data = await getDashboardStats(user.id);
                setStats(data);
            } catch (error) {
                console.error(error);
            } finally {
                setLoading(false);
            }
        }

        loadDashboard();
    }, [user]);

    return (
        <>
            <Header title="Excel Chemicals" subtitle="Field Sales Audit System" />

            <PageContainer>
                <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 20 }}>
                    Welcome back, {profile.full_name} 👋
                </h2>

                {loading ? (
                    <LoadingSpinner label="Loading your stats..." />
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
                                title="Today's Audits"
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

                            <StatCard
                                title="Products Logged Today"
                                value={stats.productsRecordedToday}
                                subtitle="Across all today's outlets"
                                icon={Package}
                            />
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
                                    Last 7 Days
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
                    <DashboardCard
                        title="New Audit"
                        description="Start a new outlet inspection."
                        icon={ClipboardPlus}
                        onClick={() => navigate("/audit/new")}
                    />

                    <DashboardCard
                        title="Audit History"
                        description="Search and filter past audits."
                        icon={Search}
                        onClick={() => navigate("/audits/history")}
                    />

                    <DashboardCard
                        title="Today's Audits"
                        description="View today's completed audits."
                        icon={ClipboardCheck}
                        onClick={() => navigate("/audits/history")}
                    />

                    <DashboardCard
                        title="Reports"
                        description="Generate a written field audit report."
                        icon={FileBarChart}
                        onClick={() => navigate("/reports")}
                    />
                </div>
            </PageContainer>

            <BottomNavigation />
        </>
    );
}
