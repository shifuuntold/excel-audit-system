import { useState } from "react";
import { supabase } from "../../lib/supabase";
import { B } from "../../config/theme";
import { Send, Lightbulb, FileBarChart, AlertTriangle, ShieldAlert, ShieldCheck } from "lucide-react";

// Different pages invite different questions — a Regional Manager opening
// this from Team Coverage is thinking about auditors and areas; opening it
// from Reports, they're thinking about what to hand upward. Keeps the
// first thing someone sees relevant instead of generic.
const SUGGESTED_PROMPTS = {
    dashboard: [
        "Which areas have the worst sales-rep coverage?",
        "What needs urgent attention right now?",
    ],
    history: [
        "Which outlets haven't been visited recently?",
        "What are retailers complaining about most?",
    ],
    team: [
        "Which outlets still require visits today?",
        "Which auditor has the heaviest workload?",
        "What should I prioritize tomorrow?",
    ],
    reports: [
        "Summarize this period's audit findings",
        "What changed compared to last month?",
    ],
    admin: [
        "Are there any data quality issues I should know about?",
        "Which areas have had the most audit activity?",
    ],
};

const DEFAULT_PROMPTS = [
    "Which areas have the worst sales-rep coverage?",
    "What needs urgent attention right now?",
    "Where is competitor presence growing fastest?",
];

const CONFIDENCE_STYLE = {
    High: { icon: ShieldCheck, color: B.green, bg: "#ECFDF5" },
    Medium: { icon: ShieldAlert, color: B.amber, bg: "#FFFBEB" },
    Low: { icon: ShieldAlert, color: B.red, bg: B.redLight },
};

const SEVERITY_COLOR = { high: B.red, medium: B.amber, low: B.muted };

let nextId = 1;

export default function AIDashboardQuery({ dateRange, pageContext }) {
    const [question, setQuestion] = useState("");
    const [messages, setMessages] = useState([]); // { id, question, result, brief, error, pending }
    const [briefPending, setBriefPending] = useState(false);

    const prompts = SUGGESTED_PROMPTS[pageContext] || DEFAULT_PROMPTS;
    const anyPending = messages.some((m) => m.pending) || briefPending;

    function buildHistory() {
        // Last couple of resolved Q&A turns, so a follow-up like "why?" has
        // something to refer back to — see formatHistory() in the edge function.
        return messages
            .filter((m) => m.result?.answer)
            .slice(-2)
            .map((m) => ({ question: m.question, answer: m.result.answer }));
    }

    async function askAI(overrideQuestion) {
        const text = (overrideQuestion ?? question).trim();
        if (!text) return;

        const id = nextId++;
        setMessages((prev) => [...prev, { id, question: text, result: null, error: null, pending: true }]);
        setQuestion("");

        try {
            const { data, error: fnError } = await supabase.functions.invoke("ai-dashboard-query", {
                body: {
                    question: text,
                    startDate: dateRange.startDate,
                    endDate: dateRange.endDate,
                    history: buildHistory(),
                },
            });

            if (fnError) throw fnError;
            if (!data?.success) throw new Error(data?.error || "AI request failed");

            setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, result: data, pending: false } : m)));
        } catch (err) {
            console.error("AI Dashboard Query Error:", err);
            const message = err.message || "Something went wrong while contacting the AI. Please try again.";
            setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, error: message, pending: false } : m)));
        }
    }

    async function generateBrief() {
        setBriefPending(true);
        const id = nextId++;

        try {
            const { data, error: fnError } = await supabase.functions.invoke("ai-dashboard-query", {
                body: { mode: "weekly_brief", startDate: dateRange.startDate, endDate: dateRange.endDate },
            });

            if (fnError) throw fnError;
            if (!data?.success) throw new Error(data?.error || "Brief generation failed");

            setMessages((prev) => [...prev, { id, isBrief: true, brief: data, pending: false }]);
        } catch (err) {
            console.error("Weekly Brief Error:", err);
            setMessages((prev) => [
                ...prev,
                { id, isBrief: true, brief: null, error: err.message || "Couldn't generate the brief. Please try again.", pending: false },
            ]);
        } finally {
            setBriefPending(false);
        }
    }

    function handleKeyDown(e) {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            askAI();
        }
    }

    return (
        <div>
            {messages.length === 0 && (
                <button
                    onClick={generateBrief}
                    disabled={briefPending}
                    style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        width: "100%",
                        background: `linear-gradient(135deg, ${B.blue}, ${B.blueMid})`,
                        color: "#fff",
                        border: 0,
                        borderRadius: 12,
                        padding: "12px 16px",
                        fontSize: 13,
                        fontWeight: 700,
                        cursor: "pointer",
                        fontFamily: "inherit",
                        marginBottom: 16,
                        opacity: briefPending ? 0.7 : 1,
                    }}
                >
                    <FileBarChart size={16} />
                    {briefPending ? "Generating brief..." : "Generate Weekly Executive Brief"}
                </button>
            )}

            {messages.length > 0 && (
                <div style={{ display: "flex", flexDirection: "column", gap: 18, marginBottom: 18 }}>
                    {messages.map((m) => (
                        <MessageThread key={m.id} message={m} dateRange={dateRange} />
                    ))}
                </div>
            )}

            {messages.length === 0 && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 14 }}>
                    {prompts.map((p) => (
                        <button
                            key={p}
                            onClick={() => askAI(p)}
                            style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 5,
                                background: B.blueFaint,
                                color: B.blue,
                                border: 0,
                                borderRadius: 20,
                                padding: "7px 12px",
                                fontSize: 12,
                                fontWeight: 600,
                                cursor: "pointer",
                                fontFamily: "inherit",
                                textAlign: "left",
                            }}
                        >
                            <Lightbulb size={12} style={{ flexShrink: 0 }} /> {p}
                        </button>
                    ))}
                </div>
            )}

            <div style={{ display: "flex", gap: 8 }}>
                <input
                    type="text"
                    value={question}
                    onChange={(e) => setQuestion(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={messages.length > 0 ? "Ask a follow-up..." : "e.g. Which areas have the worst sales-rep coverage?"}
                    disabled={anyPending}
                    className="eb-input"
                    style={{ flex: 1, fontSize: 13.5 }}
                />
                <button
                    onClick={() => askAI()}
                    disabled={anyPending || !question.trim()}
                    style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                        flexShrink: 0,
                        background: B.blue,
                        color: "#fff",
                        border: 0,
                        borderRadius: 10,
                        padding: "0 16px",
                        fontSize: 13,
                        fontWeight: 700,
                        cursor: "pointer",
                        fontFamily: "inherit",
                        opacity: anyPending || !question.trim() ? 0.6 : 1,
                    }}
                >
                    <Send size={14} /> Ask
                </button>
            </div>
        </div>
    );
}

