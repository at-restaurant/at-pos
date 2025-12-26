// src/lib/utils/offlineOrders.ts
import { db } from '@/lib/db/indexedDB'
import { STORES } from '@/lib/db/schema'
import { addToQueue } from '@/lib/db/syncQueue'
import { createClient } from '@/lib/supabase/client'

export async function createOfflineOrder(orderData: any, items: any[]) {
    const offlineOrderId = `offline_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

    const offlineOrder = {
        ...orderData,
        id: offlineOrderId,
        synced: false,
        created_at: new Date().toISOString()
    }

    // Save order to IndexedDB
    await db.put(STORES.ORDERS, offlineOrder)

    // Save order items
    const orderItems = []
    for (const item of items) {
        const orderItem = {
            id: `${offlineOrderId}_${item.id}_${Date.now()}`,
            order_id: offlineOrderId,
            menu_item_id: item.id,
            quantity: item.quantity,
            unit_price: item.price,
            total_price: item.price * item.quantity,
            created_at: new Date().toISOString()
        }

        await db.put(STORES.ORDER_ITEMS, orderItem)
        orderItems.push(orderItem)
    }

    // Queue for sync
    await addToQueue('create', 'orders', offlineOrder)

    return {
        success: true,
        order: {
            ...offlineOrder,
            order_items: orderItems
        }
    }
}

export async function getAllOrders() {
    const supabase = createClient()
    const isOnline = navigator.onLine

    let onlineOrders = []
    let offlineOrders = []

    // Get online orders if connected
    if (isOnline) {
        const { data } = await supabase
            .from('orders')
            .select('*, order_items(*, menu_items(name, price))')
            .order('created_at', { ascending: false })

        onlineOrders = data || []
    }

    // Always get offline orders
    const allOffline = await db.getAll(STORES.ORDERS) as any[]
    offlineOrders = allOffline.filter(o => !o.synced)

    // Load items for offline orders
    for (const order of offlineOrders) {
        const items = await db.getAll(STORES.ORDER_ITEMS) as any[]
        order.order_items = items.filter(i => i.order_id === order.id)
    }

    // Merge and sort by date
    return [...onlineOrders, ...offlineOrders]
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
}

export async function deleteOrder(orderId: string) {
    const isOffline = orderId.startsWith('offline_')

    if (isOffline) {
        // Delete from IndexedDB
        await db.delete(STORES.ORDERS, orderId)

        // Delete order items
        const items = await db.getAll(STORES.ORDER_ITEMS) as any[]
        for (const item of items.filter(i => i.order_id === orderId)) {
            await db.delete(STORES.ORDER_ITEMS, item.id)
        }

        return { success: true }
    } else {
        // Delete from Supabase
        const supabase = createClient()

        await supabase.from('order_items').delete().eq('order_id', orderId)
        await supabase.from('orders').delete().eq('id', orderId)

        return { success: true }
    }
}

export async function syncOfflineOrders() {
    const supabase = createClient()
    const offlineOrders = await db.getAll(STORES.ORDERS) as any[]
    const pendingOrders = offlineOrders.filter(o => !o.synced)

    let synced = 0

    for (const order of pendingOrders) {
        try {
            // Create order in Supabase
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
                    created_at: order.created_at
                })
                .select()
                .single()

            if (orderError) throw orderError

            // Get order items
            const items = await db.getAll(STORES.ORDER_ITEMS) as any[]
            const orderItems = items.filter(i => i.order_id === order.id)

            // Insert order items
            const itemsToInsert = orderItems.map(item => ({
                order_id: newOrder.id,
                menu_item_id: item.menu_item_id,
                quantity: item.quantity,
                unit_price: item.unit_price,
                total_price: item.total_price
            }))

            await supabase.from('order_items').insert(itemsToInsert)

            // Mark as synced
            await db.put(STORES.ORDERS, { ...order, synced: true })

            // Delete from IndexedDB (already on server)
            await db.delete(STORES.ORDERS, order.id)
            for (const item of orderItems) {
                await db.delete(STORES.ORDER_ITEMS, item.id)
            }

            synced++
        } catch (error) {
            console.error(`Failed to sync order ${order.id}:`, error)
        }
    }

    return { synced, total: pendingOrders.length }
}