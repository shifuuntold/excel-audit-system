import { useNavigate } from "react-router-dom";
import { B } from "../config/theme";
import excelLogo from "../assets/excel-logo.png";
import Button from "../components/common/Button";
import { CheckCircle2 } from "lucide-react";

/**
 * Where Supabase's "Confirm signup" email link should redirect to (set
 * this as the redirect URL on that email template in Supabase Auth
 * settings — Authentication > Email Templates > Confirm signup — it
 * defaults to a raw Supabase-hosted confirmation page otherwise, which is
 * the "confusing technical screen" this replaces).
 */
export default function EmailConfirmed() {
    const navigate = useNavigate();

    return (
        <div
            style={{
                minHeight: "100vh",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: `linear-gradient(135deg, ${B.blue} 0%, ${B.blueMid} 100%)`,
                padding: 20,
            }}
        >
            <div
                style={{
                    background: B.white,
                    padding: 40,
                    borderRadius: 20,
                    boxShadow: "0 20px 50px rgba(0,48,135,0.25)",
                    width: "100%",
                    maxWidth: 380,
                    textAlign: "center",
                }}
            >
                <img
                    src={excelLogo}
                    alt="Excel Chemicals"
                    style={{ height: 60, maxWidth: "70%", display: "block", margin: "0 auto 20px", objectFit: "contain" }}
                    onError={(e) => { e.target.style.display = "none"; }}
                />

                <div
                    style={{
                        width: 64,
                        height: 64,
                        borderRadius: "50%",
                        background: "#ECFDF5",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        margin: "0 auto 18px",
                    }}
                >
                    <CheckCircle2 size={34} style={{ color: B.green }} />
                </div>

                <h1 style={{ fontSize: 20, fontWeight: 700, color: B.text, margin: 0 }}>
                    Account Verified
                </h1>
                <p style={{ color: B.muted, marginTop: 8, marginBottom: 28, fontSize: 14, lineHeight: 1.6 }}>
                    Welcome to Excel Chemicals Audit System.<br />
                    Your email has been confirmed and your account is ready to use.
                </p>

                <Button variant="primary" onClick={() => navigate("/dashboard")} style={{ width: "100%" }}>
                    Continue to Dashboard
                </Button>
            </div>
        </div>
    );
}
