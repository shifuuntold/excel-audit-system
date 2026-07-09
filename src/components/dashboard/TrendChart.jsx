import { B } from "../../config/theme";

// Lightweight bar-trend, no charting library needed
export default function TrendChart({ data }) {
    if (!data || data.length === 0) return null;

    const max = Math.max(...data.map((d) => d.count), 1);

    return (
        <div style={{ display: "flex", alignItems: "flex-end", gap: 10, height: 110 }}>
            {data.map((d) => {
                const heightPct = (d.count / max) * 100;
                const label = new Date(d.date + "T00:00:00").toLocaleDateString(undefined, { weekday: "short" });

                return (
                    <div
                        key={d.date}
                        style={{
                            flex: 1,
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "center",
                            gap: 6,
                            height: "100%",
                            justifyContent: "flex-end",
                        }}
                    >
                        <span style={{ fontSize: 11, fontWeight: 700, color: B.blue }}>
                            {d.count > 0 ? d.count : ""}
                        </span>
                        <div
                            title={`${d.count} audit${d.count === 1 ? "" : "s"} on ${d.date}`}
                            style={{
                                width: "100%",
                                maxWidth: 28,
                                height: `${Math.max(heightPct, 4)}%`,
                                background: d.count > 0 ? B.blue : B.blueLight,
                                borderRadius: 6,
                                transition: "height .2s ease",
                            }}
                        />
                        <span style={{ fontSize: 10, color: B.muted, fontWeight: 600 }}>
                            {label}
                        </span>
                    </div>
                );
            })}
        </div>
    );
}
