import { Card, Button } from "../components/ui/Shared";
import { TrendingUp, Package, AlertTriangle, ArrowRight, RefreshCw } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import styles from "./HomePage.module.css";
import clsx from "clsx";
import { useState, useEffect } from "react";
import { useApp } from "../context/AppContext";
import { useAuth } from "../context/AuthProvider";

export default function HomePage() {
    const navigate = useNavigate();
    const { inventory, shopName, fetchInventory, sheetUrl } = useApp();
    const { user } = useAuth();
    const [greetingName, setGreetingName] = useState("Partner");
    const [stats, setStats] = useState({
        totalValue: "₹0",
        totalItems: 0,
        lowStock: 0,
    });

    useEffect(() => {
        if (shopName) setGreetingName(shopName);
    }, [shopName]);

    useEffect(() => {
        let val = 0;
        let count = 0;
        let low = 0;

        inventory.forEach((item) => {
            const factor = item.conversionFactor || 1;
            // Value = (Base Qty / Factor) * Price per Display Unit
            val += ((item.qty / factor) * item.price);

            count += 1;
            // Low Stock Warning if Display Qty < 10
            if ((item.qty / factor) < 10) low += 1;
        });

        setStats({
            totalValue: new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(val),
            totalItems: count,
            lowStock: low
        });
    }, [inventory]);

    return (
        <div className={styles.container}>
            {/* Header */}
            <div className={styles.header}>
                <div>
                    <h2 className={styles.greeting}>Good Evening, {greetingName} 👋</h2>
                    <h1 className={styles.title}>TrackEezy</h1>
                </div>
                {/* Refresh for Home too */}
                <Button variant="ghost" onClick={fetchInventory} className="!p-2 text-white/50 hover:text-white">
                    <RefreshCw size={18} />
                </Button>
            </div>

            {/* Setup Warning / Welcome Banner */}
            {!sheetUrl && (
                <div
                    onClick={() => navigate("/profile")}
                    className="mb-6 p-4 rounded-xl border border-orange-500/30 bg-orange-900/20 flex items-center justify-between cursor-pointer hover:bg-orange-900/30 transition-colors"
                >
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-orange-500/20 rounded-lg text-orange-400">
                            <AlertTriangle size={28} />
                        </div>
                        <div>
                            <h3 className="text-white font-semibold text-base">
                                {user ? "Start Your Inventory" : "Welcome to TrackEezy"}
                            </h3>
                            <p className="text-white/60 text-sm">
                                {user ? "Connect Google Sheet to manage stock & billing." : "Connect Google Account & Sheet to start."}
                            </p>
                        </div>
                    </div>
                    <div className="px-4 py-2 bg-gradient-to-r from-orange-500 to-red-500 text-white text-xs font-bold rounded-full shadow-lg shadow-orange-500/20 transform transition-all hover:scale-105 active:scale-95 whitespace-nowrap">
                        {user ? "Connect Now" : "Login & Start"}
                    </div>
                </div>
            )}

            {/* Hero Card */}
            <Card className={styles.heroCard}>
                <div className={styles.heroIconBg}>
                    <TrendingUp size={120} />
                </div>

                <div className={styles.heroContent}>
                    <p className={styles.heroLabel}>Total Stock Value</p>
                    <h2 className={styles.heroValue}>{stats.totalValue}</h2>

                    <div className={styles.statsRow}>
                        <div className={styles.statItem}>
                            <span className={styles.statLabel}>Total Products</span>
                            <span className={styles.statValue}>
                                <Package size={16} className={styles.accentText} /> {stats.totalItems}
                            </span>
                        </div>
                        <div className={styles.statItem}>
                            <span className={styles.statLabel}>Low Stock</span>
                            <span className={clsx(styles.statValue, styles.dangerText)}>
                                <AlertTriangle size={16} /> {stats.lowStock}
                            </span>
                        </div>
                    </div>
                </div>
            </Card>

            {/* Quick Actions (Sidebar on Desktop) */}
            <div className={styles.gridWrapper}>
                <h3 className={styles.sectionTitle}>Quick Actions</h3>
                <div className={styles.grid}>
                    <Button variant="primary" onClick={() => navigate("/billing")} className={clsx(styles.actionBtn, styles.btnLarge)}>
                        Bill / Sell
                    </Button>
                    <Button variant="secondary" onClick={() => navigate("/inventory?add=true")} className={clsx(styles.actionBtn, styles.btnLarge)}>
                        + Add Stock
                    </Button>
                    <Button variant="secondary" onClick={() => navigate("/reports")} className={clsx(styles.actionBtn, styles.btnSmall)}>
                        View Reports
                    </Button>
                    <Button variant="secondary" onClick={() => navigate("/inventory")} className={clsx(styles.actionBtn, styles.btnSmall)}>
                        Manage Inventory
                    </Button>
                </div>
            </div>

            {/* Dynamic Insight Card */}
            <div className={styles.insightsWrapper}>
                <div className={styles.insightsHeader}>
                    <h3 className={styles.sectionTitle}>Insights</h3>
                    <Link to="/reports" className={styles.viewAll}>
                        View All <ArrowRight size={12} />
                    </Link>
                </div>

                <div onClick={() => navigate("/inventory")} className="cursor-pointer">
                    {stats.totalItems === 0 ? (
                        <Card className={`${styles.insightCard} !border-l-4 !border-l-blue-500`}>
                            <div className={styles.insightText}>
                                <span className={styles.insightTitle}>Start Your Inventory</span>
                                <span className={styles.insightSub}>Add items to begin tracking</span>
                            </div>
                            <Package size={24} className="text-blue-500" />
                        </Card>
                    ) : stats.lowStock > 0 ? (
                        <Card className={`${styles.insightCard} !border-l-4 !border-l-red-500`}>
                            <div className={styles.insightText}>
                                <span className={styles.insightTitle}>Restock Needed</span>
                                <span className={styles.insightSub}>{stats.lowStock} products are running low</span>
                            </div>
                            <AlertTriangle size={24} className="text-red-500" />
                        </Card>
                    ) : (
                        <Card className={`${styles.insightCard} !border-l-4 !border-l-green-500`}>
                            <div className={styles.insightText}>
                                <span className={styles.insightTitle}>Inventory Healthy</span>
                                <span className={styles.insightSub}>All items are well stocked</span>
                            </div>
                            <Package size={24} className="text-green-500" />
                        </Card>
                    )}
                </div>
            </div>
        </div>
    );
}
