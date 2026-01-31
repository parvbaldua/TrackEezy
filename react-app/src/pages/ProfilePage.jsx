import React, { useState } from "react";
import { Card, Button, Input } from "../components/ui/Shared";
import { User, Settings, Database, Share2, HelpCircle, LogOut, ChevronRight, Save } from "lucide-react";
import styles from "./ProfilePage.module.css";
import { useAuth } from "../context/AuthProvider";
import { useApp } from "../context/AppContext";
import { GoogleSheetsService } from "../services/sheets";

export default function ProfilePage() {
    const { user, login, logout, accessToken } = useAuth();
    const { sheetUrl, saveConfig, shopName, shopAddress, shopPhone, shopGstin } = useApp();
    const [isEditing, setIsEditing] = useState(false);

    // Local state for editing
    const [name, setName] = useState(shopName || "");
    const [address, setAddress] = useState(shopAddress || "");
    const [phone, setPhone] = useState(shopPhone || "");
    const [gstin, setGstin] = useState(shopGstin || "");

    const menuItems = [
        { icon: Database, label: "Data Sync", desc: "Google Sheets status" },
        { icon: Settings, label: "App Settings", desc: "Theme, Language" },
        { icon: Share2, label: "Share App", desc: "Invite other shop owners" },
        { icon: HelpCircle, label: "Help & Support", desc: "FAQs, Contact Us" },
    ];

    const handleSave = () => {
        saveConfig(name, sheetUrl, address, phone, gstin);
        setIsEditing(false);
    };

    return (
        <div className={styles.container}>
            <h1 className={styles.title}>Profile</h1>

            {/* Profile Card */}
            <Card className={styles.profileCard}>
                {user ? (
                    <>
                        {user.picture ? (
                            <img src={user.picture} alt="Profile" className={styles.avatar} style={{ fontSize: 0 }} />
                        ) : (
                            <div className={styles.avatar}>{user.name?.[0] || "U"}</div>
                        )}
                        <div className={styles.info}>
                            <h2 className={styles.name}>{user.name}</h2>
                            <p className={styles.role}>{user.email}</p>
                            <span className={styles.status}>
                                <span className="w-2 h-2 rounded-full bg-[hsl(var(--primary))] animate-pulse" />
                                Connected to Google
                            </span>
                        </div>
                    </>
                ) : (
                    <div className="flex flex-col items-start gap-4 w-full">
                        <p className="text-white font-semibold">Sign in to sync with Google Sheets</p>
                        <Button onClick={() => login()} variant="primary" className="w-full sm:w-auto">
                            Sign In with Google
                        </Button>
                    </div>
                )}
            </Card>

            {/* Shop Details Configuration */}
            {user && (
                <Card className="p-4 flex flex-col gap-4 mb-6">
                    <div className="flex justify-between items-start sm:items-center mb-2 flex-col sm:flex-row gap-2">
                        <div className="flex items-center gap-3">
                            <div className={styles.iconBox}>
                                <Settings size={20} />
                            </div>
                            <div>
                                <h3 className={styles.settingLabel}>Shop Details</h3>
                                <p className={styles.settingDesc}>Address, Phone & GSTIN for Bills</p>
                            </div>
                        </div>
                        <Button
                            variant={isEditing ? "primary" : "secondary"}
                            onClick={() => isEditing ? handleSave() : setIsEditing(true)}
                            className="!py-1 !px-3 text-sm h-8 w-full sm:w-auto ml-auto sm:ml-0"
                        >
                            {isEditing ? <><Save size={14} /> Save</> : "Edit"}
                        </Button>
                    </div>

                    {isEditing ? (
                        <div className="flex flex-col gap-3">
                            <Input placeholder="Shop Name" value={name} onChange={(e) => setName(e.target.value)} />
                            <Input placeholder="Shop Address (e.g. 123 Market St, City)" value={address} onChange={(e) => setAddress(e.target.value)} />
                            <Input placeholder="Phone Number" value={phone} onChange={(e) => setPhone(e.target.value)} />
                            <Input placeholder="GSTIN (Optional)" value={gstin} onChange={(e) => setGstin(e.target.value)} />
                        </div>
                    ) : (
                        <div className="flex flex-col gap-2 p-3 bg-[rgba(255,255,255,0.03)] rounded-md border border-[rgba(255,255,255,0.05)] text-sm">
                            <div className="flex justify-between"><span className="text-white/50">Name:</span> <span>{shopName || "-"}</span></div>
                            <div className="flex justify-between"><span className="text-white/50">Address:</span> <span>{shopAddress || "-"}</span></div>
                            <div className="flex justify-between"><span className="text-white/50">Phone:</span> <span>{shopPhone || "-"}</span></div>
                            <div className="flex justify-between"><span className="text-white/50">GSTIN:</span> <span>{shopGstin || "-"}</span></div>
                        </div>
                    )}
                </Card>
            )}

            {/* Database Sync Configuration */}
            {user && (
                <Card className="p-4 flex flex-col gap-4 mb-6">
                    <div className="flex items-center gap-3 mb-2">
                        <div className={styles.iconBox}>
                            <Database size={20} />
                        </div>
                        <div>
                            <h3 className={styles.settingLabel}>Database Connection</h3>
                            <p className={styles.settingDesc}>
                                {sheetUrl ? "Synced with your Google Sheet" : "Link a sheet to enable sync"}
                            </p>
                        </div>
                    </div>

                    {sheetUrl ? (
                        <div className="p-3 bg-[rgba(16,185,129,0.1)] rounded-md border border-[rgba(16,185,129,0.2)] text-sm flex items-center justify-between">
                            <span className="text-[hsl(var(--primary))] font-medium flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-[hsl(var(--primary))]"></span>
                                Connected
                            </span>
                            <a href={sheetUrl} target="_blank" className="text-xs text-white/50 hover:text-white underline">
                                Open Sheet
                            </a>
                        </div>
                    ) : (
                        <div className="flex gap-2">
                            <ConnectionInput onConnect={async (urlOrCommand) => {
                                if (!urlOrCommand) return;
                                try {
                                    if (accessToken) {
                                        let finalUrl = urlOrCommand;

                                        // Auto Create Logic
                                        if (urlOrCommand === 'CREATE_NEW') {
                                            const newUrl = await GoogleSheetsService.createInventorySheet(accessToken, shopName);
                                            finalUrl = newUrl;
                                        }

                                        // Extract ID
                                        const parts = finalUrl.split("/d/");
                                        const id = parts[1] ? parts[1].split('/')[0] : null;
                                        if (id) {
                                            // Initialize (Safety Check)
                                            await GoogleSheetsService.initializeSheet(accessToken, id);
                                            // Save
                                            saveConfig(shopName || "My Shop", finalUrl, shopAddress, shopPhone, shopGstin);
                                            alert("Success! Your new Inventory Sheet is ready & connected. 🚀");
                                        } else {
                                            throw new Error("Invalid URL");
                                        }
                                    } else {
                                        throw new Error("Not logged in");
                                    }
                                } catch (err) {
                                    console.error(err);
                                    alert("Could not connect. Ensure you are logged in.");
                                }
                            }} />
                        </div>
                    )}
                </Card>
            )}

            {/* Menu */}
            <div>
                <h3 className={styles.sectionTitle}>General</h3>
                <div className={styles.settingsList}>
                    {menuItems.map((item) => (
                        <Card key={item.label} className={styles.settingItem}>
                            <div className={styles.settingLeft}>
                                <div className={styles.iconBox}>
                                    <item.icon size={20} />
                                </div>
                                <div className={styles.settingText}>
                                    <span className={styles.settingLabel}>{item.label}</span>
                                    <span className={styles.settingDesc}>{item.desc}</span>
                                </div>
                            </div>
                            <ChevronRight size={18} className="text-[hsl(var(--text-muted))]" />
                        </Card>
                    ))}
                </div>
            </div>

            <div>
                <h3 className={styles.sectionTitle}>Account</h3>
                <div className={styles.settingsList}>
                    <Card className={styles.settingItem} onClick={() => {
                        logout();
                    }}>
                        <div className={styles.settingLeft}>
                            <div className={`${styles.iconBox} !text-[hsl(var(--danger))] !bg-[hsl(var(--danger))/0.1]`}>
                                <LogOut size={20} />
                            </div>
                            <div className={styles.settingText}>
                                <span className={`${styles.settingLabel} text-[hsl(var(--danger))]`}>Log Out</span>
                            </div>
                        </div>
                    </Card>
                </div>
            </div>

        </div>
    );
}

