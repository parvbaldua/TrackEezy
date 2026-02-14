import { useState, useMemo, useEffect } from "react";
import { useApp } from "../context/AppContext";
import { useOffline } from "../context/OfflineContext";
import styles from "./BillingPage.module.css";
import { Input, Button } from "../components/ui/Shared";
import { Search, ShoppingCart, Plus, Minus, Trash2, Printer, Share2, ChevronUp, ChevronDown, Mic, MicOff } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import clsx from "clsx";
import { useAuth } from "../context/AuthProvider";
import { GoogleSheetsService } from "../services/sheets";
import { useTranslation } from "../context/LanguageContext";
import { generateInvoicePDF, downloadPDF } from "../lib/pdfGenerator";

export default function BillingPage() {
    const { inventory, shopName, shopAddress, shopPhone, shopGstin, sheetUrl, fetchInventory, getSheetId } = useApp();
    const { accessToken } = useAuth();
    const { isOnline, queueOperation } = useOffline();
    const t = useTranslation();

    const [searchTerm, setSearchTerm] = useState("");

    const [cart, setCart] = useState([]);
    const [isMobileCartOpen, setIsMobileCartOpen] = useState(false);
    const [isListening, setIsListening] = useState(false);

    // UPI ID for payment QR (stored in localStorage)
    const [upiId, setUpiId] = useState(localStorage.getItem('akb_upi_id') || '');

    // Voice Search using Web Speech API (Zero Cost)
    const startVoiceSearch = () => {
        if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
            alert('Voice search is not supported in your browser. Try Chrome or Edge.');
            return;
        }

        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        const recognition = new SpeechRecognition();

        recognition.lang = 'hi-IN'; // Hindi support for Bharat
        recognition.interimResults = false;
        recognition.maxAlternatives = 1;

        recognition.onstart = () => {
            setIsListening(true);
        };

        recognition.onresult = (event) => {
            const transcript = event.results[0][0].transcript;
            setSearchTerm(transcript);
            setIsListening(false);
        };

        recognition.onerror = (event) => {
            console.error('Voice recognition error:', event.error);
            setIsListening(false);
            if (event.error === 'not-allowed') {
                alert('Microphone access denied. Please allow microphone permissions.');
            }
        };

        recognition.onend = () => {
            setIsListening(false);
        };

        recognition.start();
    };

    // Generate UPI Payment Link
    const generateUPILink = (amount) => {
        if (!upiId) return null;
        const encodedName = encodeURIComponent(shopName || 'Store');
        return `upi://pay?pa=${upiId}&pn=${encodedName}&am=${amount.toFixed(2)}&cu=INR`;
    };

    // Persistence: Load Cart
    useEffect(() => {
        const saved = localStorage.getItem("cart_data");
        if (saved) {
            try {
                setCart(JSON.parse(saved));
            } catch (e) {
                console.error("Failed to parse cart", e);
            }
        }
    }, []);

    // Persistence: Save Cart
    useEffect(() => {
        localStorage.setItem("cart_data", JSON.stringify(cart));
    }, [cart]);

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
    const addToCart = (product) => {
        setCart(prev => {
            const existing = prev.find(item => item.id === product.id);
            const factor = product.conversionFactor || 1;
            const baseStock = product.qty; // Inventory stores Base Qty

            if (existing) {
                // Check if adding 1 more Display Unit exceeds Base Stock
                // (Existing Display Qty + 1) * Factor <= Base Stock
                if ((existing.qty + 1) * factor > baseStock) {
                    alert(`Not enough stock! Available: ${parseFloat((baseStock / factor).toFixed(2))} ${product.displayUnit}`);
                    return prev;
                }
                return prev.map(item =>
                    item.id === product.id ? { ...item, qty: item.qty + 1 } : item
                );
            }

            // Check initial add
            if (1 * factor > baseStock) {
                alert(`Not enough stock! Available: ${parseFloat((baseStock / factor).toFixed(2))} ${product.displayUnit}`);
                return prev;
            }

            return [...prev, {
                id: product.id,
                name: product.name,
                price: typeof product.price === 'string' ? parseFloat(product.price) : product.price,
                qty: 1, // Display Unit Qty
                maxQty: typeof product.qty === 'string' ? parseInt(product.qty) : product.qty,
                displayUnit: product.displayUnit || 'piece',
                baseUnit: product.baseUnit || 'piece',
                conversionFactor: factor
            }];
        });
    };

    const updateQty = (id, delta) => {
        setCart(prev => prev.map(item => {
            if (item.id === id) {
                const newQty = item.qty + delta;
                if (newQty < 1) return item; // Don't remove via minus, let trash do it

                // Limit Check
                // New Display Qty * Factor <= Base Stock
                if (newQty * item.conversionFactor > item.maxQty) {
                    alert(`Max stock reached!`);
                    return item;
                }
                return { ...item, qty: newQty };
            }
            return item;
        }));
    };

    // Set Cart Quantity Directly (for input field)
    const setCartQty = (id, newQty) => {
        const qty = parseInt(newQty) || 1;
        if (qty < 1) return;
        setCart(prev => prev.map(item => {
            if (item.id === id) {
                if (qty * item.conversionFactor > item.maxQty) {
                    alert(`Max stock reached!`);
                    return item;
                }
                return { ...item, qty };
            }
            return item;
        }));
    };

    const removeFromCart = (id) => {
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


    // Actions - Use PDF on mobile since window.print() doesn't work in TWA/WebView
    const handlePrint = () => {
        const isMobile = /Android|iPhone|iPad/i.test(navigator.userAgent);
        if (isMobile) {
            const invoiceId = Date.now().toString().slice(-6);
            const doc = generateInvoicePDF({
                format: "pos",
                shop: { name: shopName, address: shopAddress, phone: shopPhone, gstin: shopGstin },
                cart: cart.map(item => ({ ...item, discountPercent: 0, gstEnabled: false, gstPercent: 0 })),
                totals: { subtotal: totalAmount, totalDiscount: 0, afterDiscount: totalAmount, totalGst: gstAmount, grandTotal: netAmount },
                invoiceId: invoiceId
            });
            downloadPDF(doc, `invoice_${invoiceId}.pdf`);
        } else {
            window.print();
        }
    };

    const handleWhatsApp = () => {
        // Construct a clean, aligned text bill
        let message = `*🧾 INVOICE - ${shopName || 'Store'}*\n`;
        message += `Date: ${new Date().toLocaleDateString('en-GB')}\n`;
        message += `------------------------------\n`;

        cart.forEach(item => {
            // Simple alignment logic
            const lineTotal = (item.price * item.qty).toFixed(2);
            message += `${item.name} (${item.qty} ${item.displayUnit}) - ₹${lineTotal}\n`;
        });

        message += `------------------------------\n`;
        message += `*${t('billing.subtotal')}:* ₹${totalAmount.toFixed(2)}\n`;
        message += `*${t('billing.gst')} (18%):* ₹${gstAmount.toFixed(2)}\n`;
        message += `*${t('billing.total')}:* ₹${netAmount.toFixed(2)}\n`;
        message += `------------------------------\n`;
        message += `Thank you for shopping!`;

        // Direct Redirect to WhatsApp
        const url = `https://wa.me/?text=${encodeURIComponent(message)}`;
        window.open(url, '_blank');
    };

    const handleShareImage = async () => {
        try {
            const invoiceElement = document.querySelector('.invoice-box');
            if (!invoiceElement) return;

            // ... (Image Capture Logic) ...
            const clone = invoiceElement.cloneNode(true);
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
        if (!confirm(t('common.confirm') + "? This will deduct stock from the Google Sheet.")) return;

        try {
            if (!sheetUrl) {
                alert(t('home.sheetNotConnected') + "! Please configure it in Profile.");
                return;
            }

            if (!accessToken) {
                alert("Sale Simulated! (Demo Mode active - Login to sync with Sheets)");
                setCart([]);
                localStorage.removeItem("cart_data");
                return;
            }

            const soldItems = cart.map(item => ({ name: item.name, qty: item.qty }));

            // Offline Handling
            if (!isOnline) {
                // Queue Deduct Stock
                await queueOperation({
                    type: 'DEDUCT_STOCK',
                    data: soldItems
                });

                // Queue Record Sale
                await queueOperation({
                    type: 'RECORD_SALE',
                    data: {
                        date: new Date().toISOString(),
                        amount: netAmount,
                        itemsCount: totalItems,
                        invoiceId: Date.now().toString(),
                        items: soldItems
                    }
                });

                alert("You are Offline. Sale Saved! Will sync when online.");
                setCart([]);
                localStorage.removeItem("cart_data");
                return;
            }

            // Use Client Side Service
            const spreadsheetId = getSheetId(sheetUrl);
            const result = await GoogleSheetsService.deductStock(accessToken, spreadsheetId, soldItems);

            if (result.success) {
                // Record Sale History (Async, don't block success alert)
                GoogleSheetsService.recordSale(accessToken, spreadsheetId, {
                    date: new Date().toISOString(),
                    amount: netAmount,
                    itemsCount: totalItems,
                    invoiceId: Date.now().toString(),
                    items: soldItems
                });

                alert(t('common.success') + "!");
                setCart([]); // Clear cart
                localStorage.removeItem("cart_data");

                // Refresh Inventory after a slight delay to allow Sheet calculation update
                setTimeout(() => {
                    fetchInventory();
                }, 1000);

            } else {
                alert("Failed to update stock.");
            }

        } catch (error) {
            console.error("Sale Error", error);
            alert("Error processing sale: " + error.message);
        }
    };

    return (
        <div className={styles.container}>
            <div className={styles.header}>
                <div className="flex flex-col">
                    <h1 className={styles.title}>{t('billing.title')}</h1>
                </div>
            </div>

            <div className={styles.contentWrapper}>
                {/* Left: Product Selection */}
                <div className={styles.productSection}>
                    <div className={styles.searchRow}>
                        <div className={styles.searchWrapper}>
                            <Search className={styles.searchIcon} size={18} />
                            <Input
                                placeholder={t('billing.searchProducts')}
                                className={styles.searchInput}
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            // Auto-select first suggestion on Enter could be added here
                            />

                            {/* Voice Search Button */}
                            <button
                                onClick={startVoiceSearch}
                                className={`absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-full transition-all ${isListening ? 'bg-red-500 text-white animate-pulse' : 'bg-white/10 text-white/50 hover:bg-white/20 hover:text-white'}`}
                                title={t('billing.voiceSearch')}
                            >
                                {isListening ? <MicOff size={16} /> : <Mic size={16} />}
                            </button>

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
                                                    <p className="text-[10px] text-white/40">
                                                        Stock: {parseFloat((product.qty / (product.conversionFactor || 1)).toFixed(2))} {product.displayUnit}
                                                    </p>
                                                </div>
                                            </div>
                                        ))
                                    ) : (
                                        <div className="p-3 text-sm text-white/50 text-center">{t('inventory.noProducts')}</div>
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
                                            {t('common.add')} ( {cart.find(c => c.id === product.id)?.qty} {product.displayUnit})
                                        </span>
                                    ) : (
                                        <span className={styles.productStock}>
                                            {t('inventory.inStock')}: {parseFloat((product.qty / (product.conversionFactor || 1)).toFixed(2))} {product.displayUnit}
                                        </span>
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
                                <span className="text-xs font-medium text-white/80">{totalItems} {t('billing.items')}</span>
                                <span className="font-bold text-base">₹{totalAmount.toFixed(0)}</span>
                            </div>
                            <div className="flex items-center gap-2 font-semibold text-sm bg-black/20 px-3 py-1.5 rounded-full">
                                {t('billing.viewBill')} <ChevronUp size={16} />
                            </div>
                        </div>
                    )}
                </div>

                <div className={clsx(styles.cartSection, isMobileCartOpen && styles.open)}>
                    <div className={styles.cartHeader}>
                        <div className={styles.cartHeaderContent}>
                            <ShoppingCart size={20} className="text-primary" />
                            <span className={styles.cartTitle}>{t('billing.currentBill')}</span>
                            <span className="text-xs bg-white/10 px-2 py-0.5 rounded-full text-white/70">{totalItems} {t('billing.items')}</span>
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
                                <p>{t('billing.emptyCart')}</p>
                            </div>
                        ) : (
                            cart.map(item => (
                                <div key={item.id} className={styles.cartItem}>
                                    <div className={styles.cartItemInfo}>
                                        <p className={styles.cartItemName}>{item.name} ({item.qty} {item.displayUnit})</p>
                                        <p className={styles.cartItemPrice}>₹{item.price} x {item.qty} = <span className="text-white">₹{item.price * item.qty}</span></p>
                                    </div>
                                    <div className={styles.cartControls}>
                                        <button className={styles.qtyBtn} onClick={() => updateQty(item.id, -1)}><Minus size={14} /></button>
                                        <input
                                            type="number"
                                            min="1"
                                            value={item.qty}
                                            onChange={(e) => setCartQty(item.id, e.target.value)}
                                            className="w-12 h-7 text-center bg-white/10 border border-white/10 rounded text-white text-sm"
                                        />
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
                            <span>{t('billing.subtotal')}</span>
                            <span>₹{totalAmount.toFixed(2)}</span>
                        </div>
                        <div className={styles.summaryRow}>
                            <span>{t('billing.tax')} (18%)</span>
                            <span>₹{gstAmount.toFixed(2)}</span>
                        </div>
                        <div className={styles.totalRow}>
                            <span>{t('billing.total')}</span>
                            <span>₹{netAmount.toFixed(2)}</span>
                        </div>

                        {/* UPI Payment QR Code */}
                        {upiId && cart.length > 0 && (
                            <div className="mt-3 p-3 bg-white rounded-lg text-center">
                                <QRCodeSVG
                                    value={generateUPILink(netAmount)}
                                    size={100}
                                    className="mx-auto"
                                />
                                <p className="text-xs text-gray-600 mt-2">{t('billing.scanQR')} ₹{netAmount.toFixed(0)}</p>
                            </div>
                        )}

                        {!upiId && (
                            <p className="text-xs text-white/40 text-center mt-2">
                                {t('billing.addUPI')}
                            </p>
                        )}

                        <div className={styles.actionButtons}>
                            <Button variant="secondary" className="w-full" disabled={cart.length === 0} onClick={handlePrint}>
                                <Printer size={18} /> {t('billing.print')}
                            </Button>
                            <Button className="w-full !bg-[#25D366] hover:!bg-[#128C7E]" disabled={cart.length === 0} onClick={handleWhatsApp}>
                                <Share2 size={18} /> {t('billing.whatsapp')}
                            </Button>
                            <Button className="w-full !bg-blue-600 hover:!bg-blue-700 col-span-2" disabled={cart.length === 0} onClick={processSale}>
                                {t('billing.completeSale')}
                            </Button>
                        </div>
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
                                {t('profile.phone')}: {shopPhone || "+91 98765 43210"}<br />
                                {t('profile.gstin')}: {shopGstin || "Not Available"}
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
                                <th className="text-center">{t('inventory.quantity')}</th>
                                <th className="text-right">{t('inventory.price')} (₹)</th>
                                <th className="text-right">{t('billing.total')} (₹)</th>
                            </tr>
                        </thead>
                        <tbody>
                            {cart.map(item => (
                                <tr key={item.id}>
                                    <td>{item.name}</td>
                                    <td className="text-center">{item.qty} {item.displayUnit}</td>
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
                                <td className="text-right">{t('billing.subtotal')}:</td>
                                <td className="text-right">{totalAmount.toFixed(2)}</td>
                            </tr>
                            <tr className="subtotal-row">
                                <td colSpan={2}></td>
                                <td className="text-right">{t('billing.tax')} (18% GST):</td>
                                <td className="text-right">{gstAmount.toFixed(2)}</td>
                            </tr>
                            <tr className="total-row">
                                <td colSpan={2}></td>
                                <td className="text-right">{t('billing.total')}:</td>
                                <td className="text-right">₹{netAmount.toFixed(2)}</td>
                            </tr>
                        </tbody>
                    </table>

                    {/* Digital Bill QR Code - Moved to Bottom */}
                    <div style={{ marginTop: '20px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                        <QRCodeSVG
                            value={typeof window !== 'undefined' ? `${window.location.origin}/invoice?data=${btoa(JSON.stringify({
                                s: shopName,
                                a: shopAddress,
                                p: shopPhone,
                                g: shopGstin,
                                d: new Date().toISOString(),
                                t: netAmount,
                                i: cart.map(c => ({ n: c.name, q: c.qty, u: c.displayUnit, p: c.price }))
                            }))}` : ""}
                            size={100}
                        />
                        <p style={{ fontSize: '10px', marginTop: '5px' }}>Scan for Digital Bill</p>
                    </div>

                    <div style={{ marginTop: '30px', textAlign: 'center', fontSize: '14px', color: '#777' }}>
                        <p>Thank you for shopping with us!</p>
                        <p>Terms & Conditions apply. Goods once sold will not be taken back.</p>
                    </div>
                </div>
            </div>
        </div>
    );
}
