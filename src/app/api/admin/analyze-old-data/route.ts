import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: Request) {
    try {
        const { days } = await request.json()
        const cutoffDate = new Date()
        cutoffDate.setDate(cutoffDate.getDate() - days)

        const supabase = await createClient()

        // Count old orders
        const { count: ordersCount } = await supabase
            .from('orders')
            .select('*', { count: 'exact', head: true })
            .lt('created_at', cutoffDate.toISOString())
            .eq('status', 'completed')

        // Get images from old orders
        const { data: oldOrders } = await supabase
            .from('orders')
            .select('order_items(menu_items(image_url))')
            .lt('created_at', cutoffDate.toISOString())
            .eq('status', 'completed')

        const imageUrls = new Set<string>()
        oldOrders?.forEach((order: any) => {
            order.order_items?.forEach((item: any) => {
                if (item.menu_items?.image_url?.includes('cloudinary')) {
                    imageUrls.add(item.menu_items.image_url)
                }
            })
        })

        return NextResponse.json({
            orders: ordersCount || 0,
            images: imageUrls.size,
            size: Math.round((ordersCount || 0) * 0.005 + imageUrls.size * 0.1) // Rough estimate
        })
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}