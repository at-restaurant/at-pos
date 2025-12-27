// src/lib/db/indexedDB.ts - FIXED WITH BATCHING
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

                // Waiter Shifts
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

    // ✅ FIX: Batched bulk insert to prevent deadlocks
    async bulkPut(store: string, items: any[]) {
        if (!Array.isArray(items) || items.length === 0) return

        try {
            const db = await this.init()
            const BATCH_SIZE = 100 // ✅ Process 100 items at a time

            for (let i = 0; i < items.length; i += BATCH_SIZE) {
                const batch = items.slice(i, i + BATCH_SIZE)

                await new Promise((resolve, reject) => {
                    const tx = db.transaction(store, 'readwrite')
                    const objectStore = tx.objectStore(store)

                    batch.forEach(item => {
                        try {
                            objectStore.put(item)
                        } catch (err) {
                            console.warn(`Failed to put item:`, err)
                        }
                    })

                    tx.oncomplete = () => resolve(true)
                    tx.onerror = () => reject(tx.error)
                })

                // ✅ Small delay between batches to prevent blocking
                if (i + BATCH_SIZE < items.length) {
                    await new Promise(resolve => setTimeout(resolve, 10))
                }
            }

            console.log(`✅ Bulk inserted ${items.length} items in ${Math.ceil(items.length / BATCH_SIZE)} batches`)
        } catch (error) {
            console.error(`BulkPut failed for ${store}:`, error)
            throw error
        }
    }

    // ✅ NEW: Bulk delete with batching
    async bulkDelete(store: string, keys: string[]) {
        if (!Array.isArray(keys) || keys.length === 0) return

        try {
            const db = await this.init()
            const BATCH_SIZE = 100

            for (let i = 0; i < keys.length; i += BATCH_SIZE) {
                const batch = keys.slice(i, i + BATCH_SIZE)

                await new Promise((resolve, reject) => {
                    const tx = db.transaction(store, 'readwrite')
                    const objectStore = tx.objectStore(store)

                    batch.forEach(key => {
                        try {
                            objectStore.delete(key)
                        } catch (err) {
                            console.warn(`Failed to delete key:`, err)
                        }
                    })

                    tx.oncomplete = () => resolve(true)
                    tx.onerror = () => reject(tx.error)
                })

                if (i + BATCH_SIZE < keys.length) {
                    await new Promise(resolve => setTimeout(resolve, 10))
                }
            }

            console.log(`✅ Bulk deleted ${keys.length} items`)
        } catch (error) {
            console.error(`BulkDelete failed for ${store}:`, error)
            throw error
        }
    }

    // ✅ NEW: Get database size estimate
    async getStorageEstimate() {
        if (!navigator.storage?.estimate) {
            return { usage: 0, quota: 0, percentage: 0 }
        }

        try {
            const estimate = await navigator.storage.estimate()
            const usage = estimate.usage || 0
            const quota = estimate.quota || 0
            const percentage = quota > 0 ? Math.round((usage / quota) * 100) : 0

            return {
                usage: Math.round(usage / 1024 / 1024), // MB
                quota: Math.round(quota / 1024 / 1024), // MB
                percentage
            }
        } catch (error) {
            console.error('Failed to get storage estimate:', error)
            return { usage: 0, quota: 0, percentage: 0 }
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

// ✅ FIX: Proper cleanup on window unload
if (typeof window !== 'undefined') {
    window.addEventListener('beforeunload', () => {
        db.close()
    })

    // ✅ NEW: Periodic cleanup of old data
    setInterval(async () => {
        try {
            const estimate = await db.getStorageEstimate()
            if (estimate.percentage > 80) {
                console.warn('⚠️ Storage usage high:', estimate.percentage + '%')
                // Trigger cleanup if needed
                window.dispatchEvent(new CustomEvent('storage-high', {
                    detail: estimate
                }))
            }
        } catch (error) {
            // Silent fail
        }
    }, 5 * 60 * 1000) // Check every 5 minutes
}