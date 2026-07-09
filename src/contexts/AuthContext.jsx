import {
    createProfile,
    getProfile,
} from "../services/profileService";
import { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

const AuthContext = createContext();

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [profile, setProfile] = useState({
    full_name: ""
});
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function getSession() {
            const {
                data: { session },
            } = await supabase.auth.getSession();

            setUser(session?.user ?? null);

if (session?.user) {

    await createProfile(session.user);

    const profileData = await getProfile(session.user.id);

    setProfile(profileData);

}

setLoading(false);
        }

        getSession();

        const {
    data: { subscription },
} = supabase.auth.onAuthStateChange((_event, session) => {
    setUser(session?.user ?? null);

if (session?.user) {

    createProfile(session.user);

    getProfile(session.user.id)
        .then(setProfile);

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

export function useAuth() {
    return useContext(AuthContext);
}