// src/app/api/admin/cleanup-data/route.ts - NEW ADVANCED CLEANUP
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: Request) {
    try {
        const { timeRange, keepImportant } = await request.json()

        // Time ranges: '1month', '3months', '6months', '1year'
        const daysMap: Record<string, number> = {
            '1month': 30,
            '3months': 90,
            '6months': 180,
            '1year': 365
        }

        const days = daysMap[timeRange] || 90
        const cutoffDate = new Date()
        cutoffDate.setDate(cutoffDate.getDate() - days)

        const supabase = await createClient()

        // Get old orders (exclude important ones if flag is set)
        let query = supabase
            .from('orders')
            .select('id, total_amount, payment_method, order_items(menu_items(image_url))')
            .lt('created_at', cutoffDate.toISOString())
            .eq('status', 'completed')

        // Keep important orders (large amounts, special payments)
        if (keepImportant) {
            query = query.lt('total_amount', 10000) // Keep orders over 10,000 PKR
        }

        const { data: oldOrders } = await query

        if (!oldOrders || oldOrders.length === 0) {
            return NextResponse.json({
                success: true,
                deleted: { orders: 0, images: 0, sizeFreed: 0 },
                message: 'No old data to clean'
            })
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

        // Estimate size freed (rough calculation)
        const ordersSize = oldOrders.length * 0.005 // ~5KB per order
        const imagesSize = deletedImages * 0.1 // ~100KB per image
        const sizeFreed = Math.round(ordersSize + imagesSize)

        return NextResponse.json({
            success: true,
            deleted: {
                orders: oldOrders.length,
                images: deletedImages,
                sizeFreed: sizeFreed
            },
            message: `✅ Cleaned ${oldOrders.length} orders and ${deletedImages} images (${sizeFreed} MB freed)`
        })
    } catch (error: any) {
        console.error('Cleanup error:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}