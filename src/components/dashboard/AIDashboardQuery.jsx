    import { useState } from "react";
    import { supabase } from "../../lib/supabase";

    export default function AIDashboardQuery() {
    const [question, setQuestion] = useState("");
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState(null);
    const [error, setError] = useState(null);

    const askAI = async () => {
        if (!question.trim()) return;

        setLoading(true);
        setError(null);
        setResult(null);

        try {
        const { data, error } = await supabase.functions.invoke(
            "ai-dashboard-query",
            {
            body: {
                question: question.trim(),
                startDate: "2026-07-10",
                endDate: "2026-07-25",
            },
            }
        );

        if (error) {
            throw error;
        }

        if (!data?.success) {
            throw new Error(
            data?.error || "AI request failed"
            );
        }

        setResult(data);
        } catch (err) {
        console.error("AI Dashboard Query Error:", err);
        setError(
            err.message ||
            "Something went wrong while contacting the AI."
        );
        } finally {
        setLoading(false);
        }
    };

    const handleKeyDown = (e) => {
        if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        askAI();
        }
    };

    return (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
        <div className="mb-5">
            <h2 className="text-xl font-semibold text-gray-900">
            AI Audit Analyst
            </h2>

            <p className="text-sm text-gray-500 mt-1">
            Ask questions about your field sales audit data.
            </p>
        </div>

        <div className="flex gap-3">
            <input
            type="text"
            value={question}
            onChange={(e) =>
                setQuestion(e.target.value)
            }
            onKeyDown={handleKeyDown}
            placeholder="e.g. Which areas have the worst sales-rep coverage?"
            className="flex-1 rounded-lg border border-gray-300 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={loading}
            />

            <button
            onClick={askAI}
            disabled={
                loading || !question.trim()
            }
            className="rounded-lg bg-blue-600 px-6 py-3 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
            {loading ? "Analyzing..." : "Ask AI"}
            </button>
        </div>

        {error && (
            <div className="mt-4 rounded-lg bg-red-50 border border-red-200 p-4">
            <p className="text-sm text-red-700">
                {error}
            </p>
            </div>
        )}

        {result && (
            <div className="mt-6 space-y-5">
            <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                AI Analysis
                </p>

                <p className="mt-2 text-gray-800 leading-relaxed">
                {result.answer}
                </p>
            </div>

            {result.key_points?.length > 0 && (
                <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                    Key Points
                </p>

                <ul className="mt-2 space-y-2">
                    {result.key_points.map(
                    (point, index) => (
                        <li
                        key={index}
                        className="flex gap-2 text-sm text-gray-700"
                        >
                        <span>•</span>
                        <span>{point}</span>
                        </li>
                    )
                    )}
                </ul>
                </div>
            )}

            {result.recommended_action && (
                <div className="rounded-lg bg-blue-50 border border-blue-200 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">
                    Recommended Action
                </p>

                <p className="mt-1 text-sm text-blue-900">
                    {result.recommended_action}
                </p>
                </div>
            )}

            <div className="text-xs text-gray-400">
                Query type: {result.queryType}
            </div>
            </div>
        )}
        </div>
    );
    }