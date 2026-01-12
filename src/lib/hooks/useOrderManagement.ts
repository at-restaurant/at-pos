// src/lib/hooks/useOrderManagement.ts - DEXIE VERSION
import { useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/components/ui/Toast'
import { db, dbHelpers } from '@/lib/db/dexie'
import { syncManager } from '@/lib/db/syncManager'
import { productionPrinter } from '@/lib/print/ProductionPrinter'
import type { ReceiptData } from '@/types'

function generateUUID(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = Math.random() * 16 | 0
        const v = c === 'x' ? r : (r & 0x3 | 0x8)
        return v.toString(16)
    })
}

const inFlightRequests = new Map<string, Promise<any>>()

export function useOrderManagement() {
    const [loading, setLoading] = useState(false)
    const supabase = createClient()
    const toast = useToast()

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // CREATE ORDER (OFFLINE-FIRST)
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
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
                const orderId = generateUUID()
                const now = new Date().toISOString()

                const order = {
                    id: orderId,
                    ...orderData,
                    synced: false,
                    created_at: now,
                    updated_at: now
                }

                // Save to Dexie first (instant feedback)
                await db.orders.add(order)

                // Save order items
                const orderItems = items.map(item => ({
                    id: generateUUID(),
                    order_id: orderId,
                    menu_item_id: item.id,
                    quantity: item.quantity,
                    unit_price: item.price,
                    total_price: item.price * item.quantity,
                    created_at: now
                }))

                await db.order_items.bulkAdd(orderItems)

                // Update table status locally if dine-in
                if (orderData.order_type === 'dine-in' && orderData.table_id) {
                    await db.restaurant_tables.update(orderData.table_id, {
                        status: 'occupied',
                        waiter_id: orderData.waiter_id,
                        current_order_id: orderId
                    })
                }

                // Sync to Supabase if online
                if (navigator.onLine) {
                    try {
                        const { data: newOrder, error: orderError } = await supabase
                            .from('orders')
                            .insert(orderData)
                            .select()
                            .single()

                        if (!orderError && newOrder) {
                            // Update with server ID
                            await db.orders.update(orderId, {
                                id: newOrder.id,
                                synced: true
                            })

                            // Update order items with server order ID
                            for (const item of orderItems) {
                                await db.order_items.update(item.id, {
                                    order_id: newOrder.id
                                })
                            }

                            // Insert items on server
                            const itemsToInsert = orderItems.map(item => ({
                                order_id: newOrder.id,
                                menu_item_id: item.menu_item_id,
                                quantity: item.quantity,
                                unit_price: item.unit_price,
                                total_price: item.total_price
                            }))

                            await supabase.from('order_items').insert(itemsToInsert)

                            // Update table on server
                            if (orderData.order_type === 'dine-in' && orderData.table_id) {
                                await supabase
                                    .from('restaurant_tables')
                                    .update({
                                        status: 'occupied',
                                        waiter_id: orderData.waiter_id,
                                        current_order_id: newOrder.id
                                    })
                                    .eq('id', orderData.table_id)
                            }

                            toast.add('success', '✅ Order created!')

                            // ✅ INSTANT SYNC: Already online, no need to trigger
                        } else {
                            // Queue for sync
                            await dbHelpers.addToQueue('orders', 'create', order)
                            toast.add('success', '✅ Order created offline! Will sync when online.')
                        }
                    } catch (error) {
                        // Queue for sync on error
                        await dbHelpers.addToQueue('orders', 'create', order)
                        toast.add('success', '✅ Order created offline! Will sync when online.')
                    }
                } else {
                    // Queue for sync
                    await dbHelpers.addToQueue('orders', 'create', order)
                    toast.add('success', '✅ Order created offline! Will sync when online.')
                }

                return {
                    success: true,
                    order: { ...order, order_items: orderItems }
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

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // PRINT & COMPLETE ORDER
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    const printAndComplete = useCallback(async (
        orderId: string,
        tableId?: string,
        orderType?: string
    ) => {
        setLoading(true)
        try {
            // Get order from Dexie
            const order = await db.orders.get(orderId)
            if (!order) throw new Error('Order not found')

            const orderItems = await db.order_items
                .where('order_id')
                .equals(orderId)
                .toArray()

            // Get menu items and categories
            const enrichedItems = await Promise.all(
                orderItems.map(async (item) => {
                    const menuItem = await db.menu_items.get(item.menu_item_id)
                    const category = menuItem ? await db.menu_categories.get(menuItem.category_id) : null
                    return {
                        ...item,
                        menu_items: menuItem,
                        category: category ? { name: category.name, icon: category.icon } : null
                    }
                })
            )

            // Get table and waiter
            let table = null
            let waiter = null

            if (tableId) {
                table = await db.restaurant_tables.get(tableId)
            }
            if (order.waiter_id) {
                waiter = await db.waiters.get(order.waiter_id)
            }

            // Build receipt
            const receiptData: ReceiptData = {
                restaurantName: 'AT RESTAURANT',
                tagline: 'Delicious Food, Memorable Moments',
                address: 'Sooter Mills Rd, Lahore',
                orderNumber: orderId.slice(0, 8).toUpperCase(),
                date: new Date(order.created_at).toLocaleString('en-PK'),
                orderType: order.order_type || 'dine-in',
                tableNumber: table?.table_number,
                waiter: waiter?.name,
                customerName: order.customer_name,
                customerPhone: order.customer_phone,
                deliveryAddress: order.delivery_address,
                deliveryCharges: order.delivery_charges,
                items: enrichedItems.map((item: any) => ({
                    name: item.menu_items?.name || 'Unknown',
                    quantity: item.quantity,
                    price: item.unit_price,
                    total: item.total_price,
                    category: item.category ? `${item.category.icon} ${item.category.name}` : '📋 Other'
                })),
                subtotal: order.subtotal,
                tax: order.tax,
                total: order.total_amount,
                paymentMethod: order.payment_method,
                notes: order.notes
            }

            // Print
            await productionPrinter.print(receiptData)

            // Update order status
            await db.orders.update(orderId, {
                receipt_printed: true,
                status: 'completed',
                updated_at: new Date().toISOString()
            })

            // Update table if dine-in
            if (orderType === 'dine-in' && tableId) {
                await db.restaurant_tables.update(tableId, {
                    status: 'available',
                    current_order_id: undefined,
                    waiter_id: undefined
                })
            }

            // Sync to Supabase if online
            if (navigator.onLine) {
                await supabase
                    .from('orders')
                    .update({
                        receipt_printed: true,
                        status: 'completed'
                    })
                    .eq('id', orderId)

                if (orderType === 'dine-in' && tableId) {
                    await supabase
                        .from('restaurant_tables')
                        .update({
                            status: 'available',
                            current_order_id: null,
                            waiter_id: null
                        })
                        .eq('id', tableId)
                }
            } else {
                // Queue for sync
                await dbHelpers.addToQueue('orders', 'update', {
                    id: orderId,
                    receipt_printed: true,
                    status: 'completed'
                })
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

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // CANCEL ORDER
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    const cancelOrder = useCallback(async (orderId: string, tableId?: string, orderType?: string) => {
        setLoading(true)
        try {
            // Update in Dexie
            await db.orders.update(orderId, {
                status: 'cancelled',
                updated_at: new Date().toISOString()
            })

            // Update table if dine-in
            if (orderType === 'dine-in' && tableId) {
                await db.restaurant_tables.update(tableId, {
                    status: 'available',
                    current_order_id: undefined,
                    waiter_id: undefined
                })
            }

            // Sync to Supabase if online
            if (navigator.onLine) {
                await supabase
                    .from('orders')
                    .update({ status: 'cancelled' })
                    .eq('id', orderId)

                if (orderType === 'dine-in' && tableId) {
                    await supabase
                        .from('restaurant_tables')
                        .update({
                            status: 'available',
                            current_order_id: null,
                            waiter_id: null
                        })
                        .eq('id', tableId)
                }
            } else {
                await dbHelpers.addToQueue('orders', 'update', {
                    id: orderId,
                    status: 'cancelled'
                })
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
            await db.orders.update(orderId, { receipt_printed: true })

            if (navigator.onLine) {
                await supabase
                    .from('orders')
                    .update({ receipt_printed: true })
                    .eq('id', orderId)
            }

            return { success: true }
        } catch (error: any) {
            return { success: false }
        }
    }, [supabase])

    const completeOrder = useCallback(async (orderId: string, tableId?: string, orderType?: string) => {
        setLoading(true)
        try {
            await db.orders.update(orderId, {
                status: 'completed',
                updated_at: new Date().toISOString()
            })

            if (orderType === 'dine-in' && tableId) {
                await db.restaurant_tables.update(tableId, {
                    status: 'available',
                    current_order_id: undefined,
                    waiter_id: undefined
                })
            }

            if (navigator.onLine) {
                await supabase
                    .from('orders')
                    .update({ status: 'completed' })
                    .eq('id', orderId)

                if (orderType === 'dine-in' && tableId) {
                    await supabase
                        .from('restaurant_tables')
                        .update({
                            status: 'available',
                            current_order_id: null,
                            waiter_id: null
                        })
                        .eq('id', tableId)
                }
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

    return {
        createOrder,
        completeOrder,
        cancelOrder,
        markPrinted,
        printAndComplete,
        loading
    }
}