import { B } from "../../config/theme";

const CHART_HEIGHT = 110;
const LABEL_ROW_HEIGHT = 16; // fixed height for both the count label and day label rows
const BAR_TRACK_HEIGHT = CHART_HEIGHT - LABEL_ROW_HEIGHT * 2 - 12; // minus row heights and gaps
const MIN_BAR_HEIGHT = 6;

// Lightweight bar-trend, no charting library needed.
//
// Bar heights are computed as explicit pixel values here rather than CSS
// percentages, and every label sits in a fixed-height row regardless of
// whether it has text — both deliberately, so bar sizing can never be
// thrown off by how flexbox resolves percentage heights or by different
// columns' labels taking up different amounts of space.
//
// A zero-count day used to render as a genuinely blank column — no count
// label (the label was conditionally hidden for count === 0) and a bar
// filled in B.blueLight, which is close enough to the card's white
// background to be indistinguishable at a glance. On a week with a couple
// of quiet days (weekends, no visits), that reads as "the chart is
// broken" rather than "there were zero audits that day" — which is
// exactly the bug being reported. Both zero-day cases are now rendered
// explicitly instead of being invisible by omission.
export default function TrendChart({ data }) {
    if (!data || data.length === 0) {
        return (
            <div style={{ height: CHART_HEIGHT, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <p style={{ fontSize: 12.5, color: B.muted, margin: 0 }}>No audit data for this period yet.</p>
            </div>
        );
    }

    const max = Math.max(...data.map((d) => d.count), 1);

    return (
        <div style={{ display: "flex", alignItems: "flex-end", gap: 10, height: CHART_HEIGHT }}>
            {data.map((d) => {
                const hasData = d.count > 0;
                const barHeight = hasData ? Math.max((d.count / max) * BAR_TRACK_HEIGHT, MIN_BAR_HEIGHT) : MIN_BAR_HEIGHT;
                const label = new Date(d.date + "T00:00:00").toLocaleDateString(undefined, { weekday: "short" });

                return (
                    <div
                        key={d.date}
                        style={{
                            flex: 1,
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "center",
                            height: CHART_HEIGHT,
                        }}
                    >
                        <div style={{ height: LABEL_ROW_HEIGHT, display: "flex", alignItems: "flex-end" }}>
                            <span style={{ fontSize: 11, fontWeight: 700, color: hasData ? B.blue : B.muted, lineHeight: 1 }}>
                                {hasData ? d.count : "0"}
                            </span>
                        </div>

                        <div style={{ height: BAR_TRACK_HEIGHT, display: "flex", alignItems: "flex-end", marginTop: 6 }}>
                            <div
                                title={`${d.count} audit${d.count === 1 ? "" : "s"} on ${d.date}`}
                                style={{
                                    width: "100%",
                                    maxWidth: 28,
                                    height: `${barHeight}px`,
                                    background: hasData ? B.blue : "transparent",
                                    border: hasData ? "none" : `1.5px dashed ${B.border}`,
                                    borderRadius: 6,
                                    boxSizing: "border-box",
                                    transition: "height .2s ease",
                                }}
                            />
                        </div>

                        <div style={{ height: LABEL_ROW_HEIGHT, display: "flex", alignItems: "flex-start", marginTop: 6 }}>
                            <span style={{ fontSize: 10, color: B.muted, fontWeight: 600, lineHeight: 1 }}>
                                {label}
                            </span>
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
