"use client"
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
export async function reduceMenuStock(
    supabase: any,
    menuItemId: string,
    quantitySold: number
) {
    try {
        const { data: menuItem, error: fetchError } = await supabase
            .from('menu_items')
            .select('stock_quantity, name, track_stock')
            .eq('id', menuItemId)
            .single()

        if (fetchError || !menuItem) {
            console.error('❌ Menu item not found:', menuItemId)
            return
        }

        const shouldTrack = menuItem.track_stock ?? false;
        if (!shouldTrack) {
            console.log(`ℹ️ ${menuItem.name} does not track stock, skipping reduction`)
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

// ✅ NEW: Reduce linked ingredients
export async function reduceLinkedIngredients(
    supabase: any,
    menuItemId: string,
    quantitySold: number,
    variantName?: string | null
) {
    try {
        // Get menu item with linked ingredients
        const { data: menuItem, error } = await supabase
            .from('menu_items')
            .select('linked_ingredients, name')
            .eq('id', menuItemId)
            .single()

        if (error || !menuItem) {
            console.log('❌ Menu item not found:', menuItemId)
            return
        }

        const linkedIngredients = menuItem.linked_ingredients as Array<{
            ingredient_id: string
            quantity_needed: number
            variant_quantities?: Record<string, number>
        }> | null

        if (!linkedIngredients || linkedIngredients.length === 0) {
            console.log(`ℹ️ ${menuItem.name} has no linked ingredients`)
            return
        }

        // Reduce each linked ingredient
        for (const link of linkedIngredients) {
            const qtyNeededPerItem = (variantName && link.variant_quantities?.[variantName] !== undefined)
                ? link.variant_quantities[variantName]
                : link.quantity_needed;

            if (qtyNeededPerItem <= 0) continue;

            const totalNeeded = qtyNeededPerItem * quantitySold

            const { data: ingredient, error: fetchError } = await supabase
                .from('inventory_items')
                .select('quantity, name, unit')
                .eq('id', link.ingredient_id)
                .single()

            if (fetchError || !ingredient) {
                console.log(`❌ Ingredient not found: ${link.ingredient_id}`)
                continue
            }

            const newQuantity = Math.max(0, ingredient.quantity - totalNeeded)

            const { error: updateError } = await supabase
                .from('inventory_items')
                .update({
                    quantity: newQuantity,
                    updated_at: new Date().toISOString()
                })
                .eq('id', link.ingredient_id)

            if (updateError) {
                console.log(`❌ Failed to update ${ingredient.name}:`, updateError)
                continue
            }

            console.log(`✅ Ingredient reduced: ${ingredient.name} → ${ingredient.quantity} - ${totalNeeded} = ${newQuantity} ${ingredient.unit}`)
        }
    } catch (error) {
        console.log('❌ Linked ingredients reduction error:', error)
    }
}

async function updateLocalTableStatus(
    tableId: string,
    status: 'occupied' | 'available',
    currentOrderId: string | null,
    waiterId: string | null
) {
    try {
        const tablesCache = await db.get(STORES.SETTINGS, 'restaurant_tables') as any
        if (tablesCache && tablesCache.value) {
            const updatedTables = tablesCache.value.map((t: any) => {
                if (t.id === tableId) {
                    return {
                        ...t,
                        status,
                        current_order_id: currentOrderId,
                        waiter_id: waiterId
                    }
                }
                return t
            })
            await db.put(STORES.SETTINGS, { key: 'restaurant_tables', value: updatedTables })
        }
    } catch (err) {
        console.error('Failed to update local table status:', err)
    }
}

export function useOrderManagement() {
    const [loading, setLoading] = useState(false)
    const supabase = createClient()
    const toast = useToast()

    const completeOrder = useCallback(async (orderId: string, tableId?: string, orderType?: string) => {
        setLoading(true)
        try {
            const isOfflineOrder = orderId.startsWith('offline_')
            let updatedOnline = false

            if (!isOfflineOrder && navigator.onLine) {
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
                    updatedOnline = true
                } catch (netErr: any) {
                    const isNetErr = netErr?.message?.includes('Failed to fetch') || netErr?.message?.includes('NetworkError') || !navigator.onLine
                    if (!isNetErr) throw netErr
                    console.warn('Failed to complete online due to network, falling back to offline sync queue')
                }
            }

            if (!updatedOnline) {
                const order = await db.get(STORES.ORDERS, orderId) as any
                if (order) {
                    await db.put(STORES.ORDERS, {
                        ...order,
                        status: 'completed',
                        synced: false
                    })
                }

                await addToQueue('update', 'orders', {
                    id: orderId,
                    status: 'completed',
                    updated_at: new Date().toISOString()
                })

                if (orderType === 'dine-in' && tableId) {
                    await addToQueue('update', 'restaurant_tables', {
                        id: tableId,
                        status: 'available',
                        current_order_id: null,
                        waiter_id: null
                    })
                }
            }

            if (orderType === 'dine-in' && tableId) {
                await updateLocalTableStatus(tableId, 'available', null, null)
            }

            // Always update order status locally
            const orderObj = await db.get(STORES.ORDERS, orderId) as any
            if (orderObj) {
                await db.put(STORES.ORDERS, {
                    ...orderObj,
                    status: 'completed',
                    updated_at: new Date().toISOString()
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

    const cancelOrder = useCallback(async (orderId: string, tableId?: string, orderType?: string) => {
        setLoading(true)
        try {
            const isOfflineOrder = orderId.startsWith('offline_')
            let updatedOnline = false

            if (!isOfflineOrder && navigator.onLine) {
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
                    updatedOnline = true
                } catch (netErr: any) {
                    const isNetErr = netErr?.message?.includes('Failed to fetch') || netErr?.message?.includes('NetworkError') || !navigator.onLine
                    if (!isNetErr) throw netErr
                    console.warn('Failed to cancel online due to network, falling back to offline sync queue')
                }
            }

            if (!updatedOnline) {
                const order = await db.get(STORES.ORDERS, orderId) as any
                if (order) {
                    await db.put(STORES.ORDERS, {
                        ...order,
                        status: 'cancelled',
                        synced: true // Marked as synced so we don't try to sync again if offline cancelled
                    })
                }

                if (!isOfflineOrder) {
                    await addToQueue('update', 'orders', {
                        id: orderId,
                        status: 'cancelled',
                        updated_at: new Date().toISOString()
                    })
                } else {
                    const items = await db.getAll(STORES.ORDER_ITEMS) as any[]
                    const orderItems = items.filter(i => i.order_id === orderId)
                    for (const item of orderItems) {
                        await db.delete(STORES.ORDER_ITEMS, item.id)
                    }
                }

                if (orderType === 'dine-in' && tableId) {
                    await addToQueue('update', 'restaurant_tables', {
                        id: tableId,
                        status: 'available',
                        current_order_id: null,
                        waiter_id: null
                    })
                }
            }

            if (orderType === 'dine-in' && tableId) {
                await updateLocalTableStatus(tableId, 'available', null, null)
            }

            // Always update order status locally
            const orderObj = await db.get(STORES.ORDERS, orderId) as any
            if (orderObj) {
                await db.put(STORES.ORDERS, {
                    ...orderObj,
                    status: 'cancelled',
                    updated_at: new Date().toISOString()
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

            const savedReceiptStr = typeof window !== 'undefined' ? localStorage.getItem('receipt_settings') : null
            const receiptSettings = savedReceiptStr ? JSON.parse(savedReceiptStr) : {}

            const receiptData: ReceiptData = {
                restaurantName: 'AT RESTAURANT',
                tagline: 'Delicious Food, Memorable Moments',
                address: 'Sooter Mills Rd, Lahore',
                phone: receiptSettings.phone,
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
        } catch (error: any) {
            toast.add('error', `❌ ${error.message}`)
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
                let isOnline = navigator.onLine
                let onlineSuccess = false

                if (isOnline) {
                    try {
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

                        const orderItems = items.map(item => {
                            const isVariant = String(item.id).includes('__')
                            const menuItemId = isVariant ? String(item.id).split('__')[0] : item.id
                            const variantName = isVariant ? String(item.id).split('__')[1] : null
                            return {
                                order_id: order.id,
                                menu_item_id: menuItemId,
                                quantity: item.quantity,
                                unit_price: item.price,
                                total_price: item.price * item.quantity,
                                variant_name: variantName
                            }
                        })

                        const { error: itemsError } = await supabase
                            .from('order_items')
                            .insert(orderItems)

                        if (itemsError) throw itemsError

                        // ✅ UPDATED: Reduce both menu stock AND linked ingredients
                        for (const item of items) {
                            const isVariant = String(item.id).includes('__')
                            const menuItemId = isVariant ? String(item.id).split('__')[0] : item.id
                            const variantName = isVariant ? String(item.id).split('__')[1] : null
                            await reduceMenuStock(supabase, menuItemId, item.quantity)
                            await reduceLinkedIngredients(supabase, menuItemId, item.quantity, variantName) // 🆕 NEW
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

                            await updateLocalTableStatus(orderData.table_id, 'occupied', order.id, orderData.waiter_id)
                        }

                        if (orderData.waiter_id) {
                            await supabase.rpc('increment_waiter_stats', {
                                p_waiter_id: orderData.waiter_id,
                                p_orders: 1,
                                p_revenue: orderData.total_amount
                            })
                        }

                        toast.add('success', '✅ Order created!')
                        onlineSuccess = true
                        return { success: true, order }
                    } catch (err: any) {
                        if (err?.message?.includes('Failed to fetch') || err?.message?.includes('NetworkError')) {
                            console.warn('Network error during online order creation, falling back to offline mode')
                            isOnline = false
                        } else {
                            throw err
                        }
                    }
                }

                if (!isOnline) {
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

                    if (orderData.order_type === 'dine-in' && orderData.table_id) {
                        await updateLocalTableStatus(orderData.table_id, 'occupied', orderId, orderData.waiter_id)
                    }

                    const orderItems = items.map(item => {
                        const isVariant = String(item.id).includes('__')
                        const menuItemId = isVariant ? String(item.id).split('__')[0] : item.id
                        const variantName = isVariant ? String(item.id).split('__')[1] : null
                        return {
                            id: generateUUID(),
                            order_id: orderId,
                            menu_item_id: menuItemId,
                            quantity: item.quantity,
                            unit_price: item.price,
                            total_price: item.price * item.quantity,
                            variant_name: variantName,
                            created_at: new Date().toISOString()
                        }
                    })

                    for (const item of orderItems) {
                        await db.put(STORES.ORDER_ITEMS, item)
                        await addToQueue('create', 'order_items', item)
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