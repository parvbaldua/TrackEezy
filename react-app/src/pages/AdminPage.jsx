import React, { useState, useEffect } from "react";
import { Card, Button, Input } from "../components/ui/Shared";
import {
    Shield, Users, Settings, Database, Plus, Trash2,
    Save, RefreshCw, UserPlus, ChevronRight, CheckCircle,
    XCircle, Phone, Mail, Share2, Copy, Link, X
} from "lucide-react";
import styles from "./AdminPage.module.css";
import { useAuth } from "../context/AuthProvider";
import { useApp } from "../context/AppContext";
import { GoogleSheetsService } from "../services/sheets";
import { useNavigate } from "react-router-dom";

export default function AdminPage() {
    const navigate = useNavigate();
    const { user, accessToken, isAdmin } = useAuth();
    const { sheetUrl, getSheetId, shopName } = useApp();

    const [loading, setLoading] = useState(false);
    const [authorizedUsers, setAuthorizedUsers] = useState([]);
    const [userLogins, setUserLogins] = useState([]); // Login history
    const [newUser, setNewUser] = useState({ name: '', phone: '', email: '', role: 'staff' });
    const [showAddForm, setShowAddForm] = useState(false);
    const [activeTab, setActiveTab] = useState('authorized'); // 'authorized' or 'logins'
    const [showInviteModal, setShowInviteModal] = useState(false);
    const [linkCopied, setLinkCopied] = useState(false);

    // Redirect non-admin users
    useEffect(() => {
        if (!isAdmin && user) {
            navigate('/home');
        }
    }, [isAdmin, user, navigate]);

    // Fetch authorized users and login history on mount
    useEffect(() => {
        if (accessToken && sheetUrl && isAdmin) {
            fetchAuthorizedUsers();
            fetchUserLogins();
        }
    }, [accessToken, sheetUrl, isAdmin]);

    const fetchAuthorizedUsers = async () => {
        if (!accessToken || !sheetUrl) return;
        setLoading(true);
        try {
            const spreadsheetId = getSheetId(sheetUrl);
            const users = await GoogleSheetsService.getAuthorizedUsers(accessToken, spreadsheetId);
            setAuthorizedUsers(users || []);
        } catch (err) {
            console.error("Error fetching users:", err);
        }
        setLoading(false);
    };

    const fetchUserLogins = async () => {
        if (!accessToken || !sheetUrl) return;
        try {
            const spreadsheetId = getSheetId(sheetUrl);
            const logins = await GoogleSheetsService.getUserLogins(accessToken, spreadsheetId);
            setUserLogins(logins || []);
        } catch (err) {
            console.error("Error fetching login history:", err);
        }
    };

    const handleAddUser = async () => {
        if (!newUser.name || (!newUser.phone && !newUser.email)) {
            alert("Please provide name and either phone or email");
            return;
        }

        setLoading(true);
        try {
            const spreadsheetId = getSheetId(sheetUrl);
            await GoogleSheetsService.addAuthorizedUser(accessToken, spreadsheetId, {
                name: newUser.name,
                phone: newUser.phone,
                email: newUser.email,
                role: newUser.role,
                active: true
            });

            // Refresh list and reset form
            await fetchAuthorizedUsers();
            setNewUser({ name: '', phone: '', email: '', role: 'staff' });
            setShowAddForm(false);
        } catch (err) {
            console.error("Error adding user:", err);
            alert("Failed to add user");
        }
        setLoading(false);
    };

    const handleRemoveUser = async (userIndex) => {
        if (!confirm("Remove this user's access?")) return;

        setLoading(true);
        try {
            const spreadsheetId = getSheetId(sheetUrl);
            await GoogleSheetsService.removeAuthorizedUser(accessToken, spreadsheetId, userIndex);
            await fetchAuthorizedUsers();
        } catch (err) {
            console.error("Error removing user:", err);
            alert("Failed to remove user");
        }
        setLoading(false);
    };

    const handleRefresh = () => {
        fetchAuthorizedUsers();
        fetchUserLogins();
    };

    // Generate invite link for staff
    const getInviteLink = () => {
        if (!sheetUrl || !shopName) return '';
        const sheetId = getSheetId(sheetUrl);
        const encodedShopName = encodeURIComponent(shopName);
        return `${window.location.origin}/join?shop=${encodedShopName}&sheet=${sheetId}`;
    };

    const handleCopyLink = async () => {
        const link = getInviteLink();
        try {
            await navigator.clipboard.writeText(link);
            setLinkCopied(true);
            setTimeout(() => setLinkCopied(false), 2000);
        } catch (err) {
            // Fallback for older browsers
            const textArea = document.createElement('textarea');
            textArea.value = link;
            document.body.appendChild(textArea);
            textArea.select();
            document.execCommand('copy');
            document.body.removeChild(textArea);
            setLinkCopied(true);
            setTimeout(() => setLinkCopied(false), 2000);
        }
    };

    const handleNativeShare = async () => {
        const inviteLink = getInviteLink(); // Renamed 'link' to 'inviteLink' as per instruction
        if (navigator.share) {
            try {
                await navigator.share({
                    title: `Join ${shopName} on BijNex`,
                    text: `Join our shop's inventory on BijNex! Click to connect automatically:`,
                    url: inviteLink
                });
            } catch (err) {
                console.log('Share cancelled');
            }
        }
    };

    // Non-admin fallback
    if (!isAdmin) {
        return (
            <div className={styles.container}>
                <Card className="p-8 text-center">
                    <Shield size={48} className="mx-auto mb-4 text-red-500" />
                    <h2 className="text-xl font-bold text-white mb-2">Access Denied</h2>
                    <p className="text-white/60">You don't have admin privileges.</p>
                    <Button onClick={() => navigate('/home')} className="mt-4">
                        Go to Home
                    </Button>
                </Card>
            </div>
        );
    }

    return (
        <div className={styles.container}>
            {/* Header */}
            <div className={styles.header}>
                <div>
                    <h1 className={styles.title}>Admin Panel</h1>
                    <p className={styles.subtitle}>Manage users and app settings</p>
                </div>
                <Button variant="ghost" onClick={handleRefresh} disabled={loading}>
                    <RefreshCw size={18} className={loading ? "animate-spin" : ""} />
                </Button>
            </div>

            {/* Admin Info Card */}
            <Card className={styles.adminCard}>
                <div className={styles.adminInfo}>
                    <Shield size={24} className="text-emerald-400" />
                    <div>
                        <p className="text-white font-semibold">{user?.name}</p>
                        <p className="text-white/50 text-sm">{user?.email}</p>
                    </div>
                </div>
                <span className={styles.adminBadge}>Admin</span>
            </Card>

            {/* Stats Row */}
            <div className={styles.statsRow}>
                <Card className={styles.statCard}>
                    <Users size={20} className="text-blue-400" />
                    <div>
                        <p className={styles.statValue}>{authorizedUsers.length}</p>
                        <p className={styles.statLabel}>Authorized</p>
                    </div>
                </Card>
                <Card className={styles.statCard}>
                    <Users size={20} className="text-purple-400" />
                    <div>
                        <p className={styles.statValue}>{userLogins.length}</p>
                        <p className={styles.statLabel}>Unique Logins</p>
                    </div>
                </Card>
                <Card className={styles.statCard}>
                    <Database size={20} className="text-emerald-400" />
                    <div>
                        <p className={styles.statValue}>{sheetUrl ? "✓" : "✗"}</p>
                        <p className={styles.statLabel}>Database</p>
                    </div>
                </Card>
            </div>

            {/* Invite Staff Button */}
            <Card
                className="p-4 mb-4 flex items-center justify-between cursor-pointer hover:bg-white/5 transition-colors"
                onClick={() => setShowInviteModal(true)}
            >
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center">
                        <Share2 size={20} className="text-white" />
                    </div>
                    <div>
                        <p className="text-white font-medium">Invite Staff</p>
                        <p className="text-white/50 text-sm">Share link to connect staff</p>
                    </div>
                </div>
                <ChevronRight size={20} className="text-white/30" />
            </Card>

            {/* Invite Modal */}
            {showInviteModal && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <Card className="w-full max-w-md p-6 relative">
                        <button
                            onClick={() => setShowInviteModal(false)}
                            className="absolute top-4 right-4 text-white/50 hover:text-white"
                        >
                            <X size={20} />
                        </button>

                        <div className="text-center mb-6">
                            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center">
                                <Share2 size={32} className="text-white" />
                            </div>
                            <h2 className="text-xl font-bold text-white">Invite Staff</h2>
                            <p className="text-white/50 text-sm mt-1">
                                Share this link with your staff to connect them
                            </p>
                        </div>

                        {/* Link Preview */}
                        <div className="bg-black/30 rounded-lg p-3 mb-4 flex items-center gap-2">
                            <Link size={16} className="text-white/50 flex-shrink-0" />
                            <p className="text-white/70 text-sm truncate flex-1">
                                {getInviteLink()}
                            </p>
                        </div>

                        {/* Action Buttons */}
                        <div className="flex gap-3">
                            <Button
                                variant="secondary"
                                className="flex-1 flex items-center justify-center gap-2"
                                onClick={handleCopyLink}
                            >
                                {linkCopied ? (
                                    <>
                                        <CheckCircle size={18} className="text-emerald-400" />
                                        <span className="text-emerald-400">Copied!</span>
                                    </>
                                ) : (
                                    <>
                                        <Copy size={18} />
                                        <span>Copy Link</span>
                                    </>
                                )}
                            </Button>

                            {navigator.share && (
                                <Button
                                    variant="primary"
                                    className="flex-1 flex items-center justify-center gap-2"
                                    onClick={handleNativeShare}
                                >
                                    <Share2 size={18} />
                                    <span>Share</span>
                                </Button>
                            )}
                        </div>

                        {/* Instructions */}
                        <div className="mt-4 pt-4 border-t border-white/10">
                            <p className="text-white/40 text-xs text-center">
                                Staff will use this link to set up the app on their device and connect to your shop.
                            </p>
                        </div>
                    </Card>
                </div>
            )}

            {/* Tab Navigation */}
            <div className="flex gap-2 mb-4 overflow-x-auto no-scrollbar">
                <button
                    onClick={() => setActiveTab('authorized')}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === 'authorized'
                        ? 'bg-emerald-500 text-white'
                        : 'bg-white/5 text-white/60 hover:bg-white/10'
                        }`}
                >
                    <Users size={16} className="inline mr-2" />
                    Authorized Users
                </button>
                <button
                    onClick={() => setActiveTab('logins')}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === 'logins'
                        ? 'bg-purple-500 text-white'
                        : 'bg-white/5 text-white/60 hover:bg-white/10'
                        }`}
                >
                    <Users size={16} className="inline mr-2" />
                    Login History
                </button>
            </div>

            {/* User Management Section - Authorized Users Tab */}
            {activeTab === 'authorized' && (
                <div className={styles.section}>
                    <div className={styles.sectionHeader}>
                        <h2 className={styles.sectionTitle}>
                            <Users size={20} /> Authorized Users
                        </h2>
                        <Button
                            variant="primary"
                            onClick={() => setShowAddForm(!showAddForm)}
                            className="!py-1 !px-3 text-sm"
                        >
                            <UserPlus size={16} /> Add User
                        </Button>
                    </div>

                    {/* Add User Form */}
                    {showAddForm && (
                        <Card className={styles.addUserForm}>
                            <h3 className="text-white font-semibold mb-3">Add New User</h3>
                            <div className={styles.formGrid}>
                                <Input
                                    placeholder="Full Name"
                                    value={newUser.name}
                                    onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}
                                />
                                <Input
                                    placeholder="Phone Number"
                                    value={newUser.phone}
                                    onChange={(e) => setNewUser({ ...newUser, phone: e.target.value })}
                                />
                                <Input
                                    placeholder="Email (optional)"
                                    value={newUser.email}
                                    onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                                />
                                <select
                                    value={newUser.role}
                                    onChange={(e) => setNewUser({ ...newUser, role: e.target.value })}
                                    className={styles.selectInput}
                                >
                                    <option value="staff">Staff (Billing Only)</option>
                                    <option value="manager">Manager (Full Access)</option>
                                </select>
                            </div>
                            <div className={styles.formActions}>
                                <Button variant="secondary" onClick={() => setShowAddForm(false)}>
                                    Cancel
                                </Button>
                                <Button variant="primary" onClick={handleAddUser} disabled={loading}>
                                    <Save size={16} /> Save User
                                </Button>
                            </div>
                        </Card>
                    )}

                    {/* User List */}
                    <div className={styles.userList}>
                        {loading && authorizedUsers.length === 0 ? (
                            <Card className="p-4 text-center text-white/50">
                                Loading users...
                            </Card>
                        ) : authorizedUsers.length === 0 ? (
                            <Card className="p-6 text-center">
                                <Users size={32} className="mx-auto mb-2 text-white/30" />
                                <p className="text-white/50">No authorized users yet</p>
                                <p className="text-white/30 text-sm">Add users to allow them to access the app</p>
                            </Card>
                        ) : (
                            authorizedUsers.map((u, index) => (
                                <Card key={index} className={styles.userCard}>
                                    <div className={styles.userInfo}>
                                        <div className={styles.userAvatar}>
                                            {u.name?.[0]?.toUpperCase() || "U"}
                                        </div>
                                        <div>
                                            <p className="text-white font-medium">{u.name}</p>
                                            <div className="flex items-center gap-3 text-xs text-white/50">
                                                {u.phone && (
                                                    <span className="flex items-center gap-1">
                                                        <Phone size={10} /> {u.phone}
                                                    </span>
                                                )}
                                                {u.email && (
                                                    <span className="flex items-center gap-1">
                                                        <Mail size={10} /> {u.email}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                    <div className={styles.userActions}>
                                        <span className={`${styles.roleBadge} ${styles[u.role || 'staff']}`}>
                                            {u.role || 'staff'}
                                        </span>
                                        {u.active !== false ? (
                                            <CheckCircle size={16} className="text-emerald-400" />
                                        ) : (
                                            <XCircle size={16} className="text-red-400" />
                                        )}
                                        <button
                                            onClick={() => handleRemoveUser(index + 2)} // +2 for header row
                                            className={styles.deleteBtn}
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                    </div>
                                </Card>
                            ))
                        )}
                    </div>
                </div>
            )}

            {/* Login History Tab */}
            {activeTab === 'logins' && (
                <div className={styles.section}>
                    <div className={styles.sectionHeader}>
                        <h2 className={styles.sectionTitle}>
                            <Users size={20} /> Login History
                        </h2>
                        <p className="text-white/50 text-sm">{userLogins.length} unique accounts</p>
                    </div>

                    <div className={styles.userList}>
                        {userLogins.length === 0 ? (
                            <Card className="p-6 text-center">
                                <Users size={32} className="mx-auto mb-2 text-white/30" />
                                <p className="text-white/50">No login history yet</p>
                                <p className="text-white/30 text-sm">User logins will be tracked here</p>
                            </Card>
                        ) : (
                            userLogins.map((login, index) => (
                                <Card key={index} className={styles.userCard}>
                                    <div className={styles.userInfo}>
                                        {login.picture ? (
                                            <img
                                                src={login.picture}
                                                alt={login.name}
                                                className="w-10 h-10 rounded-full object-cover"
                                            />
                                        ) : (
                                            <div className={styles.userAvatar}>
                                                {login.name?.[0]?.toUpperCase() || login.email?.[0]?.toUpperCase() || "U"}
                                            </div>
                                        )}
                                        <div>
                                            <p className="text-white font-medium">{login.name || login.email}</p>
                                            <p className="text-white/50 text-xs">{login.email}</p>
                                        </div>
                                    </div>
                                    <div className="flex flex-col items-end gap-1">
                                        <span className="bg-purple-500/20 text-purple-400 px-2 py-0.5 rounded text-xs font-medium">
                                            {login.loginCount} logins
                                        </span>
                                        <span className="text-white/40 text-xs">
                                            {login.timestamp ? new Date(login.timestamp).toLocaleDateString() : ''}
                                        </span>
                                    </div>
                                </Card>
                            ))
                        )}
                    </div>
                </div>
            )}

            {/* Quick Links */}
            <div className={styles.section}>
                <h2 className={styles.sectionTitle}>
                    <Settings size={20} /> Quick Settings
                </h2>
                <div className={styles.linksList}>
                    <Card className={styles.linkCard} onClick={() => navigate('/profile')}>
                        <div className="flex items-center gap-3">
                            <Database size={20} className="text-blue-400" />
                            <span>Database Connection</span>
                        </div>
                        <ChevronRight size={18} className="text-white/30" />
                    </Card>
                    <Card className={styles.linkCard} onClick={() => navigate('/reports')}>
                        <div className="flex items-center gap-3">
                            <Settings size={20} className="text-purple-400" />
                            <span>View Reports</span>
                        </div>
                        <ChevronRight size={18} className="text-white/30" />
                    </Card>
                </div>
            </div>
        </div>
    );
}
