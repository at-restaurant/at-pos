// src/lib/db/offlineManager.ts - COMPLETE OFFLINE MANAGER
import { createClient } from '@/lib/supabase/client'
import { db } from './indexedDB'
import { STORES } from './schema'
import { imageCompressor } from './imageCompressor'

const dispatchSyncEvent = (type: string, detail: any) => {
    if (typeof window === 'undefined') return
    window.dispatchEvent(new CustomEvent(type, { detail }))
}

class OfflineManager {
    private isDownloading = false
    private syncInProgress = false
    private autoSyncInterval: NodeJS.Timeout | null = null

    constructor() {
        if (typeof window !== 'undefined') {
            this.initAutoSync()
        }
    }

    // ✅ Auto-sync every 5 minutes when online
    private initAutoSync() {
        if (navigator.onLine) {
            this.downloadEssentialData()
        }

        window.addEventListener('online', () => {
            this.downloadEssentialData(true)
            this.syncPendingOrders()
        })

        this.autoSyncInterval = setInterval(() => {
            if (navigator.onLine) {
                this.downloadEssentialData()
                this.syncPendingOrders()
            }
        }, 5 * 60 * 1000) // 5 minutes
    }

    // ✅ Check if offline data exists
    async isOfflineReady(): Promise<boolean> {
        try {
            const [categories, items] = await Promise.all([
                db.getAll(STORES.MENU_CATEGORIES),
                db.getAll(STORES.MENU_ITEMS)
            ])

            return (
                Array.isArray(categories) && categories.length > 0 &&
                Array.isArray(items) && items.length > 0
            )
        } catch (error) {
            return false
        }
    }

