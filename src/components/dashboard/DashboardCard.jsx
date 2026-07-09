import { B } from "../../config/theme";

export default function DashboardCard({ title, description, icon: Icon, onClick }) {
    return (
        <button
            onClick={onClick}
            disabled={!onClick}
            style={{
                background: B.white,
                borderRadius: 16,
                border: `1px solid ${B.blueLight}`,
                boxShadow: "0 2px 14px rgba(0,48,135,0.07)",
                padding: 22,
                textAlign: "left",
                width: "100%",
                cursor: onClick ? "pointer" : "default",
                opacity: onClick ? 1 : 0.6,
                transition: "transform .15s ease, box-shadow .15s ease",
                fontFamily: "inherit",
            }}
            onMouseEnter={(e) => {
                if (!onClick) return;
                e.currentTarget.style.transform = "translateY(-2px)";
                e.currentTarget.style.boxShadow = "0 8px 24px rgba(0,48,135,0.14)";
            }}
            onMouseLeave={(e) => {
                e.currentTarget.style.transform = "translateY(0)";
                e.currentTarget.style.boxShadow = "0 2px 14px rgba(0,48,135,0.07)";
            }}
        >
            <div
                style={{
                    width: 44,
                    height: 44,
                    borderRadius: 12,
                    background: B.blueFaint,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    marginBottom: 16,
                }}
            >
                <Icon size={22} style={{ color: B.blue }} />
            </div>

            <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: B.text }}>
                {title}
            </h3>

            <p style={{ color: B.muted, marginTop: 6, fontSize: 13.5, lineHeight: 1.4 }}>
                {description}
            </p>
        </button>
    );
}
