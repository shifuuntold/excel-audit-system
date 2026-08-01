import {
    createProfile,
    getProfile,
} from "../services/profileService";
import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { AuthContext } from "./authContextObject";

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [profile, setProfile] = useState({
        full_name: "",
    });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function loadProfile(sessionUser) {
            try {
                await createProfile(sessionUser);
                const profileData = await getProfile(sessionUser.id);
                setProfile(profileData);
            } catch (error) {
                // Never let a failed profile fetch strand the app on the
                // loading spinner forever — log it and fall through so
                // the person at least reaches the sign-in screen.
                console.error("Failed to load profile", error);
            }
        }

        async function getSession() {
            try {
                const {
                    data: { session },
                } = await supabase.auth.getSession();

                setUser(session?.user ?? null);

                if (session?.user) {
                    await loadProfile(session.user);
                }
            } catch (error) {
                console.error("Failed to restore session", error);
            } finally {
                setLoading(false);
            }
        }

        getSession();

        const {
            data: { subscription },
        } = supabase.auth.onAuthStateChange((_event, session) => {
            setUser(session?.user ?? null);

            if (session?.user) {
                loadProfile(session.user);
            }
        });

        return () => subscription.unsubscribe();
    }, []);

    async function logout() {
        setProfile({
            full_name: "",
        });

        await supabase.auth.signOut();
    }

    return (
        <AuthContext.Provider
            value={{
                user,
                profile,
                loading,
                logout,
            }}
        >
            {children}
        </AuthContext.Provider>
    );
}
