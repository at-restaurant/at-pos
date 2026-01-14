// src/lib/db/syncManager.ts - OPTIMIZED SYNC STRATEGY
import { createClient } from '@/lib/supabase/client'
import { db, dbHelpers, compressImageFromURL } from './dexie'

class SyncManager {
    private isSyncing = false
    private syncInterval: NodeJS.Timeout | null = null

    constructor() {
        if (typeof window !== 'undefined') {
            this.setupListeners()
            this.startFallbackSync()
        }
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // SMART SYNC LISTENERS
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    private setupListeners() {
        // ✅ INSTANT: When network comes back
        window.addEventListener('online', () => {
            console.log('🌐 Network restored - syncing immediately')
            this.syncAll()
        })

        // ✅ INSTANT: When app comes to foreground
        document.addEventListener('visibilitychange', () => {
            if (!document.hidden && navigator.onLine) {
                console.log('👁️ App visible - checking sync')
                this.syncAll()
            }
        })

        // ✅ INSTANT: When page loads
        if (navigator.onLine) {
            console.log('🚀 Page loaded - initial sync')
            setTimeout(() => this.syncAll(), 1000)
        }
    }

    // ✅ FALLBACK: Only for safety (30 minutes)
    private startFallbackSync() {
        this.syncInterval = setInterval(() => {
            if (navigator.onLine && !this.isSyncing) {
                console.log('⏰ Fallback sync check (30min)')
                this.syncAll()
            }
        }, 30 * 60 * 1000) // 30 minutes
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // DOWNLOAD ESSENTIAL DATA (Menu, Tables, Waiters)
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    async downloadEssentialData(): Promise<{ success: boolean; message?: string }> {
        if (!navigator.onLine) {
            return { success: false, message: 'Offline - cannot download' }
        }

        const supabase = createClient()

        try {
            this.dispatchEvent('sync-start', { message: 'Downloading menu data...' })

            // 1️⃣ Download menu categories
            const { data: categories } = await supabase
                .from('menu_categories')
                .select('*')
                .eq('is_active', true)
                .order('display_order')

            if (categories && categories.length > 0) {
                await db.menu_categories.bulkPut(categories)
            }

            // 2️⃣ Download menu items with image compression
            const { data: items } = await supabase
                .from('menu_items')
                .select('*')
                .eq('is_available', true)
                .order('name')

            if (items && items.length > 0) {
                this.dispatchEvent('sync-progress', {
                    message: 'Compressing images...',
                    current: 1,
                    total: 3
                })

                // Compress images in batches
                const batchSize = 5
                for (let i = 0; i < items.length; i += batchSize) {
                    const batch = items.slice(i, i + batchSize)

                    const compressedBatch = await Promise.all(
                        batch.map(async (item) => {
                            if (item.image_url && !item.image_url.startsWith('data:')) {
                                try {
                                    const compressed = await compressImageFromURL(item.image_url, 800)
                                    return {
                                        ...item,
                                        compressed_image: compressed || undefined
                                    }
                                } catch (error) {
                                    console.warn('Image compression failed:', item.id)
                                    return item
                                }
                            }
                            return item
                        })
                    )

                    await db.menu_items.bulkPut(compressedBatch)
                }
            }

            // 3️⃣ Download tables
            const { data: tables } = await supabase
                .from('restaurant_tables')
                .select('*')
                .order('table_number')

            if (tables && tables.length > 0) {
                await db.restaurant_tables.bulkPut(tables)
            }

            // 4️⃣ Download waiters
            const { data: waiters } = await supabase
                .from('waiters')
                .select('*')
                .eq('is_active', true)
                .order('name')

            if (waiters && waiters.length > 0) {
                await db.waiters.bulkPut(waiters)
            }

            // Update last sync timestamp
            await db.settings.put({
                key: 'last_full_sync',
                value: Date.now(),
                updated_at: new Date().toISOString()
            })

            this.dispatchEvent('sync-complete', {
                categories: categories?.length || 0,
                items: items?.length || 0,
                tables: tables?.length || 0,
                waiters: waiters?.length || 0
            })

            return {
                success: true,
                message: `Downloaded ${items?.length || 0} menu items`
            }
        } catch (error: any) {
            this.dispatchEvent('sync-error', { error: error.message })
            return { success: false, message: error.message }
        }
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // UPLOAD PENDING CHANGES (Orders, Shifts, etc.)
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    async uploadPendingChanges(): Promise<{ success: boolean; synced: number }> {
        if (!navigator.onLine || this.isSyncing) {
            return { success: false, synced: 0 }
        }

        this.isSyncing = true
        let totalSynced = 0

        try {
            const supabase = createClient()

            // 1️⃣ Sync pending orders
            const pendingOrders = await db.orders
                .where('synced')
                .equals(0)
                .toArray()

            for (const order of pendingOrders) {
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
                            customer_name: order.customer_name,
                            customer_phone: order.customer_phone,
                            delivery_address: order.delivery_address,
                            delivery_charges: order.delivery_charges,
                            notes: order.notes,
                            receipt_printed: order.receipt_printed,
                            created_at: order.created_at
                        })
                        .select()
                        .single()

                    if (orderError) throw orderError

                    // Get order items
                    const orderItems = await db.order_items
                        .where('order_id')
                        .equals(order.id)
                        .toArray()

                    // Insert order items
                    if (orderItems.length > 0) {
                        const itemsToInsert = orderItems.map(item => ({
                            order_id: newOrder.id,
                            menu_item_id: item.menu_item_id,
                            quantity: item.quantity,
                            unit_price: item.unit_price,
                            total_price: item.total_price
                        }))

                        await supabase.from('order_items').insert(itemsToInsert)

                        // Delete synced items from Dexie
                        await db.order_items.bulkDelete(orderItems.map(i => i.id))
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

                    // Delete synced order from Dexie
                    await db.orders.delete(order.id)
                    totalSynced++

                } catch (error) {
                    console.error('Order sync failed:', order.id, error)
                }
            }

            // 2️⃣ Sync pending waiter shifts
            const pendingShifts = await db.waiter_shifts
                .where('synced')
                .equals(0)
                .toArray()

            for (const shift of pendingShifts) {
                try {
                    await supabase.from('waiter_shifts').insert({
                        waiter_id: shift.waiter_id,
                        clock_in: shift.clock_in,
                        clock_out: shift.clock_out,
                        created_at: shift.created_at
                    })

                    await db.waiter_shifts.delete(shift.id)
                    totalSynced++
                } catch (error) {
                    console.error('Shift sync failed:', shift.id, error)
                }
            }

            // 3️⃣ Process sync queue
            const queueItems = await db.sync_queue
                .where('status')
                .equals('pending')
                .toArray()

            for (const item of queueItems) {
                try {
                    await db.sync_queue.update(item.id, { status: 'syncing' })

                    if (item.action === 'create') {
                        await supabase.from(item.table).insert(item.data)
                    } else if (item.action === 'update') {
                        await supabase.from(item.table).update(item.data).eq('id', item.data.id)
                    } else if (item.action === 'delete') {
                        await supabase.from(item.table).delete().eq('id', item.data.id)
                    }

                    await db.sync_queue.delete(item.id)
                    totalSynced++
                } catch (error) {
                    await db.sync_queue.update(item.id, {
                        status: 'failed',
                        retries: item.retries + 1
                    })
                }
            }

            if (totalSynced > 0) {
                this.dispatchEvent('sync-complete', { synced: totalSynced })
                console.log(`✅ Synced ${totalSynced} items`)
            }

            return { success: true, synced: totalSynced }
        } catch (error) {
            this.dispatchEvent('sync-error', { error: 'Upload failed' })
            return { success: false, synced: totalSynced }
        } finally {
            this.isSyncing = false
        }
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // SYNC ALL (Download + Upload)
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    async syncAll(): Promise<{ success: boolean; downloaded?: any; uploaded?: any }> {
        if (!navigator.onLine) {
            return { success: false }
        }

        try {
            // Upload first (pending changes)
            const uploaded = await this.uploadPendingChanges()

            // Then download fresh data
            const downloaded = await this.downloadEssentialData()

            return {
                success: true,
                downloaded,
                uploaded
            }
        } catch (error) {
            return { success: false }
        }
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // ✅ TRIGGER SYNC AFTER DATA CREATION (Called from hooks)
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    async syncAfterCreate() {
        if (navigator.onLine && !this.isSyncing) {
            console.log('📤 New data created - syncing immediately')
            await this.uploadPendingChanges()
        }
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // UTILITIES
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    async getPendingCount(): Promise<number> {
        return await dbHelpers.getPendingCount()
    }

    async isOfflineReady(): Promise<boolean> {
        const [categories, items] = await Promise.all([
            db.menu_categories.count(),
            db.menu_items.count()
        ])
        return categories > 0 && items > 0
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

// Singleton instance
export const syncManager = new SyncManager()

// Cleanup on unload
if (typeof window !== 'undefined') {
    window.addEventListener('beforeunload', () => {
        syncManager.destroy()
    })
}

export default syncManager