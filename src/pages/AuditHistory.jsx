import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { getAudits } from "../services/auditHistoryService";
import { getAreas, getAreaMap, resolveAreaName } from "../services/areaService";
import { totalProductsRecorded } from "../utils/productSummary";

import Header from "../components/layout/Header";
import PageContainer from "../components/layout/PageContainer";
import BottomNavigation from "../components/layout/BottomNavigation";
import LoadingSpinner from "../components/common/LoadingSpinner";
import Input from "../components/common/Input";
import Select from "../components/common/Select";
import Button from "../components/common/Button";
import { B } from "../config/theme";
import { ClipboardX, MapPin, User, Clock, FileSpreadsheet, FileText } from "lucide-react";

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

    const [audits, setAudits] = useState([]);
    const [areas, setAreas] = useState([]);
    const [areaMap, setAreaMap] = useState({});
    const [loading, setLoading] = useState(true);
    const [exporting, setExporting] = useState(false);

    const [preset, setPreset] = useState("today");
    const [startDate, setStartDate] = useState(PRESETS.today().start);
    const [endDate, setEndDate] = useState(PRESETS.today().end);
    const [areaId, setAreaId] = useState("");
    const [search, setSearch] = useState("");

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

    async function handleExportExcel() {
        if (filteredAudits.length === 0) return;
        setExporting(true);
        try {
            const { exportAuditsToExcel } = await import("../services/exportService");
            exportAuditsToExcel(filteredAudits, areaMap, `excel-chemicals-audits-${startDate || "all"}_to_${endDate || "all"}.xlsx`);
        } finally {
            setExporting(false);
        }
    }

    async function handleExportPDF() {
        if (filteredAudits.length === 0) return;
        setExporting(true);
        try {
            const { exportAuditsToPDF } = await import("../services/exportService");
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
