// src/lib/db/dexie.ts - COMPLETE DEXIE DATABASE
import Dexie, { Table } from 'dexie'
import imageCompression from 'browser-image-compression'

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// TYPE DEFINITIONS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export interface MenuItem {
    id: string
    name: string
    description?: string
    price: number
    category_id: string
    image_url?: string
    compressed_image?: string // Base64 compressed for offline
    is_available: boolean
    created_at: string
    updated_at?: string
}

export interface MenuCategory {
    id: string
    name: string
    icon: string
    display_order: number
    is_active: boolean
    created_at: string
}

export interface Order {
    id: string
    waiter_id?: string
    table_id?: string
    status: 'pending' | 'completed' | 'cancelled'
    subtotal: number
    tax: number
    total_amount: number
    order_type: 'dine-in' | 'delivery'
    payment_method?: 'cash' | 'online' | 'card'
    customer_name?: string
    customer_phone?: string
    delivery_address?: string
    delivery_charges?: number
    notes?: string
    receipt_printed: boolean
    synced: boolean
    created_at: string
    updated_at?: string
}

export interface OrderItem {
    id: string
    order_id: string
    menu_item_id: string
    quantity: number
    unit_price: number
    total_price: number
    created_at: string
}

export interface RestaurantTable {
    id: string
    table_number: number
    capacity: number
    section?: string
    status: 'available' | 'occupied' | 'reserved'
    waiter_id?: string
    current_order_id?: string
    created_at: string
}

export interface Waiter {
    id: string
    name: string
    phone: string
    cnic?: string
    profile_pic?: string
    is_active: boolean
    is_on_duty: boolean
    created_at: string
}

export interface WaiterShift {
    id: string
    waiter_id: string
    clock_in: string
    clock_out?: string
    synced: boolean
    created_at: string
}

export interface SyncQueue {
    id: string
    table: string
    action: 'create' | 'update' | 'delete'
    data: any
    status: 'pending' | 'syncing' | 'failed'
    retries: number
    created_at: string
}

export interface AppSettings {
    key: string
    value: any
    updated_at: string
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// DEXIE DATABASE CLASS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

class RestaurantDatabase extends Dexie {
    menu_items!: Table<MenuItem, string>
    menu_categories!: Table<MenuCategory, string>
    orders!: Table<Order, string>
    order_items!: Table<OrderItem, string>
    restaurant_tables!: Table<RestaurantTable, string>
    waiters!: Table<Waiter, string>
    waiter_shifts!: Table<WaiterShift, string>
    sync_queue!: Table<SyncQueue, string>
    settings!: Table<AppSettings, string>

    constructor() {
        super('RestaurantDB')

        this.version(1).stores({
            menu_items: 'id, category_id, is_available, name',
            menu_categories: 'id, is_active, display_order',
            orders: 'id, status, synced, waiter_id, table_id, created_at',
            order_items: 'id, order_id, menu_item_id',
            restaurant_tables: 'id, table_number, status, waiter_id',
            waiters: 'id, is_active, is_on_duty, name',
            waiter_shifts: 'id, waiter_id, synced, created_at',
            sync_queue: 'id, status, table, created_at',
            settings: 'key'
        })
    }
}

export const db = new RestaurantDatabase()

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// IMAGE COMPRESSION UTILITIES
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export async function compressImage(
    file: File,
    maxWidthOrHeight: number = 800,
    maxSizeMB: number = 0.05
): Promise<string> {
    try {
        const options = {
            maxSizeMB,
            maxWidthOrHeight,
            useWebWorker: true,
            fileType: 'image/jpeg'
        }

        const compressedFile = await imageCompression(file, options)
        return await fileToBase64(compressedFile)
    } catch (error) {
        console.error('Image compression failed:', error)
        throw error
    }
}

export async function compressImageFromURL(
    url: string,
    maxWidthOrHeight: number = 800
): Promise<string | null> {
    try {
        const response = await fetch(url)
        const blob = await response.blob()
        const file = new File([blob], 'image.jpg', { type: blob.type })
        return await compressImage(file, maxWidthOrHeight, 0.05)
    } catch (error) {
        console.error('URL compression failed:', error)
        return null
    }
}

function fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(reader.result as string)
        reader.onerror = reject
        reader.readAsDataURL(file)
    })
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// DATABASE HELPER FUNCTIONS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export const dbHelpers = {
    // ✅ Get pending sync count
    async getPendingCount(): Promise<number> {
        try {
            const [orders, shifts, queue] = await Promise.all([
                db.orders.where('synced').equals(0).count(),
                db.waiter_shifts.where('synced').equals(0).count(),
                db.sync_queue.where('status').equals('pending').count()
            ])
            return orders + shifts + queue
        } catch (error) {
            return 0
        }
    },

    // ✅ Clear all data (for testing)
    async clearAll(): Promise<void> {
        await db.transaction('rw', [
            db.menu_items,
            db.menu_categories,
            db.orders,
            db.order_items,
            db.restaurant_tables,
            db.waiters,
            db.waiter_shifts,
            db.sync_queue
        ], async () => {
            await db.menu_items.clear()
            await db.menu_categories.clear()
            await db.orders.clear()
            await db.order_items.clear()
            await db.restaurant_tables.clear()
            await db.waiters.clear()
            await db.waiter_shifts.clear()
            await db.sync_queue.clear()
        })
    },

    // ✅ Get storage size estimate
    async getStorageInfo() {
        try {
            const [categories, items, orders, tables, waiters] = await Promise.all([
                db.menu_categories.count(),
                db.menu_items.count(),
                db.orders.count(),
                db.restaurant_tables.count(),
                db.waiters.count()
            ])

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
                counts: {
                    categories,
                    items,
                    orders,
                    tables,
                    waiters
                }
            }
        } catch (error) {
            return {
                used: 0,
                limit: 0,
                percentage: 0,
                counts: { categories: 0, items: 0, orders: 0, tables: 0, waiters: 0 }
            }
        }
    },

    // ✅ Add to sync queue
    async addToQueue(table: string, action: 'create' | 'update' | 'delete', data: any) {
        await db.sync_queue.add({
            id: `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            table,
            action,
            data,
            status: 'pending',
            retries: 0,
            created_at: new Date().toISOString()
        })
    },

    // ✅ Clean old completed orders (keep last 200)
    async cleanOldOrders() {
        try {
            const allOrders = await db.orders
                .where('status')
                .equals('completed')
                .reverse()
                .sortBy('created_at')

            if (allOrders.length > 200) {
                const toDelete = allOrders.slice(200)
                const orderIds = toDelete.map(o => o.id)

                await db.transaction('rw', [db.orders, db.order_items], async () => {
                    await db.orders.bulkDelete(orderIds)
                    await db.order_items.where('order_id').anyOf(orderIds).delete()
                })

                console.log(`🧹 Cleaned ${toDelete.length} old orders`)
                return toDelete.length
            }

            return 0
        } catch (error) {
            console.error('Clean orders failed:', error)
            return 0
        }
    }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// AUTO-CLEANUP ON STARTUP
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

if (typeof window !== 'undefined') {
    // Clean old orders on app start
    db.on('ready', () => {
        dbHelpers.cleanOldOrders()
    })

    // Periodic cleanup every 30 minutes
    setInterval(() => {
        dbHelpers.cleanOldOrders()
    }, 30 * 60 * 1000)
}

export default db