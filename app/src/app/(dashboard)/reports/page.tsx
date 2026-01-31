"use client";

import { Card, Button } from "@/components/ui/Shared";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import styles from "./reports.module.css";
import clsx from "clsx";
import { useApp } from "@/context/AppContext";
import { useState, useEffect } from "react";
import { RefreshCw } from "lucide-react";

const SALES_DATA = [
    { name: 'Mon', sales: 4000 },
    { name: 'Tue', sales: 3000 },
    { name: 'Wed', sales: 5000 },
    { name: 'Thu', sales: 2780 },
    { name: 'Fri', sales: 1890 },
    { name: 'Sat', sales: 6390 },
    { name: 'Sun', sales: 3490 },
];

export default function ReportsPage() {
    const { inventory, sheetUrl } = useApp();
    const [stats, setStats] = useState({
        totalValue: 0,
        lowStockCount: 0,
        topItems: [] as any[]
    });
    // const [loading, setLoading] = useState(false); // No longer needed as we use context data

    useEffect(() => {
        if (!inventory || inventory.length === 0) return;

        let val = 0;
        let low = 0;

        inventory.forEach((item: any) => {
            // Ensure numbers
            const q = parseFloat(item.qty) || 0;
            const p = parseFloat(item.price) || 0;
            val += (q * p);
            if (q < 10) low += 1;
        });

        const top = [...inventory]
            .sort((a: any, b: any) => ((b.qty * b.price) - (a.qty * a.price)))
            .slice(0, 5);

        setStats({
            totalValue: val,
            lowStockCount: low,
            topItems: top
        });
    }, [inventory]);

    return (
        <div className={styles.container}>
            <div className="flex justify-between items-center mb-6">
                <h1 className={styles.title}>Reports & Insights</h1>
                {/* Auto-synced via Context */}
            </div>

            {/* Revenue Chart - Still Mocked until Sales implemented */}
            <Card className={styles.chartCard}>
                <div className={styles.chartHeader}>
                    <h3 className={styles.chartTitle}>Inventory Value</h3>
                    <p className={styles.chartSubtitle}>Total: {new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(stats.totalValue)}</p>
                </div>
                <div className={styles.chartContainer}>
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={SALES_DATA}>
                            <defs>
                                <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                                    <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <Tooltip
                                contentStyle={{ backgroundColor: 'hsl(var(--bg-card))', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)' }}
                                itemStyle={{ color: 'hsl(var(--primary))' }}
                            />
                            <Area type="monotone" dataKey="sales" stroke="hsl(var(--primary))" fillOpacity={1} fill="url(#colorSales)" />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
            </Card>

            {/* High Value Items (Replaces Best Sellers for now) */}
            <Card>
                <h3 className={styles.bestSellersTitle}>Top Value Stock</h3>
                <div className={styles.bestSellerList}>
                    {stats.topItems.map((item, i) => (
                        <div key={item.name} className={styles.bestSellerItem}>
                            <div className={styles.bestSellerRow}>
                                <span>{i + 1}. {item.name}</span>
                                <span className={styles.bestSellerValue}>₹{item.price * item.qty} est.</span>
                            </div>
                            <div className={styles.progressBarContainer}>
                                <div
                                    className={styles.progressBarFill}
                                    style={{ width: `${(item.price / 300) * 100}%` }} // dynamic width
                                />
                            </div>
                        </div>
                    ))}
                    {stats.topItems.length === 0 && <p className="text-sm text-white/50">Add items to see insights.</p>}
                </div>
            </Card>

            {/* Summary Stats */}
            <div className={styles.statsGrid}>
                <Card className={clsx(styles.statCard, styles.statCardAlternate)}>
                    <span className={styles.statLabel}>Stock Alerts</span>
                    <p className={clsx(styles.statValue, styles.dangerText)}>{stats.lowStockCount} Items Low</p>
                </Card>
                <Card className={styles.statCard}>
                    <span className={styles.statLabel}>Total Net Worth</span>
                    <p className={styles.statValueWhite}>{new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(stats.totalValue)}</p>
                </Card>
            </div>
        </div>
    );
}
