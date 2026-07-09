import { Loader2 } from "lucide-react";
import { B } from "../../config/theme";

export default function LoadingSpinner({ label = "Loading...", fullScreen = false }) {
    const content = (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
            <Loader2 size={28} className="animate-spin" style={{ color: B.blue }} />
            {label && (
                <p style={{ fontSize: 14, color: B.muted, fontWeight: 500 }}>
                    {label}
                </p>
            )}
        </div>
    );

    if (!fullScreen) return content;

    return (
        <div
            style={{
                minHeight: "100vh",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: B.bg,
            }}
        >
            {content}
        </div>
    );
}
