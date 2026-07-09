import { useEffect, useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { getTodaysAuditCount } from "../services/dashboardService";

import DashboardCard from "../components/dashboard/DashboardCard";
import StatCard from "../components/dashboard/StatCard";
import { useNavigate } from "react-router-dom";

import {

    ClipboardPlus,
    ChartColumn,
    Search,
    FileBarChart,
    ClipboardCheck,
    MapPinned,

} from "lucide-react";

export default function Dashboard() {
    const { user, profile } = useAuth();

const navigate = useNavigate();

const [todayCount, setTodayCount] = useState(0);

useEffect(() => {

    async function loadDashboard() {

        if (!user) return;

        try {

            const count = await getTodaysAuditCount(user.id);

            setTodayCount(count);

        } catch (error) {

            console.error(error);

        }

    }

    loadDashboard();

}, [user]);

    return (
        <div className="min-h-screen bg-slate-100">

            <div className="bg-blue-900 text-white px-8 py-6 shadow">

                <h1 className="text-3xl font-bold">
                    Excel Chemicals
                </h1>

                <p className="text-blue-200">
                    Field Sales Audit System
                </p>

            </div>

            <h2 className="text-3xl font-bold mb-8">

    Welcome back, {profile.full_name} 👋

</h2>

<div className="grid lg:grid-cols-3 gap-6 mb-10">

    <StatCard
        title="Today's Audits"
        value="{todayCount}"
        subtitle={
            todayCount === 1
                ? "1 audit submitted today"
                : `${todayCount} audits submitted today`
    }
        icon={ClipboardCheck}
    />

    <StatCard
        title="Areas Covered"
        value="0"
        subtitle="Today's visits"
        icon={MapPinned}
    />

    <StatCard
        title="Pending Sync"
        value="0"
        subtitle="Ready to upload"
        icon={ChartColumn}
    />

</div>

<div className="grid md:grid-cols-2 gap-6">

    <DashboardCard
        title="New Audit"
        description="Start a new outlet inspection."
        icon={ClipboardPlus}
        onClick={() => navigate("/audit/new")}
    />

    <DashboardCard
        title="Today's Audits"
        description="View today's completed audits."
        icon={ClipboardCheck}
        onClick={() => navigate("/audits/today")}
    />

    <DashboardCard
        title="Search Outlets"
        description="Search previously audited outlets."
        icon={Search}
    />

    <DashboardCard
        title="Reports"
        description="View availability and sales reports."
        icon={FileBarChart}
    />

</div>

        </div>
    );
}