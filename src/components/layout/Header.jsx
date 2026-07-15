import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { B } from "../../config/theme";
import excelLogo from "../../assets/excel-logo.png";

export default function Header({ title, subtitle, backTo, action }) {
    const navigate = useNavigate();

    return (
        <div
            style={{
                background: B.white,
                borderBottom: `1px solid ${B.border}`,
                boxShadow: "0 1px 3px rgba(0,48,135,0.06)",
                position: "relative",
            }}
        >
            <div
                style={{
                    maxWidth: 960,
                    margin: "0 auto",
                    padding: "18px 20px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 12,
                }}
            >
                <div style={{ display: "flex", alignItems: "center", gap: 14, minWidth: 0 }}>
                    {backTo && (
                        <button
                            onClick={() => (backTo === "-1" ? navigate(-1) : navigate(backTo))}
                            aria-label="Go back"
                            style={{
                                background: B.blueFaint,
                                border: "none",
                                borderRadius: 999,
                                width: 36,
                                height: 36,
                                flexShrink: 0,
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                cursor: "pointer",
                                color: B.blue,
                            }}
                        >
                            <ArrowLeft size={18} />
                        </button>
                    )}

                    <img
                        src={excelLogo}
                        alt="Excel Chemicals"
                        style={{
                            height: 46,
                            maxWidth: 150,
                            objectFit: "contain",
                            flexShrink: 0,
                        }}
                        onError={(e) => { e.target.style.display = "none"; }}
                    />

                    <div style={{ minWidth: 0, borderLeft: `1.5px solid ${B.border}`, paddingLeft: 14 }}>
                        <h1
                            style={{
                                fontSize: 19,
                                fontWeight: 800,
                                margin: 0,
                                color: B.blue,
                                whiteSpace: "nowrap",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                            }}
                        >
                            {title}
                        </h1>
                        {subtitle && (
                            <p
                                style={{
                                    margin: 0,
                                    marginTop: 2,
                                    fontSize: 12.5,
                                    color: B.muted,
                                    whiteSpace: "nowrap",
                                    overflow: "hidden",
                                    textOverflow: "ellipsis",
                                }}
                            >
                                {subtitle}
                            </p>
                        )}
                    </div>
                </div>

                {action && <div style={{ flexShrink: 0 }}>{action}</div>}
            </div>

            {/* Signature accent: a hard-edged colour break rather than a
                smooth gradient, echoing the diagonal cut through the logo. */}
            <div
                style={{
                    height: 3,
                    background: `linear-gradient(100deg, ${B.blue} 0%, ${B.blue} 78%, ${B.red} 78%, ${B.red} 100%)`,
                }}
            />
        </div>
    );
}
