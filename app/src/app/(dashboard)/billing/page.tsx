"use client";

import { useState, useMemo } from "react";
import { useApp } from "@/context/AppContext";
import styles from "./billing.module.css";
import { Input, Button } from "@/components/ui/Shared";
import { Search, ShoppingCart, Plus, Minus, Trash2, Printer, Share2, ChevronUp, ChevronDown } from "lucide-react";
import clsx from "clsx";

interface CartItem {
    id: number;
    name: string;
    price: number;
    qty: number;
    maxQty: number;
}

export default function BillingPage() {
    const { inventory, shopName, shopAddress, shopPhone, shopGstin, sheetUrl } = useApp();

    const [searchTerm, setSearchTerm] = useState("");

    const [cart, setCart] = useState<CartItem[]>([]);
    // const [customerName, setCustomerName] = useState("Cash"); // Removed
    const [isMobileCartOpen, setIsMobileCartOpen] = useState(false);

    // Filter Products
    const filteredProducts = useMemo(() => {
        if (!searchTerm) return inventory;
        const lower = searchTerm.toLowerCase();
        return inventory.filter(p =>
            p.name.toLowerCase().includes(lower) ||
            (p.sku && p.sku.toLowerCase().includes(lower))
        ).sort((a, b) => a.name.localeCompare(b.name));
    }, [inventory, searchTerm]);

    // Cart Logic
    const addToCart = (product: any) => {
        setCart(prev => {
            const existing = prev.find(item => item.id === product.id);
            if (existing) {
                if (existing.qty >= product.qty) return prev; // Stock limit
                return prev.map(item =>
                    item.id === product.id ? { ...item, qty: item.qty + 1 } : item
                );
            }
            return [...prev, {
                id: product.id,
                name: product.name,
                price: typeof product.price === 'string' ? parseFloat(product.price) : product.price,
                qty: 1,
                maxQty: typeof product.qty === 'string' ? parseInt(product.qty) : product.qty
            }];
        });
    };

    const updateQty = (id: number, delta: number) => {
        setCart(prev => prev.map(item => {
            if (item.id === id) {
                const newQty = item.qty + delta;
                if (newQty < 1) return item; // Don't remove via minus, let trash do it
                if (newQty > item.maxQty) return item; // Max stock constraint
                return { ...item, qty: newQty };
            }
            return item;
        }));
    };

    const removeFromCart = (id: number) => {
        setCart(prev => prev.filter(item => item.id !== id));
    };

    // Calculations
    const totalAmount = useMemo(() => {
        return cart.reduce((sum, item) => sum + (item.price * item.qty), 0);
    }, [cart]);

    const totalItems = useMemo(() => cart.reduce((sum, item) => sum + item.qty, 0), [cart]);

    // Derived Calculations
    const gstRate = 0.18;
    const gstAmount = totalAmount * gstRate;
    const netAmount = totalAmount + gstAmount;


    // Actions
    const handlePrint = () => {
        window.print();
    };

    const handleWhatsApp = () => {
        // Construct a clean, aligned text bill
        let message = `*🧾 INVOICE - ${shopName || 'Store'}*\n`;
        message += `Date: ${new Date().toLocaleDateString('en-GB')}\n`;
        message += `------------------------------\n`;

        cart.forEach(item => {
            // Simple alignment logic
            const lineTotal = (item.price * item.qty).toFixed(2);
            message += `${item.name} (x${item.qty}) - ₹${lineTotal}\n`;
        });

        message += `------------------------------\n`;
        message += `*Subtotal:* ₹${totalAmount.toFixed(2)}\n`;
        message += `*GST (18%):* ₹${gstAmount.toFixed(2)}\n`;
        message += `*TOTAL:* ₹${netAmount.toFixed(2)}\n`;
        message += `------------------------------\n`;
        message += `Thank you for shopping!`;

        // Direct Redirect to WhatsApp
        const url = `https://wa.me/?text=${encodeURIComponent(message)}`;
        window.open(url, '_blank');
    };

    const handleShareImage = async () => {
        try {
            const invoiceElement = document.querySelector('.invoice-box') as HTMLElement;
            if (!invoiceElement) return;

            // ... (Image Capture Logic) ...
            const clone = invoiceElement.cloneNode(true) as HTMLElement;
            clone.style.position = 'absolute';
            clone.style.top = '-9999px';
            clone.style.left = '0';
            clone.style.width = '800px';
            clone.style.background = 'white';
            clone.style.display = 'block';
            document.body.appendChild(clone);

            const html2canvas = (await import('html2canvas')).default;
            const canvas = await html2canvas(clone, {
                scale: 2,
                useCORS: true,
                backgroundColor: '#ffffff',
                windowWidth: 800 // Force desktop width for mobile capture
            });
            document.body.removeChild(clone);

            canvas.toBlob(async (blob) => {
                if (!blob) return;
                const file = new File([blob], `invoice_${Date.now()}.png`, { type: 'image/png' });

                if (navigator.share && navigator.canShare({ files: [file] })) {
                    await navigator.share({
                        files: [file],
                        title: 'Invoice',
                        text: `Invoice from ${shopName}`
                    });
                } else {
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `invoice_${Date.now()}.png`;
                    a.click();
                }
            }, 'image/png');

        } catch (error) {
            console.error("Image Share Error", error);
            alert("Could not generate image.");
        }
    };

    const processSale = async () => {
        if (!confirm("Confirm Sale? This will deduct stock from the Google Sheet.")) return;

        try {
            if (!sheetUrl) {
                alert("No Google Sheet connected! Please configure it in Profile.");
                return;
            }

            // Demo Mode Check (Client-side logic since we don't have session here easily accessible globally without hook, checking inventory source or just try/catch)
            // better to assume if it fails 401 it handles it, OR check if we are using demo data.
            // Let's just try the fetch, if it is 401, we show "Demo Mode" success.

            const soldItems = cart.map(item => ({ name: item.name, qty: item.qty }));

            const res = await fetch('/api/sync', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    sheetUrl,
                    action: 'SELL',
                    data: soldItems
                })
            });

            const result = await res.json();

            // Handle Demo Mode (Unauthorized = Success for UI testing)
            if (res.status === 401) {
                alert("Sale Simulated! (Demo Mode active - Login to sync with Sheets)");
                setCart([]);
                return;
            }

            if (result.success) {
                alert("Stock Updated Successfully!");
                setCart([]); // Clear cart
                // optionally refresh inventory here or let next sync handle it
                window.location.reload(); // Simple reload to re-fetch updated inventory
            } else {
                alert("Failed to update stock: " + result.error);
            }

        } catch (error) {
            console.error("Sale Error", error);
            alert("Error processing sale.");
        }
    };

    return (
        <div className={styles.container}>
            {/* Left: Product Selection */}
            <div className={styles.productSection}>
                <div className={styles.searchRow}>
                    <div className={styles.searchWrapper}>
                        <Search className={styles.searchIcon} size={18} />
                        <Input
                            placeholder="Search products..."
                            className={styles.searchInput}
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        // Auto-select first suggestion on Enter could be added here
                        />

                        {/* Search Suggestions Dropdown */}
                        {searchTerm && (
                            <div className="absolute top-full left-0 right-0 mt-2 bg-[#27272A] border border-white/10 rounded-lg shadow-xl z-[100] max-h-60 overflow-y-auto">
                                {filteredProducts.length > 0 ? (
                                    filteredProducts.map(product => (
                                        <div
                                            key={product.id}
                                            className="p-3 hover:bg-white/5 cursor-pointer border-b border-white/5 last:border-0 flex justify-between items-center"
                                            onClick={() => {
                                                addToCart(product);
                                                setSearchTerm(""); // Clear after adding for fast POS flow
                                            }}
                                        >
                                            <div>
                                                <p className="font-medium text-white">{product.name}</p>
                                                <p className="text-xs text-white/50">{product.sku}</p>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-primary font-semibold">₹{product.price}</p>
                                                <p className="text-[10px] text-white/40">Stock: {product.qty}</p>
                                            </div>
                                        </div>
                                    ))
                                ) : (
                                    <div className="p-3 text-sm text-white/50 text-center">No products found</div>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                <div className={styles.productsGrid}>
                    {filteredProducts.map(product => (
                        <div key={product.id} className={styles.productCard} onClick={() => addToCart(product)}>
                            <div>
                                <h3 className={styles.productName}>{product.name}</h3>
                                {(product.sku) && <p className="text-xs text-white/40">{product.sku}</p>}
                            </div>
                            <div className={styles.productMeta}>
                                <span className={styles.productPrice}>₹{product.price}</span>
                                {cart.find(item => item.id === product.id) ? (
                                    <span className="text-[10px] text-green-400 font-bold bg-green-900/30 px-2 py-0.5 rounded-full">
                                        Added ( {cart.find(c => c.id === product.id)?.qty} )
                                    </span>
                                ) : (
                                    <span className={styles.productStock}>Stock: {product.qty}</span>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Right: Cart (Bill) */}

            {/* Mobile Floating Bar (Only visible on mobile when cart has items and is closed) */}
            <div className="lg:hidden">
                {!isMobileCartOpen && totalItems > 0 && (
                    <div className={styles.floatingCartBar} onClick={() => setIsMobileCartOpen(true)}>
                        <div className="flex flex-col">
                            <span className="text-xs font-medium text-white/80">{totalItems} Items</span>
                            <span className="font-bold text-base">₹{totalAmount.toFixed(0)}</span>
                        </div>
                        <div className="flex items-center gap-2 font-semibold text-sm bg-black/20 px-3 py-1.5 rounded-full">
                            View Bill <ChevronUp size={16} />
                        </div>
                    </div>
                )}
            </div>

            <div className={clsx(styles.cartSection, isMobileCartOpen && styles.open)}>
                <div className={styles.cartHeader}>
                    <div className={styles.cartHeaderContent}>
                        <ShoppingCart size={20} className="text-primary" />
                        <span className={styles.cartTitle}>Current Bill</span>
                        <span className="text-xs bg-white/10 px-2 py-0.5 rounded-full text-white/70">{totalItems} items</span>
                    </div>
                    {/* Mobile Close Button */}
                    <div className="lg:hidden text-white hover:bg-white/10 p-2 rounded-full cursor-pointer" onClick={() => setIsMobileCartOpen(false)}>
                        <ChevronDown size={24} />
                    </div>
                </div>

                <div className={styles.cartItems}>
                    {cart.length === 0 ? (
                        <div className={styles.emptyCart}>
                            <ShoppingCart size={48} />
                            <p>Cart is empty</p>
                        </div>
                    ) : (
                        cart.map(item => (
                            <div key={item.id} className={styles.cartItem}>
                                <div className={styles.cartItemInfo}>
                                    <p className={styles.cartItemName}>{item.name}</p>
                                    <p className={styles.cartItemPrice}>₹{item.price} x {item.qty} = <span className="text-white">₹{item.price * item.qty}</span></p>
                                </div>
                                <div className={styles.cartControls}>
                                    <button className={styles.qtyBtn} onClick={() => updateQty(item.id, -1)}><Minus size={14} /></button>
                                    <span className={styles.qtyValue}>{item.qty}</span>
                                    <button className={styles.qtyBtn} onClick={() => updateQty(item.id, 1)}><Plus size={14} /></button>
                                    <button className={clsx(styles.qtyBtn, "!bg-red-500/20 !text-red-400 hover:!bg-red-500/30 ml-2")} onClick={() => removeFromCart(item.id)}>
                                        <Trash2 size={14} />
                                    </button>
                                </div>
                            </div>
                        ))
                    )}
                </div>

                <div className={styles.billSummary}>

                    <div className={styles.summaryRow}>
                        <span>Subtotal</span>
                        <span>₹{totalAmount.toFixed(2)}</span>
                    </div>
                    <div className={styles.summaryRow}>
                        <span>Tax (18%)</span>
                        <span>₹{gstAmount.toFixed(2)}</span>
                    </div>
                    <div className={styles.totalRow}>
                        <span>Total</span>
                        <span>₹{netAmount.toFixed(2)}</span>
                    </div>

                    <div className={styles.actionButtons}>
                        <Button variant="secondary" className="w-full" disabled={cart.length === 0} onClick={handlePrint}>
                            <Printer size={18} /> Print
                        </Button>
                        <Button className="w-full !bg-[#25D366] hover:!bg-[#128C7E]" disabled={cart.length === 0} onClick={handleWhatsApp}>
                            <Share2 size={18} /> WhatsApp
                        </Button>
                        <Button className="w-full border border-white/10 hover:bg-white/5 col-span-2 text-xs" disabled={cart.length === 0} onClick={handleShareImage}>
                            Share Receipt Image
                        </Button>
                        <Button className="w-full !bg-blue-600 hover:!bg-blue-700 col-span-2 mt-2" disabled={cart.length === 0} onClick={processSale}>
                            Complete Sale (Update Stock)
                        </Button>
                    </div>
                </div>
            </div>

            {/* 
                HIDDEN PRINT SECTION 
                Uses the 'print-visible' class which is handled by globals.css @media print 
            */}
            <div className="print-visible" style={{ display: 'none' }}>
                <div className="invoice-box">
                    <div className="invoice-header">
                        <div className="shop-details">
                            <h2>{shopName || "Fresh Mart Grocery"}</h2>
                            <p>
                                {shopAddress || "123 Market Street, City Center"}<br />
                                Phone: {shopPhone || "+91 98765 43210"}<br />
                                GSTIN: {shopGstin || "Not Available"}
                            </p>
                        </div>
                        <div className="invoice-meta">
                            <p>
                                <strong>Invoice #:</strong> {Date.now().toString().slice(-6)}<br />
                                <strong>Date:</strong> {new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}<br />
                                <strong>Time:</strong> {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </p>
                        </div>
                    </div>

                    <table>
                        <thead>
                            <tr>
                                <th style={{ width: '40%' }}>Item Description</th>
                                <th className="text-center">Qty</th>
                                <th className="text-right">Price (₹)</th>
                                <th className="text-right">Total (₹)</th>
                            </tr>
                        </thead>
                        <tbody>
                            {cart.map(item => (
                                <tr key={item.id}>
                                    <td>{item.name}</td>
                                    <td className="text-center">{item.qty}</td>
                                    <td className="text-right">{item.price.toFixed(2)}</td>
                                    <td className="text-right">{(item.price * item.qty).toFixed(2)}</td>
                                </tr>
                            ))}

                            {/* Spacer */}
                            <tr style={{ height: '20px' }}>
                                <td colSpan={4} style={{ border: 'none' }}></td>
                            </tr>

                            {/* Totals */}
                            <tr className="subtotal-row">
                                <td colSpan={2}></td>
                                <td className="text-right">Subtotal:</td>
                                <td className="text-right">{totalAmount.toFixed(2)}</td>
                            </tr>
                            <tr className="subtotal-row">
                                <td colSpan={2}></td>
                                <td className="text-right">Tax (18% GST):</td>
                                <td className="text-right">{gstAmount.toFixed(2)}</td>
                            </tr>
                            <tr className="total-row">
                                <td colSpan={2}></td>
                                <td className="text-right">Grand Total:</td>
                                <td className="text-right">₹{netAmount.toFixed(2)}</td>
                            </tr>
                        </tbody>
                    </table>

                    <div style={{ marginTop: '30px', textAlign: 'center', fontSize: '14px', color: '#777' }}>
                        <p>Thank you for shopping with us!</p>
                        <p>Terms & Conditions apply. Goods once sold will not be taken back.</p>
                    </div>
                </div>
            </div>
        </div>
    );
}
