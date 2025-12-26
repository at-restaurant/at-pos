// src/lib/db/offlineManager.ts - PRODUCTION CLEAN VERSION
import { createClient } from '@/lib/supabase/client'
import { db } from './indexedDB'
import { STORES } from './schema'

const dispatchSyncEvent = (type: string, detail: any) => {
    if (typeof window === 'undefined') return
    window.dispatchEvent(new CustomEvent(type, { detail }))
}

interface DownloadResult {
    success: boolean
    message?: string
    counts?: { categories: number; items: number; tables: number; waiters: number }
    error?: string
}

class OfflineManager {
    private isDownloading = false
    private syncInProgress = false
    private autoCleanupInterval: NodeJS.Timeout | null = null

    constructor() {
        if (typeof window !== 'undefined') {
            this.initAutoCleanup()
            this.initAutoSync()
        }
    }

    private initAutoCleanup() {
        this.cleanupOldData()
        this.autoCleanupInterval = setInterval(() => {
            this.cleanupOldData()
        }, 24 * 60 * 60 * 1000)
    }

    private initAutoSync() {
        if (typeof navigator !== 'undefined' && navigator.onLine) {
            this.downloadEssentialData()
        }

        window.addEventListener('online', () => {
            this.downloadEssentialData(true)
            this.syncPendingOrders()
        })

        setInterval(() => {
            if (typeof navigator !== 'undefined' && navigator.onLine) {
                this.downloadEssentialData()
            }
        }, 15 * 60 * 1000)
    }

    async downloadEssentialData(force = false): Promise<DownloadResult> {
        if (this.isDownloading) {
            return { success: false, message: 'Already downloading...' }
        }

        const lastSync = localStorage.getItem('menu_last_sync')
        const oneHour = 60 * 60 * 1000

        if (!force && lastSync && Date.now() - parseInt(lastSync) < oneHour) {
            return { success: true, message: 'Menu is fresh' }
        }

        this.isDownloading = true
        const supabase = createClient()

        try {
            dispatchSyncEvent('sync-start', {
                direction: 'download',
                total: 4,
                message: 'Downloading menu data...'
            })

            const [categoriesResult, itemsResult, tablesResult, waitersResult] =
                await Promise.allSettled([
                    supabase
                        .from('menu_categories')
                        .select('*')
                        .eq('is_active', true)
                        .order('display_order'),
                    supabase
                        .from('menu_items')
                        .select('*')
                        .eq('is_available', true)
                        .order('name'),
                    supabase
                        .from('restaurant_tables')
                        .select('*')
                        .order('table_number'),
                    supabase
                        .from('waiters')
                        .select('*')
                        .eq('is_active', true)
                        .order('name')
                ])

            const categoriesData =
                categoriesResult.status === 'fulfilled' &&
                Array.isArray(categoriesResult.value.data)
                    ? categoriesResult.value.data
                    : []

            const itemsData =
                itemsResult.status === 'fulfilled' &&
                Array.isArray(itemsResult.value.data)
                    ? itemsResult.value.data
                    : []

            const tablesData =
                tablesResult.status === 'fulfilled' &&
                Array.isArray(tablesResult.value.data)
                    ? tablesResult.value.data
                    : []

            const waitersData =
                waitersResult.status === 'fulfilled' &&
                Array.isArray(waitersResult.value.data)
                    ? waitersResult.value.data
                    : []

            let progress = 0
            const updateProgress = (current: number) => {
                progress = Math.round((current / 4) * 100)
                dispatchSyncEvent('sync-progress', {
                    progress,
                    current,
                    total: 4,
                    message: `Downloaded ${current}/4 datasets...`
                })
            }

            if (categoriesData.length > 0) {
                await db.clear(STORES.MENU_CATEGORIES)
                await db.bulkPut(STORES.MENU_CATEGORIES, categoriesData)
                await db.put(STORES.SETTINGS, {
                    key: 'categories_version',
                    value: Date.now()
                })
                updateProgress(1)
            }

            if (itemsData.length > 0) {
                await db.clear(STORES.MENU_ITEMS)
                await db.bulkPut(STORES.MENU_ITEMS, itemsData)
                await db.put(STORES.SETTINGS, {
                    key: 'menu_version',
                    value: Date.now()
                })
                updateProgress(2)
            }

            if (tablesData.length > 0) {
                await db.put(STORES.SETTINGS, {
                    key: 'restaurant_tables',
                    value: tablesData
                })
                updateProgress(3)
            }

            if (waitersData.length > 0) {
                await db.put(STORES.SETTINGS, {
                    key: 'waiters',
                    value: waitersData
                })
                updateProgress(4)
            }

            const imageUrls = itemsData
                .map(i => i.image_url)
                .filter(Boolean)
                .slice(0, 30)

            if (imageUrls.length > 0 && navigator.serviceWorker?.controller) {
                navigator.serviceWorker.controller.postMessage({
                    type: 'CACHE_IMAGES',
                    urls: imageUrls
                })
            }

            localStorage.setItem('menu_last_sync', Date.now().toString())
            localStorage.setItem('offline_ready', 'true')

            dispatchSyncEvent('sync-complete', {
                categories: categoriesData.length,
                items: itemsData.length,
                tables: tablesData.length,
                waiters: waitersData.length
            })

            return {
                success: true,
                counts: {
                    categories: categoriesData.length,
                    items: itemsData.length,
                    tables: tablesData.length,
                    waiters: waitersData.length
                }
            }
        } catch (error: any) {
            dispatchSyncEvent('sync-error', { error: error.message })
            return { success: false, error: error.message }
        } finally {
            this.isDownloading = false
        }
    }

