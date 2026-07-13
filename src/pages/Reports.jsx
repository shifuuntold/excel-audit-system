import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { canViewAllAudits } from "../utils/roles";
import { getAudits } from "../services/auditHistoryService";
import { getAreas, getAreaMap, resolveAreaName } from "../services/areaService";
import { buildReportData, generateNarrativeSections } from "../services/reportService";

import Header from "../components/layout/Header";
import PageContainer from "../components/layout/PageContainer";
import BottomNavigation from "../components/layout/BottomNavigation";
import LoadingSpinner from "../components/common/LoadingSpinner";
import Input from "../components/common/Input";
import Select from "../components/common/Select";
import Button from "../components/common/Button";
import { B } from "../config/theme";
import { FileText, Download } from "lucide-react";

function isoDate(d) {
    return d.toISOString().split("T")[0];
}

export default function Reports() {
    const { user, profile } = useAuth();
    const isSupervisor = canViewAllAudits(profile?.role);

    const [areas, setAreas] = useState([]);
    const [areaMap, setAreaMap] = useState({});
    const [audits, setAudits] = useState([]);
    const [loading, setLoading] = useState(true);
    const [downloading, setDownloading] = useState(false);

    const [startDate, setStartDate] = useState(() => {
        const d = new Date();
        d.setDate(d.getDate() - 6);
        return isoDate(d);
    });
    const [endDate, setEndDate] = useState(isoDate(new Date()));
    const [areaId, setAreaId] = useState("");

    useEffect(() => {
        getAreas().then(setAreas).catch(console.error);
        getAreaMap().then(setAreaMap).catch(console.error);
    }, []);

    async function loadAudits() {
        if (!user) return;
        setLoading(true);
        try {
            const data = await getAudits({
                userId: user.id,
                allAudits: isSupervisor,
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
        loadAudits();
        // eslint-disable-next-line react-hooks/exhaustive-deps, react-hooks/set-state-in-effect
    }, [user, isSupervisor, startDate, endDate, areaId]);

    const areaLabel = useMemo(() => {
        if (areaId) {
            const match = areas.find((a) => String(a.id) === String(areaId));
            return match?.name || "Selected Area";
        }
        const distinct = [...new Set(audits.map((a) => resolveAreaName(a.outlet, areaMap)))];
        if (distinct.length === 0) return "All Areas";
        if (distinct.length <= 3) return distinct.join(", ");
        return `${distinct.length} Areas`;
    }, [areaId, areas, audits, areaMap]);

    const reportData = useMemo(() => buildReportData(audits, areaMap), [audits, areaMap]);

    const sections = useMemo(
        () => generateNarrativeSections(reportData, { areaLabel, startDate, endDate }),
        [reportData, areaLabel, startDate, endDate]
    );

    async function handleDownload() {
        setDownloading(true);
        try {
            const { exportReportToDocx } = await import("../services/docxExport");
            await exportReportToDocx(sections, {
                areaLabel,
                startDate,
                endDate,
                generatedAt: new Date().toLocaleString(),
            }, `field-audit-report-${startDate}_to_${endDate}.docx`);
        } finally {
            setDownloading(false);
        }
    }

    return (
        <>
            <Header title="Reports" subtitle="Written field audit report" backTo="/dashboard" />

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
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12 }}>
                        <Input label="From" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
                        <Input label="To" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
                        <Select label="Area" placeholder="All Areas" value={areaId} onChange={(e) => setAreaId(e.target.value)}>
                            {areas.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                        </Select>
                    </div>

                    <Button
                        variant="primary"
                        icon={Download}
                        loading={downloading}
                        disabled={audits.length === 0}
                        onClick={handleDownload}
                        style={{ marginTop: 16 }}
                    >
                        Download as Word Report
                    </Button>
                </div>

                {loading ? (
                    <LoadingSpinner label="Building report..." />
                ) : audits.length === 0 ? (
                    <div style={{ background: B.white, borderRadius: 16, border: `1px solid ${B.blueLight}`, padding: 40, textAlign: "center" }}>
                        <FileText size={32} style={{ color: B.muted, margin: "0 auto 12px" }} />
                        <p style={{ color: B.muted, fontSize: 14, margin: 0 }}>
                            No audits in this range to report on.
                        </p>
                    </div>
                ) : (
                    <div
                        style={{
                            background: B.white,
                            borderRadius: 16,
                            border: `1px solid ${B.blueLight}`,
                            boxShadow: "0 2px 14px rgba(0,48,135,0.07)",
                            padding: 26,
                        }}
                    >
                        <h1 style={{ fontSize: 18, fontWeight: 700, color: B.blue, marginBottom: 2 }}>
                            Field Sales Auditor Report
                        </h1>
                        <p style={{ fontSize: 12.5, color: B.muted, marginBottom: 20 }}>
                            Area: {areaLabel} · {startDate} to {endDate} · {audits.length} outlets covered
                        </p>

                        {sections.map((section) => (
                            <div key={section.heading} style={{ marginBottom: 22 }}>
                                <h2 style={{ fontSize: 14, fontWeight: 700, color: B.text, marginBottom: 8, borderBottom: `2px solid ${B.blueLight}`, paddingBottom: 6 }}>
                                    {section.heading}
                                </h2>

                                {section.type === "paragraph" && (
                                    <p style={{ fontSize: 13.5, color: B.text, lineHeight: 1.7, margin: 0 }}>
                                        {section.text}
                                    </p>
                                )}

                                {section.type === "bullets" && (
                                    <ul style={{ margin: 0, paddingLeft: 20, display: "flex", flexDirection: "column", gap: 6 }}>
                                        {section.items.map((item, i) => (
                                            <li key={i} style={{ fontSize: 13.5, color: B.text, lineHeight: 1.6 }}>
                                                {item}
                                            </li>
                                        ))}
                                    </ul>
                                )}

                                {section.type === "grouped-bullets" && (
                                    <>
                                        {section.introParagraphs?.map((p, i) => (
                                            <p key={i} style={{ fontSize: 13.5, color: B.text, lineHeight: 1.7, margin: "0 0 10px" }}>
                                                {p}
                                            </p>
                                        ))}

                                        {section.groups.map((group) => (
                                            <div key={group.label} style={{ marginBottom: 12 }}>
                                                <p style={{ fontSize: 13, fontWeight: 700, color: B.blue, margin: "0 0 4px" }}>
                                                    {group.label}
                                                </p>
                                                <ul style={{ margin: 0, paddingLeft: 20, display: "flex", flexDirection: "column", gap: 3 }}>
                                                    {group.items.map((item) => (
                                                        <li key={item} style={{ fontSize: 13, color: B.text, lineHeight: 1.5 }}>
                                                            {item}
                                                        </li>
                                                    ))}
                                                </ul>
                                            </div>
                                        ))}

                                        {section.outro && (
                                            <p style={{ fontSize: 13.5, color: B.text, lineHeight: 1.7, margin: "10px 0 0" }}>
                                                {section.outro}
                                            </p>
                                        )}
                                    </>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </PageContainer>

            <BottomNavigation />
        </>
    );
}
