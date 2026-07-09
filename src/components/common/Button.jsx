import { Loader2 } from "lucide-react";

const SIZES = {
    sm: { padding: "8px 14px", fontSize: 13, borderRadius: 8 },
    md: { padding: "12px 20px", fontSize: 15, borderRadius: 10 },
    lg: { padding: "14px 26px", fontSize: 16, borderRadius: 12 },
};

export default function Button({
    children,
    variant = "primary",
    size = "md",
    fullWidth = false,
    loading = false,
    disabled = false,
    type = "button",
    icon: Icon,
    onClick,
    className = "",
    style = {},
}) {
    return (
        <button
            type={type}
            onClick={onClick}
            disabled={disabled || loading}
            className={`eb-btn eb-btn-${variant} ${className}`}
            style={{
                ...SIZES[size],
                width: fullWidth ? "100%" : "auto",
                ...style,
            }}
        >
            {loading ? (
                <Loader2 size={16} className="animate-spin" />
            ) : (
                Icon && <Icon size={16} />
            )}
            {children}
        </button>
    );
}
