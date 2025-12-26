// src/lib/db/realtimeSync.ts - PRODUCTION CLEAN
import { createClient } from '@/lib/supabase/client'
import { db } from './indexedDB'
import { STORES } from './schema'

export class RealtimeSync {
    private syncQueue: Promise<any> | null = null
    private syncInterval: NodeJS.Timeout | null = null
    private pendingOperations: Map<string, 'processing' | 'failed'> = new Map()

    constructor() {
        if (typeof window !== 'undefined') {
            this.startAutoSync()
            this.setupOnlineListener()
        }
    }

    private startAutoSync() {
        this.syncInterval = setInterval(() => {
            if (navigator.onLine && !this.syncQueue) {
                this.syncAll()
            }
        }, 30000)
    }

    private setupOnlineListener() {
        window.addEventListener('online', () => {
            setTimeout(() => this.syncAll(), 1000)
        })
    }

    async syncAll(): Promise<{ success: boolean; synced: number }> {
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

            const attendanceResult = await this.syncAttendance()
            totalSynced += attendanceResult.synced

            this.dispatchEvent('sync-complete', { synced: totalSynced })

            return { success: true, synced: totalSynced }
        } catch (error) {
            this.dispatchEvent('sync-error', { error: 'Sync failed' })
            return { success: false, synced: totalSynced }
        }
    }

    private async syncOrders(): Promise<{ success: boolean; synced: number }> {
        const supabase = createClient()
        let synced = 0

        try {
            const allOrders = (await db.getAll(STORES.ORDERS)) as any[]
            const pendingOrders = allOrders.filter(
                o => !o.synced && o.id.startsWith('offline_')
            )

            if (pendingOrders.length === 0) {
                return { success: true, synced: 0 }
            }

            for (const order of pendingOrders) {
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

                    if (orderError) throw order
                    Error

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
                } catch (error) {
                    this.pendingOperations.set(order.id, 'failed')
                    setTimeout(() => this.pendingOperations.delete(order.id), 300000)
                }
            }

            return { success: true, synced }
        } catch (error) {
            return { success: false, synced }
        }
    }

    private async syncAttendance(): Promise<{ success: boolean; synced: number }> {
        const supabase = createClient()
        let synced = 0

        try {
            const allShifts = (await db.getAll(STORES.WAITER_SHIFTS)) as any[]
            const pendingShifts = allShifts.filter(
                s => !s.synced && s.id.startsWith('offline_')
            )

            if (pendingShifts.length === 0) {
                return { success: true, synced: 0 }
            }

            for (const shift of pendingShifts) {
                if (this.pendingOperations.has(shift.id)) continue
                this.pendingOperations.set(shift.id, 'processing')

                try {
                    const { error } = await supabase
                        .from('waiter_shifts')
                        .insert({
                            waiter_id: shift.waiter_id,
                            clock_in: shift.clock_in,
                            clock_out: shift.clock_out,
                            created_at: shift.created_at
                        })

                    if (error) throw error

                    await db.delete(STORES.WAITER_SHIFTS, shift.id)
                    synced++
                    this.pendingOperations.delete(shift.id)
                } catch (error) {
                    this.pendingOperations.set(shift.id, 'failed')
                    setTimeout(() => this.pendingOperations.delete(shift.id), 300000)
                }
            }

            return { success: true, synced }
        } catch (error) {
            return { success: false, synced }
        }
    }

    async getPendingCount(): Promise<number> {
        try {
            const [orders, shifts] = await Promise.all([
                db.getAll(STORES.ORDERS),
                db.getAll(STORES.WAITER_SHIFTS)
            ])

            const pendingOrders = (orders as any[]).filter(
                o => !o.synced && o.id.startsWith('offline_')
            )
            const pendingShifts = (shifts as any[]).filter(
                s => !s.synced && s.id.startsWith('offline_')
            )

            return pendingOrders.length + pendingShifts.length
        } catch (error) {
            return 0
        }
    }

    private dispatchEvent(type: string, detail: any) {
        if (typeof window === 'undefined') return
        window.dispatchEvent(new CustomEvent(type, { detail }))
    }

    destroy() {
        if (this.syncInterval) {
            clearInterval(this.syncInterval)
        }
    }
}
export const realtimeSync = new RealtimeSync()