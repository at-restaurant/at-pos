// src/lib/db/storageStrategy.ts
import { db } from './indexedDB'
import { STORES } from './schema'

/**
 * Universal Storage Strategy (All Devices)
 *
 * ALWAYS STORED (Essential):
 * - Menu items & categories (core business data)
 * - Tables & waiters metadata
 *
 * AUTO-CLEANED (History):
 * - Orders older than 30 days
 * - Maximum 200 orders kept
 *
 * SMART CACHING:
 * - Images: Full quality on desktop, compressed on mobile
 * - Sync frequency: 1 hour on WiFi, 3 hours on cellular
 */

export const STORAGE_LIMITS = {
    // History retention
    ORDERS_DAYS: 30,
    MAX_ORDERS: 200,

    // Cache TTL
    CACHE_TTL_WIFI: 3600000, // 1 hour
    CACHE_TTL_CELLULAR: 10800000, // 3 hours

    // Image limits
    MAX_IMAGE_SIZE_MOBILE: 500, // KB
    MAX_IMAGE_SIZE_DESKTOP: 2000, // KB
} as const

interface StorageMeta {
    key: string
    value: {
        lastSync: number
        itemCount?: number
    }
}

export class SmartStorage {
    // ✅ Device detection
    private get isMobile(): boolean {
        if (typeof window === 'undefined') return false
        return window.innerWidth < 768
    }

    private get isOnWiFi(): boolean {
        if (typeof navigator === 'undefined') return true
        const connection = (navigator as any).connection || (navigator as any).mozConnection || (navigator as any).webkitConnection
        return !connection || connection.effectiveType === 'wifi' || connection.effectiveType === '4g'
    }

    // ✅ FIXED: Returns Promise<boolean>
    async isDataFresh(key: string): Promise<boolean> {
        try {
            const meta = await db.get(STORES.SETTINGS, `meta_${key}`) as StorageMeta | undefined

            if (!meta?.value?.lastSync) {
                return false
            }

            const ttl = this.isOnWiFi
                ? STORAGE_LIMITS.CACHE_TTL_WIFI
                : STORAGE_LIMITS.CACHE_TTL_CELLULAR

            const isFresh = Date.now() - meta.value.lastSync < ttl
            return isFresh
        } catch (error) {
            console.error('Error checking data freshness:', error)
            return false
        }
    }

    // ✅ Update metadata with type safety
    async updateMeta(key: string, itemCount?: number): Promise<void> {
        await db.put(STORES.SETTINGS, {
            key: `meta_${key}`,
            value: {
                lastSync: Date.now(),
                itemCount
            }
        })
    }

    // ✅ Clean old orders (keep important data)
    async cleanOldOrders(): Promise<number> {
        try {
            const allOrders = await db.getAll(STORES.ORDERS) as Array<{ id: string; created_at: string; status: string }>

            if (!allOrders || allOrders.length === 0) {
                return 0
            }

            const cutoffDate = Date.now() - (STORAGE_LIMITS.ORDERS_DAYS * 24 * 60 * 60 * 1000)

            // Keep completed orders, sort by date
            const completedOrders = allOrders
                .filter(o => o.status === 'completed')
                .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

            // Delete old orders beyond limits
            const toDelete = completedOrders.filter(order => {
                const orderTime = new Date(order.created_at).getTime()
                const isOld = orderTime < cutoffDate
                const isBeyondLimit = completedOrders.indexOf(order) >= STORAGE_LIMITS.MAX_ORDERS
                return isOld || isBeyondLimit
            })

            for (const order of toDelete) {
                await db.delete(STORES.ORDERS, order.id)

                // Also delete related order items
                const orderItems = await db.getAll(STORES.ORDER_ITEMS) as Array<{ id: string; order_id: string }>
                const itemsToDelete = orderItems.filter(item => item.order_id === order.id)

                for (const item of itemsToDelete) {
                    await db.delete(STORES.ORDER_ITEMS, item.id)
                }
            }

            if (toDelete.length > 0) {
                console.log(`🧹 Cleaned ${toDelete.length} old orders`)
            }

            return toDelete.length
        } catch (error) {
            console.error('Error cleaning orders:', error)
            return 0
        }
    }

    // ✅ Get storage size estimate
    async getStorageSize(): Promise<{ used: number; limit: number; percentage: number }> {
        try {
            if (!navigator.storage?.estimate) {
                return { used: 0, limit: 0, percentage: 0 }
            }

            const estimate = await navigator.storage.estimate()
            const used = Math.round((estimate.usage || 0) / 1024 / 1024) // MB
            const limit = Math.round((estimate.quota || 0) / 1024 / 1024) // MB
            const percentage = limit > 0 ? Math.round((used / limit) * 100) : 0

            return { used, limit, percentage }
        } catch (error) {
            console.error('Error getting storage size:', error)
            return { used: 0, limit: 0, percentage: 0 }
        }
    }

    // ✅ Should cache images? (All devices, but optimize quality)
    shouldCacheImages(): boolean {
        // Always cache on desktop
        if (!this.isMobile) return true

        // On mobile, cache only on WiFi
        return this.isOnWiFi
    }

    // ✅ Get recommended image quality
    getImageQuality(): 'high' | 'medium' | 'low' {
        if (!this.isMobile) return 'high'
        return this.isOnWiFi ? 'medium' : 'low'
    }

    // ✅ Get storage breakdown
    async getStorageBreakdown(): Promise<{
        menu: number
        orders: number
        images: number
        total: number
    }> {
        try {
            const [menuItems, orders] = await Promise.all([
                db.getAll(STORES.MENU_ITEMS) as Promise<any[]>,
                db.getAll(STORES.ORDERS) as Promise<any[]>
            ])

            // Rough size estimates (in KB)
            const menuSize = (menuItems?.length || 0) * 2 // ~2KB per item
            const ordersSize = (orders?.length || 0) * 5 // ~5KB per order
            const imagesSize = (menuItems?.filter(i => i.image_url)?.length || 0) * 100 // ~100KB per image

            return {
                menu: menuSize,
                orders: ordersSize,
                images: imagesSize,
                total: menuSize + ordersSize + imagesSize
            }
        } catch (error) {
            console.error('Error getting storage breakdown:', error)
            return { menu: 0, orders: 0, images: 0, total: 0 }
        }
    }
}

export const smartStorage = new SmartStorage()