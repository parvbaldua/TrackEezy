import { useState, useRef, useEffect, useCallback } from 'react';
import { Camera, X, Loader2, CheckCircle, AlertCircle, ScanLine } from 'lucide-react';
import { lookupBarcode, playBeep } from '../utils/barcodeUtils';
import { scanProductLabel } from '../utils/ocrParser';

export default function ScanProductButton({ onScanComplete, t }) {
    const [scanning, setScanning] = useState(false);
    const [loading, setLoading] = useState(false);
    const [ocrLoading, setOcrLoading] = useState(false);
    const [ocrProgress, setOcrProgress] = useState(0);
    const [result, setResult] = useState(null);
    const [showTextScan, setShowTextScan] = useState(false);
    const videoRef = useRef(null);
    const streamRef = useRef(null);
    const animFrameRef = useRef(null);
    const hasScannedRef = useRef(false);
    const fileInputRef = useRef(null);

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
        setShowTextScan(false);
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

            await new Promise(r => setTimeout(r, 200));

            if (videoRef.current) {
                videoRef.current.srcObject = stream;
                await videoRef.current.play();
            }

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

                            playBeep();
                            stopCamera();
                            setLoading(true);

                            const productData = await lookupBarcode(code);
                            setResult(productData);
                            setLoading(false);
                            setShowTextScan(true); // Show "Scan Label" option

                            onScanComplete({
                                name: productData.name || '',
                                price: productData.price || '',
                                barcode: code,
                                baseUnit: productData.baseUnit,
                                displayUnit: productData.displayUnit,
                                conversionFactor: productData.conversionFactor,
                                sku: code,
                            });
                            return;
                        }
                    } catch (e) { }

                    animFrameRef.current = requestAnimationFrame(detectLoop);
                };

                detectLoop();
            } else {
                setResult({ found: false, error: 'Barcode scanner not supported' });
                stopCamera();
            }
        } catch (err) {
            console.error('Camera error:', err);
            setScanning(false);
            setResult({ found: false, error: 'Camera access denied' });
        }
    };

    // OCR Text Scan handler
    const handleTextScan = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setOcrLoading(true);
        setOcrProgress(0);

        try {
            const result = await scanProductLabel(file, setOcrProgress);

            // Send OCR fields to parent (only the text-based ones)
            onScanComplete({
                price: result.price || '',
                expiryDate: result.expiryDate || '',
                batchNo: result.batchNo || '',
                hsnCode: result.hsnCode || '',
                gstPercent: result.gstPercent || '',
            });

            playBeep();
            setShowTextScan(false);
            setResult({ found: true, name: 'Label details scanned!' });
            setTimeout(() => setResult(null), 2500);
        } catch (err) {
            console.error('OCR error:', err);
            setResult({ found: false, error: 'Text scan failed — fill manually' });
        } finally {
            setOcrLoading(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    useEffect(() => {
        return () => stopCamera();
    }, [stopCamera]);

    return (
        <div style={{ marginBottom: '12px' }}>
            {/* Hidden file input for OCR */}
            <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handleTextScan}
                style={{ display: 'none' }}
            />

            {/* Scan Barcode Button */}
            {!scanning && !loading && !ocrLoading && !result && !showTextScan && (
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

            {/* Live Camera */}
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
                        style={{ width: '100%', height: '200px', objectFit: 'cover' }}
                    />
                    <div style={{
                        position: 'absolute',
                        top: '30%', left: '10%', right: '10%',
                        height: '2px',
                        background: 'linear-gradient(90deg, transparent, #ef4444, #ef4444, transparent)',
                        animation: 'scanline 2s ease-in-out infinite',
                        boxShadow: '0 0 8px #ef4444',
                    }} />
                    <div style={{
                        position: 'absolute',
                        top: '15%', left: '8%', right: '8%', bottom: '25%',
                        border: '2px solid rgba(255,255,255,0.4)',
                        borderRadius: '8px',
                    }} />
                    <div style={{
                        position: 'absolute', bottom: 0, left: 0, right: 0,
                        padding: '10px',
                        background: 'linear-gradient(transparent, rgba(0,0,0,0.85))',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                    }}>
                        <div style={{
                            width: '8px', height: '8px', borderRadius: '50%',
                            background: '#ef4444', animation: 'pulse 1s ease-in-out infinite',
                        }} />
                        <span style={{ color: '#fff', fontSize: '13px', fontWeight: '500' }}>
                            Point at barcode — auto-detects
                        </span>
                    </div>
                    <button onClick={stopCamera} style={{
                        position: 'absolute', top: '8px', right: '8px',
                        background: 'rgba(0,0,0,0.6)', border: 'none',
                        borderRadius: '50%', width: '32px', height: '32px',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        cursor: 'pointer', color: '#fff', zIndex: 10,
                    }}>
                        <X size={18} />
                    </button>
                </div>
            )}

            {/* Loading barcode lookup */}
            {loading && (
                <div style={{
                    padding: '16px', background: '#1e1e2e', borderRadius: '12px',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px',
                    border: '1px solid rgba(255,255,255,0.1)',
                }}>
                    <Loader2 size={20} style={{ color: '#3b82f6', animation: 'spin 1s linear infinite' }} />
                    <span style={{ color: '#fff', fontSize: '14px' }}>Looking up product...</span>
                </div>
            )}

            {/* Result feedback */}
            {result && !loading && !ocrLoading && (
                <div style={{
                    padding: '12px 16px',
                    background: result.found ? 'rgba(16,185,129,0.15)' : 'rgba(59,130,246,0.15)',
                    borderRadius: '12px',
                    display: 'flex', alignItems: 'center', gap: '10px',
                    border: `1px solid ${result.found ? 'rgba(16,185,129,0.3)' : 'rgba(59,130,246,0.3)'}`,
                    marginBottom: showTextScan ? '8px' : 0,
                }}>
                    {result.found ? (
                        <>
                            <CheckCircle size={18} style={{ color: '#10b981', flexShrink: 0 }} />
                            <div>
                                <p style={{ color: '#10b981', fontSize: '13px', fontWeight: '600', margin: 0 }}>
                                    {result.name || 'Done!'}
                                </p>
                            </div>
                        </>
                    ) : (
                        <>
                            <AlertCircle size={18} style={{ color: '#3b82f6', flexShrink: 0 }} />
                            <div>
                                <p style={{ color: '#3b82f6', fontSize: '13px', fontWeight: '600', margin: 0 }}>
                                    {result.error || 'Barcode Scanned'}
                                </p>
                                {result.barcode && (
                                    <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '12px', margin: '2px 0 0' }}>
                                        Code: {result.barcode}
                                    </p>
                                )}
                            </div>
                        </>
                    )}
                </div>
            )}

            {/* Step 2: Scan Label Text (after barcode) */}
            {showTextScan && !ocrLoading && (
                <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        style={{
                            flex: 1,
                            padding: '12px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '8px',
                            background: 'linear-gradient(135deg, #f59e0b, #ef4444)',
                            color: '#fff',
                            border: 'none',
                            borderRadius: '10px',
                            fontSize: '14px',
                            fontWeight: '600',
                            cursor: 'pointer',
                            boxShadow: '0 2px 10px rgba(245,158,11,0.3)',
                        }}
                    >
                        <ScanLine size={18} />
                        📷 Scan Label (MRP, Expiry, GST)
                    </button>
                    <button
                        type="button"
                        onClick={() => { setShowTextScan(false); setResult(null); }}
                        style={{
                            padding: '12px 16px',
                            background: 'rgba(255,255,255,0.1)',
                            color: 'rgba(255,255,255,0.6)',
                            border: '1px solid rgba(255,255,255,0.1)',
                            borderRadius: '10px',
                            fontSize: '14px',
                            cursor: 'pointer',
                        }}
                    >
                        Skip
                    </button>
                </div>
            )}

            {/* OCR Progress */}
            {ocrLoading && (
                <div style={{
                    padding: '16px', background: '#1e1e2e', borderRadius: '12px',
                    border: '1px solid rgba(245,158,11,0.3)',
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                        <Loader2 size={18} style={{ color: '#f59e0b', animation: 'spin 1s linear infinite' }} />
                        <span style={{ color: '#fff', fontSize: '14px' }}>Reading label text... {ocrProgress}%</span>
                    </div>
                    <div style={{
                        width: '100%', height: '4px', borderRadius: '2px',
                        background: 'rgba(255,255,255,0.1)',
                    }}>
                        <div style={{
                            width: `${ocrProgress}%`, height: '100%', borderRadius: '2px',
                            background: 'linear-gradient(90deg, #f59e0b, #ef4444)',
                            transition: 'width 0.3s',
                        }} />
                    </div>
                </div>
            )}

            <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }
        @keyframes scanline { 0% { top: 20%; } 50% { top: 55%; } 100% { top: 20%; } }
      `}</style>
        </div>
    );
}