function ConnectionInput({ onConnect }) {
    const [url, setUrl] = useState("");
    const [connecting, setConnecting] = useState(false);

    return (
        <div className="flex flex-col gap-3 w-full">
            <div className="flex gap-2 w-full flex-col sm:flex-row">
                <input
                    placeholder="Paste Google Sheet URL..."
                    className="flex-1 bg-[hsl(var(--bg-input))] border border-[rgba(255,255,255,0.1)] rounded p-2 text-sm text-white focus:outline-none focus:border-[hsl(var(--primary))]"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                />
                <Button
                    variant="primary"
                    onClick={async () => {
                        setConnecting(true);
                        await onConnect(url);
                        setConnecting(false);
                    }}
                    disabled={!url || connecting}
                    className="w-full sm:w-auto"
                >
                    {connecting ? "..." : "Connect"}
                </Button>
            </div>
            <p className="text-xs text-[hsl(var(--text-muted))]">
                *Create a new sheet with columns: Name, SKU, Qty, Price, Category
            </p>

            <div className="relative flex py-2 items-center">
                <div className="flex-grow border-t border-[rgba(255,255,255,0.1)]"></div>
                <span className="flex-shrink-0 mx-4 text-xs text-[hsl(var(--text-muted))]">OR</span>
                <div className="flex-grow border-t border-[rgba(255,255,255,0.1)]"></div>
            </div>

            <Button
                variant="secondary"
                className="w-full bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 border border-blue-500/30"
                onClick={async () => {
                    setConnecting(true);
                    try {
                        // We use a temporary token search or pass it from parent.
                        // Ideally onConnect should handle this, but let's assume we can trigger a create callback
                        // Modifying parent to accept 'CREATE' command
                        await onConnect('CREATE_NEW');
                    } catch (e) {
                        console.error(e);
                    }
                    setConnecting(false);
                }}
                disabled={connecting}
            >
                {connecting ? "Creating..." : "✨ Create Sheet For Me"}
            </Button>
        </div>
    );
}
