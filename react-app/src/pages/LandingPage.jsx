import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { Button, Input } from "../components/ui/Shared";
import styles from "./LandingPage.module.css";
import { ArrowRight, Loader2, Store, LogIn, ChevronLeft, X, ChevronDown, BarChart3, Receipt, Package, Download } from "lucide-react";
import { useApp } from "../context/AppContext";
import { useAuth } from "../context/AuthProvider";
import SheetSelector from "../components/SheetSelector";
import { GoogleSheetsService } from "../services/sheets";
import { motion, useScroll, useTransform, useMotionValueEvent, AnimatePresence, useSpring, useMotionValue } from "framer-motion";

// ─── Scroll-linked text highlight data ───
const SCROLL_STEPS = [
    {
        index: "01",
        title: "Smart inventory that thinks for you",
        desc: "Track every product in real-time. Barcode scanning, low stock alerts, and category organization — all from your phone."
    },
    {
        index: "02",
        title: "Billing in seconds, not minutes",
        desc: "Generate professional thermal bills instantly. Built-in GST calculation, digital sharing, and complete transaction history."
    },
    {
        index: "03",
        title: "Reports that drive decisions",
        desc: "Automated daily sales, profit margins, and top-selling insights. Your data, visualized and actionable — every single day."
    }
];

// ─── Feature cards ───
const FEATURE_CARDS = [
    {
        image: "/assets/feature-inventory.png",
        title: "Inventory Management",
        desc: "Real-time stock tracking with barcode scanning, bulk upload, and intelligent low-stock alerts.",
        cardStyle: "cardGreen",
        index: "01"
    },
    {
        image: "/assets/feature-billing.png",
        title: "Instant Billing",
        desc: "Thermal printer support, GST calculation, UPI integration, and professional invoice generation.",
        cardStyle: "cardDark",
        index: "02"
    },
    {
        image: "/assets/feature-reports.png",
        title: "Automated Reports",
        desc: "Visual dashboards for daily sales, profit analysis, and trending products — updated automatically.",
        cardStyle: "cardLight",
        index: "03"
    }
];

