// src/lib/hooks/useOrderManagement.ts
// ✅ SIMPLIFIED: Only reduce menu stock

import { useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/components/ui/Toast'
import { db } from '@/lib/db/indexedDB'
import { STORES } from '@/lib/db/schema'
import { addToQueue } from '@/lib/db/syncQueue'
import { productionPrinter } from '@/lib/print/ProductionPrinter'
import { ReceiptData } from '@/types'

type Category = {
    id: string
    name: string
    icon: string
}

function generateUUID(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = Math.random() * 16 | 0
        const v = c === 'x' ? r : (r & 0x3 | 0x8)
        return v.toString(16)
    })
}

const inFlightRequests = new Map<string, Promise<any>>()

// ✅ SIMPLIFIED: Only reduce menu item stock
async function reduceMenuStock(
    supabase: any,
    menuItemId: string,
    quantitySold: number
) {
    try {
        const { data: menuItem, error: fetchError } = await supabase
            .from('menu_items')
            .select('stock_quantity, name')
            .eq('id', menuItemId)
            .single()

        if (fetchError || !menuItem) {
            console.error('❌ Menu item not found:', menuItemId)
            return
        }

        const currentStock = menuItem.stock_quantity ?? 999
        if (currentStock === 999) {
            console.log(`ℹ️ ${menuItem.name} has unlimited stock, skipping reduction`)
            return
        }

        const newStock = Math.max(0, currentStock - quantitySold)

        const { error: updateError } = await supabase
            .from('menu_items')
            .update({
                stock_quantity: newStock,
                updated_at: new Date().toISOString()
            })
            .eq('id', menuItemId)

        if (updateError) {
            console.error('❌ Failed to update menu stock:', updateError)
            return
        }

        console.log(`✅ Stock reduced: ${menuItem.name} → ${currentStock} - ${quantitySold} = ${newStock}`)
    } catch (error) {
        console.error('❌ Stock reduction error:', error)
    }
}

