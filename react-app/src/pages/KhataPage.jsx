import React, { useState, useEffect } from "react";
import { Card, Button, Input } from "../components/ui/Shared";
import { Modal } from "../components/ui/Modal";
import {
    Users, Plus, Search, Phone, IndianRupee, ArrowUpRight, ArrowDownLeft,
    Wallet, RefreshCw, MessageCircle, ChevronRight, AlertCircle
} from "lucide-react";
import styles from "./KhataPage.module.css";
import clsx from "clsx";
import { useApp } from "../context/AppContext";
import { useAuth } from "../context/AuthProvider";
import { GoogleSheetsService } from "../services/sheets";

export default function KhataPage() {
    const { sheetUrl, getSheetId } = useApp();
    const { accessToken } = useAuth();

    const [customers, setCustomers] = useState([]);
    const [loading, setLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState("");
    const [activeTab, setActiveTab] = useState("all"); // all, owing, clear

    // Modal States
    const [isAddCustomerOpen, setIsAddCustomerOpen] = useState(false);
    const [isTransactionOpen, setIsTransactionOpen] = useState(false);
    const [selectedCustomer, setSelectedCustomer] = useState(null);
    const [customerLedger, setCustomerLedger] = useState([]);
    const [isLedgerOpen, setIsLedgerOpen] = useState(false);

    // Form States
    const [newCustomer, setNewCustomer] = useState({ name: "", phone: "", notes: "" });
    const [transaction, setTransaction] = useState({ type: "CREDIT", amount: "", description: "" });
    const [saving, setSaving] = useState(false);

    // Fetch customers on mount
    useEffect(() => {
        if (sheetUrl && accessToken) {
            fetchCustomers();
        }
    }, [sheetUrl, accessToken]);

    const fetchCustomers = async () => {
        if (!sheetUrl || !accessToken) return;
        setLoading(true);
        try {
            const spreadsheetId = getSheetId(sheetUrl);
            const data = await GoogleSheetsService.getCustomers(accessToken, spreadsheetId);
            setCustomers(data);
        } catch (error) {
            console.error("Error fetching customers:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleAddCustomer = async () => {
        if (!newCustomer.name) return;
        setSaving(true);
        try {
            const spreadsheetId = getSheetId(sheetUrl);
            await GoogleSheetsService.addCustomer(accessToken, spreadsheetId, newCustomer);
            setNewCustomer({ name: "", phone: "", notes: "" });
            setIsAddCustomerOpen(false);
            fetchCustomers();
        } catch (error) {
            alert("Error adding customer: " + error.message);
        } finally {
            setSaving(false);
        }
    };

    const handleAddTransaction = async () => {
        if (!transaction.amount || !selectedCustomer) return;
        setSaving(true);
        try {
            const spreadsheetId = getSheetId(sheetUrl);
            await GoogleSheetsService.addLedgerEntry(accessToken, spreadsheetId, {
                customerName: selectedCustomer.name,
                type: transaction.type,
                amount: parseFloat(transaction.amount),
                description: transaction.description,
                date: new Date().toISOString().split('T')[0]
            });
            setTransaction({ type: "CREDIT", amount: "", description: "" });
            setIsTransactionOpen(false);
            setSelectedCustomer(null);
            fetchCustomers();
        } catch (error) {
            alert("Error adding transaction: " + error.message);
        } finally {
            setSaving(false);
        }
    };

    const viewCustomerLedger = async (customer) => {
        setSelectedCustomer(customer);
        setLoading(true);
        try {
            const spreadsheetId = getSheetId(sheetUrl);
            const ledger = await GoogleSheetsService.getCustomerLedger(accessToken, spreadsheetId, customer.name);
            setCustomerLedger(ledger.reverse()); // Most recent first
            setIsLedgerOpen(true);
        } catch (error) {
            console.error("Error fetching ledger:", error);
        } finally {
            setLoading(false);
        }
    };

    const openTransactionModal = (customer, type) => {
        setSelectedCustomer(customer);
        setTransaction({ type, amount: "", description: "" });
        setIsTransactionOpen(true);
    };

    // WhatsApp reminder
    const sendWhatsAppReminder = (customer) => {
        const message = encodeURIComponent(
            `नमस्ते ${customer.name} जी,\n\nआपका बकाया ₹${customer.balance} है।\nकृपया जल्द भुगतान करें।\n\nधन्यवाद!`
        );
        window.open(`https://wa.me/91${customer.phone}?text=${message}`, '_blank');
    };

    // Filter customers
    const filtered = customers.filter(c => {
        const matchesSearch = c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            c.phone.includes(searchTerm);

        if (!matchesSearch) return false;

        if (activeTab === 'all') return true;
        if (activeTab === 'owing') return c.balance > 0;
        if (activeTab === 'clear') return c.balance === 0;

        return true;
    });

    // Stats
    const totalOwed = customers.reduce((sum, c) => sum + (c.balance > 0 ? c.balance : 0), 0);
    const customersOwing = customers.filter(c => c.balance > 0).length;

    return (
        <div className={styles.container}>
            <div className={styles.header}>
                <div>
                    <h1 className={styles.title}>Khata / Udhar</h1>
                    <p className={styles.subtitle}>Manage credit sales and payments</p>
                </div>
                <div className={styles.headerActions}>
                    <Button variant="secondary" onClick={fetchCustomers} disabled={loading}>
                        <RefreshCw size={20} className={loading ? "animate-spin" : ""} />
                    </Button>
                    <Button onClick={() => setIsAddCustomerOpen(true)}>
                        <Plus size={20} /> Add Customer
                    </Button>
                </div>
            </div>

            {/* Stats Cards */}
            <div className={styles.statsGrid}>
                <Card className={styles.statCard}>
                    <div className={styles.statIcon} style={{ background: 'rgba(239, 68, 68, 0.15)' }}>
                        <IndianRupee size={24} className="text-red-400" />
                    </div>
                    <div>
                        <p className={styles.statLabel}>Total Receivable</p>
                        <p className={styles.statValue}>₹{totalOwed.toLocaleString()}</p>
                    </div>
                </Card>
                <Card className={styles.statCard}>
                    <div className={styles.statIcon} style={{ background: 'rgba(251, 191, 36, 0.15)' }}>
                        <Users size={24} className="text-yellow-400" />
                    </div>
                    <div>
                        <p className={styles.statLabel}>Customers Owing</p>
                        <p className={styles.statValue}>{customersOwing}</p>
                    </div>
                </Card>
            </div>

            {/* Filter Tabs */}
            <div className="flex gap-2 overflow-x-auto pb-2 mb-4 no-scrollbar">
                {[
                    { id: 'all', label: 'All Customers' },
                    { id: 'owing', label: '⚠️ Pending Dues' },
                    { id: 'clear', label: '✅ Clear' }
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

            {/* Search */}
            <div className={styles.searchWrapper}>
                <Search className={styles.searchIcon} size={18} />
                <Input
                    placeholder="Search customer..."
                    className={styles.searchInput}
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
            </div>

            {/* Customer List */}
            <div className={styles.list}>
                {filtered.length === 0 ? (
                    <div className="text-center py-12 text-white/40">
                        <Users size={48} className="mx-auto mb-4 opacity-30" />
                        <p>No customers found</p>
                        <Button onClick={() => setIsAddCustomerOpen(true)} className="mt-4">
                            <Plus size={18} /> Add First Customer
                        </Button>
                    </div>
                ) : (
                    filtered.map(customer => (
                        <Card key={customer.id} className={styles.customerCard}>
                            <div className={styles.customerInfo} onClick={() => viewCustomerLedger(customer)}>
                                <div className={styles.avatar}>
                                    {customer.name.charAt(0).toUpperCase()}
                                </div>
                                <div>
                                    <h3 className={styles.customerName}>{customer.name}</h3>
                                    {customer.phone && (
                                        <p className={styles.customerPhone}>
                                            <Phone size={12} /> {customer.phone}
                                        </p>
                                    )}
                                </div>
                            </div>

                            <div className={styles.customerMeta}>
                                <div className={clsx(
                                    styles.balance,
                                    customer.balance > 0 ? styles.balanceOwing : styles.balanceClear
                                )}>
                                    {customer.balance > 0 ? (
                                        <>₹{customer.balance.toLocaleString()}</>
                                    ) : (
                                        <span className="text-green-400">Clear</span>
                                    )}
                                </div>

                                <div className={styles.actions}>
                                    <button
                                        className={styles.actionBtn}
                                        onClick={() => openTransactionModal(customer, 'CREDIT')}
                                        title="Add Credit (Udhar)"
                                    >
                                        <ArrowUpRight size={16} className="text-red-400" />
                                    </button>
                                    <button
                                        className={styles.actionBtn}
                                        onClick={() => openTransactionModal(customer, 'PAYMENT')}
                                        title="Record Payment"
                                    >
                                        <ArrowDownLeft size={16} className="text-green-400" />
                                    </button>
                                    {customer.phone && customer.balance > 0 && (
                                        <button
                                            className={styles.actionBtn}
                                            onClick={() => sendWhatsAppReminder(customer)}
                                            title="Send WhatsApp Reminder"
                                        >
                                            <MessageCircle size={16} className="text-green-500" />
                                        </button>
                                    )}
                                    <button
                                        className={styles.actionBtn}
                                        onClick={() => viewCustomerLedger(customer)}
                                        title="View Ledger"
                                    >
                                        <ChevronRight size={16} />
                                    </button>
                                </div>
                            </div>
                        </Card>
                    ))
                )}
            </div>

            {/* Add Customer Modal */}
            <Modal isOpen={isAddCustomerOpen} onClose={() => setIsAddCustomerOpen(false)} title="Add Customer">
                <div className="space-y-4">
                    <div>
                        <label className={styles.modalLabel}>Customer Name *</label>
                        <Input
                            placeholder="e.g. राजेश शर्मा"
                            value={newCustomer.name}
                            onChange={(e) => setNewCustomer({ ...newCustomer, name: e.target.value })}
                        />
                    </div>
                    <div>
                        <label className={styles.modalLabel}>Phone Number (Optional)</label>
                        <Input
                            placeholder="e.g. 9876543210"
                            type="tel"
                            value={newCustomer.phone}
                            onChange={(e) => setNewCustomer({ ...newCustomer, phone: e.target.value })}
                        />
                    </div>
                    <div>
                        <label className={styles.modalLabel}>Notes (Optional)</label>
                        <Input
                            placeholder="e.g. Regular customer, Village address..."
                            value={newCustomer.notes}
                            onChange={(e) => setNewCustomer({ ...newCustomer, notes: e.target.value })}
                        />
                    </div>
                    <Button
                        onClick={handleAddCustomer}
                        disabled={!newCustomer.name || saving}
                        className="w-full h-12 bg-green-600 hover:bg-green-700"
                    >
                        {saving ? "Saving..." : "Add Customer"}
                    </Button>
                </div>
            </Modal>

            {/* Add Transaction Modal */}
            <Modal
                isOpen={isTransactionOpen}
                onClose={() => setIsTransactionOpen(false)}
                title={transaction.type === 'CREDIT' ? 'Add Credit (उधार)' : 'Record Payment (वसूली)'}
            >
                <div className="space-y-4">
                    {selectedCustomer && (
                        <div className="p-3 bg-white/5 rounded-lg border border-white/10 mb-4">
                            <p className="text-sm text-white/60">Customer</p>
                            <p className="font-semibold">{selectedCustomer.name}</p>
                            <p className="text-sm mt-1">
                                Current Balance: <span className={selectedCustomer.balance > 0 ? "text-red-400" : "text-green-400"}>
                                    ₹{selectedCustomer.balance}
                                </span>
                            </p>
                        </div>
                    )}

                    <div className="flex gap-2">
                        <button
                            className={clsx(
                                "flex-1 py-3 rounded-lg font-medium transition-colors",
                                transaction.type === 'CREDIT'
                                    ? "bg-red-500/20 text-red-400 border border-red-500/30"
                                    : "bg-white/5 text-white/60"
                            )}
                            onClick={() => setTransaction({ ...transaction, type: 'CREDIT' })}
                        >
                            <ArrowUpRight size={18} className="inline mr-1" />
                            उधार (Credit)
                        </button>
                        <button
                            className={clsx(
                                "flex-1 py-3 rounded-lg font-medium transition-colors",
                                transaction.type === 'PAYMENT'
                                    ? "bg-green-500/20 text-green-400 border border-green-500/30"
                                    : "bg-white/5 text-white/60"
                            )}
                            onClick={() => setTransaction({ ...transaction, type: 'PAYMENT' })}
                        >
                            <ArrowDownLeft size={18} className="inline mr-1" />
                            वसूली (Payment)
                        </button>
                    </div>

                    <div>
                        <label className={styles.modalLabel}>Amount (₹) *</label>
                        <Input
                            placeholder="0.00"
                            type="number"
                            value={transaction.amount}
                            onChange={(e) => setTransaction({ ...transaction, amount: e.target.value })}
                            className="text-2xl font-bold h-14"
                        />
                    </div>
                    <div>
                        <label className={styles.modalLabel}>Description (Optional)</label>
                        <Input
                            placeholder="e.g. 5kg Rice, Monthly bill..."
                            value={transaction.description}
                            onChange={(e) => setTransaction({ ...transaction, description: e.target.value })}
                        />
                    </div>
                    <Button
                        onClick={handleAddTransaction}
                        disabled={!transaction.amount || saving}
                        className={clsx(
                            "w-full h-12",
                            transaction.type === 'CREDIT'
                                ? "bg-red-600 hover:bg-red-700"
                                : "bg-green-600 hover:bg-green-700"
                        )}
                    >
                        {saving ? "Saving..." : (transaction.type === 'CREDIT' ? "Add Credit" : "Record Payment")}
                    </Button>
                </div>
            </Modal>

            {/* Customer Ledger Modal */}
            <Modal
                isOpen={isLedgerOpen}
                onClose={() => setIsLedgerOpen(false)}
                title={selectedCustomer ? `${selectedCustomer.name} - Ledger` : 'Ledger'}
            >
                <div className="space-y-3 max-h-[60vh] overflow-y-auto">
                    {selectedCustomer && (
                        <div className="p-4 bg-gradient-to-r from-blue-500/10 to-purple-500/10 rounded-xl border border-white/10 mb-4">
                            <p className="text-2xl font-bold">
                                Balance: <span className={selectedCustomer.balance > 0 ? "text-red-400" : "text-green-400"}>
                                    ₹{selectedCustomer.balance.toLocaleString()}
                                </span>
                            </p>
                        </div>
                    )}

                    {customerLedger.length === 0 ? (
                        <div className="text-center py-8 text-white/40">
                            <Wallet size={40} className="mx-auto mb-3 opacity-30" />
                            <p>No transactions yet</p>
                        </div>
                    ) : (
                        customerLedger.map(entry => (
                            <div
                                key={entry.id}
                                className={clsx(
                                    "p-3 rounded-lg border",
                                    entry.type === 'CREDIT'
                                        ? "bg-red-500/5 border-red-500/20"
                                        : "bg-green-500/5 border-green-500/20"
                                )}
                            >
                                <div className="flex justify-between items-start">
                                    <div>
                                        <p className="text-xs text-white/40">{entry.date}</p>
                                        <p className="font-medium mt-0.5">
                                            {entry.type === 'CREDIT' ? 'उधार (Credit)' : 'वसूली (Payment)'}
                                        </p>
                                        {entry.description && (
                                            <p className="text-sm text-white/60 mt-1">{entry.description}</p>
                                        )}
                                    </div>
                                    <div className={clsx(
                                        "text-lg font-bold",
                                        entry.type === 'CREDIT' ? "text-red-400" : "text-green-400"
                                    )}>
                                        {entry.type === 'CREDIT' ? '+' : '-'}₹{entry.amount}
                                    </div>
                                </div>
                            </div>
                        ))
                    )}

                    <div className="flex gap-2 mt-4 pt-4 border-t border-white/10">
                        <Button
                            onClick={() => { setIsLedgerOpen(false); openTransactionModal(selectedCustomer, 'CREDIT'); }}
                            className="flex-1 bg-red-600 hover:bg-red-700"
                        >
                            <ArrowUpRight size={18} /> Add Credit
                        </Button>
                        <Button
                            onClick={() => { setIsLedgerOpen(false); openTransactionModal(selectedCustomer, 'PAYMENT'); }}
                            className="flex-1 bg-green-600 hover:bg-green-700"
                        >
                            <ArrowDownLeft size={18} /> Record Payment
                        </Button>
                    </div>
                </div>
            </Modal>
        </div>
    );
}
