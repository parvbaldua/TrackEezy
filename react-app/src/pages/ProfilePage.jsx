import React, { useState } from "react";
import { Card, Button, Input } from "../components/ui/Shared";
import { User, Settings, Database, Share2, HelpCircle, LogOut, ChevronRight, Save, Shield, CreditCard, Globe } from "lucide-react";
import styles from "./ProfilePage.module.css";
import { useAuth } from "../context/AuthProvider";
import { useApp } from "../context/AppContext";
import { GoogleSheetsService } from "../services/sheets";
import { useNavigate } from "react-router-dom";
import LanguageSelector from "../components/ui/LanguageSelector";
import { useTranslation } from "../context/LanguageContext";

export default function ProfilePage() {
    const navigate = useNavigate();
    const { user, login, logout, accessToken, isAdmin } = useAuth();
    const { sheetUrl, saveConfig, shopName, shopAddress, shopPhone, shopGstin } = useApp();
    const [isEditing, setIsEditing] = useState(false);
    const t = useTranslation();

    // Local state for editing
    const [name, setName] = useState(shopName || "");
    const [address, setAddress] = useState(shopAddress || "");
    const [phone, setPhone] = useState(shopPhone || "");
    const [gstin, setGstin] = useState(shopGstin || "");
    const [upiId, setUpiId] = useState(localStorage.getItem('bijnex_upi_id') || "");

    const menuItems = [
        { icon: Database, label: t('profile.databaseSync'), desc: "Google Sheets status" },
        { icon: Settings, label: "App Settings", desc: "Theme, Language" }, // Note: keys might be missing for "App Settings", leaving as is if not in en.json
        { icon: Share2, label: "Share App", desc: "Invite other shop owners" },
        { icon: HelpCircle, label: "Help & Support", desc: "FAQs, Contact Us" },
    ];

    const handleSave = () => {
        saveConfig(name, sheetUrl, address, phone, gstin);
        // Save UPI ID separately
        if (upiId) {
            localStorage.setItem('bijnex_upi_id', upiId);
        } else {
            localStorage.removeItem('bijnex_upi_id');
        }
        setIsEditing(false);
    };

    return (
        <div className={styles.container}>
            <h1 className={styles.title}>{t('profile.title')}</h1>

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
                                {t('profile.connectedToGoogle')}
                            </span>
                        </div>
                    </>
                ) : (
                    <div className="flex flex-col items-start gap-4 w-full">
                        <p className="text-white font-semibold">Sign in to sync with Google Sheets</p>
                        <Button onClick={() => login()} variant="primary" className="w-full sm:w-auto">
                            {t('profile.signIn')}
                        </Button>
                    </div>
                )}
            </Card>

            {/* Admin Panel Link - Only for Admins */}
            {user && isAdmin && (
                <Card
                    className="p-4 mb-6 cursor-pointer hover:bg-white/5 transition-colors border-l-4 border-l-emerald-500"
                    onClick={() => navigate('/admin')}
                >
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className={`${styles.iconBox} !bg-emerald-500/20 !text-emerald-400`}>
                                <Shield size={20} />
                            </div>
                            <div>
                                <h3 className={styles.settingLabel}>{t('profile.adminPanel')}</h3>
                                <p className={styles.settingDesc}>{t('profile.manageUsers')}</p>
                            </div>
                        </div>
                        <ChevronRight size={18} className="text-white/30" />
                    </div>
                </Card>
            )}

            {/* Shop Details Configuration */}
            {user && (
                <Card className="p-4 flex flex-col gap-4 mb-6">
                    <div className="flex justify-between items-start sm:items-center mb-2 flex-col sm:flex-row gap-2">
                        <div className="flex items-center gap-3">
                            <div className={styles.iconBox}>
                                <Settings size={20} />
                            </div>
                            <div>
                                <h3 className={styles.settingLabel}>{t('profile.shopDetails')}</h3>
                                <p className={styles.settingDesc}>Address, Phone & GSTIN for Bills</p>
                            </div>
                        </div>
                        <Button
                            variant={isEditing ? "primary" : "secondary"}
                            onClick={() => isEditing ? handleSave() : setIsEditing(true)}
                            className="!py-1 !px-3 text-sm h-8 w-full sm:w-auto ml-auto sm:ml-0"
                        >
                            {isEditing ? <><Save size={14} /> {t('common.save')}</> : t('common.edit')}
                        </Button>
                    </div>

                    {isEditing ? (
                        <div className="flex flex-col gap-3">
                            <Input placeholder={t('profile.shopName')} value={name} onChange={(e) => setName(e.target.value)} />
                            <Input placeholder={t('profile.shopAddress')} value={address} onChange={(e) => setAddress(e.target.value)} />
                            <Input placeholder={t('profile.phone')} value={phone} onChange={(e) => setPhone(e.target.value)} />
                            <Input placeholder={t('profile.gstin')} value={gstin} onChange={(e) => setGstin(e.target.value)} />
                            <div className="relative">
                                <Input
                                    placeholder={t('profile.upiId')}
                                    value={upiId}
                                    onChange={(e) => setUpiId(e.target.value)}
                                />
                                <p className="text-xs text-white/40 mt-1 flex items-center gap-1">
                                    <CreditCard size={12} /> {t('profile.upiHint')}
                                </p>
                            </div>
                        </div>
                    ) : (
                        <div className="flex flex-col gap-2 p-3 bg-[rgba(255,255,255,0.03)] rounded-md border border-[rgba(255,255,255,0.05)] text-sm">
                            <div className="flex justify-between"><span className="text-white/50">{t('profile.shopName')}:</span> <span>{shopName || "-"}</span></div>
                            <div className="flex justify-between"><span className="text-white/50">{t('profile.shopAddress')}:</span> <span>{shopAddress || "-"}</span></div>
                            <div className="flex justify-between"><span className="text-white/50">{t('profile.phone')}:</span> <span>{shopPhone || "-"}</span></div>
                            <div className="flex justify-between"><span className="text-white/50">{t('profile.gstin')}:</span> <span>{shopGstin || "-"}</span></div>
                            <div className="flex justify-between"><span className="text-white/50">{t('profile.upiId')}:</span> <span className="flex items-center gap-1">{upiId || <span className="text-orange-400">Not Set</span>}</span></div>
                        </div>
                    )}
                </Card>
            )}

            {/* Language Selection */}
            {user && (
                <Card className="p-4 mb-6">
                    <div className="flex items-center gap-3 mb-3">
                        <div className={styles.iconBox}>
                            <Globe size={20} />
                        </div>
                        <div>
                            <h3 className={styles.settingLabel}>{t('profile.language')}</h3>
                            <p className={styles.settingDesc}>Change display language</p>
                        </div>
                    </div>
                    <LanguageSelector />
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
                            <h3 className={styles.settingLabel}>{t('profile.databaseSync')}</h3>
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
                                <span className={`${styles.settingLabel} text-[hsl(var(--danger))]`}>{t('profile.signOut')}</span>
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
