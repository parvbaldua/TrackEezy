import { useState, useEffect } from "react";
import { Card, Input, Button } from "../components/ui/Shared";
import { Modal } from "../components/ui/Modal";
import { SuccessPopup } from "../components/ui/SuccessPopup";
import { Search, Filter, Plus, Edit2, AlertCircle, RefreshCw, ExternalLink } from "lucide-react";
import styles from "./InventoryPage.module.css";
import clsx from "clsx";
import { useApp } from "../context/AppContext";
import { useAuth } from "../context/AuthProvider";
import { GoogleSheetsService } from "../services/sheets";
import { useSearchParams } from "react-router-dom";

export default function InventoryPage() {
    const { sheetUrl, inventory, fetchInventory, addInventoryItem, updateInventoryItem, lastError, getSheetId } = useApp();
    const { accessToken } = useAuth();
    const [searchParams] = useSearchParams();
    const [searchTerm, setSearchTerm] = useState("");
    const [loading, setLoading] = useState(false);

    // Upload State
    const [isAddOpen, setIsAddOpen] = useState(false);
    const [newItem, setNewItem] = useState({ name: "", sku: "", qty: "", price: "", category: "General" });
    const [adding, setAdding] = useState(false);
    const [showSuccess, setShowSuccess] = useState(false);

    const [editMode, setEditMode] = useState(false);
    const [editId, setEditId] = useState(null);
    const [originalName, setOriginalName] = useState("");

    useEffect(() => {
        if (searchParams.get("add") === "true") {
            setEditMode(false);
            setNewItem({ name: "", sku: "", qty: "", price: "", category: "General" });
            setIsAddOpen(true);
        }
    }, [searchParams]);

    const handleEditItem = (item) => {
        setEditMode(true);
        setEditId(item.id);
        setOriginalName(item.name); // Track original name for lookup
        setNewItem({
            name: item.name,
            sku: item.sku || "",
            qty: item.qty.toString(),
            price: item.price.toString(),
            category: item.category || "General"
        });
        setIsAddOpen(true);
    };

    const handleAddItem = async () => {
        if (!newItem.name || !newItem.price) return;
        setAdding(true);

        const itemData = {
            id: editMode && editId ? editId : Date.now(),
            name: newItem.name,
            sku: newItem.sku,
            qty: parseInt(newItem.qty) || 0,
            price: parseFloat(newItem.price) || 0,
            low: (parseInt(newItem.qty) || 0) < 10,
            category: newItem.category
        };

        setIsAddOpen(false);
        setNewItem({ name: "", sku: "", qty: "", price: "", category: "General" });

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
                        newItem.qty,
                        newItem.price,
                        newItem.category
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
                        qty: newItem.qty,
                        price: newItem.price,
                        category: newItem.category
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

    const filtered = inventory.filter(item =>
        item?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item?.sku?.toLowerCase().includes(searchTerm.toLowerCase())
    ).sort((a, b) => a.name.localeCompare(b.name));

    return (
        <div className={styles.container}>
            <div className={styles.header}>
                <div className="flex flex-col">
                    <h1 className={styles.title}>Inventory</h1>
                    {lastError && (
                        <div className="mt-2 p-2 bg-red-900/40 border border-red-500/50 rounded-md text-red-200 text-sm flex items-center gap-2">
                            <AlertCircle size={16} />
                            {lastError}
                        </div>
                    )}
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
                        setNewItem({ name: "", sku: "", qty: "", price: "", category: "General" });
                        setIsAddOpen(true);
                    }}>
                        <Plus size={24} />
                        <span className={styles.addBtnText}>Add New Item</span>
                    </Button>
                </div>
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
                {filtered.map((item) => (
                    <Card key={item.id} className={styles.itemCard}>
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
                                    Stock: {item.qty}
                                </p>
                                <Button variant="ghost" className="!p-1 h-auto text-white/50" onClick={() => handleEditItem(item)}>
                                    <Edit2 size={14} />
                                </Button>
                            </div>
                        </div>
                    </Card>
                ))}
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
                    <div key={item.id} className={styles.tableRow}>
                        <div className={clsx(styles.tableCell, styles.cellPrimary)}>
                            {item.name}
                            {item.low && <AlertCircle size={14} className={clsx(styles.lowStockIcon, "inline ml-2")} />}
                        </div>
                        <div className={styles.tableCell}>{item.sku}</div>
                        <div className={styles.tableCell}>₹{item.price}</div>
                        <div className={clsx(styles.tableCell, item.low && styles.stockLow)}>{item.qty}</div>
                        <div className={styles.rowAction}>
                            <Button variant="ghost" className="!p-2" onClick={() => handleEditItem(item)}>
                                <Edit2 size={16} />
                            </Button>
                        </div>
                    </div>
                ))}
            </div>

            <Modal isOpen={isAddOpen} onClose={() => setIsAddOpen(false)} title={editMode ? "Edit Product" : "Add New Product"}>
                <div className={styles.formContainer}>
                    <div>
                        <label className={styles.modalLabel}>Product Name</label>
                        <Input
                            placeholder="e.g. Basmati Rice 5kg"
                            value={newItem.name}
                            className={styles.modalInput}
                            onChange={(e) => setNewItem({ ...newItem, name: e.target.value })}
                        />
                    </div>

                    <div className={styles.rowGroup}>
                        <div>
                            <label className={styles.modalLabel}>Price (₹)</label>
                            <Input
                                placeholder="0.00"
                                type="number"
                                value={newItem.price}
                                className={styles.modalInput}
                                onChange={(e) => setNewItem({ ...newItem, price: e.target.value })}
                            />
                        </div>
                        <div>
                            <label className={styles.modalLabel}>Quantity</label>
                            <Input
                                placeholder="0"
                                type="number"
                                value={newItem.qty}
                                className={styles.modalInput}
                                onChange={(e) => setNewItem({ ...newItem, qty: e.target.value })}
                            />
                        </div>
                    </div>

                    <div className={styles.rowGroup}>
                        <div>
                            <label className={styles.modalLabel}>Category</label>
                            <Input
                                placeholder="e.g. Grains"
                                value={newItem.category}
                                className={styles.modalInput}
                                onChange={(e) => setNewItem({ ...newItem, category: e.target.value })}
                            />
                        </div>
                        <div>
                            <label className={styles.modalLabel}>SKU (Optional)</label>
                            <Input
                                placeholder="e.g. SKU-12345"
                                value={newItem.sku}
                                className={styles.modalInput}
                                onChange={(e) => setNewItem({ ...newItem, sku: e.target.value })}
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

        </div>
    );
}
