// ✅ Reusable DB optimization functions
import { createClient } from '@/lib/supabase/client'

export async function generateDailySummary(date: string) {
    const supabase = createClient()
    const start = new Date(date)
    start.setHours(0, 0, 0, 0)
    const end = new Date(start)
    end.setDate(end.getDate() + 1)

    // Get orders for the day
    const { data: orders } = await supabase
        .from('orders')
        .select('total_amount, subtotal, tax, status')
        .gte('created_at', start.toISOString())
        .lt('created_at', end.toISOString())

    const completed = orders?.filter(o => o.status === 'completed') || []
    const totalRevenue = completed.reduce((s, o) => s + (o.total_amount || 0), 0)
    const totalTax = completed.reduce((s, o) => s + (o.tax || 0), 0)

    // Get inventory cost (simple estimation)
    const { data: inventory } = await supabase
        .from('inventory_items')
        .select('quantity, purchase_price')

    const inventoryCost = inventory?.reduce((s, i) => s + (i.quantity * i.purchase_price * 0.1), 0) || 0
    const netProfit = totalRevenue - inventoryCost - totalTax

    // Upsert summary
    await supabase.from('daily_summaries').upsert({
        date,
        total_revenue: totalRevenue,
        total_orders: completed.length,
        total_tax: totalTax,
        net_profit: netProfit,
        inventory_cost: inventoryCost
    }, { onConflict: 'date' })

    return { success: true, totalRevenue, netProfit }
}

export async function archiveOldData(daysToKeep = 90) {
    const supabase = createClient()
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep)

    // Move old orders to archive
    const { data: oldOrders } = await supabase
        .from('orders')
        .select('*')
        .lt('created_at', cutoffDate.toISOString())
        .eq('status', 'completed')

    if (oldOrders?.length) {
        await supabase.from('orders_archive').insert(oldOrders)
        const orderIds = oldOrders.map(o => o.id)

        // Move order items
        const { data: oldItems } = await supabase
            .from('order_items')
            .select('*')
            .in('order_id', orderIds)

        if (oldItems?.length) {
            await supabase.from('order_items_archive').insert(oldItems)
            await supabase.from('order_items').delete().in('order_id', orderIds)
        }

        await supabase.from('orders').delete().in('id', orderIds)
    }

    return { archived: oldOrders?.length || 0 }
}