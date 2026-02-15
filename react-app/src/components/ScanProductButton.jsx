import { useState, useRef, useEffect } from 'react';
import { Camera, X, Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import { Html5Qrcode } from 'html5-qrcode';
import { lookupBarcode, playBeep } from '../utils/barcodeUtils';

export default function ScanProductButton({ onScanComplete, t }) {
    const [scanning, setScanning] = useState(false);
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState(null); // { found, name, barcode }
    const scannerRef = useRef(null);
    const containerRef = useRef(null);
    const hasScannedRef = useRef(false);

    const startScanner = async () => {
        setScanning(true);
        setResult(null);
        hasScannedRef.current = false;

        // Small delay to let DOM render
        await new Promise(r => setTimeout(r, 300));

        try {
            const scanner = new Html5Qrcode('barcode-reader');
            scannerRef.current = scanner;

            await scanner.start(
                { facingMode: 'environment' },
                {
                    fps: 10,
                    qrbox: { width: 280, height: 120 },
                    aspectRatio: 1.5,
                },
                async (decodedText) => {
                    // Prevent duplicate scans
                    if (hasScannedRef.current) return;
                    hasScannedRef.current = true;

                    // BEEP!
                    playBeep();

                    // Stop camera
                    try { await scanner.stop(); } catch (e) { }
                    setScanning(false);
                    setLoading(true);

                    // Lookup product
                    const productData = await lookupBarcode(decodedText);
                    setResult(productData);
                    setLoading(false);

                    // Auto-fill form
                    onScanComplete({
                        name: productData.name || '',
                        price: productData.price || '',
                        barcode: decodedText,
                        baseUnit: productData.baseUnit,
                        displayUnit: productData.displayUnit,
                        conversionFactor: productData.conversionFactor,
                        sku: decodedText, // Use barcode as SKU
                    });

                    // Auto-hide result after 2s
                    setTimeout(() => setResult(null), 2500);
                },
                () => { } // Ignore scan errors (no barcode in frame)
            );
        } catch (err) {
            console.error('Scanner error:', err);
            setScanning(false);
            setResult({ found: false, error: 'Camera access denied' });
        }
    };

    const stopScanner = async () => {
        if (scannerRef.current) {
            try { await scannerRef.current.stop(); } catch (e) { }
            scannerRef.current = null;
        }
        setScanning(false);
    };

    // Cleanup on unmount
    useEffect(() => {
        return () => { stopScanner(); };
    }, []);

    return (
        <div style={{ marginBottom: '12px' }}>
            {/* Scan Button */}
            {!scanning && !loading && !result && (
                <button
                    type="button"
                    onClick={startScanner}
                    style={{
                        width: '100%',
                        padding: '14px 16px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '10px',
                        background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
                        color: '#fff',
                        border: 'none',
                        borderRadius: '12px',
                        fontSize: '15px',
                        fontWeight: '600',
                        cursor: 'pointer',
                        boxShadow: '0 4px 15px rgba(59,130,246,0.3)',
                    }}
                >
                    <Camera size={20} />
                    Scan Barcode
                </button>
            )}

            {/* Live Camera View */}
            {scanning && (
                <div style={{ position: 'relative', borderRadius: '12px', overflow: 'hidden', border: '2px solid #3b82f6' }}>
                    <div id="barcode-reader" ref={containerRef} style={{ width: '100%' }} />

                    {/* Scanning indicator */}
                    <div style={{
                        position: 'absolute', bottom: 0, left: 0, right: 0,
                        padding: '10px',
                        background: 'linear-gradient(transparent, rgba(0,0,0,0.8))',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                    }}>
                        <div style={{
                            width: '8px', height: '8px', borderRadius: '50%',
                            background: '#ef4444',
                            animation: 'pulse 1s ease-in-out infinite',
                        }} />
                        <span style={{ color: '#fff', fontSize: '13px', fontWeight: '500' }}>
                            Point at barcode...
                        </span>
                    </div>

                    {/* Close button */}
                    <button
                        onClick={stopScanner}
                        style={{
                            position: 'absolute', top: '8px', right: '8px',
                            background: 'rgba(0,0,0,0.6)', border: 'none',
                            borderRadius: '50%', width: '32px', height: '32px',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            cursor: 'pointer', color: '#fff', zIndex: 10,
                        }}
                    >
                        <X size={18} />
                    </button>
                </div>
            )}

            {/* Loading state */}
            {loading && (
                <div style={{
                    padding: '16px',
                    background: '#1e1e2e',
                    borderRadius: '12px',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px',
                    border: '1px solid rgba(255,255,255,0.1)',
                }}>
                    <Loader2 size={20} style={{ color: '#3b82f6', animation: 'spin 1s linear infinite' }} />
                    <span style={{ color: '#fff', fontSize: '14px' }}>Looking up product...</span>
                </div>
            )}

            {/* Result feedback */}
            {result && !loading && (
                <div style={{
                    padding: '12px 16px',
                    background: result.found ? 'rgba(16,185,129,0.15)' : 'rgba(59,130,246,0.15)',
                    borderRadius: '12px',
                    display: 'flex', alignItems: 'center', gap: '10px',
                    border: `1px solid ${result.found ? 'rgba(16,185,129,0.3)' : 'rgba(59,130,246,0.3)'}`,
                }}>
                    {result.found ? (
                        <>
                            <CheckCircle size={18} style={{ color: '#10b981' }} />
                            <div>
                                <p style={{ color: '#10b981', fontSize: '13px', fontWeight: '600', margin: 0 }}>Product Found!</p>
                                <p style={{ color: '#fff', fontSize: '14px', margin: '2px 0 0' }}>{result.name}</p>
                            </div>
                        </>
                    ) : (
                        <>
                            <AlertCircle size={18} style={{ color: '#3b82f6' }} />
                            <div>
                                <p style={{ color: '#3b82f6', fontSize: '13px', fontWeight: '600', margin: 0 }}>
                                    {result.error || 'Barcode Scanned'}
                                </p>
                                <p style={{ color: '#fff/70', fontSize: '13px', margin: '2px 0 0' }}>
                                    {result.barcode ? `Code: ${result.barcode} — fill details manually` : 'Try again'}
                                </p>
                            </div>
                        </>
                    )}
                </div>
            )}

            <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }
        #barcode-reader video { border-radius: 10px; }
        #barcode-reader { border: none !important; }
        #barcode-reader__scan_region { background: transparent !important; }
        #barcode-reader__dashboard { display: none !important; }
        #barcode-reader img[alt="Info icon"] { display: none !important; }
        #barcode-reader__dashboard_section_csr { display: none !important; }
        #qr-shaded-region { border-color: #3b82f6 !important; }
      `}</style>
        </div>
    );
}
