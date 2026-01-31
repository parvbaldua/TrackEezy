import { Link, useLocation } from "react-router-dom";
import { Home, Package, Tags, FileBarChart, User } from "lucide-react";
import styles from "./Sidebar.module.css";
import clsx from "clsx";

export default function Sidebar() {
    const location = useLocation();
    const pathname = location.pathname;

    const navItems = [
        { name: "Dashboard", href: "/home", icon: Home },
        { name: "Inventory", href: "/inventory", icon: Package },
        { name: "Sell / POS", href: "/sell", icon: Tags },
        { name: "Reports", href: "/reports", icon: FileBarChart },
    ];

    return (
        <aside className={styles.sidebar}>
            <div className={styles.logo}>
                <div className={styles.logoIcon}>T</div>
                TrackEezy
            </div>

            <nav className={styles.nav}>
                {navItems.map((item) => {
                    const isActive = pathname === item.href;
                    return (
                        <Link
                            key={item.name}
                            to={item.href} // 'to' instead of 'href' in react-router
                            className={clsx(styles.navItem, isActive && styles.active)}
                        >
                            <item.icon size={20} className={styles.icon} />
                            {item.name}
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
                        <span className={styles.userName}>My Shop</span>
                        <span className={styles.userRole}>Store Owner</span>
                    </div>
                </Link>
            </div>
        </aside>
    );
}
