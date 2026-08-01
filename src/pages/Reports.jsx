import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../hooks/useAuth";
import { canViewAllAudits } from "../utils/roles";
import { getAudits } from "../services/auditHistoryService";
import { getAreas, getAreaMap, resolveAreaName } from "../services/areaService";
import { buildReportData, generateNarrativeSections } from "../services/reportService";
import { localIsoDate as isoDate } from "../utils/format";
import { supabase } from "../lib/supabase";

import Header from "../components/layout/Header";
import PageContainer from "../components/layout/PageContainer";
import BottomNavigation from "../components/layout/BottomNavigation";
import AIAssistant from "../components/ai/AIAssistant";
import { SkeletonReport } from "../components/common/Skeleton";
import Input from "../components/common/Input";
import Select from "../components/common/Select";
import Button from "../components/common/Button";
import { B } from "../config/theme";
import { FileText, Download, Sparkles, ShieldAlert, ShieldCheck, AlertTriangle } from "lucide-react";

const CONFIDENCE_STYLE = {
    High: { icon: ShieldCheck, color: B.green, bg: "#ECFDF5" },
    Medium: { icon: ShieldAlert, color: B.amber, bg: "#FFFBEB" },
    Low: { icon: ShieldAlert, color: B.red, bg: B.redLight },
};
const SEVERITY_COLOR = { high: B.red, medium: B.amber, low: B.muted };

