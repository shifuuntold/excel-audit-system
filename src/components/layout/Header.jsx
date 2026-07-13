import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { B } from "../../config/theme";
import excelLogo from "../../assets/excel-logo.png";

export default function Header({ title, subtitle, backTo, action }) {
    const navigate = useNavigate();

    return (
        <div
            style={{
                background: `linear-gradient(135deg, ${B.blue} 0%, ${B.blueMid} 100%)`,
                color: B.white,
                padding: "24px 20px",
                boxShadow: "0 4px 16px rgba(0,48,135,0.18)",
            }}
        >
            <div
                style={{
                    maxWidth: 960,
                    margin: "0 auto",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 12,
                }}
            >
                <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
                    {backTo && (
                        <button
                            onClick={() => navigate(backTo)}
                            aria-label="Go back"
                            style={{
                                background: "rgba(255,255,255,0.14)",
                                border: "none",
                                borderRadius: 999,
                                width: 36,
                                height: 36,
                                flexShrink: 0,
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                cursor: "pointer",
                                color: B.white,
                            }}
                        >
                            <ArrowLeft size={18} />
                        </button>
                    )}

                    <img
                        src={excelLogo}
                        alt="Excel Chemicals"
                        style={{
                            height: 40,
                            maxWidth: 130,
                            objectFit: "contain",
                            borderRadius: 8,
                            background: "#fff",
                            padding: "4px 8px",
                            flexShrink: 0,
                        }}
                        onError={(e) => { e.target.style.display = "none"; }}
                    />

                    <div style={{ minWidth: 0 }}>
                        <h1
                            style={{
                                fontSize: 22,
                                fontWeight: 700,
                                margin: 0,
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
                                    fontSize: 13,
                                    color: "rgba(255,255,255,0.78)",
                                }}
                            >
                                {subtitle}
                            </p>
                        )}
                    </div>
                </div>

                {action && <div style={{ flexShrink: 0 }}>{action}</div>}
            </div>
        </div>
    );
}
