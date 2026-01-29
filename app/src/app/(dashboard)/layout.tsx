import BottomNav from "@/components/BottomNav";
import Sidebar from "@/components/Sidebar";
import styles from "./dashboard.module.css";

export default function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <main className={styles.layout}>
            <Sidebar />
            <div className={styles.contentWrapper}>
                {children}
            </div>
            <div className={styles.bottomNavWrapper}>
                <BottomNav />
            </div>
        </main>
    );
}
