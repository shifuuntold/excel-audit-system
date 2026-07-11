import { useEffect, useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { isAdmin, ROLES, ROLE_LABELS } from "../utils/roles";
import { getAllProfiles, updateUserRole } from "../services/profileService";
import { getAreas, deleteArea } from "../services/areaService";
import { getDistributors, deleteDistributor } from "../services/distributorService";
import { getAllCompetitorsFlat, deleteCompetitor } from "../services/competitorService";
import { COMPETITOR_CATEGORIES } from "../config/productCatalog";

import Header from "../components/layout/Header";
import PageContainer from "../components/layout/PageContainer";
import BottomNavigation from "../components/layout/BottomNavigation";
import LoadingSpinner from "../components/common/LoadingSpinner";
import { B } from "../config/theme";
import { Lock, Trash2, Users, MapPin, Truck, Swords } from "lucide-react";

const TABS = [
    { key: "users", label: "Users", icon: Users },
    { key: "areas", label: "Areas", icon: MapPin },
    { key: "distributors", label: "Distributors", icon: Truck },
    { key: "competitors", label: "Competitors", icon: Swords },
];

const CATEGORY_LABELS = Object.fromEntries(COMPETITOR_CATEGORIES.map((c) => [c.key, c.label]));

export default function AdminPanel() {
    const { profile } = useAuth();
    const admin = isAdmin(profile?.role);

    const [tab, setTab] = useState("users");
    const [loading, setLoading] = useState(true);

    const [users, setUsers] = useState([]);
    const [areas, setAreas] = useState([]);
    const [distributors, setDistributors] = useState([]);
    const [competitors, setCompetitors] = useState([]);

    async function loadAll() {
        setLoading(true);
        try {
            const [u, a, d, c] = await Promise.all([
                getAllProfiles(),
                getAreas(),
                getDistributors(),
                getAllCompetitorsFlat(),
            ]);
            setUsers(u);
            setAreas(a);
            setDistributors(d);
            setCompetitors(c);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        if (!admin) return;
        // eslint-disable-next-line react-hooks/set-state-in-effect, react-hooks/exhaustive-deps
        loadAll();
    }, [admin]);

    async function handleRoleChange(userId, role) {
        try {
            await updateUserRole(userId, role);
            setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, role } : u)));
        } catch (error) {
            console.error(error);
            alert("Couldn't update that user's role.");
        }
    }

    async function handleDeleteArea(id) {
        if (!confirm("Delete this area? Past audits will keep their saved area name.")) return;
        try {
            await deleteArea(id);
            setAreas((prev) => prev.filter((a) => a.id !== id));
        } catch (error) {
            console.error(error);
            alert("Couldn't delete that area.");
        }
    }

    async function handleDeleteDistributor(id) {
        if (!confirm("Delete this distributor?")) return;
        try {
            await deleteDistributor(id);
            setDistributors((prev) => prev.filter((d) => d.id !== id));
        } catch (error) {
            console.error(error);
            alert("Couldn't delete that distributor.");
        }
    }

    async function handleDeleteCompetitor(id) {
        if (!confirm("Delete this competitor?")) return;
        try {
            await deleteCompetitor(id);
            setCompetitors((prev) => prev.filter((c) => c.id !== id));
        } catch (error) {
            console.error(error);
            alert("Couldn't delete that competitor.");
        }
    }

    if (!admin) {
        return (
            <>
                <Header title="Admin" backTo="/dashboard" />
                <PageContainer withNav={false}>
                    <div style={{ background: B.white, borderRadius: 16, border: `1px solid ${B.blueLight}`, padding: 40, textAlign: "center" }}>
                        <Lock size={32} style={{ color: B.muted, margin: "0 auto 12px" }} />
                        <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 6 }}>Admin access required</h2>
                        <p style={{ color: B.muted, fontSize: 13, margin: 0 }}>
                            This page is only available to Admin accounts.
                        </p>
                    </div>
                </PageContainer>
            </>
        );
    }

    return (
        <>
            <Header title="Admin" subtitle="Users, areas, distributors & competitors" backTo="/dashboard" />

            <PageContainer>
                <div style={{ display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap" }}>
                    {TABS.map(({ key, label, icon: Icon }) => (
                        <button
                            key={key}
                            onClick={() => setTab(key)}
                            style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 6,
                                padding: "8px 14px",
                                borderRadius: 20,
                                fontSize: 12.5,
                                fontWeight: 700,
                                border: `1.5px solid ${tab === key ? B.blue : B.border}`,
                                background: tab === key ? B.blue : B.white,
                                color: tab === key ? B.white : B.muted,
                                cursor: "pointer",
                                fontFamily: "inherit",
                            }}
                        >
                            <Icon size={14} /> {label}
                        </button>
                    ))}
                </div>

                {loading ? (
                    <LoadingSpinner label="Loading admin data..." />
                ) : (
                    <div style={{ background: B.white, borderRadius: 16, border: `1px solid ${B.blueLight}`, boxShadow: "0 2px 14px rgba(0,48,135,0.07)", padding: 20 }}>

                        {tab === "users" && (
                            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                                {users.length === 0 && <p style={{ color: B.muted, fontSize: 13 }}>No users found.</p>}
                                {users.map((u) => (
                                    <div key={u.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: `1px solid ${B.blueLight}` }}>
                                        <span style={{ fontSize: 13.5, fontWeight: 600 }}>{u.full_name || "Unnamed User"}</span>
                                        <select
                                            className="eb-input"
                                            style={{ width: "auto", padding: "6px 10px", fontSize: 12.5 }}
                                            value={u.role || ROLES.AUDITOR}
                                            onChange={(e) => handleRoleChange(u.id, e.target.value)}
                                        >
                                            {Object.values(ROLES).map((r) => (
                                                <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                                            ))}
                                        </select>
                                    </div>
                                ))}
                            </div>
                        )}

                        {tab === "areas" && (
                            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                                {areas.length === 0 && <p style={{ color: B.muted, fontSize: 13 }}>No areas yet — they're added automatically from the location search.</p>}
                                {areas.map((a) => (
                                    <div key={a.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: `1px solid ${B.blueLight}` }}>
                                        <span style={{ fontSize: 13.5 }}>{a.name}</span>
                                        <button onClick={() => handleDeleteArea(a.id)} style={iconBtnStyle}>
                                            <Trash2 size={14} />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}

                        {tab === "distributors" && (
                            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                                {distributors.length === 0 && <p style={{ color: B.muted, fontSize: 13 }}>No distributors yet.</p>}
                                {distributors.map((d) => (
                                    <div key={d.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: `1px solid ${B.blueLight}` }}>
                                        <span style={{ fontSize: 13.5 }}>{d.name}</span>
                                        <button onClick={() => handleDeleteDistributor(d.id)} style={iconBtnStyle}>
                                            <Trash2 size={14} />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}

                        {tab === "competitors" && (
                            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                                {competitors.length === 0 && <p style={{ color: B.muted, fontSize: 13 }}>No competitors yet.</p>}
                                {competitors.map((c) => (
                                    <div key={c.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: `1px solid ${B.blueLight}` }}>
                                        <span style={{ fontSize: 13.5 }}>
                                            {c.name}
                                            <span style={{ fontSize: 11, color: B.muted, marginLeft: 8 }}>
                                                {CATEGORY_LABELS[c.category] || c.category}
                                            </span>
                                        </span>
                                        <button onClick={() => handleDeleteCompetitor(c.id)} style={iconBtnStyle}>
                                            <Trash2 size={14} />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}

                    </div>
                )}
            </PageContainer>

            <BottomNavigation />
        </>
    );
}

const iconBtnStyle = {
    background: "none",
    border: "none",
    color: "#C8102E",
    cursor: "pointer",
    padding: 6,
    display: "flex",
};
