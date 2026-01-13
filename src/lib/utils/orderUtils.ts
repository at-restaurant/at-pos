// src/lib/utils/orderUtils.ts - REUSABLE ORDER LOGIC
import { db, dbHelpers } from '@/lib/db/dexie'
import { createClient } from '@/lib/supabase/client'
import { syncManager } from '@/lib/db/syncManager'
import { productionPrinter } from '@/lib/print/ProductionPrinter'
import type { OrderWithRelations, ReceiptData, OrderType } from '@/types'

const supabase = createClient()

// ✅ Generate UUID
function uuid() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = Math.random() * 16 | 0
        const v = c === 'x' ? r : (r & 0x3 | 0x8)
        return v.toString(16)
    })
}

// ✅ Determine Order Type & Category
export function categorizeOrder(order: OrderWithRelations): {
    type: OrderType
    category: 'dine-in' | 'delivery' | 'takeaway'
    displayType: OrderType | 'takeaway' // For display purposes only
} {
    if (order.order_type === 'dine-in') {
        return { type: 'dine-in', category: 'dine-in', displayType: 'dine-in' }
    }

    // Check if has customer info
    const hasCustomerInfo = order.customer_name || order.customer_phone || order.delivery_address

    if (hasCustomerInfo) {
        return { type: 'delivery', category: 'delivery', displayType: 'delivery' }
    }

    // Takeaway is delivery without customer info
    return { type: 'delivery', category: 'takeaway', displayType: 'takeaway' as OrderType }
}

// ✅ Get Today's Date Range
export function getTodayRange() {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const end = new Date()
    end.setHours(23, 59, 59, 999)
    return {
        start: today.toISOString(),
        end: end.toISOString(),
        startDate: today,
        endDate: end
    }
}

// ✅ Load Order with Full Relations
export async function loadOrderWithRelations(orderId: string): Promise<OrderWithRelations | null> {
    try {
        const order = await db.orders.get(orderId)
        if (!order) return null

        const items = await db.order_items.where('order_id').equals(orderId).toArray()

        const itemsWithDetails = await Promise.all(
            items.map(async (item) => {
                const menuItem = await db.menu_items.get(item.menu_item_id)
                return {
                    id: item.id,
                    quantity: item.quantity,
                    unit_price: item.unit_price,
                    total_price: item.total_price,
                    menu_item_id: item.menu_item_id,
                    menu_items: menuItem ? {
                        name: menuItem.name,
                        price: menuItem.price,
                        category_id: menuItem.category_id
                    } : undefined
                }
            })
        )

        let tableData = null
        let waiterData = null

        if (order.table_id) {
            tableData = await db.restaurant_tables.get(order.table_id)
        }
        if (order.waiter_id) {
            waiterData = await db.waiters.get(order.waiter_id)
        }

        return {
            ...order,
            order_items: itemsWithDetails,
            restaurant_tables: tableData ? { table_number: tableData.table_number } : undefined,
            waiters: waiterData ? { name: waiterData.name } : undefined
        } as OrderWithRelations
    } catch (error) {
        console.error('Load order error:', error)
        return null
    }
}

// ✅ Create Order (Universal)
export async function createOrder(
    orderData: {
        order_type: OrderType
        status: 'pending' | 'completed'
        subtotal: number
        tax: number
        total_amount: number
        payment_method?: PaymentMethodData
        table_id?: string
        waiter_id?: string
        customer_name?: string
        customer_phone?: string
        delivery_address?: string
        delivery_charges?: number
        notes?: string
    },
    items: Array<{ id: string; quantity: number; price: number; name: string }>
) {
    const orderId = uuid()
    const now = new Date().toISOString()

    const order = {
        id: orderId,
        ...orderData,
        receipt_printed: false,
        synced: false,
        created_at: now,
        updated_at: now
    }

    // Save to Dexie
    await db.orders.add(order as any)

    const orderItems = items.map(item => ({
        id: uuid(),
        order_id: orderId,
        menu_item_id: item.id,
        quantity: item.quantity,
        unit_price: item.price,
        total_price: item.price * item.quantity,
        created_at: now
    }))

    await db.order_items.bulkAdd(orderItems)

    // Update table if dine-in
    if (orderData.order_type === 'dine-in' && orderData.table_id) {
        await db.restaurant_tables.update(orderData.table_id, {
            status: 'occupied',
            waiter_id: orderData.waiter_id,
            current_order_id: orderId
        })
    }

    // Sync online
    if (navigator.onLine) {
        try {
            const { data: newOrder } = await supabase
                .from('orders')
                .insert(orderData)
                .select()
                .single()

            if (newOrder) {
                await db.orders.update(orderId, { id: newOrder.id, synced: true })

                const itemsToInsert = orderItems.map(item => ({
                    order_id: newOrder.id,
                    menu_item_id: item.menu_item_id,
                    quantity: item.quantity,
                    unit_price: item.unit_price,
                    total_price: item.total_price
                }))

                await supabase.from('order_items').insert(itemsToInsert)

                if (orderData.order_type === 'dine-in' && orderData.table_id) {
                    await supabase.from('restaurant_tables').update({
                        status: 'occupied',
                        waiter_id: orderData.waiter_id,
                        current_order_id: newOrder.id
                    }).eq('id', orderData.table_id)
                }
            }
        } catch (error) {
            await dbHelpers.addToQueue('orders', 'create', order)
        }
    } else {
        await dbHelpers.addToQueue('orders', 'create', order)
    }

    return { success: true, orderId, order: { ...order, order_items: orderItems } }
}

