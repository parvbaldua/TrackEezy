import React, { createContext, useContext, useState, useEffect } from 'react';
import { useGoogleLogin } from '@react-oauth/google';
import { isAdminEmail } from '../config/AdminConfig';

import { API_BASE_URL } from '../config/api';

const AuthContext = createContext();

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [accessToken, setAccessToken] = useState(null);
    const [loading, setLoading] = useState(true);
    const [isAdmin, setIsAdmin] = useState(false);

    const refreshAccessToken = async () => {
        try {
            const res = await fetch(`${API_BASE_URL}/api/auth/google/refresh`, {
                method: 'POST',
                credentials: 'include', // Send cookies
            });

            if (res.ok) {
                const data = await res.json();
                setAccessToken(data.access_token);

                // If we don't have user info (e.g. reload), fetch it
                if (!user) {
                    await fetchUserInfo(data.access_token);
                }

                // Schedule next refresh slightly before expiry (e.g. 5 mins before)
                // Expiry is usually 1 hour (3600*1000 ms)
                // We'll trust the expiry_date if provided, else default to 50 mins
                const expiresInMs = data.expiry_date ? (data.expiry_date - Date.now()) : 50 * 60 * 1000;
                const refreshTime = Math.max(expiresInMs - 5 * 60 * 1000, 60 * 1000); // 5 mins buffer, min 1 min

                setTimeout(refreshAccessToken, refreshTime);
            } else {
                // Clear state if refresh fails
                if (user) logout();
            }
        } catch (error) {
            console.error("Session refresh failed", error);
            if (user) logout();
        } finally {
            setLoading(false);
        }
    };

    // Initial check for session
    useEffect(() => {
        const checkSession = async () => {
            try {
                // Try to refresh token immediately to check if we have a valid session
                // We don't have the refresh token in frontend, but validation happens via cookie on backend
                await refreshAccessToken();
            } catch (e) {
                // Not logged in or session expired
                setLoading(false);
            }
        };
        checkSession();
    }, []);

    const fetchUserInfo = async (token) => {
        try {
            // We can fetch from Google directly using the access token
            // OR we can trust what the backend gave us during login.
            // But for reload, we might need to fetch again or store in local state.
            // Let's fetch from Google to be safe and get fresh profile.
            const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
                headers: { Authorization: `Bearer ${token}` },
            });
            const userInfo = await res.json();
            setUser(userInfo);
            setIsAdmin(isAdminEmail(userInfo.email));

            // Log login
            logUserLogin(token, userInfo);
        } catch (err) {
            console.error("Failed to fetch user info", err);
        }
    };

    const logUserLogin = (token, userInfo) => {
        const savedUrl = localStorage.getItem("bijnex_sheet_url");
        if (savedUrl) {
            const sheetId = savedUrl.split("/d/")[1]?.split('/')[0];
            if (sheetId) {
                import("../services/sheets").then(({ GoogleSheetsService }) => {
                    GoogleSheetsService.logUserLogin(token, sheetId, userInfo).catch(e => console.error("Login log failed", e));
                });
            }
        }
    }

    const login = useGoogleLogin({
        flow: 'auth-code', // Auth Code Flow
        // Critical: Force consent to ensure we get a refresh_token
        prompt: 'consent',
        access_type: 'offline', // access_type: 'offline' is implied by flow='auth-code' usually, but good to be specific if supported
        onSuccess: async (codeResponse) => {
            try {
                const res = await fetch(`${API_BASE_URL}/api/auth/google/login`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ code: codeResponse.code }),
                    credentials: 'include' // Receive cookies
                });

                if (res.ok) {
                    const data = await res.json();
                    setAccessToken(data.access_token);
                    setUser(data.user);
                    setIsAdmin(isAdminEmail(data.user.email));

                    // Schedule Refresh
                    const expiresInMs = data.expiry_date ? (data.expiry_date - Date.now()) : 50 * 60 * 1000;
                    const refreshTime = Math.max(expiresInMs - 5 * 60 * 1000, 60 * 1000);
                    setTimeout(refreshAccessToken, refreshTime);

                    // Log Logic
                    logUserLogin(data.access_token, data.user);
                } else {
                    console.error('Backend Login Failed');
                    alert("Login failed: Backend rejected the request. Check server logs.");
                }
            } catch (e) {
                console.error('Login Error', e);
                alert(`Login failed: ${e.message}. Is the backend server running on port 4000?`);
            }
        },
        onError: error => {
            console.log('Login Failed:', error);
            alert("Google Login Failed. See console for details.");
        },
        scope: "https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/drive.readonly",
    });

    const logout = async () => {
        try {
            await fetch(`${API_BASE_URL}/api/auth/google/logout`, {
                method: 'POST',
                credentials: 'include'
            });
        } catch (e) {
            console.error("Logout API failed", e);
        }
        setUser(null);
        setAccessToken(null);
        setIsAdmin(false);

        // Clear Local Auth
        localStorage.removeItem('bijnex_access_token');
        localStorage.removeItem('bijnex_user');

        // Clear App Config (Shop Name, Sheet URL, etc) so Landing Page shows setup
        localStorage.removeItem('bijnex_shop_name');
        localStorage.removeItem('bijnex_shop_address');
        localStorage.removeItem('bijnex_shop_phone');
        localStorage.removeItem('bijnex_shop_gstin');
        localStorage.removeItem('bijnex_sheet_url');

        // Clear Legacy Keys (to prevent auto-migration loop)
        const legacyPrefixes = ['biznex_', 'TrackEezy'];
        Object.keys(localStorage).forEach(key => {
            if (legacyPrefixes.some(prefix => key.startsWith(prefix))) {
                localStorage.removeItem(key);
            }
        });

        window.location.replace('/');
    };

    return (
        <AuthContext.Provider value={{ user, accessToken, login, logout, loading, isAdmin }}>
            {children}
        </AuthContext.Provider>
    );
}

export const useAuth = () => useContext(AuthContext);
