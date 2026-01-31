import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { indexedDBService } from '../services/indexedDB';

const OfflineContext = createContext();

export function OfflineProvider({ children }) {
    const [isOnline, setIsOnline] = useState(navigator.onLine);
    const [pendingCount, setPendingCount] = useState(0);
    const [lastSync, setLastSync] = useState(null);
    const [swRegistration, setSwRegistration] = useState(null);

    // Initialize IndexedDB and register SW
    useEffect(() => {
        const init = async () => {
            try {
                await indexedDBService.init();
                const syncTime = await indexedDBService.getInventoryLastSync();
                setLastSync(syncTime);
                await updatePendingCount();
            } catch (error) {
                console.error('Offline init error:', error);
            }
        };
        init();

        // Register service worker
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register('/sw.js')
                .then((registration) => {
                    console.log('SW registered:', registration);
                    setSwRegistration(registration);
                })
                .catch((error) => {
                    console.error('SW registration failed:', error);
                });

            // Listen for SW messages
            navigator.serviceWorker.addEventListener('message', (event) => {
                if (event.data?.type === 'SYNC_REQUESTED') {
                    // Trigger sync from App
                    window.dispatchEvent(new CustomEvent('sync-pending'));
                }
            });
        }

        // Online/Offline listeners
        const handleOnline = () => {
            setIsOnline(true);
            // Trigger sync when coming online
            window.dispatchEvent(new CustomEvent('sync-pending'));
        };
        const handleOffline = () => setIsOnline(false);

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, []);

    const updatePendingCount = async () => {
        try {
            const pending = await indexedDBService.getPendingOperations();
            setPendingCount(pending.length);
        } catch (error) {
            console.error('Error getting pending count:', error);
        }
    };

    // Cache inventory locally
    const cacheInventory = useCallback(async (inventory) => {
        try {
            await indexedDBService.saveInventory(inventory);
            setLastSync(new Date().toISOString());
            console.log('Inventory cached:', inventory.length, 'items');
        } catch (error) {
            console.error('Error caching inventory:', error);
        }
    }, []);

    // Get cached inventory
    const getCachedInventory = useCallback(async () => {
        try {
            return await indexedDBService.getInventory();
        } catch (error) {
            console.error('Error getting cached inventory:', error);
            return [];
        }
    }, []);

    // Queue an operation for sync
    const queueOperation = useCallback(async (operation) => {
        try {
            await indexedDBService.addPendingOperation(operation);
            await updatePendingCount();
            console.log('Operation queued:', operation.type);
        } catch (error) {
            console.error('Error queuing operation:', error);
        }
    }, []);

    // Process pending operations
    const syncPendingOperations = useCallback(async (syncFn) => {
        if (!isOnline) return { success: 0, failed: 0 };

        try {
            const pending = await indexedDBService.getPendingOperations();
            let success = 0;
            let failed = 0;

            for (const op of pending) {
                try {
                    await syncFn(op);
                    await indexedDBService.clearPendingOperation(op.id);
                    success++;
                } catch (error) {
                    console.error('Sync failed for operation:', op, error);
                    failed++;
                }
            }

            await updatePendingCount();
            return { success, failed };
        } catch (error) {
            console.error('Error syncing operations:', error);
            return { success: 0, failed: 0 };
        }
    }, [isOnline]);

    // Request background sync (if supported)
    const requestBackgroundSync = useCallback(async () => {
        if (swRegistration && 'sync' in swRegistration) {
            try {
                await swRegistration.sync.register('sync-pending-operations');
                console.log('Background sync registered');
            } catch (error) {
                console.error('Background sync registration failed:', error);
            }
        }
    }, [swRegistration]);

    const value = {
        isOnline,
        pendingCount,
        lastSync,
        cacheInventory,
        getCachedInventory,
        queueOperation,
        syncPendingOperations,
        requestBackgroundSync
    };

    return (
        <OfflineContext.Provider value={value}>
            {children}
        </OfflineContext.Provider>
    );
}

export function useOffline() {
    const context = useContext(OfflineContext);
    if (!context) {
        throw new Error('useOffline must be used within an OfflineProvider');
    }
    return context;
}
