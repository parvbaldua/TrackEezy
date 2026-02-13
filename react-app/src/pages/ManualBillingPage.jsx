import { useState, useMemo, useEffect } from "react";
import { useApp } from "../context/AppContext";
import styles from "./ManualBillingPage.module.css";
import { Input, Button } from "../components/ui/Shared";
import { Modal } from "../components/ui/Modal";
import { Search, ShoppingCart, Plus, Minus, Trash2, Printer, Share2, ChevronUp, ChevronDown, Settings, Zap, X, Check, Phone, FileText, Download, Mic, MicOff } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import clsx from "clsx";
import { useAuth } from "../context/AuthProvider";
import { GoogleSheetsService } from "../services/sheets";
import { generateInvoicePDF, downloadPDF } from "../lib/pdfGenerator";

export default function ManualBillingPage() {
    const { inventory, shopName, shopAddress, shopPhone, shopGstin, sheetUrl, fetchInventory, getSheetId } = useApp();
    const { accessToken } = useAuth();

    // Quick Picks State
    const [quickPicks, setQuickPicks] = useState([]);
    const [isEditingQuickPicks, setIsEditingQuickPicks] = useState(false);
    const [quickPickSearch, setQuickPickSearch] = useState("");

    // Product Selection State
    const [selectedProduct, setSelectedProduct] = useState(null);
    const [searchTerm, setSearchTerm] = useState("");
    const [showSearchDropdown, setShowSearchDropdown] = useState(false);

    // Manual Entry State
    const [manualPrice, setManualPrice] = useState("");
    const [manualProductName, setManualProductName] = useState(""); // Custom product name
    const [quantity, setQuantity] = useState(1);
    const [discountPercent, setDiscountPercent] = useState("");
    const [gstEnabled, setGstEnabled] = useState(false);
    const [gstPercent, setGstPercent] = useState("18");

    // Cart State
    const [cart, setCart] = useState([]);
    const [isMobileCartOpen, setIsMobileCartOpen] = useState(false);

    // Share Modal State
    const [showShareModal, setShowShareModal] = useState(false);
    const [customerPhone, setCustomerPhone] = useState("");
    const [pdfFormat, setPdfFormat] = useState("pos"); // 'pos' or 'a4'

    // UPI ID for payment QR (stored in localStorage)
    const [upiId] = useState(localStorage.getItem('bijnex_upi_id') || '');

    // Generate UPI Payment Link
    const generateUPILink = (amount) => {
        if (!upiId) return null;
        const encodedName = encodeURIComponent(shopName || 'Store');
        return `upi://pay?pa=${upiId}&pn=${encodedName}&am=${amount.toFixed(2)}&cu=INR`;
    };

    // Load Quick Picks from localStorage
    useEffect(() => {
        const saved = localStorage.getItem("bijnex_quick_picks");
        if (saved) {
            try {
                setQuickPicks(JSON.parse(saved));
            } catch (e) {
                console.error("Failed to parse quick picks", e);
            }
        }
    }, []);

    // Save Quick Picks to localStorage
    useEffect(() => {
        if (quickPicks.length > 0) {
            localStorage.setItem("bijnex_quick_picks", JSON.stringify(quickPicks));
        }
    }, [quickPicks]);

    // Load Cart from localStorage
    useEffect(() => {
        const saved = localStorage.getItem("manual_cart_data");
        if (saved) {
            try {
                setCart(JSON.parse(saved));
            } catch (e) {
                console.error("Failed to parse cart", e);
            }
        }
    }, []);

    // Save Cart to localStorage
    useEffect(() => {
        localStorage.setItem("manual_cart_data", JSON.stringify(cart));
    }, [cart]);

    // Filter products for search
    const filteredProducts = useMemo(() => {
        if (!searchTerm) return [];
        const lower = searchTerm.toLowerCase();
        return inventory.filter(p =>
            p.name.toLowerCase().includes(lower) ||
            (p.sku && p.sku.toLowerCase().includes(lower))
        ).slice(0, 10);
    }, [inventory, searchTerm]);

    // Filter products for Quick Pick modal
    const quickPickFilteredProducts = useMemo(() => {
        if (!quickPickSearch) return inventory.slice(0, 20);
        const lower = quickPickSearch.toLowerCase();
        return inventory.filter(p =>
            p.name.toLowerCase().includes(lower) ||
            (p.sku && p.sku.toLowerCase().includes(lower))
        ).slice(0, 20);
    }, [inventory, quickPickSearch]);

    // Select a product (from Quick Pick or Search)
    const selectProduct = (product) => {
        setSelectedProduct(product);
        setManualPrice("");
        setQuantity(1);
        setSearchTerm("");
        setShowSearchDropdown(false);
    };

    // Add/Remove Quick Pick
    const toggleQuickPick = (product) => {
        const exists = quickPicks.find(p => p.id === product.id);
        if (exists) {
            setQuickPicks(prev => prev.filter(p => p.id !== product.id));
        } else {
            if (quickPicks.length >= 10) {
                alert("Maximum 10 Quick Picks allowed!");
                return;
            }
            setQuickPicks(prev => [...prev, { id: product.id, name: product.name, sku: product.sku }]);
        }
    };

    // Add to Cart
    const addToCart = () => {
        // Allow either selected product OR manual product name
        const productName = selectedProduct ? selectedProduct.name : manualProductName.trim();
        if (!productName || !manualPrice) {
            alert("Please enter product name and price");
            return;
        }

        const price = parseFloat(manualPrice) || 0;
        const discount = parseFloat(discountPercent) || 0;
        const gst = gstEnabled ? (parseFloat(gstPercent) || 0) : 0;

        const cartItem = {
            id: Date.now(), // Unique cart item ID
            productId: selectedProduct ? selectedProduct.id : `custom_${Date.now()}`,
            name: productName,
            price: price,
            qty: quantity,
            discountPercent: discount,
            gstEnabled: gstEnabled,
            gstPercent: gst,
            isCustom: !selectedProduct // Flag for custom items
        };

        setCart(prev => [...prev, cartItem]);

        // Reset form
        setSelectedProduct(null);
        setManualProductName("");
        setManualPrice("");
        setQuantity(1);
        setDiscountPercent("");
    };

    // Remove from Cart
    const removeFromCart = (cartItemId) => {
        setCart(prev => prev.filter(item => item.id !== cartItemId));
    };

    // Update Cart Item Quantity
    const updateCartItemQty = (cartItemId, newQty) => {
        const qty = parseInt(newQty) || 1;
        if (qty < 1) return;
        setCart(prev => prev.map(item =>
            item.id === cartItemId ? { ...item, qty } : item
        ));
    };

    // Cart Calculations
    const cartTotals = useMemo(() => {
        let subtotal = 0;
        let totalDiscount = 0;
        let totalGst = 0;

        cart.forEach(item => {
            const itemSubtotal = item.price * item.qty;
            const itemDiscount = itemSubtotal * (item.discountPercent / 100);
            const afterDiscount = itemSubtotal - itemDiscount;
            const itemGst = item.gstEnabled ? afterDiscount * (item.gstPercent / 100) : 0;

            subtotal += itemSubtotal;
            totalDiscount += itemDiscount;
            totalGst += itemGst;
        });

        const afterDiscount = subtotal - totalDiscount;
        const grandTotal = afterDiscount + totalGst;

        return { subtotal, totalDiscount, afterDiscount, totalGst, grandTotal };
    }, [cart]);

    // Process Sale
    const processSale = async () => {
        if (cart.length === 0) return;
        if (!confirm("Confirm Sale?")) return;

        try {
            if (accessToken && sheetUrl) {
                const spreadsheetId = getSheetId(sheetUrl);

                // 1. Deduct Stock from Inventory
                const soldItems = cart.map(item => ({
                    name: item.name,
                    qty: item.qty
                }));
                await GoogleSheetsService.deductStock(accessToken, spreadsheetId, soldItems);

                // 2. Record Sale History
                await GoogleSheetsService.recordSale(accessToken, spreadsheetId, {
                    date: new Date().toISOString(),
                    amount: cartTotals.grandTotal,
                    itemsCount: cart.reduce((sum, item) => sum + item.qty, 0),
                    invoiceId: Date.now().toString(),
                    items: cart.map(item => ({ name: item.name, qty: item.qty }))
                });

                // 3. Refresh inventory to reflect new stock
                if (fetchInventory) {
                    fetchInventory();
                }
            }

            alert("Sale Recorded Successfully!");
            setCart([]);
            localStorage.removeItem("manual_cart_data");

        } catch (error) {
            console.error("Sale Error", error);
            alert("Error processing sale: " + error.message);
        }
    };

    // Print Handler
    const handlePrint = () => {
        window.print();
    };

    // Open Share Modal
    const handleWhatsAppClick = () => {
        setShowShareModal(true);
    };

    // Generate PDF
    const handleDownloadPDF = () => {
        const invoiceId = Date.now().toString().slice(-6);
        const doc = generateInvoicePDF({
            format: pdfFormat,
            shop: { name: shopName, address: shopAddress, phone: shopPhone, gstin: shopGstin },
            cart: cart,
            totals: cartTotals,
            invoiceId: invoiceId
        });
        downloadPDF(doc, `invoice_${invoiceId}.pdf`);
    };

    // Send via WhatsApp using Web Share API for direct file sharing
    const handleSendWhatsApp = async () => {
        const invoiceId = Date.now().toString().slice(-6);

        // Build message
        let message = `🧾 *INVOICE - ${shopName || 'Store'}*\n`;
        message += `Invoice #: ${invoiceId}\n`;
        message += `Date: ${new Date().toLocaleDateString('en-GB')}\n`;
        message += `------------------------------\n`;

        cart.forEach(item => {
            const lineTotal = (item.price * item.qty).toFixed(2);
            message += `${item.name} (${item.qty}) - ₹${lineTotal}\n`;
        });

        message += `------------------------------\n`;
        message += `*Subtotal:* ₹${cartTotals.subtotal.toFixed(2)}\n`;
        if (cartTotals.totalDiscount > 0) {
            message += `*Discount:* -₹${cartTotals.totalDiscount.toFixed(2)}\n`;
        }
        if (cartTotals.totalGst > 0) {
            message += `*GST:* ₹${cartTotals.totalGst.toFixed(2)}\n`;
        }
        message += `*TOTAL:* ₹${cartTotals.grandTotal.toFixed(2)}\n`;
        message += `------------------------------\n`;
        message += `Thank you for your business!`;

        // Try Web Share API first (for direct file sharing)
        if (navigator.share && navigator.canShare) {
            try {
                // Generate PDF as blob
                const doc = generateInvoicePDF({
                    format: pdfFormat,
                    shop: { name: shopName, address: shopAddress, phone: shopPhone, gstin: shopGstin },
                    cart: cart,
                    totals: cartTotals,
                    invoiceId: invoiceId
                });

                const pdfBlob = doc.output('blob');
                const file = new File([pdfBlob], `invoice_${invoiceId}.pdf`, { type: 'application/pdf' });

                // Check if file sharing is supported
                if (navigator.canShare({ files: [file] })) {
                    await navigator.share({
                        title: `Invoice #${invoiceId}`,
                        text: message,
                        files: [file]
                    });
                    setShowShareModal(false);
                    setCustomerPhone("");
                    return;
                }
            } catch (err) {
                console.log('Web Share failed, falling back to WhatsApp URL:', err);
            }
        }

        // Fallback: Open WhatsApp with message (no file attachment)
        const phone = customerPhone.replace(/\D/g, "");
        const fullPhone = phone.startsWith("91") ? phone : `91${phone}`;
        const url = phone
            ? `https://wa.me/${fullPhone}?text=${encodeURIComponent(message)}`
            : `https://wa.me/?text=${encodeURIComponent(message)}`;

        window.open(url, '_blank');
        setShowShareModal(false);
        setCustomerPhone("");
    };

    const totalItems = cart.reduce((sum, item) => sum + item.qty, 0);

    return (
        <div className={styles.container}>
            <div className={styles.header}>
                <div className="flex flex-col">
                    <h1 className={styles.title}>Manual Billing</h1>
                </div>
                <Button
                    variant="ghost"
                    className="!px-3 !py-2 text-yellow-400 hover:text-yellow-300 flex items-center gap-2"
                    onClick={() => setIsEditingQuickPicks(true)}
                    title="Choose Quick Picks"
                >
                    <Zap size={16} />
                    <span className="text-sm">Choose Quick Picks</span>
                </Button>
            </div>

            <div className={styles.contentWrapper}>
                {/* Left: Product Entry */}
                <div className={styles.entrySection}>
                    {/* Quick Picks Grid */}
                    {quickPicks.length > 0 && (
                        <div className={styles.quickPicksSection}>
                            <div className={styles.quickPicksHeader}>
                                <Zap size={16} className="text-yellow-400" />
                                <span>Quick Picks</span>
                            </div>
                            <div className={styles.quickPicksGrid}>
                                {quickPicks.map(pick => {
                                    const product = inventory.find(p => p.id === pick.id);
                                    return (
                                        <button
                                            key={pick.id}
                                            className={clsx(
                                                styles.quickPickCard,
                                                selectedProduct?.id === pick.id && styles.selected
                                            )}
                                            onClick={() => product && selectProduct(product)}
                                        >
                                            <span className={styles.quickPickName}>{pick.name}</span>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* Search Product */}
                    <div className={styles.searchSection}>
                        <label className={styles.label}>Or Search Product</label>
                        <div className={styles.searchWrapper}>
                            <Search className={styles.searchIcon} size={18} />
                            <Input
                                placeholder="Search products..."
                                className={styles.searchInput}
                                value={searchTerm}
                                onChange={(e) => {
                                    setSearchTerm(e.target.value);
                                    setShowSearchDropdown(true);
                                }}
                                onFocus={() => setShowSearchDropdown(true)}
                            />
                            {showSearchDropdown && searchTerm && (
                                <div className={styles.searchDropdown}>
                                    {filteredProducts.length > 0 ? (
                                        filteredProducts.map(product => (
                                            <div
                                                key={product.id}
                                                className={styles.searchItem}
                                                onClick={() => selectProduct(product)}
                                            >
                                                <span className={styles.searchItemName}>{product.name}</span>
                                                <span className={styles.searchItemPrice}>₹{product.price}</span>
                                            </div>
                                        ))
                                    ) : (
                                        <div className={styles.searchEmpty}>No products found</div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Selected Product Form */}
                    {selectedProduct && (
                        <div className={styles.entryForm}>
                            <div className={styles.selectedHeader}>
                                <span className={styles.selectedLabel}>Selected:</span>
                                <span className={styles.selectedName}>{selectedProduct.name}</span>
                                <button className={styles.clearBtn} onClick={() => setSelectedProduct(null)}>
                                    <X size={16} />
                                </button>
                            </div>

                            <div className={styles.formRow}>
                                <div className={styles.formGroup}>
                                    <label className={styles.label}>Price (₹)</label>
                                    <Input
                                        type="number"
                                        placeholder="Enter price"
                                        value={manualPrice}
                                        onChange={(e) => setManualPrice(e.target.value)}
                                        className={styles.priceInput}
                                    />
                                </div>
                                <div className={styles.formGroup}>
                                    <label className={styles.label}>Quantity</label>
                                    <div className={styles.qtyControl}>
                                        <button onClick={() => setQuantity(q => Math.max(1, q - 1))}><Minus size={16} /></button>
                                        <span>{quantity}</span>
                                        <button onClick={() => setQuantity(q => q + 1)}><Plus size={16} /></button>
                                    </div>
                                </div>
                            </div>

                            <div className={styles.formRow}>
                                <div className={styles.formGroup}>
                                    <label className={styles.label}>Discount (%)</label>
                                    <Input
                                        type="number"
                                        placeholder="0"
                                        value={discountPercent}
                                        onChange={(e) => setDiscountPercent(e.target.value)}
                                        className={styles.discountInput}
                                    />
                                </div>
                                <div className={styles.formGroup}>
                                    <label className={styles.label}>GST</label>
                                    <div className={styles.gstControl}>
                                        <button
                                            className={clsx(styles.gstToggle, !gstEnabled && styles.active)}
                                            onClick={() => setGstEnabled(false)}
                                        >Off</button>
                                        <button
                                            className={clsx(styles.gstToggle, gstEnabled && styles.active)}
                                            onClick={() => setGstEnabled(true)}
                                        >On</button>
                                        {gstEnabled && (
                                            <Input
                                                type="number"
                                                value={gstPercent}
                                                onChange={(e) => setGstPercent(e.target.value)}
                                                className={styles.gstInput}
                                            />
                                        )}
                                    </div>
                                </div>
                            </div>

                            <Button
                                className={styles.addToCartBtn}
                                onClick={addToCart}
                                disabled={!manualPrice}
                            >
                                <Plus size={18} /> Add to Cart
                            </Button>
                        </div>
                    )}

                    {/* Custom Product Entry (when no product selected) */}
                    {!selectedProduct && (
                        <div className={styles.entryForm}>
                            <div className={styles.selectedHeader}>
                                <span className={styles.selectedLabel}>✏️ Add Custom Item</span>
                            </div>

                            <div className={styles.formRow}>
                                <div className={styles.formGroup} style={{ flex: 2 }}>
                                    <label className={styles.label}>Product Name</label>
                                    <Input
                                        type="text"
                                        placeholder="Enter product name..."
                                        value={manualProductName}
                                        onChange={(e) => setManualProductName(e.target.value)}
                                        className={styles.priceInput}
                                    />
                                </div>
                            </div>

                            <div className={styles.formRow}>
                                <div className={styles.formGroup}>
                                    <label className={styles.label}>Price (₹)</label>
                                    <Input
                                        type="number"
                                        placeholder="Enter price"
                                        value={manualPrice}
                                        onChange={(e) => setManualPrice(e.target.value)}
                                        className={styles.priceInput}
                                    />
                                </div>
                                <div className={styles.formGroup}>
                                    <label className={styles.label}>Quantity</label>
                                    <div className={styles.qtyControl}>
                                        <button onClick={() => setQuantity(q => Math.max(1, q - 1))}><Minus size={16} /></button>
                                        <span>{quantity}</span>
                                        <button onClick={() => setQuantity(q => q + 1)}><Plus size={16} /></button>
                                    </div>
                                </div>
                            </div>

                            <div className={styles.formRow}>
                                <div className={styles.formGroup}>
                                    <label className={styles.label}>Discount (%)</label>
                                    <Input
                                        type="number"
                                        placeholder="0"
                                        value={discountPercent}
                                        onChange={(e) => setDiscountPercent(e.target.value)}
                                        className={styles.discountInput}
                                    />
                                </div>
                                <div className={styles.formGroup}>
                                    <label className={styles.label}>GST</label>
                                    <div className={styles.gstControl}>
                                        <button
                                            className={clsx(styles.gstToggle, !gstEnabled && styles.active)}
                                            onClick={() => setGstEnabled(false)}
                                        >Off</button>
                                        <button
                                            className={clsx(styles.gstToggle, gstEnabled && styles.active)}
                                            onClick={() => setGstEnabled(true)}
                                        >On</button>
                                        {gstEnabled && (
                                            <Input
                                                type="number"
                                                value={gstPercent}
                                                onChange={(e) => setGstPercent(e.target.value)}
                                                className={styles.gstInput}
                                            />
                                        )}
                                    </div>
                                </div>
                            </div>

                            <Button
                                className={styles.addToCartBtn}
                                onClick={addToCart}
                                disabled={!manualProductName.trim() || !manualPrice}
                            >
                                <Plus size={18} /> Add to Cart
                            </Button>
                        </div>
                    )}
                </div>

                {/* Mobile Floating Bar */}
                <div className="lg:hidden">
                    {!isMobileCartOpen && totalItems > 0 && (
                        <div className={styles.floatingCartBar} onClick={() => setIsMobileCartOpen(true)}>
                            <div className="flex flex-col">
                                <span className="text-xs font-medium text-white/80">{totalItems} Items</span>
                                <span className="font-bold text-base">₹{cartTotals.grandTotal.toFixed(0)}</span>
                            </div>
                            <div className="flex items-center gap-2 font-semibold text-sm bg-black/20 px-3 py-1.5 rounded-full">
                                View Bill <ChevronUp size={16} />
                            </div>
                        </div>
                    )}
                </div>

                {/* Right: Cart */}
                <div className={clsx(styles.cartSection, isMobileCartOpen && styles.open)}>
                    <div className={styles.cartHeader}>
                        <div className={styles.cartHeaderContent}>
                            <ShoppingCart size={20} className="text-primary" />
                            <span className={styles.cartTitle}>Current Bill</span>
                            <span className="text-xs bg-white/10 px-2 py-0.5 rounded-full text-white/70">{totalItems} items</span>
                        </div>
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
                                        <p className={styles.cartItemPrice}>
                                            ₹{item.price} × {item.qty} = ₹{(item.price * item.qty).toFixed(2)}
                                            {item.discountPercent > 0 && <span className="text-green-400"> -{item.discountPercent}%</span>}
                                            {item.gstEnabled && <span className="text-yellow-400"> +{item.gstPercent}% GST</span>}
                                        </p>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <button
                                            className="w-7 h-7 rounded bg-white/10 hover:bg-white/20 flex items-center justify-center"
                                            onClick={() => updateCartItemQty(item.id, item.qty - 1)}
                                            disabled={item.qty <= 1}
                                        >
                                            <Minus size={14} />
                                        </button>
                                        <input
                                            type="number"
                                            min="1"
                                            value={item.qty}
                                            onChange={(e) => updateCartItemQty(item.id, e.target.value)}
                                            className="w-12 h-7 text-center bg-white/10 border border-white/10 rounded text-white text-sm"
                                        />
                                        <button
                                            className="w-7 h-7 rounded bg-white/10 hover:bg-white/20 flex items-center justify-center"
                                            onClick={() => updateCartItemQty(item.id, item.qty + 1)}
                                        >
                                            <Plus size={14} />
                                        </button>
                                    </div>
                                    <button className={styles.removeBtn} onClick={() => removeFromCart(item.id)}>
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                            ))
                        )}
                    </div>

                    <div className={styles.billSummary}>
                        <div className={styles.summaryRow}>
                            <span>Subtotal</span>
                            <span>₹{cartTotals.subtotal.toFixed(2)}</span>
                        </div>
                        {cartTotals.totalDiscount > 0 && (
                            <div className={clsx(styles.summaryRow, styles.discount)}>
                                <span>Discount</span>
                                <span>-₹{cartTotals.totalDiscount.toFixed(2)}</span>
                            </div>
                        )}
                        {cartTotals.totalGst > 0 && (
                            <div className={styles.summaryRow}>
                                <span>GST</span>
                                <span>₹{cartTotals.totalGst.toFixed(2)}</span>
                            </div>
                        )}
                        <div className={styles.totalRow}>
                            <span>Total</span>
                            <span>₹{cartTotals.grandTotal.toFixed(2)}</span>
                        </div>

                        {/* UPI Payment QR Code */}
                        {upiId && cart.length > 0 && (
                            <div className="mt-3 p-3 bg-white rounded-lg text-center">
                                <QRCodeSVG
                                    value={generateUPILink(cartTotals.grandTotal)}
                                    size={100}
                                    className="mx-auto"
                                />
                                <p className="text-xs text-gray-600 mt-2">Scan to Pay ₹{cartTotals.grandTotal.toFixed(0)}</p>
                            </div>
                        )}

                        {!upiId && (
                            <p className="text-xs text-white/40 text-center mt-2">
                                Add UPI ID in Profile to show payment QR
                            </p>
                        )}

                        <div className={styles.actionButtons}>
                            <Button variant="secondary" className="w-full" disabled={cart.length === 0} onClick={handlePrint}>
                                <Printer size={18} /> Print
                            </Button>
                            <Button className="w-full !bg-[#25D366] hover:!bg-[#128C7E]" disabled={cart.length === 0} onClick={handleWhatsAppClick}>
                                <Share2 size={18} /> WhatsApp
                            </Button>
                            <Button className="w-full !bg-blue-600 hover:!bg-blue-700 col-span-2 mt-2" disabled={cart.length === 0} onClick={processSale}>
                                Complete Sale
                            </Button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Quick Picks Edit Modal */}
            <Modal isOpen={isEditingQuickPicks} onClose={() => setIsEditingQuickPicks(false)} title="Edit Quick Picks">
                <div className={styles.quickPickModal}>
                    <p className={styles.modalSubtext}>Select up to 10 frequently sold products for quick access</p>

                    <div className={styles.modalSearch}>
                        <Search size={16} />
                        <input
                            placeholder="Search products..."
                            value={quickPickSearch}
                            onChange={(e) => setQuickPickSearch(e.target.value)}
                        />
                    </div>

                    <div className={styles.quickPickList}>
                        {quickPickFilteredProducts.map(product => {
                            const isSelected = quickPicks.some(p => p.id === product.id);
                            return (
                                <div
                                    key={product.id}
                                    className={clsx(styles.quickPickListItem, isSelected && styles.selected)}
                                    onClick={() => toggleQuickPick(product)}
                                >
                                    <span>{product.name}</span>
                                    {isSelected && <Check size={16} className="text-green-400" />}
                                </div>
                            );
                        })}
                    </div>

                    <div className={styles.modalFooter}>
                        <span className="text-white/50 text-sm">{quickPicks.length}/10 selected</span>
                        <Button onClick={() => setIsEditingQuickPicks(false)}>Done</Button>
                    </div>
                </div>
            </Modal>

            {/* Share Modal */}
            <Modal isOpen={showShareModal} onClose={() => setShowShareModal(false)} title="Share Invoice">
                <div className={styles.shareModal}>
                    <div className={styles.shareField}>
                        <label className={styles.shareLabel}>
                            <Phone size={16} /> Customer Phone
                        </label>
                        <div className={styles.phoneInputWrapper}>
                            <span className={styles.phonePrefix}>+91</span>
                            <input
                                type="tel"
                                placeholder="9876543210"
                                value={customerPhone}
                                onChange={(e) => setCustomerPhone(e.target.value)}
                                className={styles.phoneInput}
                                maxLength={10}
                            />
                        </div>
                        <p className={styles.shareHint}>Leave empty to select contact in WhatsApp</p>
                    </div>

                    <div className={styles.shareField}>
                        <label className={styles.shareLabel}>
                            <FileText size={16} /> Invoice Format
                        </label>
                        <div className={styles.formatToggle}>
                            <button
                                className={clsx(styles.formatBtn, pdfFormat === "pos" && styles.active)}
                                onClick={() => setPdfFormat("pos")}
                            >
                                <span className={styles.formatIcon}>🧾</span>
                                <span>Receipt</span>
                                <span className={styles.formatDesc}>POS / Thermal</span>
                            </button>
                            <button
                                className={clsx(styles.formatBtn, pdfFormat === "a4" && styles.active)}
                                onClick={() => setPdfFormat("a4")}
                            >
                                <span className={styles.formatIcon}>📄</span>
                                <span>Invoice</span>
                                <span className={styles.formatDesc}>A4 Page</span>
                            </button>
                        </div>
                    </div>

                    <div className={styles.shareActions}>
                        <Button variant="secondary" className="flex-1" onClick={handleDownloadPDF}>
                            <Download size={18} /> Download PDF
                        </Button>
                        <Button className="flex-1 !bg-[#25D366] hover:!bg-[#128C7E]" onClick={handleSendWhatsApp}>
                            <Share2 size={18} /> Send via WhatsApp
                        </Button>
                    </div>
                </div>
            </Modal>

            {/* Hidden Print Section */}
            <div className="print-visible" style={{ display: 'none' }}>
                <div className="invoice-box">
                    <div className="invoice-header">
                        <div className="shop-details">
                            <h2>{shopName || "Store"}</h2>
                            <p>
                                {shopAddress || "Address"}<br />
                                Phone: {shopPhone || "N/A"}<br />
                                GSTIN: {shopGstin || "N/A"}
                            </p>
                        </div>
                        <div className="invoice-meta">
                            <p>
                                <strong>Invoice #:</strong> {Date.now().toString().slice(-6)}<br />
                                <strong>Date:</strong> {new Date().toLocaleDateString('en-GB')}<br />
                                <strong>Time:</strong> {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </p>
                        </div>
                    </div>

                    <table>
                        <thead>
                            <tr>
                                <th style={{ width: '40%' }}>Item</th>
                                <th className="text-center">Qty</th>
                                <th className="text-right">Price</th>
                                <th className="text-right">Total</th>
                            </tr>
                        </thead>
                        <tbody>
                            {cart.map(item => (
                                <tr key={item.id}>
                                    <td>{item.name}</td>
                                    <td className="text-center">{item.qty}</td>
                                    <td className="text-right">₹{item.price.toFixed(2)}</td>
                                    <td className="text-right">₹{(item.price * item.qty).toFixed(2)}</td>
                                </tr>
                            ))}
                            <tr style={{ height: '20px' }}><td colSpan={4} style={{ border: 'none' }}></td></tr>
                            <tr className="subtotal-row">
                                <td colSpan={2}></td>
                                <td className="text-right">Subtotal:</td>
                                <td className="text-right">₹{cartTotals.subtotal.toFixed(2)}</td>
                            </tr>
                            {cartTotals.totalDiscount > 0 && (
                                <tr className="subtotal-row">
                                    <td colSpan={2}></td>
                                    <td className="text-right">Discount:</td>
                                    <td className="text-right">-₹{cartTotals.totalDiscount.toFixed(2)}</td>
                                </tr>
                            )}
                            {cartTotals.totalGst > 0 && (
                                <tr className="subtotal-row">
                                    <td colSpan={2}></td>
                                    <td className="text-right">GST:</td>
                                    <td className="text-right">₹{cartTotals.totalGst.toFixed(2)}</td>
                                </tr>
                            )}
                            <tr className="total-row">
                                <td colSpan={2}></td>
                                <td className="text-right">Grand Total:</td>
                                <td className="text-right">₹{cartTotals.grandTotal.toFixed(2)}</td>
                            </tr>
                        </tbody>
                    </table>

                    <div style={{ marginTop: '30px', textAlign: 'center', fontSize: '14px', color: '#777' }}>
                        <p>Thank you for shopping with us!</p>
                    </div>
                </div>
            </div>
        </div>
    );
}
