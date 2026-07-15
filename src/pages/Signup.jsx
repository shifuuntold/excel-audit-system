import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { B } from "../config/theme";
import excelLogo from "../assets/excel-logo.png";
import Button from "../components/common/Button";
import Input from "../components/common/Input";
import ErrorMessage from "../components/common/ErrorMessage";
import { CheckCircle2 } from "lucide-react";

export default function Signup() {
    const navigate = useNavigate();

    const [fullName, setFullName] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [awaitingConfirmation, setAwaitingConfirmation] = useState(false);

    async function handleSignup(e) {
        e.preventDefault();
        setLoading(true);
        setError("");

        if (password.length < 6) {
            setError("Password must be at least 6 characters.");
            setLoading(false);
            return;
        }

        const { data, error } = await supabase.auth.signUp({
            email,
            password,
            options: {
                data: { full_name: fullName },
                // Without this, Supabase falls back to the Site URL set in
                // its dashboard — which defaults to localhost and is easy
                // to forget to update after deploying. Setting it here
                // means the confirmation link always lands back on
                // whatever domain the app is actually running on.
                emailRedirectTo: window.location.origin,
            },
        });

        setLoading(false);

        if (error) {
            setError(error.message);
            return;
        }

        if (data.session) {
            // Email confirmation is off — signed in immediately
            navigate("/dashboard");
        } else {
            // Email confirmation is required before they can log in
            setAwaitingConfirmation(true);
        }
    }

    if (awaitingConfirmation) {
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
                        style={{ height: 44, display: "block", margin: "0 auto 20px", objectFit: "contain" }}
                        onError={(e) => { e.target.style.display = "none"; }}
                    />

                    <div
                        style={{
                            width: 60,
                            height: 60,
                            borderRadius: "50%",
                            background: "#F0FBF6",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            margin: "0 auto 18px",
                        }}
                    >
                        <CheckCircle2 size={30} style={{ color: B.green }} />
                    </div>

                    <h1 style={{ fontSize: 20, fontWeight: 800, color: B.text, margin: 0 }}>
                        Check your email
                    </h1>
                    <p style={{ color: B.muted, marginTop: 10, fontSize: 14, lineHeight: 1.7 }}>
                        We've sent a confirmation link to<br /><strong style={{ color: B.text }}>{email}</strong>
                    </p>
                    <p style={{ color: B.muted, marginTop: 8, fontSize: 12.5, lineHeight: 1.6 }}>
                        Tap the link to activate your account, then come back here to sign in.
                    </p>
                    <Button variant="primary" fullWidth onClick={() => navigate("/")} style={{ marginTop: 22 }}>
                        Go to Sign In
                    </Button>
                </div>
            </div>
        );
    }

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
            <form
                onSubmit={handleSignup}
                style={{
                    background: B.white,
                    padding: 40,
                    borderRadius: 20,
                    boxShadow: "0 20px 50px rgba(0,48,135,0.25)",
                    width: "100%",
                    maxWidth: 380,
                }}
            >
                <div style={{ textAlign: "center", marginBottom: 28 }}>
                    <img
                        src={excelLogo}
                        alt="Excel Chemicals"
                        style={{ height: 72, maxWidth: "70%", display: "block", margin: "0 auto 16px", objectFit: "contain" }}
                        onError={(e) => { e.target.style.display = "none"; }}
                    />
                    <h1 style={{ fontSize: 22, fontWeight: 700, color: B.blue, margin: 0 }}>
                        Create Account
                    </h1>
                    <p style={{ color: B.muted, marginTop: 6, fontSize: 14 }}>
                        Field Sales Audit System
                    </p>
                </div>

                <ErrorMessage>{error}</ErrorMessage>

                <Input
                    label="Full Name"
                    placeholder="Jane Wanjiru"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    required
                />

                <Input
                    label="Email"
                    type="email"
                    placeholder="you@excelchemicals.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                />

                <Input
                    label="Password"
                    type="password"
                    placeholder="At least 6 characters"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                />

                <Button type="submit" variant="primary" fullWidth loading={loading} size="lg">
                    {loading ? "Creating account..." : "Create Account"}
                </Button>

                <p style={{ textAlign: "center", fontSize: 13, color: B.muted, marginTop: 18 }}>
                    Already have an account?{" "}
                    <Link to="/" style={{ color: B.blue, fontWeight: 600, textDecoration: "none" }}>
                        Sign In
                    </Link>
                </p>
            </form>
        </div>
    );
}
