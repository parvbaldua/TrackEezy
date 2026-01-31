import React, { useState } from 'react';
import { useLanguage, LANGUAGES } from '../../context/LanguageContext';
import { Globe, Check, ChevronDown } from 'lucide-react';
import styles from './LanguageSelector.module.css';

export default function LanguageSelector({ compact = false }) {
    const { language, changeLanguage, currentLanguage, availableLanguages } = useLanguage();
    const [isOpen, setIsOpen] = useState(false);

    const handleSelect = (langCode) => {
        changeLanguage(langCode);
        setIsOpen(false);
    };

    if (compact) {
        // Compact version for header/nav
        return (
            <div className={styles.compactWrapper}>
                <button
                    className={styles.compactButton}
                    onClick={() => setIsOpen(!isOpen)}
                    title="Change Language"
                >
                    <Globe size={18} />
                    <span className={styles.compactCode}>{currentLanguage.code.toUpperCase()}</span>
                </button>

                {isOpen && (
                    <>
                        <div className={styles.backdrop} onClick={() => setIsOpen(false)} />
                        <div className={styles.compactDropdown}>
                            {availableLanguages.map(lang => (
                                <button
                                    key={lang.code}
                                    className={`${styles.compactItem} ${language === lang.code ? styles.active : ''}`}
                                    onClick={() => handleSelect(lang.code)}
                                >
                                    <span className={styles.flag}>{lang.flag}</span>
                                    <span>{lang.nativeName}</span>
                                    {language === lang.code && <Check size={14} className="text-primary" />}
                                </button>
                            ))}
                        </div>
                    </>
                )}
            </div>
        );
    }

    // Full version for settings page
    return (
        <div className={styles.wrapper}>
            <button
                className={styles.selector}
                onClick={() => setIsOpen(!isOpen)}
            >
                <div className={styles.selectedInfo}>
                    <Globe size={20} className="text-primary" />
                    <div>
                        <span className={styles.label}>Language</span>
                        <span className={styles.current}>
                            {currentLanguage.flag} {currentLanguage.nativeName}
                        </span>
                    </div>
                </div>
                <ChevronDown size={18} className={`${styles.chevron} ${isOpen ? styles.open : ''}`} />
            </button>

            {isOpen && (
                <>
                    <div className={styles.backdrop} onClick={() => setIsOpen(false)} />
                    <div className={styles.dropdown}>
                        {availableLanguages.map(lang => (
                            <button
                                key={lang.code}
                                className={`${styles.item} ${language === lang.code ? styles.active : ''}`}
                                onClick={() => handleSelect(lang.code)}
                            >
                                <span className={styles.flag}>{lang.flag}</span>
                                <div className={styles.langInfo}>
                                    <span className={styles.nativeName}>{lang.nativeName}</span>
                                    <span className={styles.englishName}>{lang.name}</span>
                                </div>
                                {language === lang.code && <Check size={18} className="text-primary" />}
                            </button>
                        ))}
                    </div>
                </>
            )}
        </div>
    );
}
