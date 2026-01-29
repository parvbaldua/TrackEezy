import React, { createContext, useContext, useState, useEffect } from 'react';
import { googleLogout, useGoogleLogin } from '@react-oauth/google';

const AuthContext = createContext();

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [accessToken, setAccessToken] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Restore session from localStorage if available
        const savedToken = localStorage.getItem('trackeezy_access_token');
        const savedUser = localStorage.getItem('trackeezy_user');

        if (savedToken && savedUser) {
            setAccessToken(savedToken);
            setUser(JSON.parse(savedUser));
        }
        setLoading(false);
    }, []);

    const login = useGoogleLogin({
        onSuccess: async (tokenResponse) => {
            const token = tokenResponse.access_token;
            setAccessToken(token);
            localStorage.setItem('trackeezy_access_token', token);

            try {
                const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
                    headers: { Authorization: `Bearer ${token}` },
                });
                const userInfo = await res.json();
                setUser(userInfo);
                localStorage.setItem('trackeezy_user', JSON.stringify(userInfo));
            } catch (err) {
                console.error("Failed to fetch user info", err);
            }
        },
        onError: error => console.log('Login Failed:', error),
        scope: "https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/userinfo.email",
    });

    const logout = () => {
        googleLogout();
        setUser(null);
        setAccessToken(null);

        // Clear Auth
        localStorage.removeItem('trackeezy_access_token');
        localStorage.removeItem('trackeezy_user');

        // Clear App Config (Shop Name, Sheet URL, etc) so Landing Page shows setup
        localStorage.removeItem('trackeezy_shop_name');
        localStorage.removeItem('trackeezy_shop_address');
        localStorage.removeItem('trackeezy_shop_phone');
        localStorage.removeItem('trackeezy_shop_gstin');
        localStorage.removeItem('trackeezy_sheet_url');

        // Hard redirect to reset AppContext state
        window.location.replace('/');
    };

    return (
        <AuthContext.Provider value={{ user, accessToken, login, logout, loading }}>
            {children}
        </AuthContext.Provider>
    );
}

export const useAuth = () => useContext(AuthContext);
