import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";

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

        const { error } =
            await supabase.auth.signInWithPassword({

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

        <div className="min-h-screen flex items-center justify-center bg-slate-100">

            <form
                onSubmit={handleLogin}
                className="bg-white p-10 rounded-xl shadow-xl w-96"
            >

                <h1 className="text-3xl font-bold text-center mb-2">

                    Excel Audit

                </h1>

                <p className="text-center text-gray-500 mb-8">

                    Sign in

                </p>

                <input
                    type="email"
                    placeholder="Email"
                    className="w-full border rounded-lg p-3 mb-4"
                    value={email}
                    onChange={(e)=>setEmail(e.target.value)}
                />

                <input
                    type="password"
                    placeholder="Password"
                    className="w-full border rounded-lg p-3 mb-4"
                    value={password}
                    onChange={(e)=>setPassword(e.target.value)}
                />

                {error && (

                    <p className="text-red-600 mb-4">

                        {error}

                    </p>

                )}

                <button
                    disabled={loading}
                    className="w-full bg-blue-700 text-white p-3 rounded-lg"
                >

                    {loading ? "Signing in..." : "Login"}

                </button>

            </form>

        </div>

    );

}