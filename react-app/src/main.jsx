import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'
import { GoogleOAuthProvider } from '@react-oauth/google';

// Fallback or Env variable
const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || "YOUR_CLIENT_ID_HERE";

// Force Cache Bust Debugging
window.BIZNEX_VERSION = "1.0.0-BijNex";
console.log("%cApp Version: " + window.BIZNEX_VERSION, "background: #222; color: #bada55; padding: 4px; border-radius: 4px;");
console.log("DEBUG: Google Client ID:", CLIENT_ID); // Debugging Log



ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
        <GoogleOAuthProvider clientId={CLIENT_ID}>
            <App />
        </GoogleOAuthProvider>
    </React.StrictMode>,
)
