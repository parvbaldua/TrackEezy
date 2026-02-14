import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Store, CheckCircle, Loader2 } from 'lucide-react';
import { useApp } from '../context/AppContext';

export default function JoinPage() {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const { refreshConfig } = useApp();
    const [status, setStatus] = useState('loading'); // loading, success, error
    const [shopName, setShopName] = useState('');

    useEffect(() => {
        const shop = searchParams.get('shop');
        const sheet = searchParams.get('sheet');

        if (!shop || !sheet) {
            setStatus('error');
            return;
        }

        // Decode the shop name
        const decodedShopName = decodeURIComponent(shop);
        setShopName(decodedShopName);

        // Save to localStorage
        const sheetUrl = `https://docs.google.com/spreadsheets/d/${sheet}`;
        localStorage.setItem('akb_shop_name', decodedShopName);
        localStorage.setItem('akb_sheet_url', sheetUrl);

        // Trigger AppContext to re-read from localStorage
        refreshConfig();

        // Show success briefly, then redirect
        setStatus('success');
        setTimeout(() => {
            navigate('/');
        }, 1500);
    }, [searchParams, navigate, refreshConfig]);

    return (
        <div className="min-h-screen bg-gradient-to-br from-[#0a0a0a] via-[#111] to-[#0a0a0a] flex items-center justify-center p-4">
            <div className="text-center">
                {status === 'loading' && (
                    <>
                        <Loader2 size={48} className="mx-auto mb-4 text-emerald-400 animate-spin" />
                        <p className="text-white/60">Setting up...</p>
                    </>
                )}

                {status === 'success' && (
                    <>
                        <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center shadow-lg shadow-emerald-500/30">
                            <Store size={40} className="text-white" />
                        </div>
                        <h1 className="text-2xl font-bold text-white mb-2">
                            Joining {shopName}
                        </h1>
                        <div className="flex items-center justify-center gap-2 text-emerald-400">
                            <CheckCircle size={20} />
                            <span>Connected successfully!</span>
                        </div>
                        <p className="text-white/40 text-sm mt-4">Redirecting...</p>
                    </>
                )}

                {status === 'error' && (
                    <>
                        <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-red-500 to-red-600 flex items-center justify-center">
                            <Store size={40} className="text-white" />
                        </div>
                        <h1 className="text-2xl font-bold text-white mb-2">
                            Invalid Invite Link
                        </h1>
                        <p className="text-white/60 mb-4">
                            This invite link is missing required information.
                        </p>
                        <button
                            onClick={() => navigate('/')}
                            className="px-6 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-white transition-colors"
                        >
                            Go to Home
                        </button>
                    </>
                )}
            </div>
        </div>
    );
}
