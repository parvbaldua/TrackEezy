import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Check } from "lucide-react";
import styles from "./SuccessPopup.module.css";

export function SuccessPopup({ show, onClose }) {
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    useEffect(() => {
        if (show) {
            const timer = setTimeout(() => {
                onClose();
            }, 2000);
            return () => clearTimeout(timer);
        }
    }, [show, onClose]);

    if (!show || !mounted) return null;

    // Use document.body if portal-root is missing
    const portalRoot = document.getElementById("portal-root") || document.body;

    return createPortal(
        <div className={styles.overlay}>
            <div className={styles.popup}>
                <div className={styles.glow}></div>
                <div className={styles.iconCircle}>
                    <Check className={styles.icon} />
                </div>
                <h3 className={styles.text}>Success!</h3>
                <p className={styles.subtext}>Item added to inventory</p>
            </div>
        </div>,
        portalRoot
    );
}