function SectionLabel({ children }) {
    return (
        <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: B.muted, textTransform: "uppercase", letterSpacing: 0.4 }}>
            {children}
        </p>
    );
}

function ConfidenceBadge({ confidence }) {
    if (!confidence) return null;
    const style = CONFIDENCE_STYLE[confidence.level] || CONFIDENCE_STYLE.Medium;
    const Icon = style.icon;
    return (
        <div
            title={confidence.note}
            style={{ display: "inline-flex", alignItems: "center", gap: 5, background: style.bg, color: style.color, borderRadius: 20, padding: "3px 10px", fontSize: 11, fontWeight: 700 }}
        >
            <Icon size={11} /> {confidence.level} confidence
        </div>
    );
}

function FlagsList({ flags }) {
    if (!flags || flags.length === 0) return null;
    return (
        <div>
            <SectionLabel>Findings</SectionLabel>
            <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 6 }}>
                {flags.map((f, i) => (
                    <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 7 }}>
                        <AlertTriangle size={13} style={{ color: SEVERITY_COLOR[f.severity] || B.muted, flexShrink: 0, marginTop: 2 }} />
                        <p style={{ margin: 0, fontSize: 12.5, color: B.text, lineHeight: 1.5 }}>{f.message}</p>
                    </div>
                ))}
            </div>
        </div>
    );
}

function MessageThread({ message, dateRange }) {
    if (message.isBrief) return <BriefCard message={message} dateRange={dateRange} />;

    return (
        <div>
            <p style={{ margin: "0 0 8px", fontSize: 13.5, fontWeight: 700, color: B.text }}>{message.question}</p>

            {message.pending && (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    <div className="eb-skeleton" style={{ height: 12, width: "90%", borderRadius: 6 }} />
                    <div className="eb-skeleton" style={{ height: 12, width: "75%", borderRadius: 6 }} />
                    <div className="eb-skeleton" style={{ height: 12, width: "60%", borderRadius: 6 }} />
                </div>
            )}

            {message.error && (
                <div style={{ background: B.redLight, border: "1px solid #FCA5A5", borderRadius: 10, padding: 14 }}>
                    <p style={{ margin: 0, fontSize: 13, color: B.red }}>{message.error}</p>
                </div>
            )}

            {message.result && (
                <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                    <p style={{ margin: 0, fontSize: 13.5, color: B.text, lineHeight: 1.6 }}>{message.result.answer}</p>

                    {message.result.key_points?.length > 0 && (
                        <ul style={{ margin: 0, paddingLeft: 18, display: "flex", flexDirection: "column", gap: 5 }}>
                            {message.result.key_points.map((point, i) => (
                                <li key={i} style={{ fontSize: 13, color: B.text, lineHeight: 1.55 }}>{point}</li>
                            ))}
                        </ul>
                    )}

                    <FlagsList flags={message.result.flags} />

                    {message.result.recommended_action && (
                        <div style={{ background: B.blueFaint, border: `1px solid ${B.blueLight}`, borderRadius: 10, padding: 14 }}>
                            <SectionLabel>Recommended Action</SectionLabel>
                            <p style={{ margin: "5px 0 0", fontSize: 13, color: B.blue, lineHeight: 1.55 }}>
                                {message.result.recommended_action}
                            </p>
                        </div>
                    )}

                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                        {/* Trust footer — a Regional Manager won't act on a number they
                            can't trace back to a filter, so always show the window the
                            answer was actually computed over. */}
                        <p style={{ margin: 0, fontSize: 11, color: B.muted }}>
                            Based on audits from {dateRange.label}
                            {message.result.queryType ? ` · ${message.result.queryType.replace(/_/g, " ")}` : ""}
                        </p>
                        <ConfidenceBadge confidence={message.result.confidence} />
                    </div>
                </div>
            )}
        </div>
    );
}

