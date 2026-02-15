import { useState, useRef, useEffect, useCallback } from 'react';
import { Camera, X, Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import { lookupBarcode, playBeep } from '../utils/barcodeUtils';

export default function ScanProductButton({ onScanComplete, t }) {
    const [scanning, setScanning] = useState(false);
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState(null);
    const videoRef = useRef(null);
    const streamRef = useRef(null);
    const animFrameRef = useRef(null);
    const hasScannedRef = useRef(false);

    const stopCamera = useCallback(() => {
        if (animFrameRef.current) {
            cancelAnimationFrame(animFrameRef.current);
            animFrameRef.current = null;
        }
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
            streamRef.current = null;
        }
        setScanning(false);
    }, []);

    const startScanner = async () => {
        setScanning(true);
        setResult(null);
        hasScannedRef.current = false;

        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: {
                    facingMode: 'environment',
                    width: { ideal: 1280 },
                    height: { ideal: 720 },
                }
            });
            streamRef.current = stream;

            // Wait for video ref to be available
            await new Promise(r => setTimeout(r, 200));

            if (videoRef.current) {
                videoRef.current.srcObject = stream;
                await videoRef.current.play();
            }

            // Check if BarcodeDetector is available (Chrome Android)
            if ('BarcodeDetector' in window) {
                const detector = new BarcodeDetector({
                    formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'code_39', 'code_93', 'itf']
                });

                const detectLoop = async () => {
                    if (hasScannedRef.current || !videoRef.current) return;

                    try {
                        const barcodes = await detector.detect(videoRef.current);
                        if (barcodes.length > 0 && !hasScannedRef.current) {
                            hasScannedRef.current = true;
                            const code = barcodes[0].rawValue;

                            // BEEP + Vibrate
                            playBeep();

                            // Stop camera
                            stopCamera();
                            setLoading(true);

                            // Lookup product
                            const productData = await lookupBarcode(code);
                            setResult(productData);
                            setLoading(false);

                            // Auto-fill form
                            onScanComplete({
                                name: productData.name || '',
                                price: productData.price || '',
                                barcode: code,
                                baseUnit: productData.baseUnit,
                                displayUnit: productData.displayUnit,
                                conversionFactor: productData.conversionFactor,
                                sku: code,
                            });

                            // Auto-hide result
                            setTimeout(() => setResult(null), 3000);
                            return;
                        }
                    } catch (e) {
                        // Detection error — keep trying
                    }

                    animFrameRef.current = requestAnimationFrame(detectLoop);
                };

                // Start detection loop
                detectLoop();
            } else {
                // Fallback: BarcodeDetector not available
                setResult({ found: false, error: 'Barcode scanner not supported on this device' });
                stopCamera();
            }
        } catch (err) {
            console.error('Camera error:', err);
            setScanning(false);
            setResult({ found: false, error: 'Camera access denied — allow camera permission' });
        }
    };

    // Cleanup on unmount
    useEffect(() => {
        return () => stopCamera();
    }, [stopCamera]);

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
                <div style={{
                    position: 'relative',
                    borderRadius: '12px',
                    overflow: 'hidden',
                    border: '2px solid #3b82f6',
                    background: '#000',
                }}>
                    <video
                        ref={videoRef}
                        autoPlay
                        playsInline
                        muted
                        style={{
                            width: '100%',
                            height: '200px',
                            objectFit: 'cover',
                        }}
                    />

                    {/* Scan line animation */}
                    <div style={{
                        position: 'absolute',
                        top: '30%', left: '10%', right: '10%',
                        height: '2px',
                        background: 'linear-gradient(90deg, transparent, #ef4444, #ef4444, transparent)',
                        animation: 'scanline 2s ease-in-out infinite',
                        boxShadow: '0 0 8px #ef4444',
                    }} />

                    {/* Scan frame overlay */}
                    <div style={{
                        position: 'absolute',
                        top: '15%', left: '8%', right: '8%', bottom: '25%',
                        border: '2px solid rgba(255,255,255,0.4)',
                        borderRadius: '8px',
                    }} />

                    {/* Bottom overlay */}
                    <div style={{
                        position: 'absolute', bottom: 0, left: 0, right: 0,
                        padding: '10px',
                        background: 'linear-gradient(transparent, rgba(0,0,0,0.85))',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                    }}>
                        <div style={{
                            width: '8px', height: '8px', borderRadius: '50%',
                            background: '#ef4444',
                            animation: 'pulse 1s ease-in-out infinite',
                        }} />
                        <span style={{ color: '#fff', fontSize: '13px', fontWeight: '500' }}>
                            Point at barcode — auto-detects instantly
                        </span>
                    </div>

                    {/* Close button */}
                    <button
                        onClick={stopCamera}
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
                            <CheckCircle size={18} style={{ color: '#10b981', flexShrink: 0 }} />
                            <div>
                                <p style={{ color: '#10b981', fontSize: '13px', fontWeight: '600', margin: 0 }}>Product Found!</p>
                                <p style={{ color: '#fff', fontSize: '14px', margin: '2px 0 0' }}>{result.name}</p>
                            </div>
                        </>
                    ) : (
                        <>
                            <AlertCircle size={18} style={{ color: '#3b82f6', flexShrink: 0 }} />
                            <div>
                                <p style={{ color: '#3b82f6', fontSize: '13px', fontWeight: '600', margin: 0 }}>
                                    {result.error || 'Barcode Scanned'}
                                </p>
                                <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: '13px', margin: '2px 0 0' }}>
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
        @keyframes scanline {
          0% { top: 20%; }
          50% { top: 55%; }
          100% { top: 20%; }
        }
      `}</style>
        </div>
    );
}