    // ✅ Download essential data with image compression
    async downloadEssentialData(force = false): Promise<{ success: boolean; counts?: any }> {
        if (this.isDownloading) {
            return { success: false }
        }

        const lastSync = localStorage.getItem('menu_last_sync')
        const oneHour = 60 * 60 * 1000

        if (!force && lastSync && Date.now() - parseInt(lastSync) < oneHour) {
            return { success: true }
        }

        this.isDownloading = true
        const supabase = createClient()

        try {
            dispatchSyncEvent('sync-start', {
                direction: 'download',
                total: 4,
                message: 'Downloading menu data...'
            })

            // ✅ Fetch all data
            const [categoriesResult, itemsResult, tablesResult, waitersResult] = await Promise.allSettled([
                supabase.from('menu_categories').select('*').eq('is_active', true).order('display_order'),
                supabase.from('menu_items').select('*').eq('is_available', true).order('name'),
                supabase.from('restaurant_tables').select('*').order('table_number'),
                supabase.from('waiters').select('*').eq('is_active', true).order('name')
            ])

            const categoriesData = categoriesResult.status === 'fulfilled' && Array.isArray(categoriesResult.value.data)
                ? categoriesResult.value.data : []
            const itemsData = itemsResult.status === 'fulfilled' && Array.isArray(itemsResult.value.data)
                ? itemsResult.value.data : []
            const tablesData = tablesResult.status === 'fulfilled' && Array.isArray(tablesResult.value.data)
                ? tablesResult.value.data : []
            const waitersData = waitersResult.status === 'fulfilled' && Array.isArray(waitersResult.value.data)
                ? waitersResult.value.data : []

            // ✅ Save categories
            if (categoriesData.length > 0) {
                await db.clear(STORES.MENU_CATEGORIES)
                await db.bulkPut(STORES.MENU_CATEGORIES, categoriesData)
                dispatchSyncEvent('sync-progress', {
                    progress: 25,
                    current: 1,
                    total: 4,
                    message: 'Saved categories...'
                })
            }

            // ✅ Compress and save menu items with images
            if (itemsData.length > 0) {
                await db.clear(STORES.MENU_ITEMS)

                const compressedItems = await Promise.all(
                    itemsData.map(async (item) => {
                        if (item.image_url && !item.image_url.startsWith('data:')) {
                            try {
                                const compressed = await imageCompressor.compressImage(item.image_url)
                                return {
                                    ...item,
                                    image_url_original: item.image_url, // Keep original for online mode
                                    image_url: compressed || item.image_url // Use compressed for offline
                                }
                            } catch (error) {
                                return item
                            }
                        }
                        return item
                    })
                )

                await db.bulkPut(STORES.MENU_ITEMS, compressedItems)

                dispatchSyncEvent('sync-progress', {
                    progress: 50,
                    current: 2,
                    total: 4,
                    message: `Compressed ${compressedItems.length} menu items...`
                })
            }

            // ✅ Save tables and waiters
            if (tablesData.length > 0) {
                await db.put(STORES.SETTINGS, {
                    key: 'restaurant_tables',
                    value: tablesData
                })
                dispatchSyncEvent('sync-progress', {
                    progress: 75,
                    current: 3,
                    total: 4,
                    message: 'Saved tables...'
                })
            }

            if (waitersData.length > 0) {
                await db.put(STORES.SETTINGS, {
                    key: 'waiters',
                    value: waitersData
                })
                dispatchSyncEvent('sync-progress', {
                    progress: 100,
                    current: 4,
                    total: 4,
                    message: 'Saved waiters...'
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
            return { success: false }
        } finally {
            this.isDownloading = false
        }
    }

    // ✅ Sync pending orders to server
    async syncPendingOrders(): Promise<{ success: boolean; synced: number }> {
        if (this.syncInProgress || !navigator.onLine) {
            return { success: false, synced: 0 }
        }

        this.syncInProgress = true
        let syncedCount = 0

        try {
            const ordersData = await db.getAll(STORES.ORDERS)
            if (!Array.isArray(ordersData)) {
                return { success: false, synced: 0 }
            }

            const pendingOrders = ordersData.filter(o => !o.synced && o.id.startsWith('offline_'))

            if (pendingOrders.length === 0) {
                return { success: true, synced: 0 }
            }

            dispatchSyncEvent('sync-start', {
                direction: 'upload',
                total: pendingOrders.length,
                message: 'Syncing orders...'
            })

            const supabase = createClient()

            for (let i = 0; i < pendingOrders.length; i++) {
                const order = pendingOrders[i]
                try {
                    // Create order on server
                    const { data: newOrder, error: orderError } = await supabase
                        .from('orders')
                        .insert({
                            waiter_id: order.waiter_id,
                            table_id: order.table_id,
                            status: order.status,
                            subtotal: order.subtotal,
                            tax: order.tax,
                            total_amount: order.total_amount,
                            order_type: order.order_type,
                            payment_method: order.payment_method,
                            notes: order.notes,
                            customer_name: order.customer_name,
                            customer_phone: order.customer_phone,
                            delivery_address: order.delivery_address,
                            delivery_charges: order.delivery_charges,
                            receipt_printed: order.receipt_printed || false,
                            created_at: order.created_at
                        })
                        .select()
                        .single()

                    if (orderError) throw orderError

                    // Get order items
                    const orderItems = await db.getAll(STORES.ORDER_ITEMS) as any[]
                    const items = orderItems.filter(i => i.order_id === order.id)

                    // Insert order items
                    if (items.length > 0) {
                        const itemsToInsert = items.map(item => ({
                            order_id: newOrder.id,
                            menu_item_id: item.menu_item_id,
                            quantity: item.quantity,
                            unit_price: item.unit_price,
                            total_price: item.total_price
                        }))

                        await supabase.from('order_items').insert(itemsToInsert)

                        // Delete synced items from IndexedDB
                        for (const item of items) {
                            await db.delete(STORES.ORDER_ITEMS, item.id)
                        }
                    }

                    // Update table if dine-in
                    if (order.order_type === 'dine-in' && order.table_id) {
                        await supabase
                            .from('restaurant_tables')
                            .update({
                                status: 'occupied',
                                waiter_id: order.waiter_id,
                                current_order_id: newOrder.id
                            })
                            .eq('id', order.table_id)
                    }

                    // Delete synced order
                    await db.delete(STORES.ORDERS, order.id)
                    syncedCount++

                    dispatchSyncEvent('sync-progress', {
                        progress: Math.round(((i + 1) / pendingOrders.length) * 100),
                        current: i + 1,
                        total: pendingOrders.length,
                        message: `Synced ${i + 1}/${pendingOrders.length} orders`
                    })
                } catch (err) {
                    console.error('Failed to sync order:', order.id, err)
                }
            }

            if (syncedCount > 0) {
                dispatchSyncEvent('sync-complete', { synced: syncedCount })
            }

            return { success: true, synced: syncedCount }
        } catch (error) {
            dispatchSyncEvent('sync-error', { error: 'Sync failed' })
            return { success: false, synced: syncedCount }
        } finally {
            this.syncInProgress = false
        }
    }

    // ✅ Get offline data
    async getOfflineData(store: string): Promise<any[]> {
        try {
            if (store === 'restaurant_tables' || store === 'waiters') {
                const data = await db.get(STORES.SETTINGS, store)
                if (data && typeof data === 'object' && 'value' in data) {
                    return Array.isArray((data as any).value) ? (data as any).value : []
                }
                return []
            }

            const data = await db.getAll(store)
            return Array.isArray(data) ? data : []
        } catch (error) {
            return []
        }
    }

    // ✅ Get storage info
    async getStorageInfo() {
        try {
            const [categoriesData, itemsData, ordersData] = await Promise.all([
                db.getAll(STORES.MENU_CATEGORIES),
                db.getAll(STORES.MENU_ITEMS),
                db.getAll(STORES.ORDERS)
            ])

            const categories = Array.isArray(categoriesData) ? categoriesData : []
            const items = Array.isArray(itemsData) ? itemsData : []
            const orders = Array.isArray(ordersData) ? ordersData : []

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
                menuItemsCount: items.length
            }
        } catch (error) {
            return {
                used: 0,
                limit: 0,
                percentage: 0,
                hasData: false,
                ordersCount: 0,
                menuItemsCount: 0
            }
        }
    }

    destroy() {
        if (this.autoSyncInterval) {
            clearInterval(this.autoSyncInterval)
        }
    }
}

export const offlineManager = new OfflineManager()