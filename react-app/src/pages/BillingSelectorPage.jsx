import { Link } from "react-router-dom";
import { ScanLine, Tags } from "lucide-react";
import styles from "./BillingSelectorPage.module.css";

export default function BillingSelectorPage() {
    return (
        <div className={styles.container}>
            <h1 className={styles.title}>Choose Billing Mode</h1>
            <p className={styles.subtitle}>Select how you want to create bills</p>

            <div className={styles.optionsGrid}>
                <Link to="/billing" className={styles.option}>
                    <div className={styles.optionIcon}>
                        <ScanLine size={40} />
                    </div>
                    <h2 className={styles.optionTitle}>Auto Billing</h2>
                    <p className={styles.optionDesc}>
                        Use predefined prices from your inventory. Quick checkout with automatic pricing.
                    </p>
                    <span className={styles.optionTag}>Recommended for fixed prices</span>
                </Link>

                <Link to="/manual-billing" className={styles.option}>
                    <div className={styles.optionIcon} style={{ background: "rgba(234, 179, 8, 0.15)" }}>
                        <Tags size={40} style={{ color: "#fbbf24" }} />
                    </div>
                    <h2 className={styles.optionTitle}>Manual Billing</h2>
                    <p className={styles.optionDesc}>
                        Enter custom prices for each item. Perfect for variable pricing and discounts.
                    </p>
                    <span className={styles.optionTag}>For custom pricing</span>
                </Link>
            </div>
        </div>
    );
}
