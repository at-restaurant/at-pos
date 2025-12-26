import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: Request) {
    try {
        const { days } = await request.json()
        const cutoffDate = new Date()
        cutoffDate.setDate(cutoffDate.getDate() - days)

        const supabase = await createClient()

        // Get old orders with images
        const { data: oldOrders } = await supabase
            .from('orders')
            .select('id, order_items(menu_items(image_url))')
            .lt('created_at', cutoffDate.toISOString())
            .eq('status', 'completed')

        if (!oldOrders || oldOrders.length === 0) {
            return NextResponse.json({ success: true, deleted: { orders: 0, images: 0, size: 0 } })
        }

        const orderIds = oldOrders.map(o => o.id)

        // Collect unique Cloudinary images
        const imageUrls = new Set<string>()
        oldOrders.forEach((order: any) => {
            order.order_items?.forEach((item: any) => {
                if (item.menu_items?.image_url?.includes('cloudinary')) {
                    imageUrls.add(item.menu_items.image_url)
                }
            })
        })

        // Delete order items first (foreign key constraint)
        await supabase
            .from('order_items')
            .delete()
            .in('order_id', orderIds)

        // Delete orders
        await supabase
            .from('orders')
            .delete()
            .in('id', orderIds)

        // Delete Cloudinary images
        let deletedImages = 0
        for (const imageUrl of imageUrls) {
            try {
                const publicId = imageUrl.split('/').slice(-2).join('/').split('.')[0]
                const response = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL}/api/upload/cloudinary`, {
                    method: 'DELETE',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ public_id: publicId })
                })
                if (response.ok) deletedImages++
            } catch (err) {
                console.warn('Failed to delete image:', imageUrl)
            }
        }

        return NextResponse.json({
            success: true,
            deleted: {
                orders: oldOrders.length,
                images: deletedImages,
                size: Math.round(oldOrders.length * 0.005 + deletedImages * 0.1)
            }
        })
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}