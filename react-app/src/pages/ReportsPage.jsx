import { Card, Button } from "../components/ui/Shared";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import styles from "./ReportsPage.module.css";
import clsx from "clsx";
import { useApp } from "../context/AppContext";
import { useState, useEffect, useMemo } from "react";
import { RefreshCw, Download, FileSpreadsheet, AlertTriangle, TrendingUp, TrendingDown, IndianRupee, Package, Calendar } from "lucide-react";
import { GoogleSheetsService } from "../services/sheets";
import { useAuth } from "../context/AuthProvider";

export default function ReportsPage() {
    const { inventory, fetchInventory, sheetUrl, getSheetId } = useApp();
    const { accessToken } = useAuth();
    const [loading, setLoading] = useState(false);
    const [topSelling, setTopSelling] = useState([]);
    const [salesData, setSalesData] = useState([]);
    const [activeTab, setActiveTab] = useState("overview"); // overview, gst, expiry

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
                const day = now.getDay();
                const daysSinceMonday = (day + 6) % 7;
                const startOfWeek = new Date(now);
                startOfWeek.setDate(now.getDate() - daysSinceMonday);
                startOfWeek.setHours(0, 0, 0, 0);

                const daysMap = { "Mon": 0, "Tue": 0, "Wed": 0, "Thu": 0, "Fri": 0, "Sat": 0, "Sun": 0 };
                const itemCounts = {};

                history.forEach(row => {
                    const dateStr = row[0];
                    if (!dateStr) return;

                    const d = new Date(dateStr);
                    if (isNaN(d.getTime())) return;

                    if (d >= startOfWeek) {
                        const dayName = d.toLocaleDateString('en-US', { weekday: 'short' });
                        const amount = parseFloat(row[1]) || 0;
                        if (daysMap[dayName] !== undefined) {
                            daysMap[dayName] += amount;
                        }

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

    // Calculate Total Revenue
    const totalRevenue = useMemo(() => {
        return salesData.reduce((acc, curr) => acc + curr.sales, 0);
    }, [salesData]);

    // Calculate Stats from Inventory
    const stats = useMemo(() => {
        let stockValue = 0;
        let lowStockCount = 0;
        let expiringCount = 0;
        const expiringItems = [];
        const today = new Date();

        inventory.forEach((item) => {
            const q = parseFloat(String(item.qty || "0").replace(/,/g, '')) || 0;
            const p = parseFloat(String(item.price || "0").replace(/,/g, '')) || 0;
            const factor = item.conversionFactor || 1;

            // Stock value = (Base Qty / Factor) * Price
            stockValue += (q / factor) * p;

            if (item.low) lowStockCount += 1;

            // Check expiry
            if (item.expiryDate) {
                const expiry = new Date(item.expiryDate);
                const diffDays = Math.ceil((expiry - today) / (1000 * 60 * 60 * 24));
                if (diffDays >= 0 && diffDays <= 30) {
                    expiringCount += 1;
                    expiringItems.push({ ...item, daysLeft: diffDays });
                }
            }
        });

        // Sort expiring items by days left
        expiringItems.sort((a, b) => a.daysLeft - b.daysLeft);

        return {
            stockValue,
            lowStockCount,
            expiringCount,
            expiringItems: expiringItems.slice(0, 10) // Top 10 expiring
        };
    }, [inventory]);

    // GST Breakdown (assuming 18% GST on revenue - 9% CGST + 9% SGST)
    const gstStats = useMemo(() => {
        const gstRate = 0.18;
        const baseAmount = totalRevenue / (1 + gstRate);
        const totalGst = totalRevenue - baseAmount;
        const cgst = totalGst / 2;
        const sgst = totalGst / 2;

        return {
            baseAmount,
            cgst,
            sgst,
            totalGst,
            totalWithGst: totalRevenue
        };
    }, [totalRevenue]);

    // P&L Calculations (estimated - assumes 20% profit margin)
    const pnlStats = useMemo(() => {
        const profitMargin = 0.20; // 20% assumed profit margin
        const estimatedCost = totalRevenue * (1 - profitMargin);
        const grossProfit = totalRevenue - estimatedCost;
        const netProfit = grossProfit - gstStats.totalGst;

        return {
            revenue: totalRevenue,
            estimatedCost,
            grossProfit,
            gstPaid: gstStats.totalGst,
            netProfit
        };
    }, [totalRevenue, gstStats]);

    // Export to CSV
    const exportToCSV = (type) => {
        let csvContent = "";
        let filename = "";

        if (type === 'inventory') {
            filename = `inventory_${new Date().toISOString().split('T')[0]}.csv`;
            csvContent = "Product Name,SKU,Quantity,Price,Base Unit,Display Unit,Conversion Factor,Expiry Date,Batch No,HSN Code\n";
            inventory.forEach(item => {
                csvContent += `"${item.name}","${item.sku || ''}",${item.qty},${item.price},"${item.baseUnit}","${item.displayUnit}",${item.conversionFactor},"${item.expiryDate || ''}","${item.batchNo || ''}","${item.hsnCode || ''}"\n`;
            });
        } else if (type === 'sales') {
            filename = `weekly_sales_${new Date().toISOString().split('T')[0]}.csv`;
            csvContent = "Day,Sales (₹)\n";
            salesData.forEach(day => {
                csvContent += `${day.name},${day.sales}\n`;
            });
        } else if (type === 'gst') {
            filename = `gst_report_${new Date().toISOString().split('T')[0]}.csv`;
            csvContent = "Description,Amount (₹)\n";
            csvContent += `Total Revenue (with GST),${gstStats.totalWithGst.toFixed(2)}\n`;
            csvContent += `Base Amount,${gstStats.baseAmount.toFixed(2)}\n`;
            csvContent += `CGST (9%),${gstStats.cgst.toFixed(2)}\n`;
            csvContent += `SGST (9%),${gstStats.sgst.toFixed(2)}\n`;
            csvContent += `Total GST,${gstStats.totalGst.toFixed(2)}\n`;
        }

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', filename);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handleRefresh = async () => {
        setLoading(true);
        await fetchInventory();
        setLoading(false);
    };

    const formatCurrency = (val) => new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
        maximumFractionDigits: 0
    }).format(val);

    return (
        <div className={styles.container}>
            <div className="flex justify-between items-center mb-4">
                <h1 className={styles.title}>Reports & Insights</h1>
                <div className="flex gap-2">
                    <Button variant="ghost" onClick={handleRefresh} className="!p-2 text-white/50 hover:text-white">
                        <RefreshCw size={18} className={loading ? "animate-spin" : ""} />
                    </Button>
                </div>
            </div>

            {/* Tab Navigation */}
            <div className="flex gap-2 overflow-x-auto pb-2 mb-4 no-scrollbar">
                {[
                    { id: 'overview', label: '📊 Overview' },
                    { id: 'gst', label: '🧾 GST Report' },
                    { id: 'expiry', label: '⚠️ Expiry Alerts' }
                ].map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={clsx(
                            "px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors",
                            activeTab === tab.id
                                ? "bg-white text-black"
                                : "bg-white/5 text-white/60 hover:bg-white/10"
                        )}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Overview Tab */}
            {activeTab === 'overview' && (
                <>
                    {/* P&L Summary Cards */}
                    <div className="grid grid-cols-2 gap-3 mb-6">
                        <Card className="p-4 bg-gradient-to-br from-green-500/10 to-green-500/5 border-green-500/20">
                            <div className="flex items-center gap-2 mb-1">
                                <TrendingUp size={16} className="text-green-400" />
                                <span className="text-xs text-white/50">Weekly Revenue</span>
                            </div>
                            <p className="text-xl font-bold text-green-400">{formatCurrency(pnlStats.revenue)}</p>
                        </Card>
                        <Card className="p-4 bg-gradient-to-br from-blue-500/10 to-blue-500/5 border-blue-500/20">
                            <div className="flex items-center gap-2 mb-1">
                                <IndianRupee size={16} className="text-blue-400" />
                                <span className="text-xs text-white/50">Est. Net Profit</span>
                            </div>
                            <p className={clsx("text-xl font-bold", pnlStats.netProfit >= 0 ? "text-blue-400" : "text-red-400")}>
                                {formatCurrency(pnlStats.netProfit)}
                            </p>
                        </Card>
                        <Card className="p-4">
                            <div className="flex items-center gap-2 mb-1">
                                <Package size={16} className="text-purple-400" />
                                <span className="text-xs text-white/50">Stock Value</span>
                            </div>
                            <p className="text-xl font-bold text-white">{formatCurrency(stats.stockValue)}</p>
                        </Card>
                        <Card className="p-4 bg-gradient-to-br from-orange-500/10 to-orange-500/5 border-orange-500/20">
                            <div className="flex items-center gap-2 mb-1">
                                <AlertTriangle size={16} className="text-orange-400" />
                                <span className="text-xs text-white/50">Alerts</span>
                            </div>
                            <p className="text-xl font-bold text-orange-400">{stats.lowStockCount + stats.expiringCount}</p>
                        </Card>
                    </div>

                    {/* Weekly Sales Chart */}
                    <Card className={styles.chartCard}>
                        <div className={styles.chartHeader}>
                            <div className="flex justify-between items-start">
                                <div>
                                    <h3 className={styles.chartTitle}>Weekly Sales</h3>
                                    <p className={styles.chartSubtitle}>{formatCurrency(totalRevenue)}</p>
                                </div>
                                <Button variant="ghost" onClick={() => exportToCSV('sales')} className="!p-2 text-white/40 hover:text-white">
                                    <Download size={16} />
                                </Button>
                            </div>
                        </div>
                        <div className={styles.chartContainer}>
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={salesData.length > 0 ? salesData : []}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.1)" />
                                    <XAxis dataKey="name" stroke="#9ca3af" fontSize={12} tickLine={false} axisLine={false} />
                                    <YAxis stroke="#9ca3af" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(val) => `₹${val}`} width={60} />
                                    <defs>
                                        <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
                                            <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <Tooltip
                                        contentStyle={{ backgroundColor: 'hsl(var(--bg-card))', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)' }}
                                        itemStyle={{ color: '#22c55e' }}
                                    />
                                    <Area type="monotone" dataKey="sales" stroke="#22c55e" fillOpacity={1} fill="url(#colorSales)" />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    </Card>

                    {/* Top Selling */}
                    <Card>
                        <h3 className={styles.bestSellersTitle}>Top Selling This Week</h3>
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

                    {/* Export Buttons */}
                    <div className="flex gap-3 mt-4">
                        <Button variant="secondary" onClick={() => exportToCSV('inventory')} className="flex-1">
                            <FileSpreadsheet size={18} /> Export Inventory
                        </Button>
                        <Button variant="secondary" onClick={() => exportToCSV('gst')} className="flex-1">
                            <Download size={18} /> Export GST
                        </Button>
                    </div>
                </>
            )}

            {/* GST Report Tab */}
            {activeTab === 'gst' && (
                <>
                    <Card className="mb-4">
                        <h3 className="text-lg font-semibold text-white mb-4">GST Breakdown (Weekly)</h3>
                        <p className="text-xs text-white/40 mb-4">Based on 18% GST (9% CGST + 9% SGST)</p>

                        <div className="space-y-4">
                            <div className="flex justify-between items-center py-3 border-b border-white/10">
                                <span className="text-white/60">Total Revenue (incl. GST)</span>
                                <span className="font-bold text-white">{formatCurrency(gstStats.totalWithGst)}</span>
                            </div>
                            <div className="flex justify-between items-center py-3 border-b border-white/10">
                                <span className="text-white/60">Taxable Amount</span>
                                <span className="text-white">{formatCurrency(gstStats.baseAmount)}</span>
                            </div>
                            <div className="flex justify-between items-center py-3 border-b border-white/10">
                                <span className="text-white/60">CGST @ 9%</span>
                                <span className="text-orange-400">{formatCurrency(gstStats.cgst)}</span>
                            </div>
                            <div className="flex justify-between items-center py-3 border-b border-white/10">
                                <span className="text-white/60">SGST @ 9%</span>
                                <span className="text-orange-400">{formatCurrency(gstStats.sgst)}</span>
                            </div>
                            <div className="flex justify-between items-center py-3 bg-orange-500/10 rounded-lg px-3 -mx-3">
                                <span className="font-semibold text-white">Total GST Liability</span>
                                <span className="font-bold text-orange-400 text-lg">{formatCurrency(gstStats.totalGst)}</span>
                            </div>
                        </div>
                    </Card>

                    <Card>
                        <h3 className="text-lg font-semibold text-white mb-4">P&L Summary</h3>
                        <div className="space-y-3">
                            <div className="flex justify-between">
                                <span className="text-white/60">Revenue</span>
                                <span className="text-green-400">{formatCurrency(pnlStats.revenue)}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-white/60">Est. Cost of Goods (80%)</span>
                                <span className="text-red-400">- {formatCurrency(pnlStats.estimatedCost)}</span>
                            </div>
                            <div className="flex justify-between border-t border-white/10 pt-2">
                                <span className="text-white/60">Gross Profit</span>
                                <span className="text-white">{formatCurrency(pnlStats.grossProfit)}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-white/60">GST Paid</span>
                                <span className="text-red-400">- {formatCurrency(pnlStats.gstPaid)}</span>
                            </div>
                            <div className="flex justify-between bg-blue-500/10 rounded-lg px-3 py-2 -mx-3">
                                <span className="font-semibold text-white">Est. Net Profit</span>
                                <span className={clsx("font-bold text-lg", pnlStats.netProfit >= 0 ? "text-green-400" : "text-red-400")}>
                                    {formatCurrency(pnlStats.netProfit)}
                                </span>
                            </div>
                        </div>
                    </Card>

                    <Button variant="primary" onClick={() => exportToCSV('gst')} className="w-full mt-4">
                        <Download size={18} /> Download GST Report
                    </Button>
                </>
            )}

            {/* Expiry Alerts Tab */}
            {activeTab === 'expiry' && (
                <>
                    <div className="grid grid-cols-2 gap-3 mb-4">
                        <Card className="p-4 bg-gradient-to-br from-red-500/10 to-red-500/5 border-red-500/20">
                            <div className="flex items-center gap-2 mb-1">
                                <Calendar size={16} className="text-red-400" />
                                <span className="text-xs text-white/50">Expiring (30d)</span>
                            </div>
                            <p className="text-2xl font-bold text-red-400">{stats.expiringCount}</p>
                        </Card>
                        <Card className="p-4 bg-gradient-to-br from-yellow-500/10 to-yellow-500/5 border-yellow-500/20">
                            <div className="flex items-center gap-2 mb-1">
                                <AlertTriangle size={16} className="text-yellow-400" />
                                <span className="text-xs text-white/50">Low Stock</span>
                            </div>
                            <p className="text-2xl font-bold text-yellow-400">{stats.lowStockCount}</p>
                        </Card>
                    </div>

                    <Card>
                        <h3 className="text-lg font-semibold text-white mb-4">⚠️ Expiring Soon</h3>
                        {stats.expiringItems.length > 0 ? (
                            <div className="space-y-3">
                                {stats.expiringItems.map((item, i) => (
                                    <div key={i} className={clsx(
                                        "p-3 rounded-lg border",
                                        item.daysLeft <= 7 ? "bg-red-500/10 border-red-500/30" : "bg-yellow-500/10 border-yellow-500/30"
                                    )}>
                                        <div className="flex justify-between items-start">
                                            <div>
                                                <p className="font-medium text-white">{item.name}</p>
                                                <p className="text-xs text-white/50">
                                                    Batch: {item.batchNo || 'N/A'} | Qty: {(item.qty / (item.conversionFactor || 1)).toFixed(1)} {item.displayUnit}
                                                </p>
                                            </div>
                                            <div className={clsx(
                                                "px-2 py-1 rounded text-xs font-bold",
                                                item.daysLeft <= 7 ? "bg-red-500/20 text-red-400" : "bg-yellow-500/20 text-yellow-400"
                                            )}>
                                                {item.daysLeft === 0 ? "TODAY" : `${item.daysLeft}d`}
                                            </div>
                                        </div>
                                        <p className="text-xs text-white/40 mt-1">Expires: {item.expiryDate}</p>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="text-center py-8 text-white/40">
                                <Package size={40} className="mx-auto mb-3 opacity-30" />
                                <p>No items expiring within 30 days</p>
                            </div>
                        )}
                    </Card>
                </>
            )}
        </div>
    );
}