// ✅ Print & Complete Order
export async function printAndCompleteOrder(
    order: OrderWithRelations,
    menuCategories: Record<string, { name: string; icon: string }>
) {
    const { type, displayType } = categorizeOrder(order)

    const receiptData: ReceiptData = {
        restaurantName: 'AT RESTAURANT',
        tagline: 'Delicious Food, Memorable Moments',
        address: 'Sooter Mills Rd, Lahore',
        orderNumber: order.id.slice(0, 8).toUpperCase(),
        date: new Date(order.created_at).toLocaleString('en-PK'),
        orderType: type, // ✅ FIXED: Always 'dine-in' or 'delivery'
        customerName: order.customer_name,
        customerPhone: order.customer_phone,
        deliveryAddress: order.delivery_address,
        deliveryCharges: order.delivery_charges,
        tableNumber: order.restaurant_tables?.table_number,
        waiter: order.waiters?.name,
        items: order.order_items.map((item) => {
            const category = menuCategories[item.menu_item_id]
            return {
                name: item.menu_items?.name || 'Unknown',
                quantity: item.quantity,
                price: item.unit_price,
                total: item.total_price,
                category: category ? `${category.icon} ${category.name}` : '📋 Uncategorized'
            }
        }),
        subtotal: order.subtotal,
        tax: order.tax,
        total: order.total_amount,
        paymentMethod: order.payment_method,
        notes: order.notes
    }

    await productionPrinter.print(receiptData)

    // Update order
    if (navigator.onLine) {
        await supabase.from('orders').update({
            receipt_printed: true,
            status: 'completed',
            updated_at: new Date().toISOString()
        }).eq('id', order.id)

        if (order.order_type === 'dine-in' && order.table_id) {
            await supabase.from('restaurant_tables').update({
                status: 'available',
                current_order_id: null,
                waiter_id: null
            }).eq('id', order.table_id)
        }
    } else {
        await db.orders.update(order.id, {
            receipt_printed: true,
            status: 'completed',
            updated_at: new Date().toISOString()
        })

        await dbHelpers.addToQueue('orders', 'update', {
            id: order.id,
            receipt_printed: true,
            status: 'completed'
        })
    }

    return { success: true }
}

// ✅ Cancel Order
export async function cancelOrder(order: OrderWithRelations) {
    if (navigator.onLine) {
        await supabase.from('orders').update({ status: 'cancelled' }).eq('id', order.id)

        if (order.order_type === 'dine-in' && order.table_id) {
            await supabase.from('restaurant_tables').update({
                status: 'available',
                current_order_id: null,
                waiter_id: null
            }).eq('id', order.table_id)
        }
    } else {
        await db.orders.update(order.id, { status: 'cancelled' })
        await dbHelpers.addToQueue('orders', 'update', { id: order.id, status: 'cancelled' })
    }

    return { success: true }
}

// ✅ Calculate Today's Stats
export function calculateTodayStats(orders: OrderWithRelations[]) {
    const { startDate, endDate } = getTodayRange()

    const todayOrders = orders.filter(o => {
        const orderDate = new Date(o.created_at)
        return orderDate >= startDate && orderDate <= endDate && o.status === 'completed'
    })

    const dineIn = todayOrders.filter(o => o.order_type === 'dine-in')
    const delivery = todayOrders.filter(o => {
        const { category } = categorizeOrder(o)
        return category === 'delivery'
    })
    const takeaway = todayOrders.filter(o => {
        const { category } = categorizeOrder(o)
        return category === 'takeaway'
    })

    const totalRevenue = todayOrders.reduce((sum, o) => sum + o.total_amount, 0)
    const totalDeliveryCharges = delivery.reduce((sum, o) => sum + (o.delivery_charges || 0), 0)
    const cashPayments = todayOrders.filter(o => o.payment_method === 'cash')
        .reduce((sum, o) => sum + o.total_amount, 0)
    const onlinePayments = todayOrders.filter(o => o.payment_method === 'online')
        .reduce((sum, o) => sum + o.total_amount, 0)

    return {
        active: orders.filter(o => o.status === 'pending').length,
        dineInToday: dineIn.length,
        delivery: delivery.length,
        takeaway: takeaway.length,
        totalRevenue,
        totalDeliveryCharges,
        cashPayments,
        onlinePayments
    }
}