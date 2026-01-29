"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { useSession } from "next-auth/react";

interface AppState {
    shopName: string;
    shopAddress: string;
    shopPhone: string;
    shopGstin: string;
    sheetUrl: string;
    isConfigured: boolean;
    loading: boolean;
    inventory: any[];
    fetchInventory: () => Promise<void>;
    addInventoryItem: (item: any) => void;
    saveConfig: (name: string, url: string, address?: string, phone?: string, gstin?: string) => void;
}

const AppContext = createContext<AppState | undefined>(undefined);

export function AppProvider({ children }: { children: React.ReactNode }) {
    const [shopName, setShopName] = useState("");
    const [shopAddress, setShopAddress] = useState("");
    const [shopPhone, setShopPhone] = useState("");
    const [shopGstin, setShopGstin] = useState("");
    const [sheetUrl, setSheetUrl] = useState("");
    const [isConfigured, setIsConfigured] = useState(false);
    const [loading, setLoading] = useState(true);
    const [inventory, setInventory] = useState<any[]>([]);
    const { data: session } = useSession();

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
                // Removed direct fetch here to wait for session
            }
            setLoading(false);
        };
        init();
    }, []);

    // New Effect: Fetch only when URL AND Session are ready
    useEffect(() => {
        if (sheetUrl && session?.user) {
            fetchInventoryInternal(sheetUrl);
        } else if (!session?.user) {
            // DEMO MODE: Load dummy data for UI testing
            console.log("Demo Mode: Loading sample inventory");
            setInventory([
                { id: 101, name: "Sample Apple", sku: "FRT-001", price: 250, qty: 50, category: "Fruits" },
                { id: 102, name: "Test Banana", sku: "FRT-002", price: 40, qty: 120, category: "Fruits" },
                { id: 103, name: "Demo Milk", sku: "DAIRY-001", price: 65, qty: 20, category: "Dairy" },
                { id: 104, name: "Mock Bread", sku: "BAK-001", price: 45, qty: 15, category: "Bakery" },
            ]);
        }
    }, [sheetUrl, session]);

    const fetchInventoryInternal = async (url: string) => {
        if (!url) return;
        try {
            const res = await fetch('/api/sync', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sheetUrl: url, action: 'FETCH' })
            });
            const data = await res.json();
            if (data.success && data.rows) {
                const items = data.rows.map((row: any[], i: number) => ({
                    id: i,
                    name: row[0],
                    sku: row[1],
                    qty: parseInt(row[2]) || 0,
                    price: parseFloat(row[3]) || 0,
                    low: (parseInt(row[2]) || 0) < 10,
                    category: row[4] || "General"
                }));
                setInventory(items.reverse());
            } else {
                if (data.error) console.error("Sync API Error:", data.error);
            }
        } catch (error) {
            console.error("Fetch Error", error);
        }
    };

    const fetchInventory = async () => {
        await fetchInventoryInternal(sheetUrl);
    };

    // Keep this for updates later
    useEffect(() => {
        if (sheetUrl && !loading) {
            // Only auto-fetch if not initial load (handled above) 
            // actually safe to just leave as helper to refetch
        }
    }, [sheetUrl, loading]);

    const addInventoryItem = (item: any) => {
        // Shared Optimistic Update
        setInventory(prev => [item, ...prev]);
    };

    const saveConfig = (name: string, url: string, address?: string, phone?: string, gstin?: string) => {
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
            sheetUrl, isConfigured, saveConfig, loading, inventory, fetchInventory, addInventoryItem
        }}>
            {children}
        </AppContext.Provider>
    );
}

export function useApp() {
    const context = useContext(AppContext);
    if (!context) {
        throw new Error("useApp must be used within an AppProvider");
    }
    return context;
}
