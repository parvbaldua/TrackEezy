"use client";

import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Check } from "lucide-react";
import styles from "./SuccessPopup.module.css";

interface SuccessPopupProps {
    show: boolean;
    onClose: () => void;
}

export function SuccessPopup({ show, onClose }: SuccessPopupProps) {
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

    // Use the explicit portal root to avoid hydration mismatches
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