export default function LandingPage() {
    const navigate = useNavigate();
    const { saveConfig, isConfigured, loading: appLoading } = useApp();
    const { login, user, accessToken } = useAuth();

    const [mode, setMode] = useState('initial');
    const [authModalOpen, setAuthModalOpen] = useState(false);
    const [formData, setFormData] = useState({ shopName: "" });
    const [checking, setChecking] = useState(true);
    const [findingSheets, setFindingSheets] = useState(false);
    const [foundSheets, setFoundSheets] = useState([]);
    const [errorMsg, setErrorMsg] = useState(null);

    // ─── Mouse Move Parallax ───
    const mouseX = useMotionValue(0);
    const mouseY = useMotionValue(0);

    function handleMouseMove({ clientX, clientY, currentTarget }) {
        const { width, height } = currentTarget.getBoundingClientRect();
        mouseX.set(clientX - width / 2);
        mouseY.set(clientY - height / 2);
    }

    const springConfig = { stiffness: 100, damping: 30 };
    const orb1X = useSpring(useTransform(mouseX, [-500, 500], [-30, 30]), springConfig);
    const orb1Y = useSpring(useTransform(mouseY, [-500, 500], [-30, 30]), springConfig);
    const orb2X = useSpring(useTransform(mouseX, [-500, 500], [20, -20]), springConfig);
    const orb2Y = useSpring(useTransform(mouseY, [-500, 500], [20, -20]), springConfig);

    // ─── Scroll tracking for text highlight ───
    const heroWrapRef = useRef(null);
    const { scrollYProgress } = useScroll({ target: heroWrapRef, offset: ["start start", "end start"] });
    const [activeStep, setActiveStep] = useState(-1);

    useMotionValueEvent(scrollYProgress, "change", (v) => {
        // Clock section: ~0.12 to 0.75
        // Feature 3 becomes horizontal at 0.60, holds longer (~3-4s pause)
        if (v < 0.12) setActiveStep(-1);
        else if (v < 0.28) setActiveStep(0);  // Feature 1
        else if (v < 0.44) setActiveStep(1);  // Feature 2  
        else if (v < 0.75) setActiveStep(2);  // Feature 3 — straight at 0.60, holds long
        else setActiveStep(-1);
    });

    // ─── Clock Opacity: fade in → visible → fade out ───
    const scannerOpacity = useTransform(
        scrollYProgress,
        [0.08, 0.14, 0.75, 0.76],
        [0, 1, 1, 0]
    );



    useEffect(() => {
        if (!appLoading) {
            if (isConfigured) navigate("/home", { replace: true });
            else setChecking(false);
        }
    }, [appLoading, isConfigured, navigate]);

    useEffect(() => {
        const handleAuthSuccess = async () => {
            if (user && accessToken && authModalOpen) {
                if (isConfigured) return;
                if (mode === 'create_auth') await createShopAfterLogin();
                else if (mode === 'login_auth' || mode === 'initial') await searchForShops();
            }
        };
        handleAuthSuccess();
    }, [user, accessToken, mode, isConfigured, authModalOpen]);

    const openAuthModal = (m = 'initial') => { setMode(m); setAuthModalOpen(true); };
    const closeAuthModal = () => { setAuthModalOpen(false); setMode('initial'); setFormData({ shopName: "" }); setErrorMsg(null); };

    const searchForShops = async () => {
        setFindingSheets(true); setErrorMsg(null);
        try {
            let sheets = await GoogleSheetsService.searchExistingSheets(accessToken);
            if (!sheets || sheets.length === 0) {
                sheets = await GoogleSheetsService.searchExistingSheets(accessToken,
                    "mimeType='application/vnd.google-apps.spreadsheet' and trashed=false");
                if (sheets) sheets = sheets.slice(0, 10);
            }
            setFoundSheets(sheets?.length ? sheets : []);
            setMode('select_sheet');
        } catch (e) { setErrorMsg(`Failed: ${e.message}`); setFoundSheets([]); setMode('select_sheet'); }
        finally { setFindingSheets(false); }
    };

    const createShopAfterLogin = async () => {
        setFindingSheets(true);
        try {
            const name = formData.shopName || "My Shop";
            const url = await GoogleSheetsService.createInventorySheet(accessToken, name);
            saveConfig(name, url); navigate("/home", { replace: true });
        } catch (e) { alert(`Failed: ${e.message}`); setFindingSheets(false); }
    };

    const handleSheetSelect = (sheet) => {
        let name = sheet.name.replace(" - Inventory (AapKaBakaya)", "").replace(" - Inventory (TrackEezy)", "").trim();
        saveConfig(name || "My Shop", sheet.url); navigate("/home", { replace: true });
    };

    if (appLoading || checking) return null;



    return (
        <>
            <div className={styles.pageContainer}>
                {/* ═══ NAVBAR ═══ */}
                <motion.nav className={styles.navbar}
                    initial={{ y: -80, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ duration: 1, delay: 0.5, ease: [0.25, 0.46, 0.45, 0.94] }}
                >
                    <div className={styles.navContent}>
                        <div className={styles.logo}>
                            <div className={styles.logoIcon} />
                            <span>AapKaBakaya</span>
                        </div>
                        <div className={styles.navLinks}>
                            <a href="#platform" className={styles.desktopLink}>Platform</a>
                            <a href="#about" className={styles.desktopLink}>Company</a>
                            <button className={styles.navCta} onClick={() => openAuthModal()}>Get Started</button>
                        </div>
                    </div>
                </motion.nav>

                {/* ═══ HERO + SCROLL TEXT (Sticky BG) ═══ */}
                <div className={styles.heroWrapper} ref={heroWrapRef} onMouseMove={handleMouseMove}>
                    {/* Sticky BG that stays while text scrolls over */}
                    <div className={styles.heroBgSticky}>
                        <motion.div className={styles.heroBgImage}
                            initial={{ scale: 1.1 }}
                            animate={{ scale: 1 }}
                            transition={{ duration: 2, ease: "easeOut" }}
                        >
                            <motion.div className={styles.heroOrb}
                                style={{
                                    width: '70vw', height: '70vw', top: '-15%', left: '-10%',
                                    background: 'radial-gradient(circle, rgba(16, 185, 129, 0.45) 0%, rgba(16, 185, 129, 0.05) 60%, transparent 70%)',
                                    x: orb1X, y: orb1Y
                                }}
                            />


                        </motion.div>
                        <div className={styles.heroBgOverlay} />

                        {/* Hero Content (bottom-left aligned like reference) */}
                        <motion.div className={styles.heroContent}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ duration: 1, delay: 0.3 }}
                        >
                            <motion.h1 className={styles.heroTitle}
                                initial={{ y: 60, opacity: 0 }}
                                animate={{ y: 0, opacity: 1 }}
                                transition={{ duration: 1, delay: 0.6, ease: [0.25, 0.46, 0.45, 0.94] }}
                            >
                                Manage your shop{" "}
                                <span className={styles.heroHighlight}>smarter,<br />not harder.</span>
                            </motion.h1>

                            <motion.div className={styles.heroBottom}
                                initial={{ y: 40, opacity: 0 }}
                                animate={{ y: 0, opacity: 1 }}
                                transition={{ duration: 0.8, delay: 1.0 }}
                            >
                                <p className={styles.heroSubtitle}>
                                    We simplify retail with smart inventory,<br />
                                    instant billing, and automated reports<br />
                                    for modern shop owners.
                                </p>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'flex-start' }}>
                                    <a href="/app-release.apk" className={styles.heroCtaBtn} download style={{ textDecoration: 'none' }}>
                                        <span className={styles.heroCtaText}>Download App</span>
                                        <span className={styles.heroCtaIcon}><Download size={20} /></span>
                                    </a>
                                    <span style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.5)', paddingLeft: '12px' }}>
                                        Available for Android
                                    </span>
                                </div>
                            </motion.div>

                            <motion.div className={styles.scrollHint}
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1, y: [0, 8, 0] }}
                                transition={{ delay: 2, duration: 2, repeat: Infinity }}
                            >
                                <span>Discover</span>
                                <ChevronDown size={14} />
                            </motion.div>
                        </motion.div>
                    </div>

                    {/* Scroll-linked rotating clock with features at tips */}
                    <div className={styles.scrollTextSection}>
                        {/* Clock moved to root to avoid overflow clipping */}
                    </div>

                    {/* ═══ PLATFORM / LIGHT SECTION (Now Dark & Inside Hero Wrapper) ═══ */}
                    {/* Positioned absolute at bottom of scroll text area */}
                    <motion.section className={styles.platformSection} id="platform"
                        style={{
                            position: 'absolute',
                            top: '900vh',
                            width: '100%',
                            zIndex: 20
                        }}
                        initial={{ opacity: 0 }}
                        whileInView={{ opacity: 1 }}
                        viewport={{ once: true, margin: "-10%" }}
                        transition={{ duration: 0.8 }}
                    >
                        <div className={styles.lightSectionHeader}>
                            <span className={styles.lightLabel} style={{ color: 'rgba(255,255,255,0.4)' }}>The Platform</span>
                            <h2 className={styles.lightTitle} style={{ color: '#fff' }}>
                                Built for Indian retail.<br />
                                Fast, reliable, secure.
                            </h2>
                        </div>

                        <div className={styles.cardsGrid}>
                            {FEATURE_CARDS.map((card, i) => (
                                <motion.div
                                    key={card.index}
                                    className={`${styles.card} ${styles[card.cardStyle]}`}
                                    initial={{ opacity: 0, y: 50 }}
                                    whileInView={{ opacity: 1, y: 0 }}
                                    viewport={{ once: true, margin: "-80px" }}
                                    transition={{ duration: 0.7, delay: i * 0.3 }}
                                >
                                    <div className={styles.cardImageWrap}>
                                        <img src={card.image} alt={card.title} className={styles.cardImage} />
                                    </div>
                                    <div className={styles.cardBody}>
                                        <div>
                                            <div className={styles.cardHeader}>
                                                <span className={styles.cardIndex}>{card.index}</span>
                                            </div>
                                            <h3 className={styles.cardTitle}>{card.title}</h3>
                                            <p className={styles.cardDesc}>{card.desc}</p>
                                        </div>
                                    </div>
                                </motion.div>
                            ))}
                        </div>
                    </motion.section>

                </div>

                {/* SPACER for Hero Wrapper height (controlled via CSS height: 450vh -> 600vh) */}

                {/* ═══ MARQUEE ═══ */}
                <div className={styles.marqueeSection}>
                    <div className={styles.marqueeTrack}>
                        {[...Array(6)].map((_, i) => (
                            <span key={i} className={styles.marqueeText}>AapKaBakaya</span>
                        ))}
                    </div>
                </div>

                {/* ═══ ABOUT ═══ */}
                <section className={styles.aboutSection} id="about">
                    <motion.div className={styles.aboutGrid}
                        initial={{ opacity: 0, y: 40 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true, margin: "-80px" }}
                        transition={{ duration: 0.8 }}
                    >
                        <div className={styles.aboutImage}>
                            <img src="/assets/about-img.png" alt="About AapKaBakaya"
                                onError={(e) => { e.target.style.background = 'linear-gradient(135deg, #10b981 0%, #06b6d4 100%)'; e.target.style.minHeight = '400px'; }}
                            />
                        </div>
                        <div>
                            <span className={styles.aboutLabel}>Our Mission</span>
                            <h3 className={styles.aboutTitle}>Making technology accessible for every shop owner.</h3>
                            <p className={styles.aboutDesc}>
                                AapKaBakaya is designed for the 63 million+ small retailers across India. We believe shop management shouldn't require expensive POS systems or complex software. Using Google Sheets as a backend, we provide enterprise-grade tools that work on any phone, anywhere.
                            </p>
                        </div>
                    </motion.div>
                </section>

                {/* ═══ CTA (Dark, Abstract BG) ═══ */}
                <section className={styles.ctaSection}>
                    <div className={styles.ctaBg} />
                    <div className={styles.ctaOverlay} />
                    <motion.div className={styles.ctaContent}
                        initial={{ opacity: 0, y: 40 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true, margin: "-80px" }}
                        transition={{ duration: 0.8 }}
                    >
                        <span className={styles.ctaLabel}>Get Started Today</span>
                        <h2 className={styles.ctaTitle}>Ready to run your<br />shop smarter?</h2>
                        <div className={styles.ctaBtns}>
                            <button className={styles.heroCtaBtn} onClick={() => openAuthModal('create_name')}>
                                <span className={styles.heroCtaText}>Create Shop</span>
                                <span className={styles.heroCtaIcon}><Store size={20} /></span>
                            </button>
                            <a href="/app-release.apk" className={styles.heroCtaBtn} download style={{ textDecoration: 'none' }}>
                                <span className={styles.heroCtaText}>Download App</span>
                                <span className={styles.heroCtaIcon}><Download size={20} /></span>
                            </a>
                        </div>
                    </motion.div>
                </section>

                {/* ═══ FOOTER ═══ */}
                <footer className={styles.footer}>
                    <div className={styles.footerGrid}>
                        <div className={styles.footerBrand}>
                            <div className={styles.footerBrandName}>
                                <div className={styles.logoIconSm} />
                                AapKaBakaya
                            </div>
                            <p className={styles.footerBrandDesc}>
                                Smart shop management for modern Indian retail. Built to be simple, fast, and free.
                            </p>
                        </div>
                        <div className={styles.footerCol}>
                            <h4 className={styles.footerColTitle}>Platform</h4>
                            <a href="#">Inventory</a>
                            <a href="#">Billing</a>
                            <a href="#">Reports</a>
                            <a href="#">Scanner</a>
                        </div>
                        <div className={styles.footerCol}>
                            <h4 className={styles.footerColTitle}>Company</h4>
                            <a href="#">About</a>
                            <a href="#">Contact</a>
                            <a href="#">Blog</a>
                        </div>
                        <div className={styles.footerCol}>
                            <h4 className={styles.footerColTitle}>Legal</h4>
                            <a href="#">Privacy</a>
                            <a href="#">Terms</a>
                        </div>
                    </div>
                    <div className={styles.footerBottom}>
                        <span style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.2)' }}>© 2026 AapKaBakaya. All rights reserved.</span>
                        <span style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.2)' }}>Created with ❤️ by Parv Baldua</span>
                    </div>
                    <div className={styles.footerBigLogo}>AapKaBakaya</div>
                </footer>

                {/* ═══ AUTH MODAL ═══ */}
                <AnimatePresence>
                    {authModalOpen && (
                        <motion.div className={styles.modalOverlay}
                            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        >
                            <motion.div className={styles.modalContent}
                                initial={{ scale: 0.95, opacity: 0, y: 10 }}
                                animate={{ scale: 1, opacity: 1, y: 0 }}
                                exit={{ scale: 0.95, opacity: 0, y: 10 }}
                                transition={{ type: "spring", damping: 25, stiffness: 300 }}
                            >
                                <button className={styles.closeBtn} onClick={closeAuthModal}><X size={18} /></button>

                                {mode === 'initial' && !user && (
                                    <div className="flex flex-col gap-4 w-full">
                                        <div className="text-center mb-4">
                                            <div className="w-12 h-12 bg-emerald-500 rounded-2xl mx-auto mb-4 flex items-center justify-center"><Store className="text-white" size={22} /></div>
                                            <h2 className="text-xl font-bold text-white">Get Started</h2>
                                            <p className="text-white/40 text-sm mt-2">Create a new shop or sign in.</p>
                                        </div>
                                        <Button variant="primary" className="!py-4 w-full" onClick={() => setMode('create_name')}>Create New Shop</Button>
                                        <div className="relative flex py-2 items-center">
                                            <div className="flex-grow border-t border-white/8"></div>
                                            <span className="flex-shrink-0 mx-4 text-[10px] uppercase tracking-widest text-white/20">Or</span>
                                            <div className="flex-grow border-t border-white/8"></div>
                                        </div>
                                        <Button variant="secondary" className="w-full !bg-white/[0.03] !text-white/70 hover:!bg-white/[0.06] border border-white/8" onClick={() => setMode('login_auth')}>Sign In</Button>
                                    </div>
                                )}

                                {mode === 'create_name' && (
                                    <div className="w-full">
                                        <button onClick={() => setMode('initial')} className="text-white/30 hover:text-white mb-6 flex items-center gap-1 text-xs uppercase tracking-wider font-medium transition-colors"><ChevronLeft size={14} /> Back</button>
                                        <h2 className="text-xl font-bold text-white mb-2">Name your shop</h2>
                                        <p className="text-white/40 text-sm mb-6">This will appear on your bills.</p>
                                        <div className="mb-6">
                                            <Input autoFocus placeholder="e.g. Sharma General Store" value={formData.shopName} onChange={(e) => setFormData({ ...formData, shopName: e.target.value })} className="!bg-white/[0.03] !border-white/8 !text-white placeholder:text-white/15 !text-lg !p-4 focus:!border-emerald-500/40" />
                                        </div>
                                        <Button className="w-full !py-4" disabled={!formData.shopName.trim()} onClick={() => setMode('create_auth')}>Next <ArrowRight size={18} className="ml-2" /></Button>
                                    </div>
                                )}

                                {(mode === 'create_auth' || mode === 'login_auth') && (
                                    <div className="w-full text-center">
                                        {!user ? (
                                            <>
                                                <button onClick={() => setMode(mode === 'create_auth' ? 'create_name' : 'initial')} className="self-start text-white/30 hover:text-white mb-6 flex items-center gap-1 text-xs uppercase tracking-wider font-medium transition-colors"><ChevronLeft size={14} /> Back</button>
                                                <h2 className="text-xl font-bold text-white mb-2">{mode === 'create_auth' ? "Almost there!" : "Welcome back"}</h2>
                                                <p className="text-white/40 text-sm mb-8">{mode === 'create_auth' ? "Sign in to complete setup." : "Sign in to access your dashboard."}</p>
                                                <Button variant="secondary" className="w-full !bg-white !text-black hover:!bg-gray-100 !py-3 !font-medium" onClick={() => login()}>
                                                    <svg className="mr-2 h-4 w-4" viewBox="0 0 488 512"><path fill="currentColor" d="M488 261.8C488 403.3 391.1 504 248 504 110.8 504 0 393.2 0 256S110.8 8 248 8c66.8 0 123 24.5 166.3 64.9l-67.5 64.9C258.5 52.6 94.3 116.6 94.3 256c0 86.5 69.1 156.6 153.7 156.6 98.2 0 135-70.4 140.8-106.9H248v-85.3h236.1c2.3 12.7 3.9 24.9 3.9 41.4z" /></svg>
                                                    Sign in with Google
                                                </Button>
                                            </>
                                        ) : (
                                            <div className="py-8">
                                                <Loader2 className="animate-spin text-emerald-400 mx-auto mb-4" size={36} />
                                                <p className="text-white/70 text-base font-medium">{mode === 'create_auth' ? "Creating your shop..." : "Searching for shops..."}</p>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {mode === 'select_sheet' && (
                                    <div className="w-full">
                                        <button onClick={() => setMode('initial')} className="text-white/30 hover:text-white mb-4 flex items-center gap-1 text-xs uppercase tracking-wider font-medium transition-colors"><ChevronLeft size={14} /> Back</button>
                                        <h2 className="text-xl font-bold text-center mb-4 text-white">Select Shop</h2>
                                        <SheetSelector sheets={foundSheets} onSelect={handleSheetSelect} onCreateNew={() => setMode('create_name')} />
                                    </div>
                                )}

                                {errorMsg && (
                                    <div className="mt-6 p-3 bg-red-500/10 border border-red-500/15 rounded-xl w-full">
                                        <p className="text-red-400 text-xs font-mono break-words text-center">{errorMsg}</p>
                                    </div>
                                )}
                            </motion.div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
            {createPortal(
                <ScrollClock
                    progress={scrollYProgress}
                    opacity={scannerOpacity}
                    activeStep={activeStep}
                    steps={SCROLL_STEPS}
                />,
                document.getElementById('clock-portal')
            )}
        </>
    );
}


// ─── Rotating 3-Arm Clock Component ───
function ScrollClock({ progress, opacity, activeStep, steps }) {
    // Group rotation: 35° → 0° → -35° (brings each arm to horizontal)
    // Spread over 0.12 to 0.60. Last arm becomes horizontal at 0.60.
    const groupRotate = useTransform(progress, [0.12, 0.28, 0.44, 0.60], [35, 35, 0, -35]);

    // Counter-rotations to keep feature text horizontal
    const counter0 = useTransform(groupRotate, v => 35 - v);   // arm -35°
    const counter1 = useTransform(groupRotate, v => -v);        // arm 0°
    const counter2 = useTransform(groupRotate, v => -35 - v);   // arm +35°

    const counters = [counter0, counter1, counter2];
    const armAngles = [-35, 0, 35];

    // Heading Opacity: Fade in early (0.05), stay (0.15), fade out (0.25)
    const headingOpacity = useTransform(progress, [0.05, 0.15, 0.22, 0.35], [0, 1, 1, 0]);
    const headingY = useTransform(progress, [0.05, 0.35], [20, 0]);

    return (
        <motion.div className={styles.scrollClockWrapper} style={{ opacity }}>

            {/* ── Heading ── */}
            <motion.div
                className={styles.clockHeading}
                style={{ opacity: headingOpacity, y: headingY }}
            >
                <h3 className={styles.clockHeadingText}>What We Do</h3>
                <p className={styles.clockHeadingSub}>Complete control for your business.</p>
            </motion.div>


            {/* Pivot Hub */}
            <div className={styles.clockPivot}>
                <div className={styles.clockPivotGlow} />
            </div>

            {/* Rotating Group */}
            <motion.div className={styles.clockGroup} style={{ rotate: groupRotate }}>
                {steps.map((step, i) => {
                    const isActive = activeStep === i;
                    return (
                        <div
                            key={step.index}
                            className={styles.clockArm}
                            style={{ transform: `rotate(${armAngles[i]}deg)` }}
                        >
                            {/* Arm Line */}
                            <div className={`${styles.armLine} ${isActive ? styles.armLineActive : ''}`} />

                            {/* Tip Dot */}
                            <div className={`${styles.armDot} ${isActive ? styles.armDotActive : ''}`} />

                            {/* Arrow for active arm */}
                            {isActive && <div className={styles.armArrow} />}

                            {/* Counter-rotating Feature Card */}
                            <motion.div
                                className={styles.armCardWrap}
                                style={{ rotate: counters[i] }}
                            >
                                <div className={`${styles.armCard} ${isActive ? styles.armCardActive : ''}`}>
                                    <span className={styles.armCardIndex}>{step.index}</span>
                                    <h4 className={styles.armCardTitle}>{step.title}</h4>
                                    <p className={styles.armCardDesc}>{step.desc}</p>
                                </div>
                            </motion.div>
                        </div>
                    );
                })}
            </motion.div>
        </motion.div>
    );
}

