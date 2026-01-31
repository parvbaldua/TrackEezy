import { Card, Button } from "../components/ui/Shared";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import styles from "./ReportsPage.module.css";
import clsx from "clsx";
import { useApp } from "../context/AppContext";
import { useState, useEffect, useMemo } from "react";
import { RefreshCw } from "lucide-react";
import { GoogleSheetsService } from "../services/sheets";
import { useAuth } from "../context/AuthProvider";

// Mock Data until we interpret Order History
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
    const { inventory, fetchInventory, sheetUrl, getSheetId } = useApp();
    const { accessToken } = useAuth();
    const [loading, setLoading] = useState(false);
    const [topSelling, setTopSelling] = useState([]);
    const [salesData, setSalesData] = useState([]);

    // Fetch Sales History
    useEffect(() => {
        const fetchSales = async () => {
            if (!accessToken || !sheetUrl) return;
            try {
                const id = typeof getSheetId === 'function' ? getSheetId(sheetUrl) : null;
                if (!id) return;

                const history = await GoogleSheetsService.getSalesHistory(accessToken, id);

                // Calculate Start of Current Week (Monday)
                const now = new Date();
                const day = now.getDay(); // 0 (Sun) - 6 (Sat)
                // If today is Sunday (0), we want previous Monday (6 days ago). 
                // If today is Monday (1), we want today (0 days ago).
                // Logic: (day + 6) % 7 gives "days since Monday".
                // e.g. Sun(0) -> 6 days ago. Mon(1) -> 0 days ago. Tue(2) -> 1 day ago.
                const daysSinceMonday = (day + 6) % 7;
                const startOfWeek = new Date(now);
                startOfWeek.setDate(now.getDate() - daysSinceMonday);
                startOfWeek.setHours(0, 0, 0, 0);

                // Process Data
                const daysMap = { "Mon": 0, "Tue": 0, "Wed": 0, "Thu": 0, "Fri": 0, "Sat": 0, "Sun": 0 };
                const itemCounts = {};

                history.forEach(row => {
                    const dateStr = row[0];
                    if (!dateStr) return;

                    const d = new Date(dateStr);
                    if (isNaN(d.getTime())) return;

                    // Filter: Only include if date is ON or AFTER start of this week
                    if (d >= startOfWeek) {
                        const dayName = d.toLocaleDateString('en-US', { weekday: 'short' });
                        const amount = parseFloat(row[1]) || 0;
                        if (daysMap[dayName] !== undefined) {
                            daysMap[dayName] += amount;
                        }

                        // Parse Items for Top Selling
                        try {
                            const itemsJson = row[4];
                            if (itemsJson) {
                                const items = JSON.parse(itemsJson);
                                if (Array.isArray(items)) {
                                    items.forEach(item => {
                                        const name = item.name || "Unknown";
                                        const qty = parseInt(item.qty) || 0;
                                        itemCounts[name] = (itemCounts[name] || 0) + qty;
                                    });
                                }
                            }
                        } catch (e) {
                            console.warn("Failed to parse items", e);
                        }
                    }
                });

                // Top 5 Items
                const sortedItems = Object.entries(itemCounts)
                    .map(([name, qty]) => ({ name, qty }))
                    .sort((a, b) => b.qty - a.qty)
                    .slice(0, 5);
                setTopSelling(sortedItems);

                const chartData = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map(day => ({
                    name: day,
                    sales: daysMap[day]
                }));

                setSalesData(chartData);
            } catch (err) {
                console.error("Sales Fetch Error", err);
            }
        };
        fetchSales();
    }, [accessToken, sheetUrl, getSheetId]);

    // Calculate Total Revenue for the Chart
    const totalRevenue = useMemo(() => {
        return salesData.reduce((acc, curr) => acc + curr.sales, 0);
    }, [salesData]);

    // Calculate Stats from Context Inventory
    const stats = useMemo(() => {
        let val = 0;
        let low = 0;

        inventory.forEach((item) => {
            // Ensure numbers (safe parsing)
            const q = parseFloat(String(item.qty || "0").replace(/,/g, '')) || 0;
            const p = parseFloat(String(item.price || "0").replace(/,/g, '')) || 0;

            val += (q * p);
            if (item.low) low += 1; // Use the flags computed in AppContext for consistency
        });

        // Top Value items (Qty * Price)
        const top = [...inventory].sort((a, b) => {
            const qA = parseFloat(String(a.qty || "0").replace(/,/g, '')) || 0;
            const pA = parseFloat(String(a.price || "0").replace(/,/g, '')) || 0;
            const valA = qA * pA;

            const qB = parseFloat(String(b.qty || "0").replace(/,/g, '')) || 0;
            const pB = parseFloat(String(b.price || "0").replace(/,/g, '')) || 0;
            const valB = qB * pB;

            return valB - valA;
        }).slice(0, 3);

        return {
            totalValue: val,
            lowStockCount: low,
            topItems: top
        };
    }, [inventory]);

    const handleRefresh = async () => {
        setLoading(true);
        await fetchInventory();
        setLoading(false);
    };

    return (
        <div className={styles.container}>
            <div className="flex justify-between items-center mb-6">
                <h1 className={styles.title}>Reports & Insights</h1>
                <Button variant="ghost" onClick={handleRefresh} className="!p-2 text-white/50 hover:text-white">
                    <RefreshCw size={18} className={loading ? "animate-spin" : ""} />
                </Button>
            </div>

            {/* Revenue Chart - Still Mocked until Sales implemented */}
            <Card className={styles.chartCard}>
                <div className={styles.chartHeader}>
                    <h3 className={styles.chartTitle}>Weekly Sales</h3>
                    <p className={styles.chartSubtitle}>Total: {new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(totalRevenue)}</p>
                </div>
                <div className={styles.chartContainer}>
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={salesData.length > 0 ? salesData : []}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.1)" />
                            <XAxis dataKey="name" stroke="#9ca3af" fontSize={12} tickLine={false} axisLine={false} />
                            <YAxis stroke="#9ca3af" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(val) => `₹${val}`} width={60} />
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

            {/* Top Selling Items (Weekly) */}
            <Card>
                <h3 className={styles.bestSellersTitle}>Top Selling This Week (Qty)</h3>
                <div className={styles.bestSellerList}>
                    {topSelling.length > 0 ? (
                        topSelling.map((item, i) => (
                            <div key={item.name} className={styles.bestSellerItem}>
                                <div className={styles.bestSellerRow}>
                                    <span>{i + 1}. {item.name}</span>
                                    <span className={styles.bestSellerValue}>{item.qty} units</span>
                                </div>
                                <div className={styles.progressBarContainer}>
                                    <div
                                        className={styles.progressBarFill}
                                        style={{ width: `${Math.min(100, (item.qty / (topSelling[0].qty || 1)) * 100)}%` }}
                                    />
                                </div>
                            </div>
                        ))
                    ) : (
                        <p className="text-sm text-white/50">No sales recorded this week.</p>
                    )}
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
