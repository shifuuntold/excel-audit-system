import { useEffect, useRef, useState } from "react";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../hooks/useAuth";
import { loadConversation, saveConversation, clearConversation } from "../../services/aiConversationService";
import { speakText, stopSpeaking } from "../../utils/speech";
import { B } from "../../config/theme";
import {
    Send, Lightbulb, FileBarChart, AlertTriangle, ShieldAlert, ShieldCheck,
    Copy, Check, RotateCcw, Volume2, VolumeX, ThumbsUp, ThumbsDown, Trash2,
} from "lucide-react";

// A large pool so the same 4-6 questions never show twice in a row — see
// pickPrompts() below, which biases toward page-context questions but
// samples randomly from the full pool each time the assistant opens.
const CONTEXT_POOL = {
    dashboard: [
        "Which areas have the worst sales-rep coverage?",
        "What needs urgent attention right now?",
        "What changed compared to last week?",
    ],
    history: [
        "Which outlets haven't been visited recently?",
        "What are retailers complaining about most?",
        "Which outlets should be revisited first?",
    ],
    team: [
        "Which outlets still require visits today?",
        "Which auditor has the heaviest workload?",
        "What should I prioritize tomorrow?",
        "Which auditor is most productive right now?",
    ],
    reports: [
        "Summarize this period's audit findings",
        "What changed compared to last month?",
        "What are the biggest risks this month?",
    ],
    admin: [
        "Are there any data quality issues I should know about?",
        "Which areas have had the most audit activity?",
    ],
};

const GENERAL_POOL = [
    "Which area needs urgent attention?",
    "Which products are losing visibility?",
    "Which distributors are underperforming?",
    "Which area improved the most?",
    "Which competitors are gaining ground?",
    "Where is Fruitfull penetration weakest?",
    "Which areas have the strongest coverage?",
    "Which outlets have never received a promotion?",
    "What's our biggest coverage gap right now?",
    "Which distributor dominates supply in the top area?",
    "How is promotion activity trending?",
    "Which products have the strongest distribution?",
    "Which areas rely on a single distributor?",
    "What does the competitive landscape look like this month?",
    "Which outlets are overdue for a follow-up?",
    "Is field coverage improving or declining?",
    "Where are we most exposed to competitors?",
    "What should management focus on this week?",
];

function shuffledSample(pool, count) {
    const arr = [...pool];
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr.slice(0, count);
}

/** 1-2 context-relevant prompts up front, filled out with a random sample
 * from the general pool — so it's always relevant AND never identical
 * twice in a row. */
function pickPrompts(pageContext) {
    const contextPrompts = shuffledSample(CONTEXT_POOL[pageContext] || [], 2);
    const rest = shuffledSample(
        GENERAL_POOL.filter((p) => !contextPrompts.includes(p)),
        3
    );
    return [...contextPrompts, ...rest];
}

const CONFIDENCE_STYLE = {
    High: { icon: ShieldCheck, color: B.green, bg: "#ECFDF5" },
    Medium: { icon: ShieldAlert, color: B.amber, bg: "#FFFBEB" },
    Low: { icon: ShieldAlert, color: B.red, bg: B.redLight },
};

const SEVERITY_COLOR = { high: B.red, medium: B.amber, low: B.muted };

let nextId = 1;

