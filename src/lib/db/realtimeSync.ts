// src/lib/db/realtimeSync.ts
// ✅ FIXED: Excludes cancelled orders from syncing, handles offline data properly

import { createClient } from '@/lib/supabase/client'
import { db } from './indexedDB'
import { STORES } from './schema'

export class RealtimeSync {
    private syncQueue: Promise<any> | null = null
    private syncInterval: NodeJS.Timeout | null = null
    private pendingOperations: Map<string, 'processing' | 'failed'> = new Map()
    private isDestroyed: boolean = false

    constructor() {
        if (typeof window !== 'undefined') {
            this.startAutoSync()
            this.setupOnlineListener()
            this.setupUnloadListener()
        }
    }

    private startAutoSync() {
        if (this.syncInterval) {
            clearInterval(this.syncInterval)
        }

        this.syncInterval = setInterval(() => {
            if (!this.isDestroyed && navigator.onLine && !this.syncQueue) {
                this.syncAll()
            }
        }, 30000)
    }

    private setupOnlineListener() {
        const handleOnline = () => {
            if (!this.isDestroyed) {
                setTimeout(() => this.syncAll(), 1000)
            }
        }

        window.addEventListener('online', handleOnline)

        if (!window.__realtimeSyncListeners) {
            window.__realtimeSyncListeners = []
        }
        window.__realtimeSyncListeners.push({ event: 'online', handler: handleOnline })
    }

    private setupUnloadListener() {
        const handleUnload = () => {
            this.destroy()
        }

        window.addEventListener('beforeunload', handleUnload)

        if (!window.__realtimeSyncListeners) {
            window.__realtimeSyncListeners = []
        }
        window.__realtimeSyncListeners.push({ event: 'beforeunload', handler: handleUnload })
    }

    async syncAll(): Promise<{ success: boolean; synced: number }> {
        if (this.isDestroyed) {
            return { success: false, synced: 0 }
        }

        if (this.syncQueue) {
            return this.syncQueue
        }

        if (!navigator.onLine) {
            return { success: false, synced: 0 }
        }

        this.syncQueue = this._performSync()
        const result = await this.syncQueue
        this.syncQueue = null
        return result
    }

    private async _performSync(): Promise<{ success: boolean; synced: number }> {
        let totalSynced = 0

        try {
            this.dispatchEvent('sync-start', { message: 'Starting sync...' })

            const ordersResult = await this.syncOrders()
            totalSynced += ordersResult.synced

            const waitersResult = await this.syncWaiters()
            totalSynced += waitersResult.synced

            this.dispatchEvent('sync-complete', { synced: totalSynced })

            return { success: true, synced: totalSynced }
        } catch (error) {
            this.dispatchEvent('sync-error', { error: 'Sync failed' })
            return { success: false, synced: totalSynced }
        }
    }

