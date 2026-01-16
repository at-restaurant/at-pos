// src/lib/db/offlineManager.ts - COMPLETE FIXED VERSION
import { createClient } from '@/lib/supabase/client'
import { db } from './indexedDB'
import { STORES } from './schema'

const dispatchSyncEvent = (type: string, detail: any) => {
    if (typeof window === 'undefined') return
    window.dispatchEvent(new CustomEvent(type, { detail }))
}

// ✅ FIXED: Return type now includes 'error' field
interface DownloadResult {
    success: boolean
    counts?: {
        categories: number
        items: number
        tables: number
        waiters: number
        orders: number
    }
    error?: string // ✅ ADDED
}

async function compressImage(url: string, maxWidth = 400): Promise<string> {
    return new Promise((resolve) => {
        const img = new Image()
        img.crossOrigin = 'anonymous'

        img.onload = () => {
            const canvas = document.createElement('canvas')
            let width = img.width
            let height = img.height

            if (width > maxWidth) {
                height = (height * maxWidth) / width
                width = maxWidth
            }

            canvas.width = width
            canvas.height = height

            const ctx = canvas.getContext('2d')
            if (!ctx) {
                resolve(url)
                return
            }

            ctx.drawImage(img, 0, 0, width, height)
            try {
                const compressed = canvas.toDataURL('image/jpeg', 0.7)
                resolve(compressed)
            } catch {
                resolve(url)
            }
        }

        img.onerror = () => resolve(url)
        img.src = url
    })
}

class OfflineManager {
    private isDownloading = false
    private syncInProgress = false

    constructor() {
        if (typeof window !== 'undefined') {
            this.initAutoSync()
            this.initCleanup()
        }
    }

    private initAutoSync() {
        if (typeof navigator !== 'undefined' && navigator.onLine) {
            this.downloadAllData()
        }

        window.addEventListener('online', () => {
            this.downloadAllData(true)
            this.syncPendingChanges()
        })

        setInterval(() => {
            if (typeof navigator !== 'undefined' && navigator.onLine) {
                this.downloadAllData()
            }
        }, 5 * 60 * 1000)
    }

    private initCleanup() {
        this.cleanupOldData()
        setInterval(() => this.cleanupOldData(), 24 * 60 * 60 * 1000)
    }

