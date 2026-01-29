import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button, Input } from "../components/ui/Shared";
import styles from "./LandingPage.module.css";
import { ArrowRight, CheckCircle } from "lucide-react";
import { useApp } from "../context/AppContext";
import { useAuth } from "../context/AuthProvider";

export default function LandingPage() {
    const navigate = useNavigate();
    const { saveConfig, isConfigured, loading: appLoading } = useApp();
    const { login, user } = useAuth();

    const [step, setStep] = useState(1);
    const [formData, setFormData] = useState({ shopName: "", sheetUrl: "" });
    const [checking, setChecking] = useState(true);

    // If already configured and logged in, redirect
    useEffect(() => {
        if (!appLoading) {
            if (isConfigured) {
                navigate("/home", { replace: true });
            } else {
                setChecking(false);
            }
        }
    }, [appLoading, isConfigured, navigate]);

    // If user logs in via Google (and returns), proceed
    useEffect(() => {
        if (user) {
            navigate("/home", { replace: true });
        }
    }, [user, navigate]);

    if (appLoading || checking) return null;

    const handleNext = () => {
        if (step === 1) setStep(2);
    };

    const handleBack = () => {
        if (step === 2) setStep(1);
    };

    const handleFinish = () => {
        saveConfig(formData.shopName, ""); // Start empty URL, let them config later or use Google Picker?
        // Actually the app relies on Sheet URL.
        // Original code set sheetUrl to "" in handleFinish?
        // Yes: saveConfig(formData.shopName, "");
        navigate("/home", { replace: true });
    };

    return (
        <div className={styles.container}>
            {/* Centered Content Wrapper for Desktop Polish */}
            <div className={styles.contentWrapper}>

                {/* Step 1: Welcome */}
                {step === 1 && (
                    <>
                        <div className={styles.logoWrapper}>
                            <span className={styles.logoText}>T</span>
                        </div>
                        <h1 className={styles.title}>TrackEezy</h1>
                        <p className={styles.subtitle}>
                            The premium way to manage your growing shop.
                            <br />
                            <span className={styles.highlight}>Inventory • Billing • Reports</span>
                        </p>

                        <Button onClick={handleNext} className={styles.ctaButton}>
                            Get Started <ArrowRight size={20} />
                        </Button>

                        <div className="flex flex-col gap-4 mt-4 w-full max-w-[300px]">
                            <div className="relative">
                                <div className="absolute inset-0 flex items-center">
                                    <span className="w-full border-t border-white/10" />
                                </div>
                                <div className="relative flex justify-center text-xs uppercase">
                                    <span className="bg-transparent px-2 text-white/40">Or continue with</span>
                                </div>
                            </div>

                            <Button
                                variant="secondary"
                                onClick={() => login()}
                                className="w-full !bg-white !text-black hover:!bg-gray-200"
                            >
                                <svg className="mr-2 h-4 w-4" aria-hidden="true" focusable="false" data-prefix="fab" data-icon="google" role="img" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 488 512"><path fill="currentColor" d="M488 261.8C488 403.3 391.1 504 248 504 110.8 504 0 393.2 0 256S110.8 8 248 8c66.8 0 123 24.5 166.3 64.9l-67.5 64.9C258.5 52.6 94.3 116.6 94.3 256c0 86.5 69.1 156.6 153.7 156.6 98.2 0 135-70.4 140.8-106.9H248v-85.3h236.1c2.3 12.7 3.9 24.9 3.9 41.4z"></path></svg>
                                Google
                            </Button>
                        </div>
                    </>
                )}

                {/* Step 2: Shop Details */}
                {step === 2 && (
                    <div className={styles.formStep}>
                        <h2 className={styles.title}>What's your shop called?</h2>
                        <p className={styles.subtitle}>This will appear on your bills.</p>

                        <div className={styles.inputGroup}>
                            <Input
                                autoFocus
                                placeholder="e.g. Sharma General Store"
                                value={formData.shopName}
                                onChange={(e) => setFormData({ ...formData, shopName: e.target.value })}
                            />
                        </div>

                        <Button onClick={handleFinish} className={styles.ctaButton} disabled={!formData.shopName}>
                            Start My Shop <CheckCircle size={20} />
                        </Button>
                        <Button variant="ghost" onClick={handleBack} className={styles.backButton}>
                            Back
                        </Button>
                    </div>
                )}

                <p className={styles.footer}>
                    Simple • Secure • Fast
                </p>
            </div>
        </div>
    );
}
