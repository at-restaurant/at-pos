// src/lib/utils/historyHelpers.ts - FIXED
import { createClient } from '@/lib/supabase/client'

type DateRange = 'today' | 'week' | 'month' | 'year'
type TrendType = 'up' | 'down' | 'neutral' // ✅ ADD TYPE

export const getDateRange = (range: DateRange) => {
    const now = new Date()
    const start = new Date()

    const ranges = {
        today: () => start.setHours(0, 0, 0, 0),
        week: () => start.setDate(now.getDate() - 7),
        month: () => start.setMonth(now.getMonth() - 1),
        year: () => start.setFullYear(now.getFullYear() - 1)
    }

    ranges[range]()
    return { startDate: start.toISOString(), endDate: now.toISOString() }
}

export const getPreviousDateRange = (range: DateRange) => {
    const { startDate } = getDateRange(range)
    const start = new Date(startDate)
    const duration = new Date().getTime() - start.getTime()
    return {
        startDate: new Date(start.getTime() - duration).toISOString(),
        endDate: start.toISOString()
    }
}

// ✅ FIX: Remove 'as const', use explicit type
export const calculateComparison = (current: number, previous: number): { change: number; trend: TrendType } => {
    if (previous === 0) return { change: 0, trend: 'neutral' }
    const change = ((current - previous) / previous) * 100

    let trend: TrendType = 'neutral'
    if (change > 0) trend = 'up'
    else if (change < 0) trend = 'down'

    return {
        change: Math.abs(change),
        trend
    }
}

async function fetchOrders(startDate: string, endDate: string, select = 'total_amount') {
    const supabase = createClient()
    const { data, error } = await supabase
        .from('orders')
        .select(select)
        .gte('created_at', startDate)
        .lte('created_at', endDate)
        .eq('status', 'completed')

    if (error) throw error
    return data || []
}

export const loadWaiterReport = async (start: string, end: string, prevRange: any) => {
    const daysDiff = Math.ceil((new Date(end).getTime() - new Date(start).getTime()) / (1000 * 60 * 60 * 24))

    if (daysDiff > 7) {
        const orders = await fetchOrders(start, end, 'waiter_id, total_amount, waiters(name, profile_pic)')

        const waiterData = orders.reduce((acc: any, order: any) => {
            const wId = order.waiter_id
            if (!acc[wId]) {
                acc[wId] = {
                    waiter_name: order.waiters?.name || 'Unknown',
                    profile_pic: order.waiters?.profile_pic,
                    total_orders: 0,
                    total_revenue: 0
                }
            }
            acc[wId].total_orders += 1
            acc[wId].total_revenue += order.total_amount || 0
            return acc
        }, {})

        const result = Object.values(waiterData)
        const totalRevenue = result.reduce((s: number, w: any) => s + w.total_revenue, 0)

        const prevOrders = await fetchOrders(prevRange.startDate, prevRange.endDate)
        const prevRevenue = prevOrders.reduce((s, o: any) => s + (o.total_amount || 0), 0)

        return { result, comparison: calculateComparison(totalRevenue, prevRevenue) }
    }

    const [currentOrders, prevOrders] = await Promise.all([
        fetchOrders(start, end, 'waiter_id, total_amount, waiters(name, profile_pic), order_items(quantity, menu_items(name))'),
        fetchOrders(prevRange.startDate, prevRange.endDate)
    ])

    const waiterData = currentOrders.reduce((acc: any, order: any) => {
        const wId = order.waiter_id
        if (!acc[wId]) {
            acc[wId] = {
                waiter_name: order.waiters?.name || 'Unknown',
                profile_pic: order.waiters?.profile_pic,
                total_orders: 0,
                total_items_served: 0,
                total_revenue: 0,
                items_detail: {}
            }
        }
        acc[wId].total_orders += 1
        acc[wId].total_revenue += order.total_amount || 0

        order.order_items?.forEach((item: any) => {
            acc[wId].total_items_served += item.quantity
            const itemName = item.menu_items?.name || 'Unknown'
            acc[wId].items_detail[itemName] = (acc[wId].items_detail[itemName] || 0) + item.quantity
        })
        return acc
    }, {})

    const result = Object.values(waiterData).map((w: any) => ({
        ...w,
        top_item: Object.entries(w.items_detail).sort((a: any, b: any) => b[1] - a[1])[0]?.[0] || 'None'
    }))

    const totalRevenue = result.reduce((s, w: any) => s + w.total_revenue, 0)
    const prevRevenue = prevOrders.reduce((s, o: any) => s + (o.total_amount || 0), 0)

    return { result, comparison: calculateComparison(totalRevenue, prevRevenue) }
}

