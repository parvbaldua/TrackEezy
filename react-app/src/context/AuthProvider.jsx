import React, { createContext, useContext, useState, useEffect } from 'react';
import { googleLogout, useGoogleLogin } from '@react-oauth/google';
import { isAdminEmail } from '../config/AdminConfig';

const AuthContext = createContext();

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [accessToken, setAccessToken] = useState(null);
    const [loading, setLoading] = useState(true);
    const [isAdmin, setIsAdmin] = useState(false);

    useEffect(() => {
        // Restore session from localStorage if available
        const savedToken = localStorage.getItem('trackeezy_access_token');
        const savedUser = localStorage.getItem('trackeezy_user');

        if (savedToken && savedUser) {
            const parsedUser = JSON.parse(savedUser);
            setAccessToken(savedToken);
            setUser(parsedUser);
            setIsAdmin(isAdminEmail(parsedUser.email));
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
                setIsAdmin(isAdminEmail(userInfo.email));
                localStorage.setItem('trackeezy_user', JSON.stringify(userInfo));

                // Log login asynchronously (don't block UI)
                const savedUrl = localStorage.getItem("trackeezy_sheet_url");
                if (savedUrl) {
                    const sheetId = savedUrl.split("/d/")[1]?.split('/')[0];
                    if (sheetId) {
                        // Pass token, sheetId, and userInfo
                        // We use a dynamic import or direct import if circular dependency isnt an issue.
                        // Since AuthProvider doesn't depend on SheetsService directly for anything else, it's fine.
                        // But wait, we need to import GoogleSheetsService.
                        // To avoid circular refs if SheetsService imports Auth (it doesn't), we are good.
                        // Actually, let's use the Imported service.
                        import("../services/sheets").then(({ GoogleSheetsService }) => {
                            GoogleSheetsService.logUserLogin(token, sheetId, userInfo).catch(e => console.error("Login log failed", e));
                        });
                    }
                }

            } catch (err) {
                console.error("Failed to fetch user info", err);
            }
        },
        onError: error => console.log('Login Failed:', error),
        scope: "https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/drive.readonly",
    });

    const logout = () => {
        googleLogout();
        setUser(null);
        setAccessToken(null);
        setIsAdmin(false);

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
        <AuthContext.Provider value={{ user, accessToken, login, logout, loading, isAdmin }}>
            {children}
        </AuthContext.Provider>
    );
}

export const useAuth = () => useContext(AuthContext);
