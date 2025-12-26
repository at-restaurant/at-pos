// src/app/api/storage/cloudinary-status/route.ts - NEW FILE
import { NextResponse } from 'next/server'
import { v2 as cloudinary } from 'cloudinary'

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
})

export async function GET() {
    try {
        // Get Cloudinary usage stats
        const result = await cloudinary.api.usage()

        const usedGB = (result.storage?.used_bytes || 0) / (1024 * 1024 * 1024)
        const limitGB = (result.storage?.limit || 25 * 1024 * 1024 * 1024) / (1024 * 1024 * 1024)

        return NextResponse.json({
            usedGB: parseFloat(usedGB.toFixed(2)),
            limitGB: parseFloat(limitGB.toFixed(2)),
            percentage: ((usedGB / limitGB) * 100).toFixed(1),
            imageCount: result.resources?.image?.count || 0
        })
    } catch (error: any) {
        console.error('Cloudinary status error:', error)
        return NextResponse.json({
            usedGB: 0,
            limitGB: 25,
            percentage: 0,
            imageCount: 0,
            error: error.message
        })
    }
}