function BriefCard({ message, dateRange }) {
    return (
        <div style={{ border: `1px solid ${B.blueLight}`, borderRadius: 14, padding: 16, background: B.blueFaint }}>
            <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 10 }}>
                <FileBarChart size={15} style={{ color: B.blue }} />
                <p style={{ margin: 0, fontSize: 13, fontWeight: 800, color: B.blue }}>Weekly Executive Brief</p>
            </div>

            {message.pending && (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    <div className="eb-skeleton" style={{ height: 12, width: "90%", borderRadius: 6 }} />
                    <div className="eb-skeleton" style={{ height: 12, width: "70%", borderRadius: 6 }} />
                </div>
            )}

            {message.error && <p style={{ margin: 0, fontSize: 13, color: B.red }}>{message.error}</p>}

            {message.brief && (
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    <p style={{ margin: 0, fontSize: 13, color: B.text, lineHeight: 1.6 }}>{message.brief.summary}</p>

                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 10 }}>
                        <BriefStat label="Coverage" value={message.brief.coverage_pct != null ? `${message.brief.coverage_pct}%` : "—"} />
                        <BriefStat label="Promotion Activity" value={message.brief.promotion_activity_pct != null ? `${message.brief.promotion_activity_pct}%` : "—"} />
                        <BriefStat label="Top Competitor" value={message.brief.top_competitor || "—"} />
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                        {message.brief.best_area && (
                            <div>
                                <SectionLabel>Best Area</SectionLabel>
                                <p style={{ margin: "3px 0 0", fontSize: 12.5, fontWeight: 700, color: B.green }}>{message.brief.best_area.name}</p>
                                <p style={{ margin: 0, fontSize: 11.5, color: B.muted }}>{message.brief.best_area.detail}</p>
                            </div>
                        )}
                        {message.brief.worst_area && (
                            <div>
                                <SectionLabel>Worst Area</SectionLabel>
                                <p style={{ margin: "3px 0 0", fontSize: 12.5, fontWeight: 700, color: B.red }}>{message.brief.worst_area.name}</p>
                                <p style={{ margin: 0, fontSize: 11.5, color: B.muted }}>{message.brief.worst_area.detail}</p>
                            </div>
                        )}
                    </div>

                    {message.brief.critical_risks?.length > 0 && (
                        <div>
                            <SectionLabel>Critical Risks</SectionLabel>
                            <ul style={{ margin: "5px 0 0", paddingLeft: 18, display: "flex", flexDirection: "column", gap: 4 }}>
                                {message.brief.critical_risks.map((r, i) => (
                                    <li key={i} style={{ fontSize: 12.5, color: B.text, lineHeight: 1.5 }}>{r}</li>
                                ))}
                            </ul>
                        </div>
                    )}

                    {message.brief.recommended_actions?.length > 0 && (
                        <div>
                            <SectionLabel>Recommended Actions</SectionLabel>
                            <ol style={{ margin: "5px 0 0", paddingLeft: 18, display: "flex", flexDirection: "column", gap: 4 }}>
                                {message.brief.recommended_actions.map((r, i) => (
                                    <li key={i} style={{ fontSize: 12.5, color: B.text, lineHeight: 1.5 }}>{r}</li>
                                ))}
                            </ol>
                        </div>
                    )}

                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                        <p style={{ margin: 0, fontSize: 11, color: B.muted }}>Covers {dateRange.label}</p>
                        <ConfidenceBadge confidence={message.brief.confidence} />
                    </div>
                </div>
            )}
        </div>
    );
}

function BriefStat({ label, value }) {
    return (
        <div style={{ background: B.white, borderRadius: 10, padding: "8px 10px" }}>
            <p style={{ margin: 0, fontSize: 10.5, color: B.muted, fontWeight: 700, textTransform: "uppercase" }}>{label}</p>
            <p style={{ margin: "2px 0 0", fontSize: 14, fontWeight: 800, color: B.blue }}>{value}</p>
        </div>
    );
}