    async cleanupOldData(): Promise<number> {
        try {
            const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000
            const ordersData = await db.getAll(STORES.ORDERS)

            if (!Array.isArray(ordersData) || ordersData.length === 0) {
                return 0
            }

            const orders = ordersData as Array<{
                id: string
                created_at: string
                status: string
            }>

            const oldOrders = orders.filter(o => {
                const orderTime = new Date(o.created_at).getTime()
                return orderTime < sevenDaysAgo && o.status === 'completed'
            })

            const sortedOrders = orders
                .filter(o => o.status === 'completed')
                .sort(
                    (a, b) =>
                        new Date(b.created_at).getTime() -
                        new Date(a.created_at).getTime()
                )

            const ordersToDelete = sortedOrders.slice(200)
            const allDeletes = [...new Set([...oldOrders, ...ordersToDelete])]

            for (const order of allDeletes) {
                await db.delete(STORES.ORDERS, order.id)

                const itemsData = await db.getAll(STORES.ORDER_ITEMS)
                if (Array.isArray(itemsData)) {
                    const items = itemsData as Array<{ id: string; order_id: string }>
                    const orderItems = items.filter(i => i.order_id === order.id)
                    for (const item of orderItems) {
                        await db.delete(STORES.ORDER_ITEMS, item.id)
                    }
                }
            }

            return allDeletes.length
        } catch (error) {
            return 0
        }
    }

    async syncPendingOrders(): Promise<{ success: boolean; synced: number }> {
        if (
            this.syncInProgress ||
            typeof navigator === 'undefined' ||
            !navigator.onLine
        ) {
            return { success: false, synced: 0 }
        }

        this.syncInProgress = true
        let syncedCount = 0

        try {
            const ordersData = await db.getAll(STORES.ORDERS)

            if (!Array.isArray(ordersData)) {
                return { success: false, synced: 0 }
            }

            const orders = ordersData as Array<any>
            const pendingOrders = orders.filter(o => !o.synced)

            if (pendingOrders.length > 0) {
                dispatchSyncEvent('sync-start', {
                    direction: 'upload',
                    total: pendingOrders.length,
                    message: 'Uploading pending orders...'
                })
            }

            const supabase = createClient()

            for (let i = 0; i < pendingOrders.length; i++) {
                const order = pendingOrders[i]
                try {
                    const { error } = await supabase.from('orders').insert(order)

                    if (!error) {
                        await db.put(STORES.ORDERS, { ...order, synced: true })
                        syncedCount++

                        const progress = Math.round(
                            ((i + 1) / pendingOrders.length) * 100
                        )
                        dispatchSyncEvent('sync-progress', {
                            progress,
                            current: i + 1,
                            total: pendingOrders.length,
                            message: `Uploaded ${i + 1}/${pendingOrders.length} orders`
                        })
                    }
                } catch (err) {
                    // Silent fail for production
                }
            }

            if (pendingOrders.length > 0) {
                dispatchSyncEvent('sync-complete', { synced: syncedCount })
            }

            return { success: true, synced: syncedCount }
        } catch (error) {
            dispatchSyncEvent('sync-error', { error: 'Failed to sync orders' })
            return { success: false, synced: syncedCount }
        } finally {
            this.syncInProgress = false
        }
    }

