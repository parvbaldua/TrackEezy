import React from 'react';
import BottomNav from "../BottomNav";
import Sidebar from "../Sidebar";
import styles from "./DashboardLayout.module.css";
import { Outlet } from "react-router-dom";
import { useOffline } from "../../context/OfflineContext";
import { WifiOff, Cloud, CloudOff } from "lucide-react";

export default function DashboardLayout() {
    const { isOnline, pendingCount } = useOffline();

    return (
        <main className={styles.layout}>
            <Sidebar />
            <div className={styles.contentWrapper}>
                {/* Offline Indicator Banner */}
                {!isOnline && (
                    <div className="fixed top-0 left-0 right-0 z-50 bg-orange-500 text-black text-center py-2 px-4 text-sm font-medium flex items-center justify-center gap-2 md:left-64">
                        <WifiOff size={16} />
                        <span>You're offline. Changes will sync when connected.</span>
                        {pendingCount > 0 && (
                            <span className="bg-black/20 rounded-full px-2 py-0.5 text-xs">{pendingCount} pending</span>
                        )}
                    </div>
                )}
                {isOnline && pendingCount > 0 && (
                    <div className="fixed top-0 left-0 right-0 z-50 bg-blue-500 text-white text-center py-2 px-4 text-sm font-medium flex items-center justify-center gap-2 md:left-64">
                        <Cloud size={16} className="animate-pulse" />
                        <span>Syncing {pendingCount} changes...</span>
                    </div>
                )}
                <Outlet />
            </div>
            <div className={styles.bottomNavWrapper}>
                <BottomNav />
            </div>
        </main>
    );
}

