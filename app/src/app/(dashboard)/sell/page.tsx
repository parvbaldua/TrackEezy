"use client";

import { useState } from "react";
import { Card, Input, Button } from "@/components/ui/Shared";
import { Search, ShoppingCart, Trash2, CheckCircle } from "lucide-react";
import styles from "./sell.module.css";

// Mock Data (Shared source practically)
const PRODUCTS = [
    { id: 1, name: "Premium Basmati Rice", price: 120 },
    { id: 2, name: "Tata Salt 1kg", price: 28 },
    { id: 3, name: "Maggi Noodles", price: 54 },
    { id: 4, name: "Fortune Oil 1L", price: 145 },
];

export default function SellPage() {
    const [cart, setCart] = useState<{ id: number, name: string, price: number, qty: number }[]>([]);
    const [searchTerm, setSearchTerm] = useState("");

    const addToCart = (product: typeof PRODUCTS[0]) => {
        setCart(prev => {
            const existing = prev.find(p => p.id === product.id);
            if (existing) {
                return prev.map(p => p.id === product.id ? { ...p, qty: p.qty + 1 } : p);
            }
            return [...prev, { ...product, qty: 1 }];
        });
        setSearchTerm(""); // Clear search after adding
    };

    const updateQty = (id: number, delta: number) => {
        setCart(prev => prev.map(p => {
            if (p.id === id) {
                const newQty = Math.max(1, p.qty + delta);
                return { ...p, qty: newQty };
            }
            return p;
        }));
    };

    const removeFromCart = (id: number) => {
        setCart(prev => prev.filter(p => p.id !== id));
    };

    const totalAmount = cart.reduce((sum, item) => sum + (item.price * item.qty), 0);

    // Filtered lookup for search suggestion
    const suggestions = searchTerm.length > 0 ? PRODUCTS.filter(p => p.name.toLowerCase().includes(searchTerm.toLowerCase())) : [];

    return (
        <div className={styles.container}>
            <div className={styles.header}>
                <h1 className={styles.title}>New Sale</h1>

                {/* Search / Scan */}
                <div className={styles.searchContainer}>
                    <Search className={styles.searchIcon} size={18} />
                    <Input
                        placeholder="Search product..."
                        className={styles.searchInput}
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        autoFocus
                    />
                    {/* Suggestions Dropdown */}
                    {suggestions.length > 0 && (
                        <div className={styles.suggestions}>
                            {suggestions.map(p => (
                                <div
                                    key={p.id}
                                    className={styles.suggestionItem}
                                    onClick={() => addToCart(p)}
                                >
                                    <span>{p.name}</span>
                                    <span className={styles.suggestionPrice}>₹{p.price}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Right Panel (Desktop) / Main Content (Mobile) */}
            <div className={styles.cartPanel}>
                <h3 className="hidden lg:block text-lg font-bold mb-4">Current Bill</h3>

                {/* Cart Items */}
                <div className={styles.cartList}>
                    {cart.length === 0 ? (
                        <div className={styles.emptyState}>
                            <ShoppingCart size={48} className="mb-2" />
                            <p>Cart is empty</p>
                        </div>
                    ) : (
                        cart.map(item => (
                            <Card key={item.id} className={styles.cartItem}>
                                <div className={styles.cartItemInfo}>
                                    <p className={styles.itemName}>{item.name}</p>
                                    <p className={styles.itemPrice}>₹{item.price} x {item.qty}</p>
                                </div>
                                <div className={styles.cartControls}>
                                    <button onClick={() => updateQty(item.id, -1)} className={styles.qtyBtn}>-</button>
                                    <span className={styles.qtyValue}>{item.qty}</span>
                                    <button onClick={() => updateQty(item.id, 1)} className={styles.qtyBtn}>+</button>
                                </div>
                                <p className={styles.itemTotal}>₹{item.price * item.qty}</p>
                                <button onClick={() => removeFromCart(item.id)} className={styles.deleteBtn}>
                                    <Trash2 size={16} />
                                </button>
                            </Card>
                        ))
                    )}
                </div>

                {/* Total & Checkout */}
                <div className={styles.footer}>
                    <div className={styles.totalRow}>
                        <span className={styles.totalLabel}>Total Amount</span>
                        <span className={styles.totalValue}>₹{totalAmount}</span>
                    </div>
                    <Button className={styles.checkoutBtn} disabled={cart.length === 0}>
                        Generate Bill <CheckCircle size={20} className="ml-2" />
                    </Button>
                </div>
            </div>
        </div>
    );
}
