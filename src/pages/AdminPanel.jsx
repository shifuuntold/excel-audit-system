import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { isAdmin, ROLES, ROLE_LABELS } from "../utils/roles";
import { getAllProfiles, updateUserRole } from "../services/profileService";
import { getAreas, deleteArea } from "../services/areaService";
import { getDistributors, deleteDistributor } from "../services/distributorService";
import { getAllCompetitorsFlat, deleteCompetitor } from "../services/competitorService";
import { getAudits } from "../services/auditHistoryService";
import { COMPETITOR_CATEGORIES } from "../config/productCatalog";

import Header from "../components/layout/Header";
import PageContainer from "../components/layout/PageContainer";
import BottomNavigation from "../components/layout/BottomNavigation";
import LoadingSpinner from "../components/common/LoadingSpinner";
import { B } from "../config/theme";
import {
    Lock, Trash2, Users, MapPin, Truck, Swords, LayoutGrid,
    ClipboardCheck, ShieldCheck, UserCog,
} from "lucide-react";

const TABS = [
    { key: "overview", label: "Overview", icon: LayoutGrid },
    { key: "users", label: "Users", icon: Users },
    { key: "areas", label: "Areas", icon: MapPin },
    { key: "distributors", label: "Distributors", icon: Truck },
    { key: "competitors", label: "Competitors", icon: Swords },
];

const CATEGORY_ORDER = COMPETITOR_CATEGORIES.map((c) => c.key);
const CATEGORY_LABELS = Object.fromEntries(COMPETITOR_CATEGORIES.map((c) => [c.key, c.label]));

function initials(name) {
    if (!name) return "?";
    const parts = name.trim().split(/\s+/);
    return ((parts[0]?.[0] || "") + (parts[1]?.[0] || "")).toUpperCase();
}

const ROLE_COLORS = {
    admin: { bg: "#FFF0F2", text: B.red },
    supervisor: { bg: B.blueFaint, text: B.blue },
    auditor: { bg: "#F3F4F6", text: B.muted },
};

