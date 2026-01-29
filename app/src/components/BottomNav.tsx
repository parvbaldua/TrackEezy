"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Package, ScanLine, FileBarChart, User } from "lucide-react";
import styles from "./BottomNav.module.css";

export default function BottomNav() {
    const pathname = usePathname();

    const navItems = [
        { name: "Home", href: "/home", icon: Home },
        { name: "Inventory", href: "/inventory", icon: Package },
        { name: "Sell", href: "/billing", icon: ScanLine },
        { name: "Reports", href: "/reports", icon: FileBarChart },
        { name: "Profile", href: "/profile", icon: User },
    ];

    return (
        <nav className={styles.nav}>
            {navItems.map((item) => {
                const isActive = pathname === item.href;
                return (
                    <Link key={item.name} href={item.href} className={`${styles.item} ${isActive ? styles.active : ""}`}>
                        <item.icon className={styles.icon} size={24} />
                        <span className={styles.label}>{item.name}</span>
                    </Link>
                );
            })}
        </nav>
    );
}