export default function Reports() {
    const { user, profile } = useAuth();
    const isSupervisor = canViewAllAudits(profile?.role);

    const [areas, setAreas] = useState([]);
    const [areaMap, setAreaMap] = useState({});
    const [audits, setAudits] = useState([]);
    const [loading, setLoading] = useState(true);
    const [downloading, setDownloading] = useState(false);

    const [startDate, setStartDate] = useState(isoDate(new Date()));
    const [endDate, setEndDate] = useState(isoDate(new Date()));
    const [areaId, setAreaId] = useState("");

    const [reportMode, setReportMode] = useState("quick"); // "quick" | "ai"
    const [aiReport, setAiReport] = useState(null); // { sections, confidence, flags, generatedFor }
    const [aiLoading, setAiLoading] = useState(false);
    const [aiError, setAiError] = useState(null);

    async function generateAiReport() {
        setAiLoading(true);
        setAiError(null);
        try {
            const { data, error: fnError } = await supabase.functions.invoke("ai-dashboard-query", {
                body: { mode: "full_report", startDate, endDate },
            });
            if (fnError) throw fnError;
            if (!data?.success) throw new Error(data?.error || "Report generation failed");
            setAiReport({ ...data, generatedFor: { startDate, endDate } });
        } catch (error) {
            console.error(error);
            setAiError(error.message || "Something went wrong generating the AI report. Please try again.");
        } finally {
            setAiLoading(false);
        }
    }

    const aiReportStale = aiReport && (aiReport.generatedFor.startDate !== startDate || aiReport.generatedFor.endDate !== endDate);

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
        // eslint-disable-next-line react-hooks/set-state-in-effect
        loadAudits();
        // eslint-disable-next-line react-hooks/exhaustive-deps
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
        const sectionsToExport = reportMode === "ai" ? aiReport?.sections : sections;
        if (!sectionsToExport) return;

        setDownloading(true);
        try {
            const { exportReportToDocx } = await import("../services/docxExport");
            await exportReportToDocx(sectionsToExport, {
                areaLabel: reportMode === "ai" ? "All Areas (AI Analyst Report)" : areaLabel,
                startDate,
                endDate,
                generatedAt: new Date().toLocaleString(),
            }, `field-audit-report-${startDate}_to_${endDate}${reportMode === "ai" ? "-ai-analyst" : ""}.docx`, reportData);
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

                    <div style={{ display: "flex", gap: 8, marginTop: 16, marginBottom: 4 }}>
                        <ModeTab active={reportMode === "quick"} onClick={() => setReportMode("quick")} label="Quick Report" />
                        <ModeTab active={reportMode === "ai"} onClick={() => setReportMode("ai")} label="AI Analyst Report" icon={Sparkles} />
                    </div>

                    {reportMode === "quick" && (
                        <Button
                            variant="primary"
                            icon={Download}
                            loading={downloading}
                            disabled={audits.length === 0}
                            onClick={handleDownload}
                            style={{ marginTop: 12 }}
                        >
                            Download as Word Report
                        </Button>
                    )}

                    {reportMode === "ai" && (
                        <div style={{ marginTop: 12 }}>
                            {areaId && (
                                <p style={{ fontSize: 11.5, color: B.muted, margin: "0 0 10px", lineHeight: 1.5 }}>
                                    The AI Analyst Report currently covers all areas for the selected date range —
                                    the Area filter above only applies to the Quick Report.
                                </p>
                            )}
                            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                                <Button variant="primary" icon={Sparkles} loading={aiLoading} onClick={generateAiReport}>
                                    {aiReport ? "Regenerate Report" : "Generate AI Analyst Report"}
                                </Button>
                                {aiReport?.sections?.length > 0 && (
                                    <Button variant="secondary" icon={Download} loading={downloading} onClick={handleDownload}>
                                        Download as Word Report
                                    </Button>
                                )}
                            </div>
                            {aiReportStale && (
                                <p style={{ fontSize: 11.5, color: B.amber, margin: "8px 0 0", fontWeight: 600 }}>
                                    Date range changed since this report was generated — regenerate for an up-to-date version.
                                </p>
                            )}
                        </div>
                    )}
                </div>

                {reportMode === "quick" ? (
                    loading ? (
                        <SkeletonReport />
                    ) : audits.length === 0 ? (
                        <EmptyReportState text="No audits in this range to report on." />
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
                                Area: {areaLabel} · {startDate === endDate ? startDate : `${startDate} to ${endDate}`} · {audits.length} outlets covered
                            </p>

                            <ReportSections sections={sections} />
                        </div>
                    )
                ) : aiLoading ? (
                    <SkeletonReport />
                ) : aiError ? (
                    <div style={{ background: B.redLight, border: "1px solid #FCA5A5", borderRadius: 16, padding: 20 }}>
                        <p style={{ margin: 0, fontSize: 13.5, color: B.red }}>{aiError}</p>
                    </div>
                ) : !aiReport ? (
                    <EmptyReportState
                        icon={Sparkles}
                        text="Generate a management-quality analysis — coverage, product performance, area review, competitive landscape, risks, and prioritized recommendations."
                    />
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
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, marginBottom: 2 }}>
                            <h1 style={{ fontSize: 18, fontWeight: 700, color: B.blue, margin: 0 }}>
                                AI Analyst Report
                            </h1>
                            <ConfidenceBadge confidence={aiReport.confidence} />
                        </div>
                        <p style={{ fontSize: 12.5, color: B.muted, marginBottom: 20 }}>
                            All Areas · {startDate === endDate ? startDate : `${startDate} to ${endDate}`}
                        </p>

                        {aiReport.flags?.length > 0 && (
                            <div style={{ background: B.blueFaint, border: `1px solid ${B.blueLight}`, borderRadius: 12, padding: 16, marginBottom: 22 }}>
                                <p style={{ margin: "0 0 8px", fontSize: 12, fontWeight: 700, color: B.blue, textTransform: "uppercase", letterSpacing: 0.4 }}>
                                    Pre-Verified Findings
                                </p>
                                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                                    {aiReport.flags.map((f, i) => (
                                        <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 7 }}>
                                            <AlertTriangle size={13} style={{ color: SEVERITY_COLOR[f.severity] || B.muted, flexShrink: 0, marginTop: 2 }} />
                                            <p style={{ margin: 0, fontSize: 12.5, color: B.text, lineHeight: 1.5 }}>{f.message}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        <ReportSections sections={aiReport.sections} />
                    </div>
                )}
            </PageContainer>

            <BottomNavigation />
            <AIAssistant pageContext="reports" />
        </>
    );
}

function ModeTab({ active, onClick, label, icon: Icon }) {
    return (
        <button
            onClick={onClick}
            style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                border: 0,
                background: active ? B.blue : B.blueFaint,
                color: active ? "#fff" : B.blue,
                borderRadius: 10,
                padding: "8px 14px",
                fontSize: 12.5,
                fontWeight: 700,
                cursor: "pointer",
                fontFamily: "inherit",
            }}
        >
            {Icon && <Icon size={13} />} {label}
        </button>
    );
}

function ConfidenceBadge({ confidence }) {
    if (!confidence) return null;
    const style = CONFIDENCE_STYLE[confidence.level] || CONFIDENCE_STYLE.Medium;
    const Icon = style.icon;
    return (
        <div
            title={confidence.note}
            style={{ display: "inline-flex", alignItems: "center", gap: 5, background: style.bg, color: style.color, borderRadius: 20, padding: "4px 11px", fontSize: 11.5, fontWeight: 700, flexShrink: 0 }}
        >
            <Icon size={12} /> {confidence.level} confidence
        </div>
    );
}

function EmptyReportState({ text, icon: Icon = FileText }) {
    return (
        <div style={{ background: B.white, borderRadius: 16, border: `1px solid ${B.blueLight}`, padding: 40, textAlign: "center" }}>
            <Icon size={32} style={{ color: B.muted, margin: "0 auto 12px" }} />
            <p style={{ color: B.muted, fontSize: 14, margin: "0 auto", maxWidth: 340, lineHeight: 1.6 }}>{text}</p>
        </div>
    );
}

function ReportSections({ sections }) {
    return sections.map((section) => (
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
    ));
}
