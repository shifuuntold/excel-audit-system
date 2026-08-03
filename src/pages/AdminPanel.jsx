import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../hooks/useAuth";
import { isAdmin, ROLES, ROLE_LABELS } from "../utils/roles";
import { getAllProfiles, updateUserRole } from "../services/profileService";
import { getAreas, deleteArea, findOrCreateArea, resolveAreaName } from "../services/areaService";
import { getDistributors, deleteDistributor, findOrCreateDistributor } from "../services/distributorService";
import { getAllCompetitorsFlat, deleteCompetitor, findOrCreateCompetitor } from "../services/competitorService";
import { getAudits } from "../services/auditHistoryService";
import { flattenDistributors } from "../utils/distributors";
import { flattenCompetitors } from "../utils/competitors";
import { COMPETITOR_CATEGORIES } from "../config/productCatalog";

import Header from "../components/layout/Header";
import PageContainer from "../components/layout/PageContainer";
import BottomNavigation from "../components/layout/BottomNavigation";
import AIAssistant from "../components/ai/AIAssistant";
import { SkeletonDashboard } from "../components/common/Skeleton";
import { B } from "../config/theme";
import {
    Lock, Trash2, Users, MapPin, Truck, Swords, LayoutGrid,
    ClipboardCheck, ShieldCheck, UserCog, Search, Plus, AlertTriangle,
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

// Flags likely-duplicate entries (e.g. "Highland" / "Highlands",
// "Dairy Land" / "Dairyland") by comparing names with spacing, case and a
// single trailing "s" ignored. It's a simple heuristic, not spell-check —
// meant to surface candidates for a human to review, not to auto-merge.
function normalizeForDupeCheck(name) {
    let s = (name || "").toLowerCase().replace(/[^a-z0-9]/g, "");
    if (s.endsWith("s")) s = s.slice(0, -1);
    return s;
}

function findPossibleDuplicates(items, getName) {
    const groups = {};
    for (const item of items) {
        const name = getName(item);
        const key = normalizeForDupeCheck(name);
        if (!key) continue;
        if (!groups[key]) groups[key] = [];
        groups[key].push(item);
    }
    return Object.values(groups).filter((group) => group.length > 1);
}

function timeAgo(dateStr) {
    if (!dateStr) return "Never";
    const days = Math.floor((Date.now() - new Date(dateStr)) / 86400000);
    if (days <= 0) return "Today";
    if (days === 1) return "Yesterday";
    if (days < 30) return `${days} days ago`;
    const months = Math.floor(days / 30);
    return `${months} month${months === 1 ? "" : "s"} ago`;
}

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
    const [audits, setAudits] = useState([]);

    const [userSearch, setUserSearch] = useState("");
    const [areaSearch, setAreaSearch] = useState("");
    const [distributorSearch, setDistributorSearch] = useState("");
    const [competitorSearch, setCompetitorSearch] = useState("");

    const [newAreaName, setNewAreaName] = useState("");
    const [newDistributorName, setNewDistributorName] = useState("");
    const [newCompetitorName, setNewCompetitorName] = useState("");
    const [newCompetitorCategory, setNewCompetitorCategory] = useState(CATEGORY_ORDER[0]);
    const [addingArea, setAddingArea] = useState(false);
    const [addingDistributor, setAddingDistributor] = useState(false);
    const [addingCompetitor, setAddingCompetitor] = useState(false);

    async function loadAll() {
        setLoading(true);
        try {
            const [u, a, d, c, auditRows] = await Promise.all([
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
            setAudits(auditRows);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        if (!admin) return;
        // eslint-disable-next-line react-hooks/set-state-in-effect
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

    // Per-user activity, and "last used" for areas/distributors/competitors —
    // all derived from the same already-fetched audit set so this doesn't
    // cost any extra queries.
    const { userStats, areaLastUsed, distributorLastUsed, competitorLastUsed } = useMemo(() => {
        const byUser = {};
        const byArea = {};
        const byDistributor = {};
        const byCompetitor = {};

        for (const a of audits) {
            const uid = a.user_id;
            if (!byUser[uid]) byUser[uid] = { count: 0, lastActive: null };
            byUser[uid].count++;
            if (!byUser[uid].lastActive || a.created_at > byUser[uid].lastActive) byUser[uid].lastActive = a.created_at;

            const areaName = resolveAreaName(a.outlet, {});
            if (areaName && areaName !== "-") {
                if (!byArea[areaName] || a.created_at > byArea[areaName]) byArea[areaName] = a.created_at;
            }

            for (const name of flattenDistributors(a.market)) {
                if (!byDistributor[name] || a.created_at > byDistributor[name]) byDistributor[name] = a.created_at;
            }

            for (const { name } of flattenCompetitors(a.market)) {
                if (!byCompetitor[name] || a.created_at > byCompetitor[name]) byCompetitor[name] = a.created_at;
            }
        }

        return { userStats: byUser, areaLastUsed: byArea, distributorLastUsed: byDistributor, competitorLastUsed: byCompetitor };
    }, [audits]);

    const duplicateAreas = useMemo(() => findPossibleDuplicates(areas, (a) => a.name), [areas]);
    const duplicateDistributors = useMemo(() => findPossibleDuplicates(distributors, (d) => d.name), [distributors]);
    const duplicateCompetitors = useMemo(() => findPossibleDuplicates(competitors, (c) => c.name), [competitors]);
    const totalDuplicateClusters = duplicateAreas.length + duplicateDistributors.length + duplicateCompetitors.length;

    const duplicateAreaIds = useMemo(() => new Set(duplicateAreas.flat().map((a) => a.id)), [duplicateAreas]);
    const duplicateDistributorIds = useMemo(() => new Set(duplicateDistributors.flat().map((d) => d.id)), [duplicateDistributors]);
    const duplicateCompetitorIds = useMemo(() => new Set(duplicateCompetitors.flat().map((c) => c.id)), [duplicateCompetitors]);

    const filteredUsers = useMemo(() => {
        const q = userSearch.trim().toLowerCase();
        if (!q) return users;
        return users.filter((u) => (u.full_name || "").toLowerCase().includes(q));
    }, [users, userSearch]);

    const filteredAreas = useMemo(() => {
        const q = areaSearch.trim().toLowerCase();
        return (q ? areas.filter((a) => a.name.toLowerCase().includes(q)) : areas)
            .slice().sort((a, b) => a.name.localeCompare(b.name));
    }, [areas, areaSearch]);

    const filteredDistributors = useMemo(() => {
        const q = distributorSearch.trim().toLowerCase();
        return (q ? distributors.filter((d) => d.name.toLowerCase().includes(q)) : distributors)
            .slice().sort((a, b) => a.name.localeCompare(b.name));
    }, [distributors, distributorSearch]);

    const filteredCompetitorsByCategory = useMemo(() => {
        const q = competitorSearch.trim().toLowerCase();
        if (!q) return competitorsByCategory;
        return competitorsByCategory
            .map(([category, items]) => [category, items.filter((c) => c.name.toLowerCase().includes(q))])
            .filter(([, items]) => items.length > 0);
    }, [competitorsByCategory, competitorSearch]);

    async function handleRoleChange(userId, role) {
        try {
            await updateUserRole(userId, role);
            setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, role } : u)));
        } catch (error) {
            console.error(error);
            alert("Couldn't update that user's role.");
        }
    }

    async function handleAddArea() {
        const name = newAreaName.trim();
        if (!name) return;
        setAddingArea(true);
        try {
            const created = await findOrCreateArea(name);
            setAreas((prev) => (prev.some((a) => a.id === created.id) ? prev : [...prev, created]));
            setNewAreaName("");
        } catch (error) {
            console.error(error);
            alert("Couldn't add that area.");
        } finally {
            setAddingArea(false);
        }
    }

    async function handleAddDistributor() {
        const name = newDistributorName.trim();
        if (!name) return;
        setAddingDistributor(true);
        try {
            const created = await findOrCreateDistributor(name);
            setDistributors((prev) => (prev.some((d) => d.id === created.id) ? prev : [...prev, created]));
            setNewDistributorName("");
        } catch (error) {
            console.error(error);
            alert("Couldn't add that distributor.");
        } finally {
            setAddingDistributor(false);
        }
    }

    async function handleAddCompetitor() {
        const name = newCompetitorName.trim();
        if (!name) return;
        setAddingCompetitor(true);
        try {
            const created = await findOrCreateCompetitor(newCompetitorCategory, name);
            setCompetitors((prev) => (prev.some((c) => c.id === created.id) ? prev : [...prev, created]));
            setNewCompetitorName("");
        } catch (error) {
            console.error(error);
            alert("Couldn't add that competitor.");
        } finally {
            setAddingCompetitor(false);
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
                    <SkeletonDashboard />
                ) : (
                    <>
                        {tab === "overview" && (
                            <div>
                                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 14, marginBottom: 16 }}>
                                    <OverviewCard icon={ClipboardCheck} label="Total Audits" value={audits.length} />
                                    <OverviewCard icon={Users} label="Auditors" value={roleCounts.auditor} />
                                    <OverviewCard icon={ShieldCheck} label="Supervisors" value={roleCounts.supervisor} />
                                    <OverviewCard icon={UserCog} label="Admins" value={roleCounts.admin} />
                                </div>

                                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 14 }}>
                                    <OverviewCard icon={MapPin} label="Saved Areas" value={areas.length} compact />
                                    <OverviewCard icon={Truck} label="Distributors" value={distributors.length} compact />
                                    <OverviewCard icon={Swords} label="Competitor Brands" value={competitors.length} compact />
                                </div>

                                {totalDuplicateClusters > 0 && (
                                    <div
                                        style={{
                                            display: "flex", alignItems: "flex-start", gap: 10,
                                            background: "#FFFBEB", border: "1px solid #FDE68A", borderRadius: 14,
                                            padding: 16, marginTop: 20,
                                        }}
                                    >
                                        <AlertTriangle size={17} style={{ color: "#B45309", flexShrink: 0, marginTop: 1 }} />
                                        <div>
                                            <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: "#92400E" }}>
                                                {totalDuplicateClusters} possible duplicate {totalDuplicateClusters === 1 ? "entry" : "entries"} found
                                            </p>
                                            <p style={{ margin: "4px 0 0", fontSize: 12, color: "#78350F", lineHeight: 1.5 }}>
                                                Names that look like the same place or brand typed two different ways
                                                (e.g. "Highland" / "Highlands"). Flagged with a badge on the Areas,
                                                Distributors and Competitors tabs — worth a quick review since they
                                                split otherwise-identical data across two entries in reports.
                                            </p>
                                        </div>
                                    </div>
                                )}

                                <div
                                    style={{
                                        background: B.blueFaint, borderRadius: 14, padding: 16, marginTop: 20,
                                    }}
                                >
                                    <p style={{ margin: 0, fontSize: 12.5, fontWeight: 700, color: B.blue }}>Admin Tools</p>
                                    <p style={{ margin: "4px 0 0", fontSize: 12.5, color: B.muted, lineHeight: 1.6 }}>
                                        Manage users, areas, distributors and competitors. Team-wide audit
                                        analytics and exports live on the <strong>Team</strong> tab.
                                    </p>
                                </div>
                            </div>
                        )}

                        {tab === "users" && (
                            <>
                                <SearchBox value={userSearch} onChange={setUserSearch} placeholder="Search users..." />
                                <Panel>
                                    {filteredUsers.length === 0 && <Empty text={userSearch ? "No users match that search." : "No users found."} />}
                                    {filteredUsers.map((u) => {
                                        const role = u.role || ROLES.AUDITOR;
                                        const colors = ROLE_COLORS[role] || ROLE_COLORS.auditor;
                                        const activity = userStats[u.id];
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
                                                    <div style={{ minWidth: 0 }}>
                                                        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                                                            <span style={{ fontSize: 13.5, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                                                {u.full_name || "Unnamed User"}
                                                            </span>
                                                            <span style={{ fontSize: 10.5, fontWeight: 700, color: colors.text, background: colors.bg, padding: "2px 8px", borderRadius: 10, flexShrink: 0 }}>
                                                                {ROLE_LABELS[role]}
                                                            </span>
                                                        </div>
                                                        <p style={{ margin: "3px 0 0", fontSize: 11.5, color: B.muted }}>
                                                            {activity ? `${activity.count} audit${activity.count === 1 ? "" : "s"} · last active ${timeAgo(activity.lastActive)}` : "No audits yet"}
                                                        </p>
                                                    </div>
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
                            </>
                        )}

                        {tab === "areas" && (
                            <>
                                <SearchBox value={areaSearch} onChange={setAreaSearch} placeholder="Search areas..." />
                                <AddNewRow
                                    value={newAreaName}
                                    onChange={setNewAreaName}
                                    onAdd={handleAddArea}
                                    adding={addingArea}
                                    placeholder="Add a new area..."
                                />
                                <Panel>
                                    {filteredAreas.length === 0 && (
                                        <Empty text={areaSearch ? "No areas match that search." : "No areas yet — they're added automatically from the location search."} />
                                    )}
                                    {filteredAreas.map((a) => (
                                        <Row key={a.id}>
                                            <div style={{ minWidth: 0 }}>
                                                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                                    <span style={{ fontSize: 13.5 }}>{a.name}</span>
                                                    {duplicateAreaIds.has(a.id) && <DuplicateBadge />}
                                                </div>
                                                <p style={{ margin: "2px 0 0", fontSize: 11, color: B.muted }}>
                                                    Last used: {timeAgo(areaLastUsed[a.name])}
                                                </p>
                                            </div>
                                            <button onClick={() => handleDeleteArea(a.id)} style={iconBtnStyle}>
                                                <Trash2 size={14} />
                                            </button>
                                        </Row>
                                    ))}
                                </Panel>
                            </>
                        )}

                        {tab === "distributors" && (
                            <>
                                <SearchBox value={distributorSearch} onChange={setDistributorSearch} placeholder="Search distributors..." />
                                <AddNewRow
                                    value={newDistributorName}
                                    onChange={setNewDistributorName}
                                    onAdd={handleAddDistributor}
                                    adding={addingDistributor}
                                    placeholder="Add a new distributor..."
                                />
                                <Panel>
                                    {filteredDistributors.length === 0 && (
                                        <Empty text={distributorSearch ? "No distributors match that search." : "No distributors yet."} />
                                    )}
                                    {filteredDistributors.map((d) => (
                                        <Row key={d.id}>
                                            <div style={{ minWidth: 0 }}>
                                                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                                    <span style={{ fontSize: 13.5 }}>{d.name}</span>
                                                    {duplicateDistributorIds.has(d.id) && <DuplicateBadge />}
                                                </div>
                                                <p style={{ margin: "2px 0 0", fontSize: 11, color: B.muted }}>
                                                    Last used: {timeAgo(distributorLastUsed[d.name])}
                                                </p>
                                            </div>
                                            <button onClick={() => handleDeleteDistributor(d.id)} style={iconBtnStyle}>
                                                <Trash2 size={14} />
                                            </button>
                                        </Row>
                                    ))}
                                </Panel>
                            </>
                        )}

                        {tab === "competitors" && (
                            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                                <SearchBox value={competitorSearch} onChange={setCompetitorSearch} placeholder="Search competitors..." />
                                <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
                                    <select
                                        className="eb-input"
                                        style={{ width: "auto", padding: "9px 10px", fontSize: 12.5 }}
                                        value={newCompetitorCategory}
                                        onChange={(e) => setNewCompetitorCategory(e.target.value)}
                                    >
                                        {COMPETITOR_CATEGORIES.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
                                    </select>
                                    <div style={{ flex: 1 }}>
                                        <AddNewRow
                                            value={newCompetitorName}
                                            onChange={setNewCompetitorName}
                                            onAdd={handleAddCompetitor}
                                            adding={addingCompetitor}
                                            placeholder="Add a new competitor brand..."
                                        />
                                    </div>
                                </div>

                                {filteredCompetitorsByCategory.length === 0 && (
                                    <Panel><Empty text={competitorSearch ? "No competitors match that search." : "No competitors yet."} /></Panel>
                                )}
                                {filteredCompetitorsByCategory.map(([category, items]) => (
                                    <div key={category}>
                                        <p style={{ fontSize: 11.5, fontWeight: 700, color: B.blue, textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 6 }}>
                                            {CATEGORY_LABELS[category] || category} ({items.length})
                                        </p>
                                        <Panel>
                                            {items.map((c) => (
                                                <Row key={c.id}>
                                                    <div style={{ minWidth: 0 }}>
                                                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                                            <span style={{ fontSize: 13.5 }}>{c.name}</span>
                                                            {duplicateCompetitorIds.has(c.id) && <DuplicateBadge />}
                                                        </div>
                                                        <p style={{ margin: "2px 0 0", fontSize: 11, color: B.muted }}>
                                                            Last seen: {timeAgo(competitorLastUsed[c.name])}
                                                        </p>
                                                    </div>
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
            <AIAssistant pageContext="admin" />
        </>
    );
}

function SearchBox({ value, onChange, placeholder }) {
    return (
        <div style={{ position: "relative", marginBottom: 12 }}>
            <Search size={15} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: B.muted }} />
            <input
                className="eb-input"
                style={{ paddingLeft: 34, fontSize: 13 }}
                value={value}
                onChange={(e) => onChange(e.target.value)}
                placeholder={placeholder}
            />
        </div>
    );
}

function AddNewRow({ value, onChange, onAdd, adding, placeholder }) {
    return (
        <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
            <input
                className="eb-input"
                style={{ fontSize: 13 }}
                value={value}
                onChange={(e) => onChange(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") onAdd(); }}
                placeholder={placeholder}
            />
            <button
                onClick={onAdd}
                disabled={adding || !value.trim()}
                style={{
                    display: "flex", alignItems: "center", gap: 5, flexShrink: 0,
                    background: B.blue, color: "#fff", border: 0, borderRadius: 10,
                    padding: "0 14px", fontSize: 12.5, fontWeight: 700, cursor: "pointer",
                    fontFamily: "inherit", opacity: adding || !value.trim() ? 0.6 : 1,
                }}
            >
                <Plus size={14} /> Add
            </button>
        </div>
    );
}

function DuplicateBadge() {
    return (
        <span
            title="This name closely matches another entry — may be a duplicate"
            style={{
                display: "inline-flex", alignItems: "center", gap: 3,
                fontSize: 10, fontWeight: 700, color: "#92400E", background: "#FFFBEB",
                border: "1px solid #FDE68A", padding: "1px 6px", borderRadius: 8, flexShrink: 0,
            }}
        >
            <AlertTriangle size={10} /> Possible duplicate
        </span>
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
