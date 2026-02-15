import { useState, useRef } from 'react';
import { Camera, Loader2, CheckCircle, X } from 'lucide-react';
import { Button } from './ui/Shared';
import { scanProductLabel } from '../utils/ocrParser';

export default function ScanProductButton({ onScanComplete, t }) {
    const [scanning, setScanning] = useState(false);
    const [progress, setProgress] = useState(0);
    const [preview, setPreview] = useState(null);
    const [error, setError] = useState(null);
    const fileInputRef = useRef(null);

    const handleCapture = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Show preview
        const url = URL.createObjectURL(file);
        setPreview(url);
        setScanning(true);
        setProgress(0);
        setError(null);

        try {
            const result = await scanProductLabel(file, setProgress);
            onScanComplete(result);
        } catch (err) {
            console.error('OCR Error:', err);
            setError('Scan failed — please try again or fill manually');
        } finally {
            setScanning(false);
            // Clean up after a moment
            setTimeout(() => {
                setPreview(null);
                setProgress(0);
                URL.revokeObjectURL(url);
            }, 1500);
        }

        // Reset input so same file can be selected again
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const cancelScan = () => {
        setPreview(null);
        setScanning(false);
        setProgress(0);
        setError(null);
    };

    return (
        <div style={{ marginBottom: '16px' }}>
            {/* Hidden file input */}
            <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handleCapture}
                style={{ display: 'none' }}
            />

            {/* Main scan button */}
            {!scanning && !preview && (
                <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    style={{
                        width: '100%',
                        padding: '12px 16px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '8px',
                        background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
                        color: '#fff',
                        border: 'none',
                        borderRadius: '10px',
                        fontSize: '15px',
                        fontWeight: '600',
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                        boxShadow: '0 2px 12px rgba(59,130,246,0.3)',
                    }}
                >
                    <Camera size={20} />
                    📷 Scan Product Label
                </button>
            )}

            {/* Preview + Progress */}
            {(scanning || preview) && (
                <div style={{
                    position: 'relative',
                    borderRadius: '10px',
                    overflow: 'hidden',
                    border: '1px solid rgba(255,255,255,0.1)',
                    background: '#18181b',
                }}>
                    {preview && (
                        <img
                            src={preview}
                            alt="Captured label"
                            style={{
                                width: '100%',
                                maxHeight: '150px',
                                objectFit: 'cover',
                                opacity: scanning ? 0.6 : 1,
                            }}
                        />
                    )}

                    {/* Cancel button */}
                    {!scanning && (
                        <button
                            onClick={cancelScan}
                            style={{
                                position: 'absolute', top: '6px', right: '6px',
                                background: 'rgba(0,0,0,0.6)', border: 'none',
                                borderRadius: '50%', width: '28px', height: '28px',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                cursor: 'pointer', color: '#fff',
                            }}
                        >
                            <X size={16} />
                        </button>
                    )}

                    {/* Progress overlay */}
                    {scanning && (
                        <div style={{
                            position: 'absolute', inset: 0,
                            display: 'flex', flexDirection: 'column',
                            alignItems: 'center', justifyContent: 'center',
                            background: 'rgba(0,0,0,0.5)',
                        }}>
                            <Loader2 size={28} style={{ color: '#3b82f6', animation: 'spin 1s linear infinite' }} />
                            <p style={{ color: '#fff', fontSize: '13px', marginTop: '8px', fontWeight: '500' }}>
                                Scanning... {progress}%
                            </p>
                            {/* Progress bar */}
                            <div style={{
                                width: '60%', height: '4px', borderRadius: '2px',
                                background: 'rgba(255,255,255,0.2)', marginTop: '6px',
                            }}>
                                <div style={{
                                    width: `${progress}%`, height: '100%', borderRadius: '2px',
                                    background: 'linear-gradient(90deg, #3b82f6, #8b5cf6)',
                                    transition: 'width 0.3s',
                                }} />
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Error message */}
            {error && (
                <p style={{ color: '#ef4444', fontSize: '13px', marginTop: '8px', textAlign: 'center' }}>
                    {error}
                </p>
            )}

            {/* Keyframes for spinner */}
            <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
        </div>
    );
}
