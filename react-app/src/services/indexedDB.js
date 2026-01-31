/**
 * IndexedDB Service for Offline Mode
 * Provides local storage for inventory, sales, and pending operations
 */

const DB_NAME = 'trackeezy_db';
const DB_VERSION = 1;

// Store names
const STORES = {
    INVENTORY: 'inventory',
    SALES: 'sales',
    CUSTOMERS: 'customers',
    PENDING_SYNC: 'pending_sync',
    APP_STATE: 'app_state'
};

class IndexedDBService {
    constructor() {
        this.db = null;
        this.isInitialized = false;
    }

    /**
     * Initialize the database
     */
    async init() {
        if (this.isInitialized) return this.db;

        return new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, DB_VERSION);

            request.onerror = () => {
                console.error('IndexedDB error:', request.error);
                reject(request.error);
            };

            request.onsuccess = () => {
                this.db = request.result;
                this.isInitialized = true;
                console.log('IndexedDB initialized successfully');
                resolve(this.db);
            };

            request.onupgradeneeded = (event) => {
                const db = event.target.result;

                // Inventory store
                if (!db.objectStoreNames.contains(STORES.INVENTORY)) {
                    const inventoryStore = db.createObjectStore(STORES.INVENTORY, { keyPath: 'id', autoIncrement: true });
                    inventoryStore.createIndex('name', 'name', { unique: false });
                    inventoryStore.createIndex('sku', 'sku', { unique: false });
                }

                // Sales store
                if (!db.objectStoreNames.contains(STORES.SALES)) {
                    const salesStore = db.createObjectStore(STORES.SALES, { keyPath: 'id', autoIncrement: true });
                    salesStore.createIndex('date', 'date', { unique: false });
                }

                // Customers store
                if (!db.objectStoreNames.contains(STORES.CUSTOMERS)) {
                    const customersStore = db.createObjectStore(STORES.CUSTOMERS, { keyPath: 'id', autoIncrement: true });
                    customersStore.createIndex('name', 'name', { unique: false });
                }

                // Pending sync operations
                if (!db.objectStoreNames.contains(STORES.PENDING_SYNC)) {
                    const syncStore = db.createObjectStore(STORES.PENDING_SYNC, { keyPath: 'id', autoIncrement: true });
                    syncStore.createIndex('type', 'type', { unique: false });
                    syncStore.createIndex('timestamp', 'timestamp', { unique: false });
                }

                // App state (for caching misc data)
                if (!db.objectStoreNames.contains(STORES.APP_STATE)) {
                    db.createObjectStore(STORES.APP_STATE, { keyPath: 'key' });
                }

                console.log('IndexedDB stores created');
            };
        });
    }

    /**
     * Get all items from a store
     */
    async getAll(storeName) {
        await this.init();
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(storeName, 'readonly');
            const store = transaction.objectStore(storeName);
            const request = store.getAll();

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Add an item to a store
     */
    async add(storeName, item) {
        await this.init();
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(storeName, 'readwrite');
            const store = transaction.objectStore(storeName);
            const request = store.add(item);

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Update an item in a store
     */
    async put(storeName, item) {
        await this.init();
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(storeName, 'readwrite');
            const store = transaction.objectStore(storeName);
            const request = store.put(item);

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Delete an item from a store
     */
    async delete(storeName, id) {
        await this.init();
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(storeName, 'readwrite');
            const store = transaction.objectStore(storeName);
            const request = store.delete(id);

            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Clear all items in a store
     */
    async clear(storeName) {
        await this.init();
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(storeName, 'readwrite');
            const store = transaction.objectStore(storeName);
            const request = store.clear();

            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    // ==========================================
    // INVENTORY OPERATIONS
    // ==========================================

    async saveInventory(items) {
        await this.clear(STORES.INVENTORY);
        for (const item of items) {
            await this.add(STORES.INVENTORY, item);
        }
        // Save timestamp
        await this.put(STORES.APP_STATE, {
            key: 'inventory_last_sync',
            value: new Date().toISOString()
        });
    }

    async getInventory() {
        return this.getAll(STORES.INVENTORY);
    }

    async getInventoryLastSync() {
        await this.init();
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(STORES.APP_STATE, 'readonly');
            const store = transaction.objectStore(STORES.APP_STATE);
            const request = store.get('inventory_last_sync');

            request.onsuccess = () => resolve(request.result?.value || null);
            request.onerror = () => reject(request.error);
        });
    }

    // ==========================================
    // PENDING SYNC OPERATIONS
    // ==========================================

    /**
     * Add operation to sync queue (for offline changes)
     */
    async addPendingOperation(operation) {
        const pendingOp = {
            ...operation,
            timestamp: new Date().toISOString(),
            status: 'pending'
        };
        return this.add(STORES.PENDING_SYNC, pendingOp);
    }

    async getPendingOperations() {
        return this.getAll(STORES.PENDING_SYNC);
    }

    async clearPendingOperation(id) {
        return this.delete(STORES.PENDING_SYNC, id);
    }

    async clearAllPendingOperations() {
        return this.clear(STORES.PENDING_SYNC);
    }

    // ==========================================
    // CUSTOMERS OPERATIONS
    // ==========================================

    async saveCustomers(customers) {
        await this.clear(STORES.CUSTOMERS);
        for (const customer of customers) {
            await this.add(STORES.CUSTOMERS, customer);
        }
    }

    async getCustomers() {
        return this.getAll(STORES.CUSTOMERS);
    }

    // ==========================================
    // APP STATE
    // ==========================================

    async saveAppState(key, value) {
        return this.put(STORES.APP_STATE, { key, value });
    }

    async getAppState(key) {
        await this.init();
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(STORES.APP_STATE, 'readonly');
            const store = transaction.objectStore(STORES.APP_STATE);
            const request = store.get(key);

            request.onsuccess = () => resolve(request.result?.value || null);
            request.onerror = () => reject(request.error);
        });
    }
}

// Export singleton instance
export const indexedDBService = new IndexedDBService();
export const STORE_NAMES = STORES;
