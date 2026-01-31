import { useState, useEffect } from "react";
import { Card, Input, Button } from "../components/ui/Shared";
import { Modal } from "../components/ui/Modal";
import { SuccessPopup } from "../components/ui/SuccessPopup";
import { Search, Filter, Plus, Edit2, Trash2, AlertCircle, RefreshCw, ExternalLink, Package, Calendar, AlertTriangle } from "lucide-react";
import styles from "./InventoryPage.module.css";
import clsx from "clsx";
import { useApp } from "../context/AppContext";
import { useAuth } from "../context/AuthProvider";
import { GoogleSheetsService } from "../services/sheets";
import { useSearchParams } from "react-router-dom";

export default function InventoryPage() {
    const { sheetUrl, inventory, fetchInventory, addInventoryItem, updateInventoryItem, removeInventoryItem, lastError, getSheetId } = useApp();
    const { accessToken } = useAuth();
    const [searchParams] = useSearchParams();
    const [searchTerm, setSearchTerm] = useState("");
    const [activeTab, setActiveTab] = useState("all"); // 'all', 'grocery', 'liquids', 'others', 'low'
    const [loading, setLoading] = useState(false);

    // Upload State
    const [isAddOpen, setIsAddOpen] = useState(false);
    const [newItem, setNewItem] = useState({
        name: "",
        sku: "",
        qty: "",
        price: "",
        baseUnit: "gram",
        displayUnit: "kilogram",
        conversionFactor: "1000",
        _packetWeight: "",
        _packetUnitMult: 1000,
        _customUnit: "",
        expiryDate: "",
        batchNo: "",
        hsnCode: ""
    });
    const [adding, setAdding] = useState(false);
    const [showSuccess, setShowSuccess] = useState(false);

    const [editMode, setEditMode] = useState(false);
    const [editId, setEditId] = useState(null);
    const [originalName, setOriginalName] = useState("");

    useEffect(() => {
        if (searchParams.get("add") === "true") {
            setEditMode(false);
            setNewItem({ name: "", sku: "", qty: "", price: "", baseUnit: "gram", displayUnit: "kilogram", conversionFactor: "1000", _customUnit: "" });
            setIsAddOpen(true);
        }
    }, [searchParams]);

    const handleEditItem = (item) => {
        setEditMode(true);
        setEditId(item.id);
        setOriginalName(item.name); // Track original name for lookup

        // Convert Base Stock to Display Stock for Editing
        // Display Qty = Base Qty / Factor
        const factor = item.conversionFactor || 1;
        const displayQty = (item.qty / factor);

        setNewItem({
            name: item.name,
            sku: item.sku || "",
            qty: displayQty.toString(),
            price: item.price.toString(),
            baseUnit: item.baseUnit || "gram",
            displayUnit: item.displayUnit || "kilogram",
            conversionFactor: factor.toString(),
            _customUnit: item.displayUnit && !['kilogram', 'gram', 'litre', 'millilitre', 'piece', 'packet', 'box'].includes(item.displayUnit) ? item.displayUnit : "",
            expiryDate: item.expiryDate || "",
            batchNo: item.batchNo || "",
            hsnCode: item.hsnCode || ""
        });
        setIsAddOpen(true);
    };

    // Delete Item Handler
    const handleDeleteItem = async (item) => {
        if (!confirm(`Are you sure you want to delete "${item.name}"?`)) return;

        try {
            // Optimistic UI update - remove from local state
            if (removeInventoryItem) {
                removeInventoryItem(item.id);
            }

            // Delete from Google Sheets
            if (accessToken && sheetUrl) {
                const spreadsheetId = getSheetId(sheetUrl);
                await GoogleSheetsService.deleteItem(accessToken, spreadsheetId, item.name);
            }

            // Refresh inventory
            setTimeout(() => fetchInventory(), 500);
        } catch (error) {
            console.error("Delete Error:", error);
            alert("Error deleting item: " + error.message);
            // Refetch to restore state
            fetchInventory();
        }
    };

    const handleAddItem = async () => {
        if (!newItem.name || !newItem.price) return;
        setAdding(true);

        const factor = parseFloat(newItem.conversionFactor) || 1;
        const inputQty = parseFloat(newItem.qty) || 0;
        const totalBaseQty = inputQty * factor; // Store internally in Base Units

        // Use custom unit name if selected
        const finalDisplayUnit = newItem.displayUnit === 'custom' && newItem._customUnit
            ? newItem._customUnit
            : newItem.displayUnit;

        const itemData = {
            id: editMode && editId ? editId : Date.now(),
            name: newItem.name,
            sku: newItem.sku,
            qty: totalBaseQty,
            price: parseFloat(newItem.price) || 0,
            low: totalBaseQty < (10 * factor),
            baseUnit: newItem.baseUnit,
            displayUnit: finalDisplayUnit,
            conversionFactor: factor,
            expiryDate: newItem.expiryDate,
            batchNo: newItem.batchNo,
            hsnCode: newItem.hsnCode
        };

        setIsAddOpen(false);
        setNewItem({ name: "", sku: "", qty: "", price: "", baseUnit: "gram", displayUnit: "kilogram", conversionFactor: "1000", _customUnit: "", expiryDate: "", batchNo: "", hsnCode: "" });

        // Trigger Success Popup
        setShowSuccess(true);

        try {
            const spreadsheetId = getSheetId(sheetUrl);

            if (!editMode) {
                addInventoryItem(itemData);
                // Add to Google Sheets
                if (accessToken && spreadsheetId) {
                    await GoogleSheetsService.addStock(accessToken, spreadsheetId, [
                        newItem.name,
                        newItem.sku,
                        totalBaseQty,
                        newItem.price,
                        newItem.baseUnit,
                        finalDisplayUnit,
                        factor,
                        newItem.expiryDate || '',
                        newItem.batchNo || '',
                        newItem.hsnCode || ''
                    ]);
                }
            } else {
                // Optimistic Update
                updateInventoryItem(itemData);

                // Update in Sheets API
                if (accessToken && spreadsheetId) {
                    await GoogleSheetsService.updateItem(accessToken, spreadsheetId, originalName, {
                        name: newItem.name,
                        sku: newItem.sku,
                        qty: totalBaseQty,
                        price: newItem.price,
                        baseUnit: newItem.baseUnit,
                        displayUnit: finalDisplayUnit,
                        conversionFactor: factor,
                        expiryDate: newItem.expiryDate,
                        batchNo: newItem.batchNo,
                        hsnCode: newItem.hsnCode
                    });
                }
            }

            // Silent Refetch to ensure consistency without wiping state or flickering
            setTimeout(() => {
                fetchInventory();
            }, 2000);

        } catch (e) {
            console.error(e);
        } finally {
            setAdding(false);
        }
    };

    // Helper: Check if item expires within 30 days
    const isExpiringSoon = (expiryDate) => {
        if (!expiryDate) return false;
        const expiry = new Date(expiryDate);
        const today = new Date();
        const diffDays = Math.ceil((expiry - today) / (1000 * 60 * 60 * 24));
        return diffDays >= 0 && diffDays <= 30;
    };

    const filtered = inventory.filter(item => {
        // 1. Search Filter
        const matchesSearch = item?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            item?.sku?.toLowerCase().includes(searchTerm.toLowerCase());

        if (!matchesSearch) return false;

        // 2. Tab Filter
        if (activeTab === 'all') return true;
        if (activeTab === 'low') return item.low;
        if (activeTab === 'expiring') return isExpiringSoon(item.expiryDate);
        if (activeTab === 'grocery') return item.baseUnit === 'gram';
        if (activeTab === 'liquids') return item.baseUnit === 'millilitre';
        if (activeTab === 'others') return item.baseUnit === 'piece';

        return true;
    }).sort((a, b) => a.name.localeCompare(b.name));

    return (
        <div className={styles.container}>
            <div className={styles.header}>
                <div className="flex flex-col">
                    <h1 className={styles.title}>Inventory</h1>
                </div>
                <div className={styles.headerActions}>
                    {sheetUrl && (
                        <Button variant="ghost" onClick={() => window.open(sheetUrl, '_blank')} className="!p-2 text-white/50 hover:text-white" title="Open Google Sheet">
                            <ExternalLink size={20} />
                        </Button>
                    )}
                    <Button variant="secondary" onClick={fetchInventory} disabled={loading}>
                        <RefreshCw size={20} className={loading ? "animate-spin" : ""} />
                    </Button>
                    <Button className={styles.addButton} onClick={() => {
                        setEditMode(false);
                        setNewItem({ name: "", sku: "", qty: "", price: "", baseUnit: "gram", displayUnit: "kilogram", conversionFactor: "1000" });
                        setIsAddOpen(true);
                    }}>
                        <Plus size={24} />
                        <span className={styles.addBtnText}>Add New Item</span>
                    </Button>
                </div>
            </div>

            {/* Error Alert (Mobile Friendly) */}
            {lastError && (
                <div className="mb-4 p-3 bg-red-900/40 border border-red-500/50 rounded-lg text-red-200 text-sm flex items-center gap-3 animate-in fade-in slide-in-from-top-2">
                    <AlertCircle size={18} className="shrink-0 text-red-400" />
                    <span className="leading-snug">{lastError}</span>
                </div>
            )}

            {inventory.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 px-4 text-center animate-in fade-in zoom-in-95 duration-300">
                    <div className="p-6 bg-white/5 rounded-full mb-6 border border-white/10 shadow-xl shadow-black/20">
                        <Package size={64} className="text-white/40" />
                    </div>
                    <h3 className="text-2xl font-bold text-white mb-3">Your Inventory is Empty</h3>
                    <p className="text-white/60 mb-8 max-w-sm mx-auto leading-relaxed">
                        Add items to your inventory to start tracking stock and creating bills.
                    </p>
                    <Button
                        className="bg-green-600 hover:bg-green-700 text-white px-8 py-6 h-auto text-lg rounded-full font-semibold shadow-lg shadow-green-900/20 transition-all hover:scale-105"
                        onClick={() => {
                            setEditMode(false);
                            setNewItem({ name: "", sku: "", qty: "", price: "", baseUnit: "gram", displayUnit: "kilogram", conversionFactor: "1000" });
                            setIsAddOpen(true);
                        }}
                    >
                        <Plus size={24} className="mr-2" /> Add First Item
                    </Button>
                </div>
            ) : (
                <>
                    {/* Quick Filter Tabs (Separate Sections) */}
                    <div className="flex gap-2 overflow-x-auto pb-2 mb-4 no-scrollbar">
                        {[
                            { id: 'all', label: 'All Items' },
                            { id: 'expiring', label: '⚠️ Expiring Soon' },
                            { id: 'low', label: 'Low Stock' },
                            { id: 'grocery', label: 'Grocery' },
                            { id: 'liquids', label: 'Liquids' },
                            { id: 'others', label: 'Packets/Count' }
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

                    {/* Search Bar */}
                    <div className={styles.searchRow}>
                        <div className={styles.searchWrapper}>
                            <Search className={styles.searchIcon} size={18} />
                            <Input
                                placeholder="Search item or SKU..."
                                className={styles.searchInput}
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                        {/* Filter button removed by request */}
                    </div>

                    {/* Mobile List View */}
                    <div className={styles.list}>
                        {filtered.length > 0 ? (
                            filtered.map((item) => (
                                <Card key={item.id} className={clsx(styles.itemCard, item.low && styles.itemLow)}>
                                    <div className={styles.itemInfo}>
                                        <div className={styles.itemNameRow}>
                                            <h3 className={styles.itemName}>{item.name}</h3>
                                            {item.low && <AlertCircle size={14} className={styles.lowStockIcon} />}
                                        </div>
                                        <p className={styles.itemSku}>SKU: {item.sku}</p>
                                    </div>

                                    <div className={styles.itemMeta}>
                                        <p className={styles.itemPrice}>₹{item.price}</p>
                                        <div className="flex flex-col items-end gap-1">
                                            <p className={clsx(styles.stockCount, item.low && styles.stockLow)}>
                                                Stock: {parseFloat((item.qty / (item.conversionFactor || 1)).toFixed(2))} {item.displayUnit}
                                            </p>
                                            <Button variant="ghost" className="!p-1 h-auto text-white/50" onClick={() => handleEditItem(item)}>
                                                <Edit2 size={14} />
                                            </Button>
                                        </div>
                                    </div>
                                </Card>
                            ))
                        ) : (
                            <div className="text-center py-10 text-white/40">
                                <p>No items found matching "{searchTerm}"</p>
                            </div>
                        )}
                    </div>

                    {/* Desktop Table View */}
                    <div className={styles.tableContainer}>
                        <div className={styles.tableHeader}>
                            <div>Product Name</div>
                            <div>SKU</div>
                            <div>Price</div>
                            <div>Stock</div>
                            <div className="text-right">Actions</div>
                        </div>
                        {filtered.map((item) => (
                            <div key={item.id} className={clsx(styles.tableRow, item.low && styles.itemLow)}>
                                <div className={clsx(styles.tableCell, styles.cellPrimary)}>
                                    {item.name}
                                    {item.low && <AlertCircle size={14} className={clsx(styles.lowStockIcon, "inline ml-2")} />}
                                </div>
                                <div className={styles.tableCell}>{item.sku}</div>
                                <div className={styles.tableCell}>₹{item.price}</div>
                                <div className={clsx(styles.tableCell, item.low && styles.stockLow)}>{parseFloat((item.qty / (item.conversionFactor || 1)).toFixed(2))} {item.displayUnit}</div>
                                <div className={styles.rowAction}>
                                    <Button variant="ghost" className="!p-2" onClick={() => handleEditItem(item)}>
                                        <Edit2 size={16} />
                                    </Button>
                                    <Button variant="ghost" className="!p-2 text-red-500 hover:text-red-400" onClick={() => handleDeleteItem(item)}>
                                        <Trash2 size={16} />
                                    </Button>
                                </div>
                            </div>
                        ))}
                    </div>
                </>
            )}

            <Modal isOpen={isAddOpen} onClose={() => setIsAddOpen(false)} title={editMode ? "Edit Product" : "Add New Product"}>
                <div className="space-y-4">

                    {/* 1. Product Name */}
                    <div>
                        <label className={styles.modalLabel}>Product Name</label>
                        <Input
                            placeholder="e.g. Basmati Rice"
                            value={newItem.name}
                            className={styles.modalInput}
                            onChange={(e) => setNewItem({ ...newItem, name: e.target.value })}
                        />
                    </div>

                    {/* 2. Simple Unit Selection */}
                    <div>
                        <label className={styles.modalLabel}>Unit</label>
                        <select
                            className={clsx(styles.modalInput, "w-full h-10 bg-[#27272A] border border-white/10 rounded-md px-3 text-white")}
                            value={
                                // Reverse Map for Editing
                                newItem.displayUnit === 'kilogram' ? 'kg' :
                                    newItem.displayUnit === 'gram' ? 'g' :
                                        newItem.displayUnit === 'litre' ? 'L' :
                                            newItem.displayUnit === 'millilitre' ? 'ml' :
                                                newItem.displayUnit === 'piece' ? 'pcs' :
                                                    newItem.displayUnit === 'packet' || newItem.displayUnit === 'box' ? 'packet' : 'kg'
                            }
                            onChange={(e) => {
                                const val = e.target.value;
                                let base = 'gram';
                                let display = 'kilogram';
                                let factor = '1000';

                                if (val === 'kg') { base = 'gram'; display = 'kilogram'; factor = '1000'; }
                                if (val === 'g') { base = 'gram'; display = 'gram'; factor = '1'; }
                                if (val === 'L') { base = 'millilitre'; display = 'litre'; factor = '1000'; }
                                if (val === 'ml') { base = 'millilitre'; display = 'millilitre'; factor = '1'; }
                                if (val === 'pcs') { base = 'piece'; display = 'piece'; factor = '1'; }
                                if (val === 'packet') { base = 'gram'; display = 'packet'; factor = ''; }
                                if (val === 'custom') { base = 'piece'; display = 'custom'; factor = '1'; }

                                setNewItem({ ...newItem, baseUnit: base, displayUnit: display, conversionFactor: factor, _customUnit: val === 'custom' ? newItem._customUnit : '' });
                            }}
                        >
                            <option value="kg">Kilogram (kg)</option>
                            <option value="g">Gram (g)</option>
                            <option value="L">Litre (L)</option>
                            <option value="ml">Millilitre (ml)</option>
                            <option value="pcs">Pieces (Pcs)</option>
                            <option value="packet">Packet / Box</option>
                            <option value="custom">✏️ Custom Unit</option>
                        </select>
                    </div>

                    {/* Custom Unit Input */}
                    {newItem.displayUnit === 'custom' && (
                        <div className="bg-blue-500/10 p-3 rounded border border-blue-500/20">
                            <label className={styles.modalLabel} style={{ marginBottom: '5px', color: '#60a5fa' }}>Custom Unit Name</label>
                            <Input
                                placeholder="e.g. 5kg packet, 10kg bag, Box of 12"
                                value={newItem._customUnit}
                                className={styles.modalInput}
                                onChange={(e) => setNewItem({ ...newItem, _customUnit: e.target.value })}
                            />
                            <p className="text-[10px] text-blue-500/60 mt-1">
                                This will show as: {newItem.name || 'Product'} - {newItem._customUnit || 'your unit'}
                            </p>
                        </div>
                    )}

                    {/* 3. Packet Logic (Only if Packet selected) */}
                    {newItem.displayUnit === 'packet' && (
                        <div className="bg-yellow-500/10 p-3 rounded border border-yellow-500/20 mb-4">
                            <label className={styles.modalLabel} style={{ marginBottom: '5px', color: '#fbbf24' }}>Net Content per Packet</label>
                            <div className="flex gap-2 items-center">
                                <Input
                                    placeholder="e.g. 5"
                                    type="number"
                                    // Store factor temporarily or derived? 
                                    // We will use a local state for the input if we want complex conversion, 
                                    // but to keep it simple, we'll just let them enter gram/ml OR allow 5kg logic.
                                    // actually, let's keep it simple: Just Input.
                                    // But user asked for 5kg.
                                    onChange={(e) => {
                                        // This is raw input
                                        const val = e.target.value;
                                        // We need to know current multiplier (g or kg)
                                        // Let's add a toggle below or next to it.
                                        setNewItem(prev => ({ ...prev, _packetWeight: val, conversionFactor: val * (prev._packetUnitMult || 1) }));
                                    }}
                                    className={styles.modalInput}
                                />
                                <select
                                    className="h-10 bg-[#27272A] border border-white/10 rounded-md px-2 text-white text-sm"
                                    onChange={(e) => {
                                        const mult = parseFloat(e.target.value);
                                        setNewItem(prev => ({
                                            ...prev,
                                            _packetUnitMult: mult,
                                            conversionFactor: (prev._packetWeight || 0) * mult
                                        }));
                                    }}
                                >
                                    <option value="1000">kg/L</option>
                                    <option value="1">g/ml</option>
                                </select>
                            </div>
                            <p className="text-[10px] text-yellow-500/60 mt-1">
                                System will store this as {newItem.conversionFactor} {newItem.baseUnit} internally.
                            </p>
                        </div>
                    )}

                    <div className={styles.rowGroup}>
                        {/* 4. Price */}
                        <div>
                            <label className={styles.modalLabel}>
                                {newItem.displayUnit === 'packet' ? "Price of 1 Packet (₹)" : `Price per ${newItem.displayUnit} (₹)`}
                            </label>
                            <Input
                                placeholder="0.00"
                                type="number"
                                value={newItem.price}
                                className={styles.modalInput}
                                onChange={(e) => setNewItem({ ...newItem, price: e.target.value })}
                            />
                        </div>

                        {/* 5. Quantity */}
                        <div>
                            <label className={styles.modalLabel}>
                                Quantity <span className="text-white/40 font-normal">({newItem.displayUnit})</span>
                            </label>
                            <Input
                                placeholder="0"
                                type="number"
                                value={newItem.qty}
                                className={styles.modalInput}
                                onChange={(e) => setNewItem({ ...newItem, qty: e.target.value })}
                            />
                        </div>
                    </div>

                    {newItem.displayUnit !== 'packet' && (
                        <div>
                            <label className={styles.modalLabel}>One {newItem.displayUnit} = ? {newItem.baseUnit}</label>
                            <Input
                                placeholder="Conversion Factor"
                                type="number"
                                value={newItem.conversionFactor}
                                className={styles.modalInput}
                                onChange={(e) => setNewItem({ ...newItem, conversionFactor: e.target.value })}
                            />
                        </div>
                    )}

                    <div>
                        <label className={styles.modalLabel}>SKU (Optional)</label>
                        <Input
                            placeholder="e.g. SKU-123"
                            value={newItem.sku}
                            className={styles.modalInput}
                            onChange={(e) => setNewItem({ ...newItem, sku: e.target.value })}
                        />
                    </div>

                    {/* Phase 4: Additional Fields */}
                    <div className="border-t border-white/10 pt-4 mt-2">
                        <p className="text-xs text-white/40 mb-3 flex items-center gap-1">
                            <Calendar size={12} /> Optional: Tracking Information
                        </p>
                        <div className={styles.rowGroup}>
                            <div>
                                <label className={styles.modalLabel}>Expiry Date</label>
                                <Input
                                    type="date"
                                    value={newItem.expiryDate}
                                    className={styles.modalInput}
                                    onChange={(e) => setNewItem({ ...newItem, expiryDate: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className={styles.modalLabel}>Batch No.</label>
                                <Input
                                    placeholder="e.g. B001"
                                    value={newItem.batchNo}
                                    className={styles.modalInput}
                                    onChange={(e) => setNewItem({ ...newItem, batchNo: e.target.value })}
                                />
                            </div>
                        </div>
                        <div className="mt-3">
                            <label className={styles.modalLabel}>HSN Code</label>
                            <Input
                                placeholder="e.g. 1006 (for Rice)"
                                value={newItem.hsnCode}
                                className={styles.modalInput}
                                onChange={(e) => setNewItem({ ...newItem, hsnCode: e.target.value })}
                            />
                        </div>
                    </div>

                    <Button
                        onClick={handleAddItem}
                        disabled={!newItem.name || !newItem.price || adding}
                        className="w-full mt-2 h-12 text-md font-medium bg-green-600 hover:bg-green-700 text-white"
                    >
                        {adding ? "Saving..." : (editMode ? "Update Item" : "Add to Inventory")}
                    </Button>
                </div>
            </Modal>

            <SuccessPopup show={showSuccess} onClose={() => setShowSuccess(false)} />

        </div >
    );
}
