import React, { createContext, useContext, useEffect, useState } from "react";
import { useAuth } from "./AuthProvider";
import { GoogleSheetsService } from "../services/sheets";

const AppContext = createContext();

export function AppProvider({ children }) {
    const { accessToken, user } = useAuth();

    const [shopName, setShopName] = useState("");
    const [shopAddress, setShopAddress] = useState("");
    const [shopPhone, setShopPhone] = useState("");
    const [shopGstin, setShopGstin] = useState("");
    const [sheetUrl, setSheetUrl] = useState("");
    const [isConfigured, setIsConfigured] = useState(false);
    const [loading, setLoading] = useState(true);
    const [lastError, setLastError] = useState(null);
    const [inventory, setInventory] = useState([]);

    useEffect(() => {
        const init = async () => {
            const savedName = localStorage.getItem("trackeezy_shop_name");
            const savedAddress = localStorage.getItem("trackeezy_shop_address");
            const savedPhone = localStorage.getItem("trackeezy_shop_phone");
            const savedGstin = localStorage.getItem("trackeezy_shop_gstin");
            const savedUrl = localStorage.getItem("trackeezy_sheet_url");

            if (savedName) setShopName(savedName);
            if (savedAddress) setShopAddress(savedAddress);
            if (savedPhone) setShopPhone(savedPhone);
            if (savedGstin) setShopGstin(savedGstin);

            if (savedUrl) {
                setSheetUrl(savedUrl);
                setIsConfigured(true);
            }
            setLoading(false);
        };
        init();
    }, []);

    // Fetch only when URL AND Access Token are ready
    useEffect(() => {
        setLastError(null); // Clear error on deps change
        if (accessToken && !sheetUrl) {
            setLastError("No Google Sheet connected. Please go to Profile and connect a sheet.");
            setInventory([]);
            return;
        }

        if (sheetUrl && accessToken) {
            fetchInventoryInternal(sheetUrl);
        } else {
            setInventory([]);
        }
    }, [sheetUrl, accessToken]);

    const fetchInventoryInternal = async (url) => {
        if (!url || !accessToken) return;
        try {
            const spreadsheetId = getSheetId(url);
            console.log("AppContext: Calling GoogleSheetsService.getInventory", { spreadsheetId });
            const rows = await GoogleSheetsService.getInventory(accessToken, spreadsheetId);

            if (rows) {
                const items = rows.map((row, i) => ({
                    id: i,
                    name: row[0],
                    sku: row[1],
                    qty: parseFloat(String(row[2] || "0").replace(/,/g, '')) || 0,
                    price: parseFloat(String(row[3] || "0").replace(/,/g, '')) || 0,
                    // Fix: Check if Display Qty < 10
                    low: (parseFloat(String(row[2] || "0").replace(/,/g, '')) || 0) < (10 * (parseFloat(String(row[6] || "1000").replace(/,/g, '')) || 1000)),
                    // New Unit Fields
                    baseUnit: row[4] || "gram",
                    displayUnit: row[5] || "kilogram",
                    conversionFactor: parseFloat(String(row[6] || "1000").replace(/,/g, '')) || 1000
                }));
                console.log("AppContext: Parsed Items:", items.length);
                setInventory(items.reverse());
                setLastError(null); // Success
            } else {
                console.log("AppContext: No rows returned");
                setInventory([]);
            }
        } catch (error) {
            console.error("AppContext Fetch Error", error);
            if (error.message === "UNAUTHORIZED") {
                setLastError("Session Expired: Please Log Out and Sign In again.");
                alert("Your Google Session has expired. Please Log Out and Sign In again in the Profile page.");
            } else {
                setLastError(`Sync Error: ${error.message}`);
            }
        }
    };

    const fetchInventory = async () => {
        await fetchInventoryInternal(sheetUrl);
    };

    const addInventoryItem = (item) => {
        // Shared Optimistic Update
        setInventory(prev => [item, ...prev]);
    };

    const updateInventoryItem = (updatedItem) => {
        setInventory(prev => prev.map(item => item.id === updatedItem.id ? updatedItem : item));
    };

    const removeInventoryItem = (itemId) => {
        setInventory(prev => prev.filter(item => item.id !== itemId));
    };

    // Helper to get ID
    const getSheetId = (url) => {
        if (!url) return "";
        const parts = url.split("/d/");
        return parts[1] ? parts[1].split('/')[0] : url;
    };

    const saveConfig = (name, url, address, phone, gstin) => {
        localStorage.setItem("trackeezy_shop_name", name);
        localStorage.setItem("trackeezy_sheet_url", url);
        if (address) localStorage.setItem("trackeezy_shop_address", address);
        if (phone) localStorage.setItem("trackeezy_shop_phone", phone);
        if (gstin) localStorage.setItem("trackeezy_shop_gstin", gstin);

        setShopName(name);
        setSheetUrl(url);
        if (address) setShopAddress(address);
        if (phone) setShopPhone(phone);
        if (gstin) setShopGstin(gstin);
        setIsConfigured(true);
    };

    if (loading) {
        return <div className="min-h-screen bg-[#111] text-white flex items-center justify-center">Loading...</div>;
    }

    return (
        <AppContext.Provider value={{
            shopName, shopAddress, shopPhone, shopGstin,
            sheetUrl, isConfigured, saveConfig, loading, inventory, fetchInventory, addInventoryItem, updateInventoryItem, removeInventoryItem, lastError, getSheetId
        }}>
            {children}
        </AppContext.Provider>
    );
}

export function useApp() {
    return useContext(AppContext);
}