export function useOrderManagement() {
    const [loading, setLoading] = useState(false)
    const supabase = createClient()
    const toast = useToast()

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

    const cancelOrder = useCallback(async (orderId: string, tableId?: string, orderType?: string) => {
        setLoading(true)
        try {
            const isOfflineOrder = orderId.startsWith('offline_')

            if (isOfflineOrder) {
                const order = await db.get(STORES.ORDERS, orderId) as any
                if (order) {
                    await db.put(STORES.ORDERS, {
                        ...order,
                        status: 'cancelled',
                        synced: true
                    })
                }

                const items = await db.getAll(STORES.ORDER_ITEMS) as any[]
                const orderItems = items.filter(i => i.order_id === orderId)
                for (const item of orderItems) {
                    await db.delete(STORES.ORDER_ITEMS, item.id)
                }

                console.log(`✅ Cancelled offline order ${orderId} - marked as synced, won't upload`)
            } else {
                const { error: orderError } = await supabase
                    .from('orders')
                    .update({ status: 'cancelled', updated_at: new Date().toISOString() })
                    .eq('id', orderId)

                if (orderError) throw orderError
            }

            if (orderType === 'dine-in' && tableId) {
                if (isOfflineOrder) {
                    await addToQueue('update', 'restaurant_tables', {
                        id: tableId,
                        status: 'available',
                        current_order_id: null,
                        waiter_id: null
                    })
                } else {
                    await supabase
                        .from('restaurant_tables')
                        .update({ status: 'available', current_order_id: null, waiter_id: null })
                        .eq('id', tableId)
                }
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

    const printAndComplete = useCallback(async (
        orderId: string,
        tableId?: string,
        orderType?: string
    ) => {
        setLoading(true)
        try {
            const { data: order, error: fetchError } = await supabase
                .from('orders')
                .select(`
                    *,
                    restaurant_tables(table_number),
                    waiters(name),
                    order_items(*, menu_items(name, price, category_id))
                `)
                .eq('id', orderId)
                .single()

            if (fetchError || !order) throw new Error('Order not found')

            const { data: categories } = await supabase
                .from('menu_categories')
                .select('id, name, icon')

            const receiptData: ReceiptData = {
                restaurantName: 'AT RESTAURANT',
                tagline: 'Delicious Food, Memorable Moments',
                address: 'Sooter Mills Rd, Lahore',
                orderNumber: orderId.slice(0, 8).toUpperCase(),
                date: new Date(order.created_at).toLocaleString('en-PK'),
                orderType: order.order_type || 'dine-in',
                tableNumber: order.restaurant_tables?.table_number,
                waiter: order.waiters?.name,
                customerName: order.customer_name,
                customerPhone: order.customer_phone,
                deliveryAddress: order.delivery_address,
                deliveryCharges: order.delivery_charges,
                items: order.order_items.map((item: any) => {
                    const category = (categories as Category[] | null)?.find((c: Category) => c.id === item.menu_items.category_id)
                    return {
                        name: item.menu_items.name,
                        quantity: item.quantity,
                        price: item.menu_items.price,
                        total: item.total_price,
                        category: category ? `${category.icon} ${category.name}` : '📋 Other'
                    }
                }),
                subtotal: order.subtotal,
                tax: order.tax,
                total: order.total_amount,
                paymentMethod: order.payment_method,
                notes: order.notes
            }

            const printResult = await productionPrinter.print(receiptData)

            if (!printResult.success) {
                toast.add('warning', '⚠️ Print queued - will retry automatically')
            } else {
                toast.add('success', '✅ Receipt printed!')
            }

            await markPrinted(orderId)
            const result = await completeOrder(orderId, tableId, orderType)

            return result
        } catch (error: any) {  toast.add('error', `❌ ${error.message}`)
            return { success: false, error: error.message }
        } finally {
            setLoading(false)
        }
    }, [markPrinted, completeOrder, toast, supabase])

    const createOrder = useCallback(async (orderData: any, items: any[]) => {
        const idempotencyKey = orderData.idempotencyKey ||
            `order_${orderData.table_id || 'delivery'}_${Date.now()}`

        if (inFlightRequests.has(idempotencyKey)) {
            console.log('🔄 Order creation already in progress')
            return inFlightRequests.get(idempotencyKey)!
        }

        setLoading(true)

        const createPromise = (async () => {
            try {
                const isOnline = navigator.onLine

                if (isOnline) {
                    const { data: existingOrder } = await supabase
                        .from('orders')
                        .select('id')
                        .eq('table_id', orderData.table_id)
                        .eq('status', 'pending')
                        .gte('created_at', new Date(Date.now() - 60000).toISOString())
                        .single()

                    if (existingOrder) {
                        console.log('⚠️ Duplicate order prevented')
                        return {
                            success: true,
                            order: existingOrder,
                            isDuplicate: true
                        }
                    }

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

                    // ✅ SIMPLIFIED: Only reduce menu stock
                    for (const item of items) {
                        await reduceMenuStock(supabase, item.id, item.quantity)
                    }

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
                    const existingOffline = await db.get(STORES.ORDERS, idempotencyKey)
                    if (existingOffline) {
                        console.log('⚠️ Duplicate offline order prevented')
                        return {
                            success: true,
                            order: existingOffline,
                            isDuplicate: true
                        }
                    }

                    const orderId = `offline_${Date.now()}_${generateUUID().slice(0, 8)}`

                    const offlineOrder = {
                        ...orderData,
                        id: orderId,
                        idempotencyKey,
                        created_at: new Date().toISOString(),
                        synced: false
                    }

                    await db.put(STORES.ORDERS, offlineOrder)

                    const orderItems = items.map(item => ({
                        id: generateUUID(),
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

                    await addToQueue('create', 'orders', offlineOrder)

                    for (const item of orderItems) {
                        await addToQueue('create', 'order_items', item)
                    }

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
                inFlightRequests.delete(idempotencyKey)
            }
        })()

        inFlightRequests.set(idempotencyKey, createPromise)
        return createPromise
    }, [supabase, toast])

    return {
        completeOrder,
        cancelOrder,
        markPrinted,
        printAndComplete,
        createOrder,
        loading
    }
}