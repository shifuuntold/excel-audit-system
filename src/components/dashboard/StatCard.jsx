import { B } from "../../config/theme";

export default function StatCard({ title, value, subtitle, icon: Icon }) {
    return (
        <div
            style={{
                background: B.white,
                borderRadius: 16,
                border: `1px solid ${B.blueLight}`,
                boxShadow: "0 2px 14px rgba(0,48,135,0.07)",
                padding: 20,
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
            }}
        >
            <div>
                <p style={{ fontSize: 13, color: B.muted, margin: 0 }}>{title}</p>
                <h2 style={{ fontSize: 28, fontWeight: 700, margin: "6px 0 0", color: B.text }}>
                    {value}
                </h2>
                <p style={{ fontSize: 12, color: B.muted, marginTop: 6 }}>{subtitle}</p>
            </div>

            <div
                style={{
                    width: 40,
                    height: 40,
                    borderRadius: 10,
                    background: B.blueFaint,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                }}
            >
                <Icon size={20} style={{ color: B.blue }} />
            </div>
        </div>
    );
}
