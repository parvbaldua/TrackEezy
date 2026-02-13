import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';

// Import all translation files
import en from '../i18n/en.json';
import hi from '../i18n/hi.json';
import ta from '../i18n/ta.json';
import gu from '../i18n/gu.json';

// Available languages
export const LANGUAGES = {
    en: { code: 'en', name: 'English', nativeName: 'English', flag: '🇬🇧' },
    hi: { code: 'hi', name: 'Hindi', nativeName: 'हिंदी', flag: '🇮🇳' },
    ta: { code: 'ta', name: 'Tamil', nativeName: 'தமிழ்', flag: '🇮🇳' },
    gu: { code: 'gu', name: 'Gujarati', nativeName: 'ગુજરાતી', flag: '🇮🇳' },
};

// Translation data
const translations = { en, hi, ta, gu };

const LanguageContext = createContext();

export function LanguageProvider({ children }) {
    // Initialize from localStorage or default to English
    const [language, setLanguage] = useState(() => {
        const saved = localStorage.getItem('bijnex_language');
        return saved && LANGUAGES[saved] ? saved : 'en';
    });

    // Save language preference to localStorage
    useEffect(() => {
        localStorage.setItem('bijnex_language', language);
        // Set document language for accessibility
        document.documentElement.lang = language;
    }, [language]);

    // Get current translations
    const currentTranslations = useMemo(() => {
        return translations[language] || translations.en;
    }, [language]);

    /**
     * Translation function
     * Usage: t('nav.home') => "Home" or "होम" based on language
     * 
     * @param {string} key - Dot-separated key path (e.g., 'home.greeting')
     * @param {object} params - Optional parameters for interpolation
     * @returns {string} Translated text
     */
    const t = (key, params = {}) => {
        try {
            // Split key by dots and traverse the object
            const keys = key.split('.');
            let value = currentTranslations;

            for (const k of keys) {
                if (value && typeof value === 'object' && k in value) {
                    value = value[k];
                } else {
                    // Fallback to English if key not found
                    value = translations.en;
                    for (const fallbackKey of keys) {
                        if (value && typeof value === 'object' && fallbackKey in value) {
                            value = value[fallbackKey];
                        } else {
                            console.warn(`Translation missing: ${key}`);
                            return key; // Return the key itself as fallback
                        }
                    }
                    break;
                }
            }

            // Handle parameter interpolation: "Hello {name}" with {name: "John"} => "Hello John"
            if (typeof value === 'string' && Object.keys(params).length > 0) {
                return value.replace(/\{(\w+)\}/g, (match, paramKey) => {
                    return params[paramKey] !== undefined ? params[paramKey] : match;
                });
            }

            return typeof value === 'string' ? value : key;
        } catch (error) {
            console.error(`Translation error for key: ${key}`, error);
            return key;
        }
    };

    /**
     * Change the current language
     * @param {string} langCode - Language code (en, hi, ta, gu)
     */
    const changeLanguage = (langCode) => {
        if (LANGUAGES[langCode]) {
            setLanguage(langCode);
        } else {
            console.warn(`Unsupported language: ${langCode}`);
        }
    };

    /**
     * Get available languages as an array
     */
    const availableLanguages = useMemo(() => Object.values(LANGUAGES), []);

    /**
     * Get current language info
     */
    const currentLanguage = useMemo(() => LANGUAGES[language], [language]);

    const value = {
        language,
        currentLanguage,
        availableLanguages,
        changeLanguage,
        t,
        translations: currentTranslations,
    };

    return (
        <LanguageContext.Provider value={value}>
            {children}
        </LanguageContext.Provider>
    );
}

/**
 * Hook to access language context
 */
export const useLanguage = () => {
    const context = useContext(LanguageContext);
    if (!context) {
        throw new Error('useLanguage must be used within a LanguageProvider');
    }
    return context;
};

/**
 * Shorthand hook for translation function only
 * Usage: const t = useTranslation();
 */
export const useTranslation = () => {
    const { t } = useLanguage();
    return t;
};

export default LanguageContext;
