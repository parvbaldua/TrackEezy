import { Link, useLocation } from "react-router-dom";
import { Home, Package, Tags, FileBarChart, User } from "lucide-react";
import styles from "./BottomNav.module.css";
import { useTranslation } from "../context/LanguageContext";

export default function BottomNav() {
    const location = useLocation();
    const pathname = location.pathname;
    const t = useTranslation();

    const navItems = [
        { key: "home", href: "/home", icon: Home },
        { key: "inventory", href: "/inventory", icon: Package },
        { key: "billing", href: "/sell", icon: Tags },
        { key: "reports", href: "/reports", icon: FileBarChart },
        { key: "profile", href: "/profile", icon: User },
    ];

    return (
        <nav className={styles.nav}>
            {navItems.map((item) => {
                const isActive = pathname === item.href;
                return (
                    <Link key={item.key} to={item.href} className={`${styles.item} ${isActive ? styles.active : ""}`}>
                        <item.icon className={styles.icon} size={24} />
                        <span className={styles.label}>{t(`nav.${item.key}`)}</span>
                    </Link>
                );
            })}
        </nav>
    );
}

