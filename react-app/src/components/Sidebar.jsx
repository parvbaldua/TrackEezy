import { Link, useLocation } from "react-router-dom";
import { Home, Package, Tags, FileBarChart, User } from "lucide-react";
import styles from "./Sidebar.module.css";
import clsx from "clsx";
import { useTranslation } from "../context/LanguageContext";

export default function Sidebar() {
    const location = useLocation();
    const pathname = location.pathname;
    const t = useTranslation();

    const navItems = [
        { key: "home", href: "/home", icon: Home },
        { key: "inventory", href: "/inventory", icon: Package },
        { key: "billing", href: "/sell", icon: Tags },
        { key: "reports", href: "/reports", icon: FileBarChart },
    ];

    return (
        <aside className={styles.sidebar}>
            <div className={styles.logo}>
                <div className={styles.logoIcon}>B</div>
                BijNex
            </div>

            <nav className={styles.nav}>
                {navItems.map((item) => {
                    const isActive = pathname === item.href;
                    return (
                        <Link
                            key={item.key}
                            to={item.href}
                            className={clsx(styles.navItem, isActive && styles.active)}
                        >
                            <item.icon size={20} className={styles.icon} />
                            {t(`nav.${item.key}`)}
                        </Link>
                    );
                })}
            </nav>

            <div className={styles.footer}>
                <Link to="/profile" className={styles.userProfile}>
                    <div className={styles.userAvatar}>
                        <User size={20} />
                    </div>
                    <div className={styles.userInfo}>
                        <span className={styles.userName}>{t("sidebar.myShop")}</span>
                        <span className={styles.userRole}>{t("sidebar.storeOwner")}</span>
                    </div>
                </Link>
            </div>
        </aside>
    );
}
