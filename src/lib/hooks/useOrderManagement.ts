// src/lib/hooks/useOrderManagement.ts - COMPLETE FIXED VERSION
import { useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/components/ui/Toast'
import { db } from '@/lib/db/indexedDB'
import { STORES } from '@/lib/db/schema'
import { addToQueue } from '@/lib/db/syncQueue'

export function useOrderManagement() {
    const [loading, setLoading] = useState(false)
    const supabase = createClient()
    const toast = useToast()

    // ✅ Complete order + free table
    const completeOrder = useCallback(async (orderId: string, tableId?: string, orderType?: string) => {
        setLoading(true)
        try {
            const { error: orderError } = await supabase
                .from('orders')
                .update({ status: 'completed', updated_at: new Date().toISOString() })
                .eq('id', orderId)

            if (orderError) throw orderError

            if (orderType === 'dine-in' && tableId) {
                await supabase
                    .from('restaurant_tables')
                    .update({ status: 'available', current_order_id: null, waiter_id: null })
                    .eq('id', tableId)
            }

            toast.add('success', '✅ Order completed!')
            return { success: true }
        } catch (error: any) {
            toast.add('error', `❌ ${error.message}`)
            return { success: false, error: error.message }
        } finally {
            setLoading(false)
        }
    }, [supabase, toast])

    // ✅ Cancel order + free table
    const cancelOrder = useCallback(async (orderId: string, tableId?: string, orderType?: string) => {
        setLoading(true)
        try {
            const { error: orderError } = await supabase
                .from('orders')
                .update({ status: 'cancelled', updated_at: new Date().toISOString() })
                .eq('id', orderId)

            if (orderError) throw orderError

            if (orderType === 'dine-in' && tableId) {
                await supabase
                    .from('restaurant_tables')
                    .update({ status: 'available', current_order_id: null, waiter_id: null })
                    .eq('id', tableId)
            }

            toast.add('success', '✅ Order cancelled')
            return { success: true }
        } catch (error: any) {
            toast.add('error', `❌ ${error.message}`)
            return { success: false, error: error.message }
        } finally {
            setLoading(false)
        }
    }, [supabase, toast])

    // ✅ Mark receipt as printed
    const markPrinted = useCallback(async (orderId: string) => {
        try {
            const { error } = await supabase
                .from('orders')
                .update({ receipt_printed: true })
                .eq('id', orderId)

            if (error) throw error
            return { success: true }
        } catch (error: any) {
            return { success: false }
        }
    }, [supabase])

    // ✅ Print and Complete (Combined function)
    const printAndComplete = useCallback(async (
        orderId: string,
        tableId?: string,
        orderType?: string
    ) => {
        setLoading(true)
        try {
            // Mark as printed first
            await markPrinted(orderId)

            // Then complete the order
            const result = await completeOrder(orderId, tableId, orderType)

            return result
        } catch (error: any) {
            toast.add('error', `❌ ${error.message}`)
            return { success: false, error: error.message }
        } finally {
            setLoading(false)
        }
    }, [markPrinted, completeOrder, toast])

    // ✅ Create order with offline support
    const createOrder = useCallback(async (orderData: any, items: any[]) => {
        setLoading(true)
        try {
            const isOnline = navigator.onLine

            if (isOnline) {
                // Online creation
                const { data: order, error: orderError } = await supabase
                    .from('orders')
                    .insert(orderData)
                    .select()
                    .single()

                if (orderError) throw orderError

                const orderItems = items.map(item => ({
                    order_id: order.id,
                    menu_item_id: item.id,
                    quantity: item.quantity,
                    unit_price: item.price,
                    total_price: item.price * item.quantity
                }))

                const { error: itemsError } = await supabase
                    .from('order_items')
                    .insert(orderItems)

                if (itemsError) throw itemsError

                // Update table if dine-in
                if (orderData.order_type === 'dine-in' && orderData.table_id) {
                    await supabase
                        .from('restaurant_tables')
                        .update({
                            status: 'occupied',
                            waiter_id: orderData.waiter_id,
                            current_order_id: order.id
                        })
                        .eq('id', orderData.table_id)
                }

                // Update waiter stats
                if (orderData.waiter_id) {
                    await supabase.rpc('increment_waiter_stats', {
                        p_waiter_id: orderData.waiter_id,
                        p_orders: 1,
                        p_revenue: orderData.total_amount
                    })
                }

                toast.add('success', '✅ Order created!')
                return { success: true, order }
            } else {
                // ✅ Offline order creation
                const orderId = `offline_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

                const offlineOrder = {
                    ...orderData,
                    id: orderId,
                    created_at: new Date().toISOString(),
                    synced: false
                }

                // Store in IndexedDB
                await db.put(STORES.ORDERS, offlineOrder)

                // Store order items
                const orderItems = items.map(item => ({
                    id: `${orderId}_${item.id}`,
                    order_id: orderId,
                    menu_item_id: item.id,
                    quantity: item.quantity,
                    unit_price: item.price,
                    total_price: item.price * item.quantity,
                    created_at: new Date().toISOString()
                }))

                for (const item of orderItems) {
                    await db.put(STORES.ORDER_ITEMS, item)
                }

                // Add to sync queue
                await addToQueue('create', 'orders', offlineOrder)

                for (const item of orderItems) {
                    await addToQueue('create', 'order_items', item)
                }

                // Queue table update
                if (orderData.order_type === 'dine-in' && orderData.table_id) {
                    await addToQueue('update', 'restaurant_tables', {
                        id: orderData.table_id,
                        status: 'occupied',
                        waiter_id: orderData.waiter_id,
                        current_order_id: orderId
                    })
                }

                toast.add('success', '✅ Order created offline! Will sync when online.')
                return {
                    success: true,
                    order: { ...offlineOrder, order_items: orderItems }
                }
            }
        } catch (error: any) {
            toast.add('error', `❌ ${error.message}`)
            return { success: false, error: error.message }
        } finally {
            setLoading(false)
        }
    }, [supabase, toast])

    return {
        completeOrder,
        cancelOrder,
        markPrinted,
        printAndComplete,  // ✅ Now exported
        createOrder,
        loading
    }
}