    // ✅ FIXED: Exclude cancelled orders from syncing
    private async syncOrders(): Promise<{ success: boolean; synced: number }> {
        if (this.isDestroyed) return { success: false, synced: 0 }

        const supabase = createClient()
        let synced = 0

        try {
            const allOrders = (await db.getAll(STORES.ORDERS)) as any[]

            // ✅ KEY FIX: Filter out cancelled orders AND already synced orders
            const pendingOrders = allOrders.filter(
                o => !o.synced &&
                    o.id.startsWith('offline_') &&
                    o.status !== 'cancelled' // ✅ Don't sync cancelled orders
            )

            if (pendingOrders.length === 0) {
                return { success: true, synced: 0 }
            }

            console.log(`🔄 Syncing ${pendingOrders.length} orders (excluding cancelled)`)

            for (const order of pendingOrders) {
                if (this.isDestroyed) break

                if (this.pendingOperations.has(order.id)) continue
                this.pendingOperations.set(order.id, 'processing')

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
                            receipt_printed: order.receipt_printed || false,
                            created_at: order.created_at
                        })
                        .select()
                        .single()

                    if (orderError) throw orderError

                    const orderItems = (await db.getAll(STORES.ORDER_ITEMS)) as any[]
                    const items = orderItems.filter(i => i.order_id === order.id)

                    if (items.length > 0) {
                        const itemsToInsert = items.map(item => ({
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

                    if (order.waiter_id) {
                        await supabase.rpc('increment_waiter_stats', {
                            p_waiter_id: order.waiter_id,
                            p_orders: 1,
                            p_revenue: order.total_amount
                        })
                    }

                    await db.delete(STORES.ORDERS, order.id)
                    for (const item of items) {
                        await db.delete(STORES.ORDER_ITEMS, item.id)
                    }

                    synced++
                    this.pendingOperations.delete(order.id)
                    console.log(`✅ Synced order ${order.id}`)
                } catch (error) {
                    console.error(`❌ Failed to sync order ${order.id}:`, error)
                    this.pendingOperations.set(order.id, 'failed')
                    setTimeout(() => this.pendingOperations.delete(order.id), 300000)
                }
            }

            return { success: true, synced }
        } catch (error) {
            console.error('Orders sync error:', error)
            return { success: false, synced }
        }
    }

    // ✅ NEW: Sync waiter status changes
    private async syncWaiters(): Promise<{ success: boolean; synced: number }> {
        if (this.isDestroyed) return { success: false, synced: 0 }

        const supabase = createClient()
        let synced = 0

        try {
            // Get pending waiter updates from sync queue
            const allQueueItems = (await db.getAll(STORES.SYNC_QUEUE)) as any[]
            const waiterUpdates = allQueueItems.filter(
                item => item.table === 'waiters' && item.status === 'pending'
            )

            for (const update of waiterUpdates) {
                if (this.isDestroyed) break

                try {
                    await supabase
                        .from('waiters')
                        .update({ is_on_duty: update.data.is_on_duty })
                        .eq('id', update.data.id)

                    await db.delete(STORES.SYNC_QUEUE, update.id)
                    synced++
                } catch (error) {
                    console.error('Waiter sync error:', error)
                }
            }

            return { success: true, synced }
        } catch (error) {
            console.error('Waiters sync error:', error)
            return { success: false, synced }
        }
    }

    async getPendingCount(): Promise<number> {
        if (this.isDestroyed) return 0

        try {
            const [orders, queueItems] = await Promise.all([
                db.getAll(STORES.ORDERS),
                db.getAll(STORES.SYNC_QUEUE)
            ])

            // ✅ Only count non-cancelled orders
            const pendingOrders = (orders as any[]).filter(
                o => !o.synced &&
                    o.id.startsWith('offline_') &&
                    o.status !== 'cancelled'
            )

            const pendingQueue = (queueItems as any[]).filter(
                item => item.status === 'pending'
            )

            return pendingOrders.length + pendingQueue.length
        } catch (error) {
            return 0
        }
    }

    private dispatchEvent(type: string, detail: any) {
        if (typeof window === 'undefined' || this.isDestroyed) return
        window.dispatchEvent(new CustomEvent(type, { detail }))
    }

    destroy() {
        console.log('🔄 Destroying RealtimeSync...')

        this.isDestroyed = true

        if (this.syncInterval) {
            clearInterval(this.syncInterval)
            this.syncInterval = null
        }

        this.pendingOperations.clear()
        this.syncQueue = null

        if (typeof window !== 'undefined' && window.__realtimeSyncListeners) {
            window.__realtimeSyncListeners.forEach(({ event, handler }) => {
                window.removeEventListener(event, handler)
            })
            window.__realtimeSyncListeners = []
        }
    }
}

export const realtimeSync = new RealtimeSync()

if (typeof window !== 'undefined') {
    window.addEventListener('beforeunload', () => {
        realtimeSync.destroy()
    })
}

declare global {
    interface Window {
        __realtimeSyncListeners?: Array<{
            event: string
            handler: EventListener
        }>
    }
}