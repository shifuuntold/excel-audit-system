import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { B } from "../config/theme";
import excelLogo from "../assets/excel-logo.png";
import Button from "../components/common/Button";
import Input from "../components/common/Input";
import ErrorMessage from "../components/common/ErrorMessage";

export default function Login() {
    const navigate = useNavigate();

    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    async function handleLogin(e) {
        e.preventDefault();
        setLoading(true);
        setError("");

        const { error } = await supabase.auth.signInWithPassword({
            email,
            password,
        });

        setLoading(false);

        if (error) {
            setError(error.message);
            return;
        }

        navigate("/dashboard");
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
                onSubmit={handleLogin}
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
                    <h1 style={{ fontSize: 26, fontWeight: 700, color: B.blue, margin: 0 }}>
                        Excel Chemicals
                    </h1>
                    <p style={{ color: B.muted, marginTop: 6, fontSize: 14 }}>
                        Field Sales Audit System
                    </p>
                </div>

                <ErrorMessage>{error}</ErrorMessage>

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
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                />

                <Button type="submit" variant="primary" fullWidth loading={loading} size="lg">
                    {loading ? "Signing in..." : "Sign In"}
                </Button>

                <p style={{ textAlign: "center", fontSize: 13, color: B.muted, marginTop: 18 }}>
                    New here?{" "}
                    <Link to="/signup" style={{ color: B.blue, fontWeight: 600, textDecoration: "none" }}>
                        Create an account
                    </Link>
                </p>
            </form>
        </div>
    );
}
