import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { getAudits } from "../services/auditHistoryService";
import { getAreas, getAreaMap, resolveAreaName } from "../services/areaService";
import { totalProductsRecorded, findMatchingGroups, auditHasProductGroup } from "../utils/productSummary";
import { summarizeFeedback } from "../services/reportService";
import { getQueuedAudits } from "../services/offlineQueue";

import Header from "../components/layout/Header";
import PageContainer from "../components/layout/PageContainer";
import BottomNavigation from "../components/layout/BottomNavigation";
import LoadingSpinner from "../components/common/LoadingSpinner";
import Input from "../components/common/Input";
import Select from "../components/common/Select";
import Button from "../components/common/Button";
import { B } from "../config/theme";
import { ClipboardX, MapPin, User, Clock, FileSpreadsheet, FileText, MessageSquare, CloudUpload } from "lucide-react";

function isoDate(d) {
    return d.toISOString().split("T")[0];
}

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
    const { user } = useAuth();
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();

    const [audits, setAudits] = useState([]);
    const [areas, setAreas] = useState([]);
    const [areaMap, setAreaMap] = useState({});
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
    const [pendingAudits, setPendingAudits] = useState([]);

    useEffect(() => {
        const next = {};
        if (preset) next.preset = preset;
        if (startDate) next.start = startDate;
        if (endDate) next.end = endDate;
        if (areaId) next.area = areaId;
        if (search) next.q = search;
        if (productQuery) next.product = productQuery;
        // replace (not push) so every filter tweak doesn't add a new
        // browser-history entry — there's one History "page" to return to
        setSearchParams(next, { replace: true });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [preset, startDate, endDate, areaId, search, productQuery]);

    useEffect(() => {
        function refreshPending() { setPendingAudits(getQueuedAudits()); }
        refreshPending();
        window.addEventListener("offline-queue-changed", refreshPending);
        return () => window.removeEventListener("offline-queue-changed", refreshPending);
    }, []);

    useEffect(() => {
        getAreas().then(setAreas).catch(console.error);
        getAreaMap().then(setAreaMap).catch(console.error);
    }, []);

    async function loadAudits() {
        setLoading(true);
        try {
            const data = await getAudits({
                userId: user.id,
                startDate: startDate || undefined,
                endDate: endDate || undefined,
                areaId: areaId || undefined,
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
    }, [user, startDate, endDate, areaId]);

    function applyPreset(key) {
        setPreset(key);
        const { start, end } = PRESETS[key]();
        setStartDate(start);
        setEndDate(end);
    }

    const filteredAudits = useMemo(() => {
        if (!search.trim()) return audits;
        const q = search.trim().toLowerCase();
        return audits.filter((a) => (a.outlet?.shop_name || "").toLowerCase().includes(q));
    }, [audits, search]);

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

    const feedbackSummary = useMemo(() => summarizeFeedback(audits), [audits]);

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
            <Header title="Audit History" subtitle="Search and filter past audits" backTo="/dashboard" />

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
                        <Input
                            label="Search Outlet"
                            placeholder="Shop name..."
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
                                        <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: B.text }}>
                                            {audit.outlet?.shop_name || "Unnamed Outlet"}
                                        </h2>

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
