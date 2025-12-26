// src/lib/db/indexedDB.ts - FIXED WITH WAITER_SHIFTS
import { DB_NAME, DB_VERSION, STORES } from './schema'

class IndexedDBManager {
    private db: IDBDatabase | null = null
    private initPromise: Promise<IDBDatabase> | null = null
    private isInitializing = false

    async init(): Promise<IDBDatabase> {
        if (this.db && !this.isInitializing) {
            return this.db
        }

        if (this.initPromise) {
            return this.initPromise
        }

        this.isInitializing = true

        this.initPromise = new Promise<IDBDatabase>((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, DB_VERSION)

            request.onerror = () => {
                this.isInitializing = false
                this.initPromise = null
                reject(request.error)
            }

            request.onsuccess = () => {
                this.db = request.result
                this.isInitializing = false

                this.db.onclose = () => {
                    console.warn('⚠️ IndexedDB closed unexpectedly')
                    this.db = null
                    this.initPromise = null
                }

                resolve(this.db)
            }

            request.onupgradeneeded = (event) => {
                const db = (event.target as IDBOpenDBRequest).result

                // Menu Items
                if (!db.objectStoreNames.contains(STORES.MENU_ITEMS)) {
                    const store = db.createObjectStore(STORES.MENU_ITEMS, { keyPath: 'id' })
                    store.createIndex('category_id', 'category_id')
                }

                // Menu Categories
                if (!db.objectStoreNames.contains(STORES.MENU_CATEGORIES)) {
                    db.createObjectStore(STORES.MENU_CATEGORIES, { keyPath: 'id' })
                }

                // Orders
                if (!db.objectStoreNames.contains(STORES.ORDERS)) {
                    const store = db.createObjectStore(STORES.ORDERS, { keyPath: 'id' })
                    store.createIndex('synced', 'synced')
                    store.createIndex('created_at', 'created_at')
                }

                // Order Items
                if (!db.objectStoreNames.contains(STORES.ORDER_ITEMS)) {
                    const store = db.createObjectStore(STORES.ORDER_ITEMS, { keyPath: 'id' })
                    store.createIndex('order_id', 'order_id')
                }

                // ✅ NEW: Waiter Shifts
                if (!db.objectStoreNames.contains(STORES.WAITER_SHIFTS)) {
                    const store = db.createObjectStore(STORES.WAITER_SHIFTS, { keyPath: 'id' })
                    store.createIndex('waiter_id', 'waiter_id')
                    store.createIndex('synced', 'synced')
                    store.createIndex('created_at', 'created_at')
                }

                // Sync Queue
                if (!db.objectStoreNames.contains(STORES.SYNC_QUEUE)) {
                    const store = db.createObjectStore(STORES.SYNC_QUEUE, { keyPath: 'id' })
                    store.createIndex('status', 'status')
                }

                // Cart
                if (!db.objectStoreNames.contains(STORES.CART)) {
                    db.createObjectStore(STORES.CART, { keyPath: 'id' })
                }

                // Settings
                if (!db.objectStoreNames.contains(STORES.SETTINGS)) {
                    db.createObjectStore(STORES.SETTINGS, { keyPath: 'key' })
                }
            }
        })

        return this.initPromise
    }

    async get(store: string, key: string) {
        try {
            const db = await this.init()
            return new Promise((resolve, reject) => {
                const tx = db.transaction(store, 'readonly')
                const request = tx.objectStore(store).get(key)
                request.onsuccess = () => resolve(request.result)
                request.onerror = () => reject(request.error)
            })
        } catch (error) {
            console.error(`Get failed for ${store}:`, error)
            return null
        }
    }

    async getAll(store: string) {
        try {
            const db = await this.init()
            return new Promise((resolve, reject) => {
                const tx = db.transaction(store, 'readonly')
                const request = tx.objectStore(store).getAll()
                request.onsuccess = () => resolve(request.result || [])
                request.onerror = () => reject(request.error)
            })
        } catch (error) {
            console.error(`GetAll failed for ${store}:`, error)
            return []
        }
    }

    async put(store: string, data: any) {
        try {
            const db = await this.init()
            return new Promise((resolve, reject) => {
                const tx = db.transaction(store, 'readwrite')
                const request = tx.objectStore(store).put(data)
                request.onsuccess = () => resolve(request.result)
                request.onerror = () => reject(request.error)
            })
        } catch (error) {
            console.error(`Put failed for ${store}:`, error)
            throw error
        }
    }

    async delete(store: string, key: string) {
        try {
            const db = await this.init()
            return new Promise((resolve, reject) => {
                const tx = db.transaction(store, 'readwrite')
                const request = tx.objectStore(store).delete(key)
                request.onsuccess = () => resolve(request.result)
                request.onerror = () => reject(request.error)
            })
        } catch (error) {
            console.error(`Delete failed for ${store}:`, error)
            throw error
        }
    }

    async clear(store: string) {
        try {
            const db = await this.init()
            return new Promise((resolve, reject) => {
                const tx = db.transaction(store, 'readwrite')
                const request = tx.objectStore(store).clear()
                request.onsuccess = () => resolve(request.result)
                request.onerror = () => reject(request.error)
            })
        } catch (error) {
            console.error(`Clear failed for ${store}:`, error)
            throw error
        }
    }

    async bulkPut(store: string, items: any[]) {
        if (!Array.isArray(items) || items.length === 0) return

        try {
            const db = await this.init()
            return new Promise((resolve, reject) => {
                const tx = db.transaction(store, 'readwrite')
                const objectStore = tx.objectStore(store)

                items.forEach(item => {
                    try {
                        objectStore.put(item)
                    } catch (err) {
                        console.warn(`Failed to put item:`, err)
                    }
                })

                tx.oncomplete = () => resolve(true)
                tx.onerror = () => reject(tx.error)
            })
        } catch (error) {
            console.error(`BulkPut failed for ${store}:`, error)
            throw error
        }
    }

    close() {
        if (this.db) {
            this.db.close()
            this.db = null
            this.initPromise = null
        }
    }
}

export const db = new IndexedDBManager()

if (typeof window !== 'undefined') {
    window.addEventListener('beforeunload', () => {
        db.close()
    })
}