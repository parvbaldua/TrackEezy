import React from "react";
import clsx from "clsx";
import styles from "./Shared.module.css";

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
    children: React.ReactNode;
}

export function Card({ children, className, ...props }: CardProps) {
    return (
        <div className={clsx(styles.card, className)} {...props}>
            {children}
        </div>
    );
}

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: "primary" | "secondary" | "danger" | "ghost";
    isLoading?: boolean;
}

export function Button({ children, className, variant = "primary", isLoading, ...props }: ButtonProps) {
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

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
    label?: string;
}

export function Input({ label, className, ...props }: InputProps) {
    return (
        <div className={styles.inputContainer}>
            {label && <label className={styles.inputLabel}>{label}</label>}
            <input className={clsx(styles.input, className)} {...props} />
        </div>
    );
}
