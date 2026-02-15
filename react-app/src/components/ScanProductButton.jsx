import { useState, useRef, useEffect, useCallback } from 'react';
import { Camera, X, Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import { lookupBarcode, playBeep } from '../utils/barcodeUtils';
import { extractTextFromImage, parseProductLabel, preloadOcrWorker } from '../utils/ocrParser';

export default function ScanProductButton({ onScanComplete, t }) {
    // Pre-load Tesseract worker on mount (downloads lang data in background)
    useEffect(() => { preloadOcrWorker(); }, []);
    const [scanning, setScanning] = useState(false);
    const [phase, setPhase] = useState('idle'); // idle, barcode, label, processing, done
    const [result, setResult] = useState(null);
    const [statusText, setStatusText] = useState('');
    const videoRef = useRef(null);
    const canvasRef = useRef(null);
    const streamRef = useRef(null);
    const animFrameRef = useRef(null);
    const hasScannedRef = useRef(false);
    const ocrAttemptRef = useRef(0);
    const ocrTimerRef = useRef(null);

    const stopCamera = useCallback(() => {
        if (animFrameRef.current) {
            cancelAnimationFrame(animFrameRef.current);
            animFrameRef.current = null;
        }
        if (ocrTimerRef.current) {
            clearTimeout(ocrTimerRef.current);
            ocrTimerRef.current = null;
        }
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
            streamRef.current = null;
        }
        setScanning(false);
        setPhase('idle');
    }, []);

    // Capture a frame from video as image blob
    const captureFrame = () => {
        const video = videoRef.current;
        const canvas = canvasRef.current;
        if (!video || !canvas) return null;

        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(video, 0, 0);

        return new Promise(resolve => {
            canvas.toBlob(blob => resolve(blob), 'image/jpeg', 0.9);
        });
    };

    // Run OCR on captured frame
    const runOcrOnFrame = async () => {
        if (ocrAttemptRef.current >= 5) {
            // Max attempts reached
            playBeep();
            stopCamera();
            setResult({ found: false, error: 'Could not read label text — fill manually' });
            setTimeout(() => setResult(null), 3000);
            return;
        }

        ocrAttemptRef.current++;
        setStatusText(`Reading label... (attempt ${ocrAttemptRef.current}/5)`);

        const blob = await captureFrame();
        if (!blob) {
            ocrTimerRef.current = setTimeout(runOcrOnFrame, 2000);
            return;
        }

        try {
            const text = await extractTextFromImage(blob, () => { });
            const parsed = parseProductLabel(text);

            // Check if we found anything useful
            const detected = {};
            const labels = [];

            if (parsed.price) { detected.price = parsed.price; labels.push(`₹${parsed.price}`); }
            if (parsed.expiryDate) { detected.expiryDate = parsed.expiryDate; labels.push(`Exp: ${parsed.expiryDate}`); }
            if (parsed.batchNo) { detected.batchNo = parsed.batchNo; labels.push(`Batch: ${parsed.batchNo}`); }
            if (parsed.hsnCode) { detected.hsnCode = parsed.hsnCode; labels.push(`HSN: ${parsed.hsnCode}`); }
            if (parsed.gstPercent) { detected.gstPercent = parsed.gstPercent; labels.push(`GST: ${parsed.gstPercent}%`); }
            if (parsed.name && !detected.name) { detected.name = parsed.name; }

            if (labels.length > 0) {
                // Found something! Beep and fill
                playBeep();
                onScanComplete(detected);
                stopCamera();
                setPhase('done');
                setResult({ found: true, name: labels.join(' | ') });
                setTimeout(() => { setResult(null); setPhase('idle'); }, 4000);
                return;
            }

            // Nothing found yet, try again in 2 seconds
            ocrTimerRef.current = setTimeout(runOcrOnFrame, 2000);
        } catch (err) {
            console.error('OCR attempt failed:', err);
            ocrTimerRef.current = setTimeout(runOcrOnFrame, 2000);
        }
    };

    const startScanner = async () => {
        setScanning(true);
        setPhase('barcode');
        setResult(null);
        setStatusText('Point at barcode...');
        hasScannedRef.current = false;
        ocrAttemptRef.current = 0;

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

                            // BEEP for barcode
                            playBeep();
                            setStatusText('Barcode scanned! Now point at label text...');
                            setPhase('label');

                            // Lookup product in background
                            lookupBarcode(code).then(productData => {
                                onScanComplete({
                                    name: productData.name || '',
                                    barcode: code,
                                    baseUnit: productData.baseUnit,
                                    displayUnit: productData.displayUnit,
                                    conversionFactor: productData.conversionFactor,
                                    sku: code,
                                });
                            });

                            // Start OCR scanning from live camera (after 1.5s to let user reposition)
                            ocrTimerRef.current = setTimeout(runOcrOnFrame, 1500);
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
            setPhase('idle');
            setResult({ found: false, error: 'Camera access denied' });
        }
    };

    useEffect(() => {
        return () => stopCamera();
    }, [stopCamera]);

    return (
        <div style={{ marginBottom: '12px' }}>
            {/* Hidden canvas for frame capture */}
            <canvas ref={canvasRef} style={{ display: 'none' }} />

            {/* Scan Button */}
            {phase === 'idle' && !result && (
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
                    border: `2px solid ${phase === 'label' ? '#f59e0b' : '#3b82f6'}`,
                    background: '#000',
                    transition: 'border-color 0.3s',
                }}>
                    <video
                        ref={videoRef}
                        autoPlay
                        playsInline
                        muted
                        style={{ width: '100%', height: '200px', objectFit: 'cover' }}
                    />

                    {/* Scan line */}
                    <div style={{
                        position: 'absolute',
                        top: '30%', left: '10%', right: '10%',
                        height: '2px',
                        background: phase === 'label'
                            ? 'linear-gradient(90deg, transparent, #f59e0b, #f59e0b, transparent)'
                            : 'linear-gradient(90deg, transparent, #ef4444, #ef4444, transparent)',
                        animation: 'scanline 2s ease-in-out infinite',
                        boxShadow: `0 0 8px ${phase === 'label' ? '#f59e0b' : '#ef4444'}`,
                    }} />

                    {/* Scan frame */}
                    <div style={{
                        position: 'absolute',
                        top: '15%', left: '8%', right: '8%', bottom: '25%',
                        border: `2px solid rgba(255,255,255,0.4)`,
                        borderRadius: '8px',
                    }} />

                    {/* Status bar */}
                    <div style={{
                        position: 'absolute', bottom: 0, left: 0, right: 0,
                        padding: '10px',
                        background: 'linear-gradient(transparent, rgba(0,0,0,0.85))',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                    }}>
                        <div style={{
                            width: '8px', height: '8px', borderRadius: '50%',
                            background: phase === 'label' ? '#f59e0b' : '#ef4444',
                            animation: 'pulse 1s ease-in-out infinite',
                        }} />
                        <span style={{ color: '#fff', fontSize: '13px', fontWeight: '500' }}>
                            {statusText}
                        </span>
                    </div>

                    {/* Close */}
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

            {/* Result */}
            {result && !scanning && (
                <div style={{
                    padding: '12px 16px',
                    background: result.found ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)',
                    borderRadius: '12px',
                    display: 'flex', alignItems: 'center', gap: '10px',
                    border: `1px solid ${result.found ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'}`,
                }}>
                    {result.found ? (
                        <>
                            <CheckCircle size={18} style={{ color: '#10b981', flexShrink: 0 }} />
                            <p style={{ color: '#10b981', fontSize: '13px', fontWeight: '500', margin: 0 }}>
                                {result.name}
                            </p>
                        </>
                    ) : (
                        <>
                            <AlertCircle size={18} style={{ color: '#ef4444', flexShrink: 0 }} />
                            <p style={{ color: '#ef4444', fontSize: '13px', fontWeight: '500', margin: 0 }}>
                                {result.error}
                            </p>
                        </>
                    )}
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