export const loadMenuReport = async (start: string, end: string, prevRange: any) => {
    const supabase = createClient()

    const [totalMenuRes, servedRes, prevServedRes] = await Promise.all([
        supabase.from('menu_items').select('id, name, price, is_available'),
        supabase.from('order_items').select('menu_item_id, quantity, unit_price')
            .gte('created_at', start).lte('created_at', end),
        supabase.from('order_items').select('quantity')
            .gte('created_at', prevRange.startDate).lte('created_at', prevRange.endDate)
    ])

    type MenuStat = {
        item_name: string
        price: number
        available: boolean
        total_quantity: number
        total_revenue: number
    }

    const menuStats: Record<string, MenuStat> = (totalMenuRes.data || []).reduce((acc: Record<string, MenuStat>, item) => {
        acc[item.id] = {
            item_name: item.name,
            price: item.price,
            available: item.is_available,
            total_quantity: 0,
            total_revenue: 0
        }
        return acc
    }, {})

    servedRes.data?.forEach((order: any) => {
        if (menuStats[order.menu_item_id]) {
            menuStats[order.menu_item_id].total_quantity += order.quantity
            menuStats[order.menu_item_id].total_revenue += order.quantity * (order.unit_price || 0)
        }
    })

    const result = Object.values(menuStats).sort((a, b) => b.total_quantity - a.total_quantity)
    const servedItems = result.filter(r => r.total_quantity > 0)

    return {
        result,
        comparison: calculateComparison(servedItems.length, prevServedRes.data?.length || 0)
    }
}

export const loadInventoryUsage = async () => {
    const supabase = createClient()
    const { data, error } = await supabase
        .from('inventory_items')
        .select('id, name, quantity, unit, purchase_price, reorder_level')

    if (error) throw error

    return {
        result: (data || []).map(item => ({
            item_name: item.name,
            current_stock: item.quantity,
            unit: item.unit,
            purchase_price: item.purchase_price,
            reorder_level: item.reorder_level,
            stock_value: item.quantity * item.purchase_price,
            status: item.quantity <= item.reorder_level ? 'Low Stock' : 'OK'
        })).sort((a, b) => a.current_stock - b.current_stock)
    }
}

export const loadProfitLoss = async (start: string, end: string, prevRange: any) => {
    const supabase = createClient()
    const daysDiff = Math.ceil((new Date(end).getTime() - new Date(start).getTime()) / (1000 * 60 * 60 * 24))

    if (daysDiff > 7) {
        const { data: summaries } = await supabase
            .from('daily_summaries')
            .select('*')
            .gte('date', start.split('T')[0])
            .lte('date', end.split('T')[0])

        if (summaries?.length) {
            const totals = summaries.reduce((acc, d) => ({
                revenue: acc.revenue + (d.total_revenue || 0),
                tax: acc.tax + (d.total_tax || 0),
                inventory: acc.inventory + (d.inventory_cost || 0),
                profit: acc.profit + (d.net_profit || 0)
            }), { revenue: 0, tax: 0, inventory: 0, profit: 0 })

            const { data: prevSummaries } = await supabase
                .from('daily_summaries')
                .select('total_revenue')
                .gte('date', prevRange.startDate.split('T')[0])
                .lte('date', prevRange.endDate.split('T')[0])

            const prevRevenue = prevSummaries?.reduce((s, d) => s + (d.total_revenue || 0), 0) || 0

            return {
                result: [
                    { category: 'Total Revenue', amount: totals.revenue, type: 'income' },
                    { category: 'Tax Collected', amount: totals.tax, type: 'neutral' },
                    { category: 'Inventory Cost', amount: totals.inventory, type: 'expense' },
                    { category: 'Net Profit', amount: totals.profit, type: totals.profit >= 0 ? 'profit' : 'loss' }
                ],
                comparison: calculateComparison(totals.revenue, prevRevenue),
                netProfit: totals.profit
            }
        }
    }

    const [ordersRes, prevOrdersRes, inventoryRes, paymentStats] = await Promise.all([
        fetchOrders(start, end, 'total_amount, subtotal, tax, payment_method'),
        fetchOrders(prevRange.startDate, prevRange.endDate),
        supabase.from('inventory_items').select('quantity, purchase_price'),
        fetchOrders(start, end, 'payment_method, total_amount')
    ])

    const totalRevenue = ordersRes.reduce((s, o: any) => s + (o.total_amount || 0), 0)
    const totalTax = ordersRes.reduce((s, o: any) => s + (o.tax || 0), 0)
    const inventoryCost = (inventoryRes.data || []).reduce((s, i: any) =>
        s + (i.quantity * i.purchase_price * 0.1), 0)
    const netProfit = totalRevenue - inventoryCost - totalTax

    const cashRevenue = paymentStats.filter((o: any) => o.payment_method === 'cash')
        .reduce((s, o: any) => s + o.total_amount, 0)
    const onlineRevenue = paymentStats.filter((o: any) => o.payment_method === 'online')
        .reduce((s, o: any) => s + o.total_amount, 0)

    const prevRevenue = prevOrdersRes.reduce((s, o: any) => s + (o.total_amount || 0), 0)

    return {
        result: [
            { category: 'Total Revenue', amount: totalRevenue, type: 'income' },
            { category: 'Cash Payments', amount: cashRevenue, type: 'income' },
            { category: 'Online Payments', amount: onlineRevenue, type: 'income' },
            { category: 'Tax Collected', amount: totalTax, type: 'neutral' },
            { category: 'Inventory Cost', amount: inventoryCost, type: 'expense' },
            { category: 'Net Profit', amount: netProfit, type: netProfit >= 0 ? 'profit' : 'loss' }
        ],
        comparison: calculateComparison(totalRevenue, prevRevenue),
        netProfit
    }
}