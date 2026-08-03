import { useState } from "react";
import { useAuth } from "../../hooks/useAuth";
import { canViewAllAudits } from "../../utils/roles";
import { B } from "../../config/theme";
import { Sparkles, X } from "lucide-react";
import AIDashboardQuery from "./AIDashboardQuery";

function daysAgo(n) {
    const d = new Date();
    d.setDate(d.getDate() - n);
    return d.toISOString().slice(0, 10);
}

const RANGE_OPTIONS = [
    { key: "7", label: "Last 7 Days", days: 7 },
    { key: "30", label: "Last 30 Days", days: 30 },
    { key: "90", label: "Last 90 Days", days: 90 },
];

/**
 * The floating "AI Audit Analyst" entry point — a FAB that expands into a
 * bottom sheet wrapping AIDashboardQuery.
 *
 * Deliberately scoped to Supervisors/Admins only (canViewAllAudits): the
 * questions this answers ("which areas have the worst coverage") are
 * management questions, and every query costs a Gemini call, so there's
 * no upside to exposing it to every field auditor's session.
 *
 * `pageContext` lets each page hand it a short label ("dashboard",
 * "history", "team", "reports", "admin") so the suggested prompts inside
 * AIDashboardQuery match what someone on that page is actually thinking
 * about — see the mapping in AIDashboardQuery.jsx.
 */
export default function AIAssistant({ pageContext = "dashboard" }) {
    const { profile } = useAuth();
    const [open, setOpen] = useState(false);
    const [rangeKey, setRangeKey] = useState("30");

    if (!canViewAllAudits(profile?.role)) return null;

    const range = RANGE_OPTIONS.find((r) => r.key === rangeKey);
    const dateRange = {
        startDate: daysAgo(range.days),
        endDate: daysAgo(0),
        label: range.label.toLowerCase(),
    };

    return (
        <>
            {!open && (
                <button
                    onClick={() => setOpen(true)}
                    aria-label="Ask the AI Audit Analyst"
                    style={{
                        position: "fixed",
                        right: 18,
                        // Clears the bottom nav bar on the pages that have one;
                        // on pages without it this just sits a little higher,
                        // which is fine.
                        bottom: 84,
                        width: 56,
                        height: 56,
                        borderRadius: "50%",
                        background: `linear-gradient(135deg, ${B.blue}, ${B.blueMid})`,
                        color: "#fff",
                        border: "none",
                        boxShadow: "0 8px 24px rgba(0,48,135,0.35)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        cursor: "pointer",
                        zIndex: 40,
                    }}
                >
                    <Sparkles size={24} />
                </button>
            )}

            {open && (
                <div
                    onClick={() => setOpen(false)}
                    style={{
                        position: "fixed",
                        inset: 0,
                        background: "rgba(15,23,42,0.45)",
                        zIndex: 49,
                        animation: "eb-fade-in .15s ease",
                    }}
                >
                    <div
                        onClick={(e) => e.stopPropagation()}
                        style={{
                            position: "fixed",
                            left: 0,
                            right: 0,
                            bottom: 0,
                            maxWidth: 640,
                            margin: "0 auto",
                            background: B.white,
                            borderRadius: "20px 20px 0 0",
                            maxHeight: "85vh",
                            display: "flex",
                            flexDirection: "column",
                            boxShadow: "0 -8px 32px rgba(0,0,0,0.2)",
                            zIndex: 50,
                            animation: "eb-sheet-up .2s ease",
                        }}
                    >
                        <div style={{ padding: "18px 20px 12px", borderBottom: `1px solid ${B.blueLight}`, flexShrink: 0 }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
                                <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                                    <div
                                        style={{
                                            width: 36,
                                            height: 36,
                                            borderRadius: 10,
                                            background: `linear-gradient(135deg, ${B.blue}, ${B.blueMid})`,
                                            display: "flex",
                                            alignItems: "center",
                                            justifyContent: "center",
                                            flexShrink: 0,
                                        }}
                                    >
                                        <Sparkles size={17} color="#fff" />
                                    </div>
                                    <div style={{ minWidth: 0 }}>
                                        <h2 style={{ margin: 0, fontSize: 15.5, fontWeight: 800, color: B.text }}>
                                            AI Audit Analyst
                                        </h2>
                                        <p style={{ margin: "1px 0 0", fontSize: 12, color: B.muted }}>
                                            Ask questions about your field audit data
                                        </p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => setOpen(false)}
                                    aria-label="Close"
                                    style={{
                                        background: B.blueFaint,
                                        border: 0,
                                        borderRadius: "50%",
                                        width: 30,
                                        height: 30,
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        cursor: "pointer",
                                        flexShrink: 0,
                                    }}
                                >
                                    <X size={15} color={B.muted} />
                                </button>
                            </div>

                            <div style={{ display: "flex", gap: 6, marginTop: 14 }}>
                                {RANGE_OPTIONS.map((r) => (
                                    <button
                                        key={r.key}
                                        onClick={() => setRangeKey(r.key)}
                                        style={{
                                            border: `1.5px solid ${rangeKey === r.key ? B.blue : B.border}`,
                                            background: rangeKey === r.key ? B.blue : "transparent",
                                            color: rangeKey === r.key ? "#fff" : B.muted,
                                            borderRadius: 16,
                                            padding: "5px 12px",
                                            fontSize: 11.5,
                                            fontWeight: 700,
                                            cursor: "pointer",
                                            fontFamily: "inherit",
                                        }}
                                    >
                                        {r.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div style={{ padding: 20, overflowY: "auto" }}>
                            <AIDashboardQuery dateRange={dateRange} pageContext={pageContext} />
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
