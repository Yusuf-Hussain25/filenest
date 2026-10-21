import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import api from "../config/api";

const AuthContext = createContext(null);

// Signed-in user and the auth actions. The session lives in an httpOnly cookie,
// so on load we simply ask the API who we are.
export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [isLoading, setIsLoading] = useState(true);

    const refreshUser = useCallback(async () => {
        try {
            const { data } = await api.get("/api/auth/me");
            setUser(data.user);
            return data.user;
        } catch {
            setUser(null);
            return null;
        }
    }, []);

    useEffect(() => {
        let alive = true;
        api.get("/api/auth/me")
            .then(({ data }) => alive && setUser(data.user))
            .catch(() => alive && setUser(null))
            .finally(() => alive && setIsLoading(false));
        return () => {
            alive = false;
        };
    }, []);

    // Each action throws on failure so the form can show the message
    const login = useCallback(async (email, password) => {
        const { data } = await api.post("/api/auth/login", { email, password });
        setUser(data.user);
        return data.user;
    }, []);

    const register = useCallback(async (name, email, password) => {
        const { data } = await api.post("/api/auth/register", { name, email, password });
        setUser(data.user);
        return data.user;
    }, []);

    const demoLogin = useCallback(async () => {
        const { data } = await api.post("/api/auth/demo");
        setUser(data.user);
        return data.user;
    }, []);

    const logout = useCallback(async () => {
        try {
            await api.post("/api/auth/logout");
        } finally {
            setUser(null);
        }
    }, []);

    // Merge fields into the current user (e.g. new storage_used after an upload)
    const updateUser = useCallback((patch) => setUser((u) => (u ? { ...u, ...patch } : u)), []);

    const value = useMemo(
        () => ({ user, isLoading, isAuthenticated: Boolean(user), login, register, demoLogin, logout, refreshUser, updateUser }),
        [user, isLoading, login, register, demoLogin, logout, refreshUser, updateUser]
    );

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

// eslint-disable-next-line react/only-export-components -- the hook lives next to its provider
export const useAuth = () => useContext(AuthContext);