    async getOfflineData(store: string): Promise<any[]> {
        try {
            if (store === 'restaurant_tables' || store === 'waiters') {
                const data = await db.get(STORES.SETTINGS, store)
                if (data && typeof data === 'object' && 'value' in data) {
                    const value = (data as any).value
                    return Array.isArray(value) ? value : []
                }
                return []
            }

            const data = await db.getAll(store)
            return Array.isArray(data) ? data : []
        } catch (error) {
            return []
        }
    }

    async isOfflineReady(): Promise<boolean> {
        const ready = localStorage.getItem('offline_ready') === 'true'
        if (!ready) return false

        const [categories, items] = await Promise.all([
            db.getAll(STORES.MENU_CATEGORIES),
            db.getAll(STORES.MENU_ITEMS)
        ])

        return (
            Array.isArray(categories) &&
            categories.length > 0 &&
            Array.isArray(items) &&
            items.length > 0
        )
    }

    async clearAllData(includeMenu = false): Promise<void> {
        const storesToClear = [
            STORES.ORDERS,
            STORES.ORDER_ITEMS,
            STORES.CART,
            STORES.SYNC_QUEUE
        ]

        if (includeMenu) {
            storesToClear.push(STORES.MENU_ITEMS, STORES.MENU_CATEGORIES)
            localStorage.removeItem('offline_ready')
        }

        await Promise.all(storesToClear.map(store => db.clear(store)))
    }

    async getStorageInfo() {
        try {
            const [categoriesData, itemsData, ordersData] = await Promise.all([
                db.getAll(STORES.MENU_CATEGORIES),
                db.getAll(STORES.MENU_ITEMS),
                db.getAll(STORES.ORDERS)
            ])

            // Explicitly type the arrays
            const categories = Array.isArray(categoriesData) ? categoriesData : []
            const items = Array.isArray(itemsData) ? itemsData : []
            const orders = Array.isArray(ordersData) ? ordersData : []

            const menuSize = items.length * 2
            const ordersSize = orders.length * 5
            const imagesSize = items.filter((i: any) => i.image_url).length * 100

            let used = 0
            let limit = 0

            if (navigator.storage?.estimate) {
                const estimate = await navigator.storage.estimate()
                used = Math.round((estimate.usage || 0) / 1024 / 1024)
                limit = Math.round((estimate.quota || 0) / 1024 / 1024)
            }

            return {
                used,
                limit,
                percentage: limit > 0 ? Math.round((used / limit) * 100) : 0,
                hasData: categories.length > 0 && items.length > 0,
                ordersCount: orders.length,
                menuItemsCount: items.length,
                breakdown: {
                    menu: menuSize,
                    orders: ordersSize,
                    images: imagesSize,
                    total: menuSize + ordersSize + imagesSize
                }
            }
        } catch (error) {
            return {
                used: 0,
                limit: 0,
                percentage: 0,
                hasData: false,
                ordersCount: 0,
                menuItemsCount: 0,
                breakdown: { menu: 0, orders: 0, images: 0, total: 0 }
            }
        }
    }

    destroy() {
        if (this.autoCleanupInterval) {
            clearInterval(this.autoCleanupInterval)
        }
    }
}

export const offlineManager = new OfflineManager()