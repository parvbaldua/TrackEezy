import React from 'react';
import BottomNav from "../BottomNav";
import Sidebar from "../Sidebar";
import styles from "./DashboardLayout.module.css";
import { Outlet } from "react-router-dom";

export default function DashboardLayout() {
    return (
        <main className={styles.layout}>
            <Sidebar />
            <div className={styles.contentWrapper}>
                <Outlet />
            </div>
            <div className={styles.bottomNavWrapper}>
                <BottomNav />
            </div>
        </main>
    );
}
