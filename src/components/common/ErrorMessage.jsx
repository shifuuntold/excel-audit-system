import { B } from "../../config/theme";
import { AlertCircle } from "lucide-react";

export default function ErrorMessage({ children }) {
    if (!children) return null;

    return (
        <div
            style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                background: B.redLight,
                color: B.red,
                border: `1px solid ${B.red}22`,
                borderRadius: 10,
                padding: "10px 14px",
                fontSize: 13,
                fontWeight: 500,
                marginBottom: 16,
            }}
        >
            <AlertCircle size={16} style={{ flexShrink: 0 }} />
            <span>{children}</span>
        </div>
    );
}