export default function AIDashboardQuery({ dateRange, pageContext }) {
    const { user } = useAuth();
    const [question, setQuestion] = useState("");
    const [messages, setMessages] = useState([]); // { id, question, result, brief, error, pending, feedback }
    const [briefPending, setBriefPending] = useState(false);
    const [loaded, setLoaded] = useState(false);
    const [speakingId, setSpeakingId] = useState(null);
    const speechController = useRef(null);
    // Sampled once per mount (i.e. each time the assistant sheet opens) —
    // see pickPrompts() for why this rotates instead of always showing the
    // same handful of questions.
    const [prompts] = useState(() => pickPrompts(pageContext));
    const anyPending = messages.some((m) => m.pending) || briefPending;

    // Stops any speech in progress the moment this component unmounts
    // (sheet closed, navigated away) — otherwise a report keeps talking
    // in the background with no visible control left to stop it.
    useEffect(() => () => stopSpeaking(), []);

    // Restore the persisted conversation on open — survives closing the
    // sheet, refreshing, and logging back in later, instead of resetting
    // every time like the original popup did.
    useEffect(() => {
        if (!user) return;
        let cancelled = false;
        loadConversation(user.id)
            .then((saved) => {
                if (cancelled) return;
                if (saved.length > 0) {
                    nextId = Math.max(...saved.map((m) => m.id), 0) + 1;
                    setMessages(saved);
                }
            })
            .catch((err) => console.error("Failed to load AI conversation:", err))
            .finally(() => { if (!cancelled) setLoaded(true); });
        return () => { cancelled = true; };
    }, [user]);

    // Persist whenever the thread settles (no message mid-flight) — after
    // the initial load has completed, so we never overwrite a saved
    // conversation with the empty array this component starts with.
    useEffect(() => {
        if (!user || !loaded || anyPending) return;
        saveConversation(user.id, messages).catch((err) => console.error("Failed to save AI conversation:", err));
    }, [messages, loaded, anyPending, user]);

    function buildHistory() {
        // Last couple of resolved Q&A turns, so a follow-up like "why?" has
        // something to refer back to — see formatHistory() in the edge function.
        return messages
            .filter((m) => m.result?.answer)
            .slice(-2)
            .map((m) => ({ question: m.question, answer: m.result.answer }));
    }

    async function askAI(overrideQuestion, existingId) {
        const text = (overrideQuestion ?? question).trim();
        if (!text) return;

        const id = existingId ?? nextId++;
        if (existingId) {
            setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, result: null, error: null, pending: true } : m)));
        } else {
            setMessages((prev) => [...prev, { id, question: text, result: null, error: null, pending: true, feedback: null }]);
            setQuestion("");
        }

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

    function setFeedback(id, feedback) {
        setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, feedback: m.feedback === feedback ? null : feedback } : m)));
    }

    function toggleReadAloud(id, text) {
        if (speakingId === id) {
            speechController.current?.stop();
            speechController.current = null;
            setSpeakingId(null);
            return;
        }
        speechController.current?.stop();
        setSpeakingId(id);
        speechController.current = speakText(text, {
            onEnd: () => setSpeakingId(null),
            onError: (err) => {
                console.error("Read aloud failed:", err);
                setSpeakingId(null);
            },
        });
    }

    async function handleNewConversation() {
        stopSpeaking();
        speechController.current = null;
        setSpeakingId(null);
        setMessages([]);
        if (user) {
            try {
                await clearConversation(user.id);
            } catch (err) {
                console.error("Failed to clear AI conversation:", err);
            }
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
                <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 10 }}>
                    <button
                        onClick={handleNewConversation}
                        style={{
                            display: "flex", alignItems: "center", gap: 5,
                            background: "none", border: 0, color: B.muted,
                            fontSize: 11.5, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", padding: 0,
                        }}
                    >
                        <Trash2 size={12} /> New conversation
                    </button>
                </div>
            )}

            {messages.length > 0 && (
                <div style={{ display: "flex", flexDirection: "column", gap: 18, marginBottom: 18 }}>
                    {messages.map((m) => (
                        <MessageThread
                            key={m.id}
                            message={m}
                            dateRange={dateRange}
                            onRegenerate={() => askAI(m.question, m.id)}
                            onFeedback={(fb) => setFeedback(m.id, fb)}
                            speaking={speakingId === m.id}
                            onToggleReadAloud={(text) => toggleReadAloud(m.id, text)}
                        />
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

function MessageThread({ message, dateRange, onRegenerate, onFeedback, speaking, onToggleReadAloud }) {
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

                    <MessageControls
                        message={message}
                        onRegenerate={onRegenerate}
                        onFeedback={onFeedback}
                        speaking={speaking}
                        onToggleReadAloud={onToggleReadAloud}
                    />

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

function MessageControls({ message, onRegenerate, onFeedback, speaking, onToggleReadAloud }) {
    const [copied, setCopied] = useState(false);
    const canReadAloud = typeof window !== "undefined" && "speechSynthesis" in window;

    function formattedText() {
        const parts = [message.result.answer];
        if (message.result.key_points?.length > 0) {
            parts.push("\nKey Points:\n" + message.result.key_points.map((p) => `- ${p}`).join("\n"));
        }
        if (message.result.recommended_action) {
            parts.push(`\nRecommended Action:\n${message.result.recommended_action}`);
        }
        return parts.join("\n");
    }

    async function handleCopy() {
        try {
            await navigator.clipboard.writeText(formattedText());
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch (err) {
            console.error("Copy failed:", err);
        }
    }

    const iconBtnStyle = {
        display: "flex", alignItems: "center", justifyContent: "center",
        width: 26, height: 26, borderRadius: 8, border: 0,
        background: "transparent", color: B.muted, cursor: "pointer",
    };

    return (
        <div style={{ display: "flex", alignItems: "center", gap: 2, marginTop: -6 }}>
            <button onClick={handleCopy} title="Copy" style={iconBtnStyle}>
                {copied ? <Check size={14} style={{ color: B.green }} /> : <Copy size={13} />}
            </button>
            {canReadAloud && (
                <button onClick={() => onToggleReadAloud(message.result.answer)} title={speaking ? "Stop" : "Read aloud"} style={iconBtnStyle}>
                    {speaking ? <VolumeX size={14} style={{ color: B.blue }} /> : <Volume2 size={13} />}
                </button>
            )}
            <button onClick={onRegenerate} title="Regenerate" style={iconBtnStyle}>
                <RotateCcw size={13} />
            </button>
            <span style={{ width: 1, height: 16, background: B.blueLight, margin: "0 4px" }} />
            <button onClick={() => onFeedback("helpful")} title="Helpful" style={iconBtnStyle}>
                <ThumbsUp size={13} style={message.feedback === "helpful" ? { color: B.green } : undefined} />
            </button>
            <button onClick={() => onFeedback("unhelpful")} title="Not helpful" style={iconBtnStyle}>
                <ThumbsDown size={13} style={message.feedback === "unhelpful" ? { color: B.red } : undefined} />
            </button>
            {copied && <span style={{ fontSize: 11, color: B.green, fontWeight: 600, marginLeft: 2 }}>Copied!</span>}
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
