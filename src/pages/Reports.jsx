import { useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "../hooks/useAuth";
import { canViewAllAudits } from "../utils/roles";
import { getAudits } from "../services/auditHistoryService";
import { getAreas, getAreaMap, resolveAreaName } from "../services/areaService";
import { buildReportData, generateAiReportSections, formatReportDate, formatReportAsText } from "../services/reportService";
import { localIsoDate as isoDate } from "../utils/format";
import { speakText, stopSpeaking } from "../utils/speech";
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
import { Sparkles, Download, Copy, Check, Volume2, VolumeX } from "lucide-react";

const reportActionBtnStyle = {
    display: "flex", alignItems: "center", justifyContent: "center",
    width: 26, height: 26, borderRadius: 8, border: 0,
    background: "transparent", color: B.muted, cursor: "pointer",
};

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

    const [report, setReport] = useState(null); // { sections, generatedFor }
    const [aiLoading, setAiLoading] = useState(false);
    const [aiError, setAiError] = useState(null);
    const [speaking, setSpeaking] = useState(false);
    const [copied, setCopied] = useState(false);
    const speechController = useRef(null);

    // Stops the report from continuing to talk in the background after
    // navigating away from this page — there's no visible Stop control
    // left once the page unmounts.
    useEffect(() => () => stopSpeaking(), []);

    useEffect(() => {
        getAreas().then(setAreas).catch(console.error);
        getAreaMap().then(setAreaMap).catch(console.error);
    }, []);

    async function loadAudits() {
        if (!user) return;
        setLoading(true);
        try {
            // Same scoping the app uses everywhere else — an Auditor only
            // ever gets allAudits: false here, so this report can never
            // show them anyone else's data. A Supervisor/Admin gets
            // everyone's, same as the Team dashboard.
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
        if (distinct.length <= 3) return distinct.join(" & ");
        return `${distinct.length} Areas`;
    }, [areaId, areas, audits, areaMap]);

    const reportData = useMemo(() => buildReportData(audits, areaMap), [audits, areaMap]);
    const reportDateLabel = formatReportDate(startDate, endDate);

    const reportStale = report && (report.generatedFor.startDate !== startDate || report.generatedFor.endDate !== endDate || report.generatedFor.areaId !== areaId);

    async function generateReport() {
        speechController.current?.stop();
        speechController.current = null;
        setSpeaking(false);
        setAiLoading(true);
        setAiError(null);
        try {
            const topCompetitorCategories = [...reportData.competitorTallyByCategory]
                .filter(([catKey]) => catKey !== "other")
                .sort((a, b) => b[1].reduce((s, [, c]) => s + c, 0) - a[1].reduce((s, [, c]) => s + c, 0))
                .slice(0, 3)
                .map(([catKey]) => catKey);

            const { data, error: fnError } = await supabase.functions.invoke("ai-dashboard-query", {
                body: {
                    mode: "full_report",
                    reportData: {
                        areaLabel,
                        totalOutlets: reportData.totalOutlets,
                        productPenetration: reportData.productPenetration.map((p) => ({
                            label: p.label, count: p.count, pct: p.pct, tier: p.tier,
                        })),
                        topCompetitorCategories,
                        distributorCount: reportData.distributorTally.length,
                        promotionYes: reportData.promotionYes,
                        promotionNo: reportData.promotionNo,
                        visitedNo: reportData.visitedNo,
                        rawFeedback: reportData.feedback.slice(0, 30),
                    },
                },
            });

            if (fnError) throw fnError;
            if (!data?.success) throw new Error(data?.error || "Report generation failed");

            const sections = generateAiReportSections(reportData, { areaLabel, startDate, endDate }, {
                keyObservations: data.key_observations,
                retailerFeedback: data.retailer_feedback,
                recommendations: data.recommendations,
            });

            setReport({ sections, generatedFor: { startDate, endDate, areaId } });
        } catch (error) {
            console.error(error);
            setAiError(error.message || "Something went wrong generating the report. Please try again.");
        } finally {
            setAiLoading(false);
        }
    }

    async function handleDownload() {
        if (!report) return;
        setDownloading(true);
        try {
            const { exportReportToDocx } = await import("../services/docxExport");
            await exportReportToDocx(report.sections, {
                areaLabel,
                startDate,
                endDate,
                generatedAt: new Date().toLocaleString(),
            }, `field-audit-report-${startDate}_to_${endDate}.docx`, reportData);
        } finally {
            setDownloading(false);
        }
    }

    async function handleCopy() {
        if (!report) return;
        const text = formatReportAsText(report.sections, { areaLabel, dateLabel: reportDateLabel, totalOutlets: reportData.totalOutlets });
        try {
            await navigator.clipboard.writeText(text);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch (err) {
            console.error("Copy failed:", err);
        }
    }

    function toggleReadAloud() {
        if (speaking) {
            speechController.current?.stop();
            speechController.current = null;
            setSpeaking(false);
            return;
        }
        if (!report) return;
        const text = formatReportAsText(report.sections, { areaLabel, dateLabel: reportDateLabel, totalOutlets: reportData.totalOutlets });
        setSpeaking(true);
        speechController.current = speakText(text, {
            onEnd: () => setSpeaking(false),
            onError: (err) => {
                console.error("Read aloud failed:", err);
                setSpeaking(false);
            },
        });
    }

    return (
        <>
            <Header title="Reports" subtitle="AI-powered field audit report" backTo="/dashboard" />

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

                    <div style={{ marginTop: 12, display: "flex", gap: 10, flexWrap: "wrap" }}>
                        <Button variant="primary" icon={Sparkles} loading={aiLoading} disabled={audits.length === 0} onClick={generateReport}>
                            {report ? "Regenerate Report" : "Generate Report"}
                        </Button>
                        {report && (
                            <Button variant="secondary" icon={Download} loading={downloading} onClick={handleDownload}>
                                Download as Word Report
                            </Button>
                        )}
                    </div>
                    {reportStale && (
                        <p style={{ fontSize: 11.5, color: B.amber, margin: "8px 0 0", fontWeight: 600 }}>
                            Filters changed since this report was generated — regenerate for an up-to-date version.
                        </p>
                    )}
                </div>

                {loading ? (
                    <SkeletonReport />
                ) : audits.length === 0 ? (
                    <EmptyReportState text="No audits in this range to report on." />
                ) : aiLoading ? (
                    <SkeletonReport />
                ) : aiError ? (
                    <div style={{ background: B.redLight, border: "1px solid #FCA5A5", borderRadius: 16, padding: 20 }}>
                        <p style={{ margin: 0, fontSize: 13.5, color: B.red }}>{aiError}</p>
                    </div>
                ) : !report ? (
                    <EmptyReportState
                        icon={Sparkles}
                        text="Generate a field audit report — product penetration, competitive landscape, distributor activity, retailer feedback, and prioritized recommendations."
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
                        <h1 style={{ fontSize: 17, fontWeight: 800, color: B.blue, letterSpacing: 0.3, marginBottom: 14 }}>
                            FIELD SALES AUDITOR REPORT
                        </h1>
                        <div style={{ fontSize: 13, color: B.text, lineHeight: 1.9, marginBottom: 4 }}>
                            <div><strong>Area:</strong> {areaLabel}</div>
                            <div><strong>Date:</strong> {reportDateLabel}</div>
                            <div><strong>Total Outlets Covered:</strong> {reportData.totalOutlets}</div>
                        </div>

                        <div style={{ display: "flex", alignItems: "center", gap: 2, marginBottom: 18 }}>
                            <button onClick={handleCopy} title="Copy report" style={reportActionBtnStyle}>
                                {copied ? <Check size={14} style={{ color: B.green }} /> : <Copy size={13} />}
                            </button>
                            <button onClick={toggleReadAloud} title={speaking ? "Stop" : "Read aloud"} style={reportActionBtnStyle}>
                                {speaking ? <VolumeX size={14} style={{ color: B.blue }} /> : <Volume2 size={13} />}
                            </button>
                            {copied && <span style={{ fontSize: 11, color: B.green, fontWeight: 600, marginLeft: 2 }}>Copied!</span>}
                        </div>

                        <ReportSections sections={report.sections} />
                    </div>
                )}
            </PageContainer>

            <BottomNavigation />
            <AIAssistant pageContext="reports" />
        </>
    );
}

function EmptyReportState({ text, icon: Icon = Sparkles }) {
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
                <>
                    {section.text && (
                        <p style={{ fontSize: 13.5, color: B.text, lineHeight: 1.7, margin: "0 0 8px" }}>
                            {section.text}
                        </p>
                    )}
                    <ul style={{ margin: 0, paddingLeft: 20, display: "flex", flexDirection: "column", gap: 6 }}>
                        {section.items.map((item, i) => (
                            <li key={i} style={{ fontSize: 13.5, color: B.text, lineHeight: 1.6 }}>
                                {item}
                            </li>
                        ))}
                    </ul>
                </>
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
