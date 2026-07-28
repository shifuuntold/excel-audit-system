import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { canViewAllAudits } from "../utils/roles";
import { getAudits } from "../services/auditHistoryService";
import { getAreas, getAreaMap, resolveAreaName } from "../services/areaService";
import { getProfileMap } from "../services/profileService";
import { buildProductSummary, totalProductsRecorded, findMatchingGroups, auditHasProductGroup } from "../utils/productSummary";
import { summarizeFeedback } from "../services/reportService";
import { getQueuedAudits } from "../services/offlineQueue";
import { localIsoDate as isoDate } from "../utils/format";

import Header from "../components/layout/Header";
import PageContainer from "../components/layout/PageContainer";
import BottomNavigation from "../components/layout/BottomNavigation";
import LoadingSpinner from "../components/common/LoadingSpinner";
import Input from "../components/common/Input";
import Select from "../components/common/Select";
import Button from "../components/common/Button";
import { B } from "../config/theme";
import { ClipboardX, MapPin, User, Clock, FileSpreadsheet, FileText, MessageSquare, CloudUpload } from "lucide-react";

const PRESETS = {
    today: () => ({ start: isoDate(new Date()), end: isoDate(new Date()) }),
    week: () => {
        const d = new Date();
        d.setDate(d.getDate() - 6);
        return { start: isoDate(d), end: isoDate(new Date()) };
    },
    month: () => {
        const now = new Date();
        return { start: isoDate(new Date(now.getFullYear(), now.getMonth(), 1)), end: isoDate(now) };
    },
    all: () => ({ start: "", end: "" }),
};

