import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button, Input } from "../components/ui/Shared";
import styles from "./LandingPage.module.css";
import { ArrowRight, CheckCircle, Loader2, Store, LogIn, ChevronLeft } from "lucide-react";
import { useApp } from "../context/AppContext";
import { useAuth } from "../context/AuthProvider";
import SheetSelector from "../components/SheetSelector";
import { GoogleSheetsService } from "../services/sheets";

export default function LandingPage() {
    const navigate = useNavigate();
    const { saveConfig, isConfigured, loading: appLoading } = useApp();
    const { login, user, accessToken } = useAuth();

    // modes: 'initial', 'create_name', 'create_auth', 'login_auth', 'select_sheet'
    const [mode, setMode] = useState('initial');
    const [formData, setFormData] = useState({ shopName: "" });
    const [checking, setChecking] = useState(true);

    const [findingSheets, setFindingSheets] = useState(false);
    const [foundSheets, setFoundSheets] = useState([]);
    const [errorMsg, setErrorMsg] = useState(null);

    // If already configured and logged in, redirect
    useEffect(() => {
        if (!appLoading) {
            if (isConfigured) {
                navigate("/home", { replace: true });
            } else {
                setChecking(false);
            }
        }
    }, [appLoading, isConfigured, navigate]);

    // Handle Auth Success based on Mode
    useEffect(() => {
        const handleAuthSuccess = async () => {
            if (user && accessToken) {
                if (mode === 'create_auth') {
                    // CREATE FLOW: User is logged in, now create the sheet
                    await createShopAfterLogin();
                } else if (mode === 'login_auth' || mode === 'initial') {
                    // LOGIN FLOW: User is logged in, search for sheets
                    // Note: 'initial' check handles case if user was ALREADY logged in when page loaded
                    await searchForShops();
                }
            }
        };

        handleAuthSuccess();
    }, [user, accessToken, mode]);

    const searchForShops = async () => {
        setFindingSheets(true);
        setErrorMsg(null);
        try {
            console.log("Searching for existing shops...");
            // 1. Specific Search
            let sheets = await GoogleSheetsService.searchExistingSheets(accessToken);
            console.log("AapKaBakaya sheets:", sheets);

            // 2. Broad Search
            if (!sheets || sheets.length === 0) {
                const broadQuery = "mimeType='application/vnd.google-apps.spreadsheet' and trashed=false";
                sheets = await GoogleSheetsService.searchExistingSheets(accessToken, broadQuery);
                if (sheets) sheets = sheets.slice(0, 10);
            }

            if (sheets && sheets.length > 0) {
                setFoundSheets(sheets);
            } else {
                setFoundSheets([]);
            }
            setMode('select_sheet');
        } catch (e) {
            console.error("Search failed", e);
            setErrorMsg(`Failed to search: ${e.message}`);
            setFoundSheets([]);
            setMode('select_sheet'); // Still go to selector to show empty state/options
        } finally {
            setFindingSheets(false);
        }
    };

    const createShopAfterLogin = async () => {
        setFindingSheets(true); // Reuse spinner
        try {
            const name = formData.shopName || "My Shop";
            const newSheetUrl = await GoogleSheetsService.createInventorySheet(accessToken, name);
            saveConfig(name, newSheetUrl);
            navigate("/home", { replace: true });
        } catch (e) {
            console.error("Failed to create sheet", e);
            alert(`Failed to create shop: ${e.message}`);
            setFindingSheets(false);
        }
    };

    if (appLoading || checking) return null;

    // --- Handlers ---

    const handleSheetSelect = (sheet) => {
        let name = sheet.name.replace(" - Inventory (AapKaBakaya)", "").trim();
        name = name.replace(" - Inventory (TrackEezy)", "").trim();
        saveConfig(name || "My Shop", sheet.url);
        navigate("/home", { replace: true });
    };

    const handleCreateNewFromSelector = () => {
        setMode('create_name');
    };

    const resetToInitial = () => {
        setMode('initial');
        setErrorMsg(null);
        setFormData({ shopName: "" });
    };

    return (
        <div className={styles.container}>
            <div className={styles.contentWrapper}>

                {/* Header / Logo - Full size only on initial, compact otherwise */}
                {mode === 'initial' && !user ? (
                    <div className="flex flex-col items-center mb-8">
                        <div className={styles.logoWrapper}>
                            <span className={styles.logoText}>B</span>
                        </div>
                        <h1 className={styles.title}>AapKaBakaya</h1>
                        <p className={styles.subtitle}>Inventory • Billing • Reports</p>
                    </div>
                ) : (
                    <p className="text-sm text-white/40 font-medium tracking-widest mb-6">AapKaBakaya</p>
                )}

                {/* --- INITIAL CHOICE --- */}
                {mode === 'initial' && !user && (
                    <div className="flex flex-col gap-4 w-full max-w-[320px] animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <Button
                            variant="primary"
                            className="!py-6 text-lg w-full flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20"
                            onClick={() => setMode('create_name')}
                        >
                            <Store size={20} />
                            Create New Shop
                        </Button>

                        <div className="relative flex py-2 items-center">
                            <div className="flex-grow border-t border-[rgba(255,255,255,0.1)]"></div>
                            <span className="flex-shrink-0 mx-4 text-xs text-[hsl(var(--text-muted))]">ALREADY HAVE A SHOP?</span>
                            <div className="flex-grow border-t border-[rgba(255,255,255,0.1)]"></div>
                        </div>

                        <Button
                            variant="secondary"
                            className="w-full !bg-white/5 !text-white hover:!bg-white/10 border border-white/10"
                            onClick={() => {
                                setMode('login_auth');
                            }}
                        >
                            <LogIn size={18} className="mr-2" />
                            Sign In
                        </Button>
                    </div>
                )}

                {/* --- CREATE FLOW: Step 1 (Name) --- */}
                {mode === 'create_name' && (
                    <div className={styles.formStep}>
                        <button onClick={resetToInitial} className="self-start text-white/50 hover:text-white mb-4 flex items-center gap-1 text-sm">
                            <ChevronLeft size={16} /> Back
                        </button>
                        <h2 className={styles.title}>Name your shop</h2>
                        <p className={styles.subtitle}>This will appear on your bills.</p>

                        <div className={styles.inputGroup}>
                            <Input
                                autoFocus
                                placeholder="e.g. Sharma General Store"
                                value={formData.shopName}
                                onChange={(e) => setFormData({ ...formData, shopName: e.target.value })}
                            />
                        </div>

                        <Button
                            className={styles.ctaButton}
                            disabled={!formData.shopName.trim()}
                            onClick={() => {
                                setMode('create_auth');
                            }}
                        >
                            Next <ArrowRight size={20} />
                        </Button>
                    </div>
                )}

                {/* --- EXPLICIT AUTH SCREEN --- */}
                {(mode === 'create_auth' || mode === 'login_auth') && (
                    <div className="flex flex-col items-center w-full max-w-[320px]">
                        {!user ? (
                            <>
                                <button onClick={resetToInitial} className="self-start text-white/50 hover:text-white mb-4 flex items-center gap-1 text-sm">
                                    <ChevronLeft size={16} /> Back
                                </button>
                                <h2 className={styles.title + " !text-2xl"}>
                                    {mode === 'create_auth' ? "Almost there!" : "Welcome back"}
                                </h2>
                                <p className={styles.subtitle + " mb-8"}>
                                    {mode === 'create_auth'
                                        ? "Sign in to create your shop account."
                                        : "Sign in to access your existing shops."}
                                </p>
                                <Button
                                    variant="secondary"
                                    className="w-full !bg-white !text-black hover:!bg-gray-200"
                                    onClick={() => login()}
                                >
                                    <svg className="mr-2 h-4 w-4" aria-hidden="true" focusable="false" data-prefix="fab" data-icon="google" role="img" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 488 512"><path fill="currentColor" d="M488 261.8C488 403.3 391.1 504 248 504 110.8 504 0 393.2 0 256S110.8 8 248 8c66.8 0 123 24.5 166.3 64.9l-67.5 64.9C258.5 52.6 94.3 116.6 94.3 256c0 86.5 69.1 156.6 153.7 156.6 98.2 0 135-70.4 140.8-106.9H248v-85.3h236.1c2.3 12.7 3.9 24.9 3.9 41.4z"></path></svg>
                                    Sign in with Google
                                </Button>
                            </>
                        ) : (
                            <>
                                <Loader2 className="animate-spin text-emerald-400 mb-4" size={40} />
                                <p className="text-white/80 text-lg font-medium">
                                    {mode === 'create_auth' ? "Creating your shop..." : "Searching for shops..."}
                                </p>
                            </>
                        )}
                    </div>
                )}

                {/* --- LOGIN FLOW: Select Sheet --- */}
                {mode === 'select_sheet' && (
                    <div className="w-full max-w-md">
                        <button onClick={resetToInitial} className="text-white/50 hover:text-white mb-4 flex items-center gap-1 text-sm">
                            <ChevronLeft size={16} /> Back
                        </button>
                        <h2 className="text-xl font-bold text-center mb-4">Select your Shop</h2>
                        <SheetSelector
                            sheets={foundSheets}
                            onSelect={handleSheetSelect}
                            onCreateNew={handleCreateNewFromSelector}
                        />
                    </div>
                )}

                {/* --- Error Display --- */}
                {errorMsg && (
                    <div className="mt-8 p-3 bg-red-500/10 border border-red-500/20 rounded-lg max-w-[300px]">
                        <p className="text-red-400 text-xs font-mono break-words">{errorMsg}</p>
                    </div>
                )}

                <p className={styles.footer}>
                    Simple • Secure • Fast
                </p>
            </div>
        </div>
    );
}