export default function AdminPanel() {
    const { profile } = useAuth();
    const admin = isAdmin(profile?.role);

    const [tab, setTab] = useState("overview");
    const [loading, setLoading] = useState(true);

    const [users, setUsers] = useState([]);
    const [areas, setAreas] = useState([]);
    const [distributors, setDistributors] = useState([]);
    const [competitors, setCompetitors] = useState([]);
    const [totalAudits, setTotalAudits] = useState(0);

    async function loadAll() {
        setLoading(true);
        try {
            const [u, a, d, c, audits] = await Promise.all([
                getAllProfiles(),
                getAreas(),
                getDistributors(),
                getAllCompetitorsFlat(),
                getAudits({ allAudits: true, limit: 1000 }),
            ]);
            setUsers(u);
            setAreas(a);
            setDistributors(d);
            setCompetitors(c);
            setTotalAudits(audits.length);
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

    const roleCounts = useMemo(() => {
        const counts = { auditor: 0, supervisor: 0, admin: 0 };
        for (const u of users) {
            const r = u.role || "auditor";
            if (counts[r] !== undefined) counts[r]++;
        }
        return counts;
    }, [users]);

    const competitorsByCategory = useMemo(() => {
        const grouped = {};
        for (const c of competitors) {
            if (!grouped[c.category]) grouped[c.category] = [];
            grouped[c.category].push(c);
        }
        return Object.entries(grouped).sort(
            (a, b) => CATEGORY_ORDER.indexOf(a[0]) - CATEGORY_ORDER.indexOf(b[0])
        );
    }, [competitors]);

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
            <Header title="Admin" subtitle="System-wide management" backTo="/dashboard" />

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
                    <>
                        {tab === "overview" && (
                            <div>
                                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 14, marginBottom: 16 }}>
                                    <OverviewCard icon={ClipboardCheck} label="Total Audits" value={totalAudits} />
                                    <OverviewCard icon={Users} label="Auditors" value={roleCounts.auditor} />
                                    <OverviewCard icon={ShieldCheck} label="Supervisors" value={roleCounts.supervisor} />
                                    <OverviewCard icon={UserCog} label="Admins" value={roleCounts.admin} />
                                </div>

                                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 14 }}>
                                    <OverviewCard icon={MapPin} label="Saved Areas" value={areas.length} compact />
                                    <OverviewCard icon={Truck} label="Distributors" value={distributors.length} compact />
                                    <OverviewCard icon={Swords} label="Competitor Brands" value={competitors.length} compact />
                                </div>

                                <p style={{ fontSize: 12.5, color: B.muted, marginTop: 20, lineHeight: 1.7 }}>
                                    Manage who has access and clean up bad entries from the tabs above.
                                    Team-wide audit analytics and exports live on the <strong>Team</strong> tab.
                                </p>
                            </div>
                        )}

                        {tab === "users" && (
                            <Panel>
                                {users.length === 0 && <Empty text="No users found." />}
                                {users.map((u) => {
                                    const role = u.role || ROLES.AUDITOR;
                                    const colors = ROLE_COLORS[role] || ROLE_COLORS.auditor;
                                    return (
                                        <Row key={u.id}>
                                            <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
                                                <div style={{
                                                    width: 34, height: 34, borderRadius: "50%", background: B.blueFaint,
                                                    color: B.blue, display: "flex", alignItems: "center", justifyContent: "center",
                                                    fontSize: 12, fontWeight: 800, flexShrink: 0,
                                                }}>
                                                    {initials(u.full_name)}
                                                </div>
                                                <span style={{ fontSize: 13.5, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                                    {u.full_name || "Unnamed User"}
                                                </span>
                                                <span style={{ fontSize: 10.5, fontWeight: 700, color: colors.text, background: colors.bg, padding: "2px 8px", borderRadius: 10, flexShrink: 0 }}>
                                                    {ROLE_LABELS[role]}
                                                </span>
                                            </div>
                                            <select
                                                className="eb-input"
                                                style={{ width: "auto", padding: "6px 10px", fontSize: 12.5, flexShrink: 0 }}
                                                value={role}
                                                onChange={(e) => handleRoleChange(u.id, e.target.value)}
                                            >
                                                {Object.values(ROLES).map((r) => (
                                                    <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                                                ))}
                                            </select>
                                        </Row>
                                    );
                                })}
                            </Panel>
                        )}

                        {tab === "areas" && (
                            <Panel>
                                {areas.length === 0 && <Empty text="No areas yet — they're added automatically from the location search." />}
                                {areas.map((a) => (
                                    <Row key={a.id}>
                                        <span style={{ fontSize: 13.5 }}>{a.name}</span>
                                        <button onClick={() => handleDeleteArea(a.id)} style={iconBtnStyle}>
                                            <Trash2 size={14} />
                                        </button>
                                    </Row>
                                ))}
                            </Panel>
                        )}

                        {tab === "distributors" && (
                            <Panel>
                                {distributors.length === 0 && <Empty text="No distributors yet." />}
                                {distributors.map((d) => (
                                    <Row key={d.id}>
                                        <span style={{ fontSize: 13.5 }}>{d.name}</span>
                                        <button onClick={() => handleDeleteDistributor(d.id)} style={iconBtnStyle}>
                                            <Trash2 size={14} />
                                        </button>
                                    </Row>
                                ))}
                            </Panel>
                        )}

                        {tab === "competitors" && (
                            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                                {competitorsByCategory.length === 0 && (
                                    <Panel><Empty text="No competitors yet." /></Panel>
                                )}
                                {competitorsByCategory.map(([category, items]) => (
                                    <div key={category}>
                                        <p style={{ fontSize: 11.5, fontWeight: 700, color: B.blue, textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 6 }}>
                                            {CATEGORY_LABELS[category] || category}
                                        </p>
                                        <Panel>
                                            {items.map((c) => (
                                                <Row key={c.id}>
                                                    <span style={{ fontSize: 13.5 }}>{c.name}</span>
                                                    <button onClick={() => handleDeleteCompetitor(c.id)} style={iconBtnStyle}>
                                                        <Trash2 size={14} />
                                                    </button>
                                                </Row>
                                            ))}
                                        </Panel>
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

function OverviewCard({ icon: Icon, label, value, compact }) {
    return (
        <div style={{
            background: B.white, borderRadius: 14, border: `1px solid ${B.blueLight}`,
            boxShadow: "0 2px 14px rgba(0,48,135,0.06)", padding: compact ? 14 : 18,
            display: "flex", alignItems: "center", gap: 12,
        }}>
            <div style={{
                width: compact ? 34 : 40, height: compact ? 34 : 40, borderRadius: 10, background: B.blueFaint,
                display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
            }}>
                <Icon size={compact ? 16 : 19} style={{ color: B.blue }} />
            </div>
            <div style={{ minWidth: 0 }}>
                <p style={{ fontSize: compact ? 20 : 24, fontWeight: 800, margin: 0, color: B.text, lineHeight: 1.1 }}>{value}</p>
                <p style={{ fontSize: 11.5, color: B.muted, margin: "2px 0 0", fontWeight: 600 }}>{label}</p>
            </div>
        </div>
    );
}

function Panel({ children }) {
    return (
        <div style={{ background: B.white, borderRadius: 16, border: `1px solid ${B.blueLight}`, boxShadow: "0 2px 14px rgba(0,48,135,0.07)", padding: "4px 20px" }}>
            {children}
        </div>
    );
}

function Row({ children }) {
    return (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, padding: "12px 0", borderBottom: `1px solid ${B.blueLight}` }}>
            {children}
        </div>
    );
}

function Empty({ text }) {
    return <p style={{ color: B.muted, fontSize: 13, padding: "14px 0", margin: 0 }}>{text}</p>;
}

const iconBtnStyle = {
    background: "none",
    border: "none",
    color: "#C8102E",
    cursor: "pointer",
    padding: 6,
    display: "flex",
    flexShrink: 0,
};