export default function AuditHistory() {
    const { user, profile } = useAuth();
    const orgWide = canViewAllAudits(profile?.role);
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();

    const [audits, setAudits] = useState([]);
    const [areas, setAreas] = useState([]);
    const [areaMap, setAreaMap] = useState({});
    const [profileMap, setProfileMap] = useState({});
    const [loading, setLoading] = useState(true);
    const [exporting, setExporting] = useState(false);

    // Filters are seeded from the URL (if present) so that navigating to
    // an audit's details and back restores exactly what was being viewed,
    // instead of resetting to "today" every time.
    const [preset, setPreset] = useState(searchParams.get("preset") ?? "today");
    const [startDate, setStartDate] = useState(searchParams.get("start") ?? PRESETS.today().start);
    const [endDate, setEndDate] = useState(searchParams.get("end") ?? PRESETS.today().end);
    const [areaId, setAreaId] = useState(searchParams.get("area") ?? "");
    const [search, setSearch] = useState(searchParams.get("q") ?? "");
    const [productQuery, setProductQuery] = useState(searchParams.get("product") ?? "");
    const [auditorId, setAuditorId] = useState(searchParams.get("auditor") ?? "");
    const [visitStatus, setVisitStatus] = useState(searchParams.get("visited") ?? "");
    const [promotionStatus, setPromotionStatus] = useState(searchParams.get("promotion") ?? "");
    const [sortBy, setSortBy] = useState(searchParams.get("sort") ?? "newest");
    const [moreFiltersOpen, setMoreFiltersOpen] = useState(false);
    const [pendingAudits, setPendingAudits] = useState([]);

    useEffect(() => {
        const next = {};
        if (preset) next.preset = preset;
        if (startDate) next.start = startDate;
        if (endDate) next.end = endDate;
        if (areaId) next.area = areaId;
        if (search) next.q = search;
        if (productQuery) next.product = productQuery;
        if (auditorId) next.auditor = auditorId;
        if (visitStatus) next.visited = visitStatus;
        if (promotionStatus) next.promotion = promotionStatus;
        if (sortBy !== "newest") next.sort = sortBy;
        // replace (not push) so every filter tweak doesn't add a new
        // browser-history entry — there's one History "page" to return to
        setSearchParams(next, { replace: true });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [preset, startDate, endDate, areaId, search, productQuery, auditorId, visitStatus, promotionStatus, sortBy]);

    useEffect(() => {
        function refreshPending() { setPendingAudits(getQueuedAudits()); }
        refreshPending();
        window.addEventListener("offline-queue-changed", refreshPending);
        return () => window.removeEventListener("offline-queue-changed", refreshPending);
    }, []);

    useEffect(() => {
        getAreas().then(setAreas).catch(console.error);
        getAreaMap().then(setAreaMap).catch(console.error);
        if (orgWide) {
            getProfileMap().then(setProfileMap).catch(console.error);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [orgWide]);

    async function loadAudits() {
        setLoading(true);
        try {
            const data = await getAudits({
                userId: user.id,
                allAudits: orgWide,
                startDate: startDate || undefined,
                endDate: endDate || undefined,
                areaId: areaId || undefined,
                limit: orgWide ? 1000 : 200,
            });
            setAudits(data);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        if (!user) return;
        loadAudits();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user, orgWide, startDate, endDate, areaId]);

    function applyPreset(key) {
        setPreset(key);
        const { start, end } = PRESETS[key]();
        setStartDate(start);
        setEndDate(end);
    }

    const filteredAudits = useMemo(() => {
        const q = search.trim().toLowerCase();
        const matches = audits.filter((audit) => {
            if (auditorId && audit.user_id !== auditorId) return false;
            if (visitStatus && audit.market?.visited !== visitStatus) return false;
            if (promotionStatus && audit.market?.promotion !== promotionStatus) return false;
            if (!q) return true;
            const searchable = [
                audit.outlet?.shop_name, audit.outlet?.person_met, resolveAreaName(audit.outlet, areaMap),
                profileMap[audit.user_id]?.full_name,
                ...buildProductSummary(audit.products).flatMap((group) => [group.label, ...group.items]),
            ].filter(Boolean).join(" ").toLowerCase();
            return searchable.includes(q);
        });
        return matches.sort((a, b) => {
            if (sortBy === "oldest") return new Date(a.created_at) - new Date(b.created_at);
            if (sortBy === "outlet") return (a.outlet?.shop_name || "").localeCompare(b.outlet?.shop_name || "");
            if (sortBy === "products") return totalProductsRecorded(b.products) - totalProductsRecorded(a.products);
            return new Date(b.created_at) - new Date(a.created_at);
        });
    }, [audits, search, areaMap, profileMap, auditorId, visitStatus, promotionStatus, sortBy]);

    const productResults = useMemo(() => {
        const groups = findMatchingGroups(productQuery);
        if (groups.length === 0) return [];

        return groups.map((group) => {
            const matches = audits.filter((a) => auditHasProductGroup(a.products, group.key));
            return {
                ...group,
                count: matches.length,
                pct: audits.length ? Math.round((matches.length / audits.length) * 100) : 0,
                outlets: matches.map((a) => ({
                    id: a.id,
                    name: a.outlet?.shop_name || "Unnamed Outlet",
                    area: resolveAreaName(a.outlet, areaMap),
                })),
            };
        });
    }, [audits, productQuery, areaMap]);

    const feedbackSummary = useMemo(() => summarizeFeedback(filteredAudits), [filteredAudits]);

    async function handleExportExcel() {
        if (filteredAudits.length === 0) return;
        setExporting(true);
        try {
            const { exportAuditsToExcel } = await import("../services/excelExport");
            exportAuditsToExcel(filteredAudits, areaMap, `excel-chemicals-audits-${startDate || "all"}_to_${endDate || "all"}.xlsx`);
        } finally {
            setExporting(false);
        }
    }

    async function handleExportPDF() {
        if (filteredAudits.length === 0) return;
        setExporting(true);
        try {
            const { exportAuditsToPDF } = await import("../services/pdfExport");
            exportAuditsToPDF(filteredAudits, areaMap, `excel-chemicals-audits-${startDate || "all"}_to_${endDate || "all"}.pdf`);
        } finally {
            setExporting(false);
        }
    }

    return (
        <>
            <Header
                title={orgWide ? "Audits" : "My Audit History"}
                subtitle={orgWide ? "Search and filter — all auditors" : "Search and filter past audits"}
                backTo="/dashboard"
            />

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
                    <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
                        {Object.keys(PRESETS).map((key) => (
                            <button
                                key={key}
                                onClick={() => applyPreset(key)}
                                style={{
                                    padding: "6px 14px",
                                    borderRadius: 20,
                                    fontSize: 12,
                                    fontWeight: 700,
                                    border: `1.5px solid ${preset === key ? B.blue : B.border}`,
                                    background: preset === key ? B.blue : B.white,
                                    color: preset === key ? B.white : B.muted,
                                    cursor: "pointer",
                                    fontFamily: "inherit",
                                    textTransform: "capitalize",
                                }}
                            >
                                {key === "all" ? "All Time" : key}
                            </button>
                        ))}
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12 }}>
                        <Input
                            label="From"
                            type="date"
                            value={startDate}
                            onChange={(e) => { setStartDate(e.target.value); setPreset(""); }}
                        />
                        <Input
                            label="To"
                            type="date"
                            value={endDate}
                            onChange={(e) => { setEndDate(e.target.value); setPreset(""); }}
                        />
                        <Select
                            label="Area"
                            placeholder="All Areas"
                            value={areaId}
                            onChange={(e) => setAreaId(e.target.value)}
                        >
                            {areas.map((a) => (
                                <option key={a.id} value={a.id}>{a.name}</option>
                            ))}
                        </Select>
                        {orgWide && (
                            <Select label="Auditor" placeholder="All Auditors" value={auditorId} onChange={(e) => setAuditorId(e.target.value)}>
                                {Object.entries(profileMap).sort(([, a], [, b]) => (a.full_name || "").localeCompare(b.full_name || "")).map(([id, person]) => <option key={id} value={id}>{person.full_name || "Unknown Auditor"}</option>)}
                            </Select>
                        )}
                        <Input
                            label="Search audits"
                            placeholder="Outlet, person, area, auditor, product..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                        <Input
                            label="Search Product"
                            placeholder="e.g. DTD, Champ, Water..."
                            value={productQuery}
                            onChange={(e) => setProductQuery(e.target.value)}
                        />
                    </div>

                    <div style={{ marginTop: 12 }}>
                        <button onClick={() => setMoreFiltersOpen((open) => !open)} style={{ border: 0, padding: 0, background: "transparent", color: B.blue, cursor: "pointer", fontWeight: 700, fontSize: 12.5, fontFamily: "inherit" }}>
                            {moreFiltersOpen ? "Hide additional filters" : "More filters"}
                        </button>
                        {moreFiltersOpen && (
                            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12, marginTop: 12 }}>
                                <Select label="Sales Visit" placeholder="All statuses" value={visitStatus} onChange={(e) => setVisitStatus(e.target.value)}>
                                    <option value="Yes">Previously visited</option>
                                    <option value="No">Not previously visited</option>
                                </Select>
                                <Select label="Promotion" placeholder="All statuses" value={promotionStatus} onChange={(e) => setPromotionStatus(e.target.value)}>
                                    <option value="Yes">Promotion observed</option>
                                    <option value="No">No promotion observed</option>
                                </Select>
                                <Select label="Sort by" value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
                                    <option value="newest">Newest first</option>
                                    <option value="oldest">Oldest first</option>
                                    <option value="outlet">Outlet name</option>
                                    <option value="products">Most products recorded</option>
                                </Select>
                            </div>
                        )}
                    </div>

                    <div style={{ display: "flex", gap: 10, marginTop: 16, flexWrap: "wrap" }}>
                        <Button
                            variant="secondary"
                            size="sm"
                            icon={FileSpreadsheet}
                            onClick={handleExportExcel}
                            disabled={exporting || filteredAudits.length === 0}
                        >
                            Export Excel
                        </Button>
                        <Button
                            variant="secondary"
                            size="sm"
                            icon={FileText}
                            onClick={handleExportPDF}
                            disabled={exporting || filteredAudits.length === 0}
                        >
                            Export PDF
                        </Button>
                    </div>
                </div>

                {pendingAudits.length > 0 && (
                    <div style={{ marginBottom: 20 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                            <CloudUpload size={15} style={{ color: B.amber }} />
                            <h3 style={{ fontSize: 13, fontWeight: 700, margin: 0, color: B.text }}>
                                Pending Sync ({pendingAudits.length})
                            </h3>
                        </div>

                        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                            {pendingAudits.map((item) => (
                                <div
                                    key={item.localId}
                                    style={{
                                        background: "#FFFBEB",
                                        borderRadius: 14,
                                        border: `1.5px dashed ${B.amber}`,
                                        padding: 16,
                                        display: "flex",
                                        justifyContent: "space-between",
                                        alignItems: "flex-start",
                                        gap: 12,
                                    }}
                                >
                                    <div style={{ minWidth: 0 }}>
                                        <h2 style={{ fontSize: 15, fontWeight: 700, margin: 0, color: B.text }}>
                                            {item.payload?.outlet?.shop_name || "Unnamed Outlet"}
                                        </h2>
                                        <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 6 }}>
                                            <MapPin size={12} style={{ color: B.muted }} />
                                            <p style={{ fontSize: 12.5, color: B.muted, margin: 0 }}>
                                                {item.payload?.outlet?.area_name || "-"}
                                            </p>
                                        </div>
                                    </div>
                                    <span
                                        style={{
                                            background: B.amber,
                                            color: "#fff",
                                            fontSize: 10.5,
                                            fontWeight: 700,
                                            padding: "3px 9px",
                                            borderRadius: 10,
                                            flexShrink: 0,
                                            whiteSpace: "nowrap",
                                        }}
                                    >
                                        Saved on device
                                    </span>
                                </div>
                            ))}
                        </div>

                        <p style={{ fontSize: 11.5, color: B.muted, marginTop: 8 }}>
                            These were captured offline and will upload automatically once you're back online.
                        </p>
                    </div>
                )}

                {productQuery.trim() && (
                    <div style={{ marginBottom: 20 }}>
                        {productResults.length === 0 ? (
                            <div style={{ background: B.blueFaint, borderRadius: 14, padding: 16, fontSize: 13, color: B.muted }}>
                                No product line matches "{productQuery}".
                            </div>
                        ) : (
                            productResults.map((group) => (
                                <div
                                    key={group.key}
                                    style={{
                                        background: B.white,
                                        borderRadius: 14,
                                        border: `1px solid ${B.blueLight}`,
                                        boxShadow: "0 2px 14px rgba(0,48,135,0.06)",
                                        padding: 18,
                                        marginBottom: 12,
                                    }}
                                >
                                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                                        <span style={{ fontSize: 15, fontWeight: 700 }}>
                                            {group.icon} {group.label}
                                        </span>
                                        <span style={{ fontSize: 12, fontWeight: 700, color: B.blue, background: B.blueFaint, padding: "3px 10px", borderRadius: 10 }}>
                                            {group.count} of {audits.length} outlets ({group.pct}%)
                                        </span>
                                    </div>

                                    {group.outlets.length > 0 && (
                                        <p style={{ fontSize: 12.5, color: B.muted, marginTop: 8, lineHeight: 1.7 }}>
                                            {group.outlets.map((o) => `${o.name} (${o.area})`).join(" · ")}
                                        </p>
                                    )}
                                </div>
                            ))
                        )}
                    </div>
                )}

                {!loading && feedbackSummary.total > 0 && (
                    <div
                        style={{
                            background: B.white,
                            borderRadius: 14,
                            border: `1px solid ${B.blueLight}`,
                            boxShadow: "0 2px 14px rgba(0,48,135,0.06)",
                            padding: 18,
                            marginBottom: 20,
                        }}
                    >
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                            <MessageSquare size={16} style={{ color: B.blue }} />
                            <h3 style={{ fontSize: 14, fontWeight: 700, margin: 0 }}>
                                Retailer Feedback Summary
                            </h3>
                            <span style={{ fontSize: 11, color: B.muted, fontWeight: 600 }}>
                                ({feedbackSummary.total} comment{feedbackSummary.total === 1 ? "" : "s"})
                            </span>
                        </div>

                        {feedbackSummary.themeLines.length === 0 ? (
                            <p style={{ fontSize: 13, color: B.muted, margin: 0 }}>
                                No common themes detected — see individual audits for feedback.
                            </p>
                        ) : (
                            <ul style={{ margin: 0, paddingLeft: 20, display: "flex", flexDirection: "column", gap: 6 }}>
                                {feedbackSummary.themeLines.map((line, i) => (
                                    <li key={i} style={{ fontSize: 13, color: B.text, lineHeight: 1.6 }}>
                                        {line}
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                )}

                {loading ? (
                    <LoadingSpinner label="Loading audits..." />
                ) : filteredAudits.length === 0 ? (
                    <div
                        style={{
                            background: B.white,
                            borderRadius: 16,
                            border: `1px solid ${B.blueLight}`,
                            padding: 40,
                            textAlign: "center",
                        }}
                    >
                        <ClipboardX size={32} style={{ color: B.muted, margin: "0 auto 12px" }} />
                        <p style={{ color: B.muted, fontSize: 14, margin: 0 }}>
                            No audits match these filters.
                        </p>
                    </div>
                ) : (
                    <>
                        <p style={{ fontSize: 12, color: B.muted, marginBottom: 10, fontWeight: 600 }}>
                            {filteredAudits.length} audit{filteredAudits.length === 1 ? "" : "s"} found
                        </p>

                        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                            {filteredAudits.map((audit) => (
                                <div
                                    key={audit.id}
                                    onClick={() => navigate(`/audit/${audit.id}`)}
                                    style={{
                                        background: B.white,
                                        borderRadius: 14,
                                        border: `1px solid ${B.blueLight}`,
                                        boxShadow: "0 2px 14px rgba(0,48,135,0.06)",
                                        padding: 18,
                                        cursor: "pointer",
                                        display: "flex",
                                        justifyContent: "space-between",
                                        alignItems: "flex-start",
                                        gap: 12,
                                    }}
                                >
                                    <div style={{ minWidth: 0 }}>
                                        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                                            <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: B.text }}>
                                                {audit.outlet?.shop_name || "Unnamed Outlet"}
                                            </h2>
                                            {orgWide && (
                                                <span
                                                    style={{
                                                        background: B.blueFaint,
                                                        color: B.blue,
                                                        fontSize: 10.5,
                                                        fontWeight: 700,
                                                        padding: "2px 8px",
                                                        borderRadius: 10,
                                                        whiteSpace: "nowrap",
                                                    }}
                                                >
                                                    {profileMap[audit.user_id]?.full_name || "Unknown Auditor"}
                                                </span>
                                            )}
                                        </div>

                                        <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 8 }}>
                                            <MapPin size={13} style={{ color: B.muted }} />
                                            <p style={{ fontSize: 13, color: B.muted, margin: 0 }}>
                                                {resolveAreaName(audit.outlet, areaMap)}
                                            </p>
                                        </div>

                                        <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4 }}>
                                            <User size={13} style={{ color: B.muted }} />
                                            <p style={{ fontSize: 13, color: B.muted, margin: 0 }}>
                                                {audit.outlet?.person_met || "-"}
                                            </p>
                                        </div>

                                        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 10 }}>
                                            <span style={{ fontSize: 10.5, fontWeight: 700, padding: "3px 7px", borderRadius: 9, background: audit.market?.visited === "No" ? "#FEF3F2" : B.blueFaint, color: audit.market?.visited === "No" ? "#B42318" : B.blue }}>
                                                Sales visit: {audit.market?.visited === "Yes" ? "Previously visited" : audit.market?.visited === "No" ? "Not previously visited" : "Not recorded"}
                                            </span>
                                            <span style={{ fontSize: 10.5, fontWeight: 700, padding: "3px 7px", borderRadius: 9, background: audit.market?.promotion === "Yes" ? "#ECFDF3" : B.blueFaint, color: audit.market?.promotion === "Yes" ? "#027A48" : B.blue }}>
                                                Promotion: {audit.market?.promotion === "Yes" ? "Yes" : audit.market?.promotion === "No" ? "No" : "Not recorded"}
                                            </span>
                                            {(audit.market?.distributors?.length || audit.market?.distributor) && <span style={{ fontSize: 10.5, fontWeight: 700, padding: "3px 7px", borderRadius: 9, background: B.blueFaint, color: B.blue }}>Distributor: {(audit.market?.distributors || [audit.market?.distributor]).filter(Boolean).join(", ")}</span>}
                                        </div>
                                    </div>

                                    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6, flexShrink: 0 }}>
                                        <div style={{ display: "flex", alignItems: "center", gap: 4, color: B.muted }}>
                                            <Clock size={13} />
                                            <p style={{ fontSize: 12, margin: 0 }}>
                                                {new Date(audit.created_at).toLocaleDateString([], { month: "short", day: "numeric" })}
                                            </p>
                                        </div>
                                        <span
                                            style={{
                                                background: B.blueFaint,
                                                color: B.blue,
                                                fontSize: 11,
                                                fontWeight: 700,
                                                padding: "2px 8px",
                                                borderRadius: 10,
                                            }}
                                        >
                                            {totalProductsRecorded(audit.products)} products
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </>
                )}
            </PageContainer>

            <BottomNavigation />
        </>
    );
}