    // ✅ FIXED: Added online check, Supabase validation, and better error handling
    async downloadAllData(force = false): Promise<DownloadResult> {
        if (this.isDownloading) {
            return { success: false, error: 'Download already in progress' }
        }

        // ✅ Check online status first
        if (!navigator.onLine) {
            return { success: false, error: 'Cannot download while offline' }
        }

        const lastSync = localStorage.getItem('full_sync_timestamp')
        const fiveMinutes = 5 * 60 * 1000

        if (!force && lastSync && Date.now() - parseInt(lastSync) < fiveMinutes) {
            return { success: true }
        }

        this.isDownloading = true

        try {
            // ✅ FIX: Validate client can be created
            const supabase = createClient()
            if (!supabase) {
                throw new Error('Failed to initialize Supabase client')
            }

            dispatchSyncEvent('sync-start', { message: 'Downloading all data...' })

            const [categories, items, tables, waiters, orders, orderItems] = await Promise.allSettled([
                supabase.from('menu_categories').select('*').eq('is_active', true),
                supabase.from('menu_items').select('*').eq('is_available', true),
                supabase.from('restaurant_tables').select('*'),
                supabase.from('waiters').select('*').eq('is_active', true),
                supabase.from('orders').select('*, order_items(*, menu_items(name, price))').order('created_at', { ascending: false }).limit(100),
                supabase.from('order_items').select('*').limit(500)
            ])

            let progress = 0
            const updateProgress = (current: number, message: string) => {
                progress = Math.round((current / 6) * 100)
                dispatchSyncEvent('sync-progress', { progress, message })
            }

            // 1. Categories
            if (categories.status === 'fulfilled' && categories.value.data) {
                await db.clear(STORES.MENU_CATEGORIES)
                await db.bulkPut(STORES.MENU_CATEGORIES, categories.value.data)
                updateProgress(1, 'Categories downloaded')
            }

            // 2. Menu Items (with compression)
            if (items.status === 'fulfilled' && items.value.data) {
                updateProgress(2, 'Compressing images...')
                const compressedItems = await Promise.all(
                    items.value.data.map(async (item: any) => {
                        if (item.image_url && item.image_url.startsWith('http')) {
                            try {
                                const compressed = await compressImage(item.image_url, 400)
                                return { ...item, image_url: compressed, original_image_url: item.image_url }
                            } catch {
                                return item
                            }
                        }
                        return item
                    })
                )

                await db.clear(STORES.MENU_ITEMS)
                await db.bulkPut(STORES.MENU_ITEMS, compressedItems)
                updateProgress(3, 'Menu items downloaded')
            }

            // 3. Tables
            if (tables.status === 'fulfilled' && tables.value.data) {
                await db.put(STORES.SETTINGS, { key: 'restaurant_tables', value: tables.value.data })
                updateProgress(4, 'Tables downloaded')
            }

            // 4. Waiters
            if (waiters.status === 'fulfilled' && waiters.value.data) {
                await db.put(STORES.SETTINGS, { key: 'waiters', value: waiters.value.data })
                updateProgress(5, 'Waiters downloaded')
            }

            // 5. Active Orders
            if (orders.status === 'fulfilled' && orders.value.data) {
                const activeOrders = orders.value.data.filter((o: any) => o.status === 'pending' || o.status === 'preparing')

                for (const order of activeOrders) {
                    if (!order.id.startsWith('offline_')) {
                        await db.put(STORES.ORDERS, { ...order, synced: true, cached: true })

                        if (order.order_items) {
                            for (const item of order.order_items) {
                                await db.put(STORES.ORDER_ITEMS, { ...item, cached: true })
                            }
                        }
                    }
                }

                updateProgress(6, 'Orders downloaded')
            }

            localStorage.setItem('full_sync_timestamp', Date.now().toString())
            localStorage.setItem('offline_ready', 'true')

            const counts = {
                categories: categories.status === 'fulfilled' ? categories.value.data?.length || 0 : 0,
                items: items.status === 'fulfilled' ? items.value.data?.length || 0 : 0,
                tables: tables.status === 'fulfilled' ? tables.value.data?.length || 0 : 0,
                waiters: waiters.status === 'fulfilled' ? waiters.value.data?.length || 0 : 0,
                orders: orders.status === 'fulfilled' ? orders.value.data?.filter((o: any) => o.status === 'pending').length || 0 : 0
            }

            dispatchSyncEvent('sync-complete', counts)
            console.log('✅ Full data sync complete:', counts)

            return { success: true, counts }

        } catch (error: any) {
            console.error('❌ Download failed:', error)

            // ✅ FIX: Handle specific error types
            let errorMessage = 'Download failed'
            if (error?.message?.includes('Invalid value')) {
                errorMessage = 'Invalid Supabase configuration. Check environment variables.'
            } else if (error?.message?.includes('Failed to fetch')) {
                errorMessage = 'Network error. Check your connection.'
            } else {
                errorMessage = error.message || 'Unknown error'
            }

            dispatchSyncEvent('sync-error', { error: errorMessage })
            return { success: false, error: errorMessage }
        } finally {
            this.isDownloading = false
        }
    }

