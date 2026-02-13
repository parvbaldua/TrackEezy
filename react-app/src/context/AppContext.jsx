import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { useAuth } from "./AuthProvider";
import { GoogleSheetsService } from "../services/sheets";
import { useOffline } from "./OfflineContext";

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

    // Function to read config from storage
    const readConfigFromStorage = useCallback(() => {
        let savedName = localStorage.getItem("bijnex_shop_name");
        let savedAddress = localStorage.getItem("bijnex_shop_address");
        let savedPhone = localStorage.getItem("bijnex_shop_phone");
        let savedGstin = localStorage.getItem("bijnex_shop_gstin");
        let savedUrl = localStorage.getItem("bijnex_sheet_url");

        // AUTO-MIGRATE: If bijnex keys are missing, check biznex keys (from the revert)
        if (!savedUrl) {
            const legacyUrl = localStorage.getItem("biznex_sheet_url");
            if (legacyUrl) {
                console.log("Migrating legacy Biznex keys to BijNex...");
                savedName = localStorage.getItem("biznex_shop_name");
                savedAddress = localStorage.getItem("biznex_shop_address");
                savedPhone = localStorage.getItem("biznex_shop_phone");
                savedGstin = localStorage.getItem("biznex_shop_gstin");
                savedUrl = legacyUrl;

                // Save to new keys
                localStorage.setItem("bijnex_shop_name", savedName || "");
                localStorage.setItem("bijnex_sheet_url", savedUrl);
                if (savedAddress) localStorage.setItem("bijnex_shop_address", savedAddress);
                if (savedPhone) localStorage.setItem("bijnex_shop_phone", savedPhone);
                if (savedGstin) localStorage.setItem("bijnex_shop_gstin", savedGstin);
            }
        }

        if (savedName) setShopName(savedName);
        if (savedAddress) setShopAddress(savedAddress);
        if (savedPhone) setShopPhone(savedPhone);
        if (savedGstin) setShopGstin(savedGstin);

        if (savedUrl) {
            setSheetUrl(savedUrl);
            setIsConfigured(true);
            return true;
        }
        return false;
    }, []);

    // Initial load from storage
    useEffect(() => {
        readConfigFromStorage();
        setLoading(false);
    }, [readConfigFromStorage]);

    const getSheetId = () => {
        if (!sheetUrl) return null;
        try {
            const match = sheetUrl.match(/\/d\/([a-zA-Z0-9-_]+)/);
            return match ? match[1] : null;
        } catch (e) {
            console.error("Invalid Sheet URL", e);
            return null;
        }
    };

    const fetchInventory = useCallback(async () => {
        if (!isConfigured || !sheetUrl || !accessToken) return;

        const sheetId = getSheetId();
        if (!sheetId) return;

        try {
            setLoading(true);
            const data = await GoogleSheetsService.getInventory(accessToken, sheetId);
            setInventory(data);
            setLastError(null);
            return data;
        } catch (error) {
            console.error("Failed to fetch inventory:", error);
            setLastError("Failed to sync with Google Sheets");
        } finally {
            setLoading(false);
        }
    }, [isConfigured, sheetUrl, accessToken]);

    const addInventoryItem = async (item) => {
        const sheetId = getSheetId();
        if (!sheetId || !accessToken) return;
        try {
            await GoogleSheetsService.addItem(accessToken, sheetId, item);
            await fetchInventory(); // Refresh
        } catch (error) {
            console.error("Failed to add item:", error);
            throw error;
        }
    };

    const updateInventoryItem = async (updatedItem) => {
        const sheetId = getSheetId();
        if (!sheetId || !accessToken) return;
        try {
            await GoogleSheetsService.updateItem(accessToken, sheetId, updatedItem);
            await fetchInventory(); // Refresh
        } catch (error) {
            console.error("Failed to update item:", error);
            throw error;
        }
    };

    const removeInventoryItem = async (itemId) => {
        const sheetId = getSheetId();
        if (!sheetId || !accessToken) return;
        try {
            await GoogleSheetsService.deleteItem(accessToken, sheetId, itemId);
            await fetchInventory(); // Refresh
        } catch (error) {
            console.error("Failed to delete item:", error);
            throw error;
        }
    };

    // Load inventory on startup if configured
    useEffect(() => {
        if (isConfigured && accessToken) {
            fetchInventory();
        }
    }, [isConfigured, accessToken, fetchInventory]);

    const saveConfig = (name, url, address, phone, gstin) => {
        localStorage.setItem("bijnex_shop_name", name);
        localStorage.setItem("bijnex_sheet_url", url);
        if (address) localStorage.setItem("bijnex_shop_address", address);
        if (phone) localStorage.setItem("bijnex_shop_phone", phone);
        if (gstin) localStorage.setItem("bijnex_shop_gstin", gstin);

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
            sheetUrl, isConfigured, saveConfig, loading, inventory, fetchInventory, addInventoryItem, updateInventoryItem, removeInventoryItem, lastError, getSheetId,
            refreshConfig: readConfigFromStorage
        }}>
            {children}
        </AppContext.Provider>
    );
}

export function useApp() {
    return useContext(AppContext);
}
