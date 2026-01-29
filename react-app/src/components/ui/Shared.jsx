import React from "react";
import clsx from "clsx";
import styles from "./Shared.module.css";

export function Card({ children, className, ...props }) {
    return (
        <div className={clsx(styles.card, className)} {...props}>
            {children}
        </div>
    );
}

export function Button({ children, className, variant = "primary", isLoading, ...props }) {
    return (
        <button
            className={clsx(styles.btn, styles[variant], className)}
            disabled={isLoading || props.disabled}
            {...props}
        >
            {isLoading ? "..." : children}
        </button>
    );
}

export function Input({ label, className, ...props }) {
    return (
        <div className={styles.inputContainer}>
            {label && <label className={styles.inputLabel}>{label}</label>}
            <input className={clsx(styles.input, className)} {...props} />
        </div>
    );
}
