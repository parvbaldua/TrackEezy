// API Configuration for AapKaBakaya

// 1. If VITE_API_URL is set (e.g. in Vercel), use it.
// 2. Else, if we are on localhost, assume backend is on port 4000.
// 3. Otherwise, relative path (if backend is on same domain) or placeholders.

const getBaseUrl = () => {
    if (import.meta.env.VITE_API_URL) {
        return import.meta.env.VITE_API_URL;
    }

    // Fallback for local development
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        return 'http://localhost:4000';
    }

    // Fallback for production if env var is missing (User needs to set it!)
    console.warn("API_URL not set in production! Defaulting to current origin.");
    return window.location.origin;
};

export const API_BASE_URL = getBaseUrl();
