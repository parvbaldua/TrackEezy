"use client";

import { Card, Button } from "@/components/ui/Shared";
import { TrendingUp, Package, AlertTriangle, ArrowRight, RefreshCw } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import styles from "./home.module.css";
import clsx from "clsx";
import { useState, useEffect } from "react";
import { useApp } from "@/context/AppContext";

export default function HomePage() {
    const router = useRouter();
    const { inventory, shopName, fetchInventory } = useApp();
    const [greetingName, setGreetingName] = useState("Partner");
    const [stats, setStats] = useState({
        totalValue: "₹0",
        totalItems: 0,
        lowStock: 0,
    });
    // const [loading, setLoading] = useState(false); // Can use app loading if initial, but inventory might already be loaded

    useEffect(() => {
        if (shopName) setGreetingName(shopName);
    }, [shopName]);

    // Calculate stats whenever inventory changes
    useEffect(() => {
        let val = 0;
        let count = 0;
        let low = 0;

        inventory.forEach((item) => {
            // item matches context structure { id, name, sku, qty, price ... }
            val += (item.qty * item.price);
            count += 1;
            if (item.qty < 10) low += 1;
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
                    <Button variant="primary" onClick={() => router.push("/billing")} className={clsx(styles.actionBtn, styles.btnLarge)}>
                        Bill / Sell
                    </Button>
                    <Button variant="secondary" onClick={() => router.push("/inventory?add=true")} className={clsx(styles.actionBtn, styles.btnLarge)}>
                        + Add Stock
                    </Button>
                    <Button variant="secondary" onClick={() => router.push("/reports")} className={clsx(styles.actionBtn, styles.btnSmall)}>
                        View Reports
                    </Button>
                    <Button variant="secondary" onClick={() => router.push("/inventory")} className={clsx(styles.actionBtn, styles.btnSmall)}>
                        Manage Inventory
                    </Button>
                </div>
            </div>

            {/* Recent Activity Mock */}
            <div className={styles.insightsWrapper}>
                <div className={styles.insightsHeader}>
                    <h3 className={styles.sectionTitle}>Insights</h3>
                    <Link href="/reports" className={styles.viewAll}>
                        View All <ArrowRight size={12} />
                    </Link>
                </div>
                <Card className={styles.insightCard}>
                    <div className={styles.insightText}>
                        <span className={styles.insightTitle}>Fast-Moving Items</span>
                        <span className={styles.insightSub}>3 Products need restock soon</span>
                    </div>
                    <TrendingUp size={20} className={styles.accentText} />
                </Card>
            </div>
        </div>
    );
}
