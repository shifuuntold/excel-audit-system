import { B } from "../../config/theme";

const CHART_HEIGHT = 110;
const LABEL_ROW_HEIGHT = 16; // fixed height for both the count label and day label rows
const BAR_TRACK_HEIGHT = CHART_HEIGHT - LABEL_ROW_HEIGHT * 2 - 12; // minus row heights and gaps
const MIN_BAR_HEIGHT = 4;

// Lightweight bar-trend, no charting library needed.
//
// Bar heights are computed as explicit pixel values here rather than CSS
// percentages, and every label sits in a fixed-height row regardless of
// whether it has text — both deliberately, so bar sizing can never be
// thrown off by how flexbox resolves percentage heights or by different
// columns' labels taking up different amounts of space.
export default function TrendChart({ data }) {
    if (!data || data.length === 0) return null;

    const max = Math.max(...data.map((d) => d.count), 1);

    return (
        <div style={{ display: "flex", alignItems: "flex-end", gap: 10, height: CHART_HEIGHT }}>
            {data.map((d) => {
                const barHeight = Math.max((d.count / max) * BAR_TRACK_HEIGHT, MIN_BAR_HEIGHT);
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
                            <span style={{ fontSize: 11, fontWeight: 700, color: B.blue, lineHeight: 1 }}>
                                {d.count > 0 ? d.count : ""}
                            </span>
                        </div>

                        <div style={{ height: BAR_TRACK_HEIGHT, display: "flex", alignItems: "flex-end", marginTop: 6 }}>
                            <div
                                title={`${d.count} audit${d.count === 1 ? "" : "s"} on ${d.date}`}
                                style={{
                                    width: "100%",
                                    maxWidth: 28,
                                    height: `${barHeight}px`,
                                    background: d.count > 0 ? B.blue : B.blueLight,
                                    borderRadius: 6,
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
