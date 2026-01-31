"use client";

import { useState, useEffect } from "react";
import { Card, Input, Button } from "@/components/ui/Shared";
import { Modal } from "@/components/ui/Modal";
import { SuccessPopup } from "@/components/ui/SuccessPopup";
import { Search, Filter, Plus, Edit2, AlertCircle, RefreshCw, ExternalLink } from "lucide-react";
import styles from "./inventory.module.css";
import clsx from "clsx";
import { useApp } from "@/context/AppContext";

import { useSearchParams } from "next/navigation";

export default function InventoryPage() {
    const { sheetUrl, inventory, fetchInventory, addInventoryItem, updateInventoryItem } = useApp();
    const searchParams = useSearchParams();
    const [searchTerm, setSearchTerm] = useState("");
    const [loading, setLoading] = useState(false);

    // Upload State
    const [isAddOpen, setIsAddOpen] = useState(false);
    // Default to Wt based (gram/kg)
    const [newItem, setNewItem] = useState({
        name: "",
        sku: "",
        qty: "",
        price: "",
        baseUnit: "gram",
        displayUnit: "kilogram",
        conversionFactor: "1000"
    });
    const [adding, setAdding] = useState(false);
    const [showSuccess, setShowSuccess] = useState(false);

    const [editMode, setEditMode] = useState(false);
    const [editId, setEditId] = useState<number | null>(null);

    useEffect(() => {
        if (searchParams.get("add") === "true") {
            setEditMode(false);
            setNewItem({ name: "", sku: "", qty: "", price: "", baseUnit: "gram", displayUnit: "kilogram", conversionFactor: "1000" });
            setIsAddOpen(true);
        }
    }, [searchParams]);

    const handleEditItem = (item: any) => {
        setEditMode(true);
        setEditId(item.id);

        // Converting Base Stock to Display Stock for Editing
        // Display Qty = Base Qty / Factor
        const displayQty = (item.qty / (item.conversionFactor || 1));

        setNewItem({
            name: item.name,
            sku: item.sku || "",
            qty: displayQty.toString(),
            price: item.price.toString(),
            baseUnit: item.baseUnit || "gram",
            displayUnit: item.displayUnit || "kilogram",
            conversionFactor: (item.conversionFactor || 1).toString()
        });
        setIsAddOpen(true);
    };

    const handleAddItem = async () => {
        if (!newItem.name || !newItem.price) return;
        setAdding(true);

        const factor = parseFloat(newItem.conversionFactor) || 1;
        const inputQty = parseFloat(newItem.qty) || 0;
        const totalBaseQty = inputQty * factor;

        const itemData = {
            id: editMode && editId ? editId : Date.now(),
            name: newItem.name,
            sku: newItem.sku,
            qty: totalBaseQty, // Storing Base Unit Qty internally
            price: parseFloat(newItem.price) || 0,
            low: totalBaseQty < (10 * factor), // Low stock alert logic (arbitrary 10 display units?) -> Let's keep it simple
            baseUnit: newItem.baseUnit,
            displayUnit: newItem.displayUnit,
            conversionFactor: factor
        };

        try {
            if (editMode && editId) {
                // Find original name to identify the row to update
                const originalItem = inventory.find(i => i.id === editId);
                const originalName = originalItem?.name;

                if (!originalName) {
                    alert("Original item not found. Cannot update.");
                    setAdding(false);
                    return;
                }

                // Call Update API
                await fetch('/api/sync', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        sheetUrl,
                        action: 'UPDATE',
                        originalName: originalName,
                        data: [
                            newItem.name,
                            newItem.sku,
                            totalBaseQty,
                            newItem.price,
                            newItem.baseUnit,
                            newItem.displayUnit,
                            factor
                        ]
                    })
                });

                // Optimistic Update
                updateInventoryItem(itemData);

            } else {
                // Add New Item
                await fetch('/api/sync', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        sheetUrl,
                        action: 'ADD',
                        data: [
                            newItem.name,
                            newItem.sku,
                            totalBaseQty,
                            newItem.price,
                            newItem.baseUnit,
                            newItem.displayUnit,
                            factor
                        ]
                    })
                });
                // Optimistic Add
                addInventoryItem(itemData);
            }

            setIsAddOpen(false);
            setNewItem({ name: "", sku: "", qty: "", price: "", baseUnit: "gram", displayUnit: "kilogram", conversionFactor: "1000" });

            // Trigger Success Popup
            setShowSuccess(true);

            setTimeout(() => {
                fetchInventory();
            }, 5000);

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
                <h1 className={styles.title}>Inventory</h1>
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
                <Button variant="secondary" className={styles.filterButton} disabled title="Filter disabled"><Filter size={18} /></Button>
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
                                    Stock: {parseFloat((item.qty / (item.conversionFactor || 1)).toFixed(2))} {item.displayUnit}
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
                        <div className={clsx(styles.tableCell, item.low && styles.stockLow)}>{parseFloat((item.qty / (item.conversionFactor || 1)).toFixed(2))} {item.displayUnit}</div>
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
                            placeholder="e.g. Basmati Rice"
                            value={newItem.name}
                            className={styles.modalInput}
                            onChange={(e) => setNewItem({ ...newItem, name: e.target.value })}
                        />
                    </div>

                    <div className={styles.rowGroup}>
                        <div>
                            <label className={styles.modalLabel}>Inventory Type (Base Unit)</label>
                            <select
                                className={clsx(styles.modalInput, "w-full h-10 bg-[#27272A] border border-white/10 rounded-md px-3 text-white")}
                                value={newItem.baseUnit}
                                onChange={(e) => {
                                    const base = e.target.value;
                                    let display = base;
                                    let factor = "1";

                                    // Auto-set smart defaults
                                    if (base === 'gram') { display = 'kilogram'; factor = '1000'; }
                                    if (base === 'millilitre') { display = 'litre'; factor = '1000'; }

                                    setNewItem({ ...newItem, baseUnit: base, displayUnit: display, conversionFactor: factor });
                                }}
                            >
                                <option value="gram">Weight (gram)</option>
                                <option value="millilitre">Liquid (ml)</option>
                                <option value="piece">Count (piece)</option>
                            </select>
                        </div>
                        <div>
                            <label className={styles.modalLabel}>Display Unit (Selling)</label>
                            <select
                                className={clsx(styles.modalInput, "w-full h-10 bg-[#27272A] border border-white/10 rounded-md px-3 text-white")}
                                value={newItem.displayUnit}
                                onChange={(e) => setNewItem({ ...newItem, displayUnit: e.target.value })}
                            >
                                {newItem.baseUnit === 'gram' && (
                                    <>
                                        <option value="gram">gram (g)</option>
                                        <option value="kilogram">kilogram (kg)</option>
                                    </>
                                )}
                                {newItem.baseUnit === 'millilitre' && (
                                    <>
                                        <option value="millilitre">millilitre (ml)</option>
                                        <option value="litre">litre (L)</option>
                                    </>
                                )}
                                {newItem.baseUnit === 'piece' && (
                                    <>
                                        <option value="piece">piece</option>
                                        <option value="packet">packet</option>
                                        <option value="box">box</option>
                                        <option value="bundle">bundle</option>
                                    </>
                                )}
                            </select>
                        </div>
                    </div>

                    <div className={styles.rowGroup}>
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
                        <div>
                            <label className={styles.modalLabel}>Price per {newItem.displayUnit} (₹)</label>
                            <Input
                                placeholder="0.00"
                                type="number"
                                value={newItem.price}
                                className={styles.modalInput}
                                onChange={(e) => setNewItem({ ...newItem, price: e.target.value })}
                            />
                        </div>
                    </div>

                    <div className={styles.rowGroup}>
                        <div>
                            <label className={styles.modalLabel}>Stock ({newItem.displayUnit})</label>
                            <Input
                                placeholder="0"
                                type="number"
                                value={newItem.qty} // This is Display Qty for Input
                                className={styles.modalInput}
                                onChange={(e) => setNewItem({ ...newItem, qty: e.target.value })}
                            />
                        </div>
                        <div>
                            <label className={styles.modalLabel}>SKU (Optional)</label>
                            <Input
                                placeholder="e.g. SKU-123"
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