    // ✅ FIXED: Added online check, Supabase validation, cancelled order filter, and better error handling
    async syncPendingChanges(): Promise<{ success: boolean; synced: number }> {
        // ✅ FIX: Check online and validate client
        if (this.syncInProgress || !navigator.onLine) {
            return { success: false, synced: 0 }
        }

        this.syncInProgress = true
        let syncedCount = 0

        try {
            const supabase = createClient()
            if (!supabase) {
                console.error('Cannot create Supabase client for sync')
                return { success: false, synced: 0 }
            }

            // 1. Sync orders
            const allOrders = await db.getAll(STORES.ORDERS) as any[]
            const pendingOrders = allOrders.filter(o =>
                !o.synced &&
                o.id.startsWith('offline_') &&
                o.status !== 'cancelled' // ✅ Don't sync cancelled orders
            )

            for (const order of pendingOrders) {
                try {
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
                            created_at: order.created_at
                        })
                        .select()
                        .single()

                    if (orderError) throw orderError

                    const items = await db.getAll(STORES.ORDER_ITEMS) as any[]
                    const orderItems = items.filter(i => i.order_id === order.id)

                    if (orderItems.length > 0) {
                        const itemsToInsert = orderItems.map(item => ({
                            order_id: newOrder.id,
                            menu_item_id: item.menu_item_id,
                            quantity: item.quantity,
                            unit_price: item.unit_price,
                            total_price: item.total_price
                        }))

                        await supabase.from('order_items').insert(itemsToInsert)
                    }

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

                    await db.delete(STORES.ORDERS, order.id)
                    for (const item of orderItems) {
                        await db.delete(STORES.ORDER_ITEMS, item.id)
                    }

                    syncedCount++
                    console.log(`✅ Synced order ${order.id}`)

                } catch (error) {
                    console.error(`❌ Failed to sync order ${order.id}:`, error)
                }
            }

            // 2. Sync waiter status changes
            const queueItems = await db.getAll(STORES.SYNC_QUEUE) as any[]
            const waiterUpdates = queueItems.filter(item => item.table === 'waiters' && item.status === 'pending')

            for (const update of waiterUpdates) {
                try {
                    await supabase
                        .from('waiters')
                        .update({ is_on_duty: update.data.is_on_duty })
                        .eq('id', update.data.id)

                    await db.delete(STORES.SYNC_QUEUE, update.id)
                    syncedCount++
                } catch (error) {
                    console.error('Waiter sync error:', error)
                }
            }

            if (syncedCount > 0) {
                dispatchSyncEvent('sync-complete', { synced: syncedCount })
            }

            return { success: true, synced: syncedCount }

        } catch (error: any) {
            // ✅ FIX: Better error logging
            console.error('Sync error:', error?.message || error)
            return { success: false, synced: syncedCount }
        } finally {
            this.syncInProgress = false
        }
    }

    async getOfflineData(store: string): Promise<any[]> {
        try {
            if (store === 'restaurant_tables' || store === 'waiters') {
                const data = await db.get(STORES.SETTINGS, store)
                return data && (data as any).value ? (data as any).value : []
            }

            const data = await db.getAll(store)
            return Array.isArray(data) ? data : []
        } catch {
            return []
        }
    }

    async cleanupOldData(): Promise<number> {
        try {
            const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000
            const ordersData = await db.getAll(STORES.ORDERS) as any[]

            const oldOrders = ordersData.filter(o => {
                const orderTime = new Date(o.created_at).getTime()
                return orderTime < sevenDaysAgo && o.status === 'completed' && o.cached
            })

            for (const order of oldOrders) {
                await db.delete(STORES.ORDERS, order.id)

                const itemsData = await db.getAll(STORES.ORDER_ITEMS) as any[]
                const orderItems = itemsData.filter(i => i.order_id === order.id)

                for (const item of orderItems) {
                    await db.delete(STORES.ORDER_ITEMS, item.id)
                }
            }

            return oldOrders.length
        } catch {
            return 0
        }
    }

    async isOfflineReady(): Promise<boolean> {
        const ready = localStorage.getItem('offline_ready') === 'true'
        if (!ready) return false

        const [categories, items] = await Promise.all([
            db.getAll(STORES.MENU_CATEGORIES),
            db.getAll(STORES.MENU_ITEMS)
        ])

        return Array.isArray(categories) && categories.length > 0 &&
            Array.isArray(items) && items.length > 0
    }

    async clearAllData(includeMenu = false): Promise<void> {
        const storesToClear = [STORES.ORDERS, STORES.ORDER_ITEMS, STORES.CART, STORES.SYNC_QUEUE]

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
        // Cleanup if needed
    }
}

export const offlineManager = new OfflineManager()