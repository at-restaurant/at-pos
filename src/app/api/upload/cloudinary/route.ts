// src/app/api/upload/cloudinary/route.ts - FINAL COMPLETE VERSION
import { NextResponse } from 'next/server'
import { v2 as cloudinary } from 'cloudinary'

// Configure Cloudinary
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
})

export const dynamic = 'force-dynamic'
export const revalidate = false

export async function POST(request: Request) {
    try {
        const formData = await request.formData()
        const file = formData.get('file') as File
        const folder = formData.get('folder') as string || 'restaurant'

        if (!file) {
            return NextResponse.json({ error: 'No file provided' }, { status: 400 })
        }

        // ✅ File validation
        const maxSize = 10 * 1024 * 1024 // 10MB
        if (file.size > maxSize) {
            return NextResponse.json({
                error: 'File too large. Maximum size is 10MB'
            }, { status: 400 })
        }

        const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
        if (!allowedTypes.includes(file.type)) {
            return NextResponse.json({
                error: 'Invalid file type. Only JPEG, PNG, WebP, and GIF are allowed'
            }, { status: 400 })
        }

        // Convert file to buffer
        const bytes = await file.arrayBuffer()
        const buffer = Buffer.from(bytes)

        // ✅ OPTIMIZED: Better transformation settings
        const result = await new Promise((resolve, reject) => {
            const uploadStream = cloudinary.uploader.upload_stream(
                {
                    folder: `restaurant/${folder}`,
                    resource_type: 'image',
                    transformation: [
                        { width: 1200, height: 1200, crop: 'limit' },
                        { quality: 'auto:good' },
                        { fetch_format: 'auto' },
                        { flags: 'progressive' }
                    ],
                    responsive_breakpoints: {
                        create_derived: true,
                        bytes_step: 20000,
                        min_width: 200,
                        max_width: 1200,
                        max_images: 5
                    }
                },
                (error, result) => {
                    if (error) reject(error)
                    else resolve(result)
                }
            )
            uploadStream.end(buffer)
        })

        const uploadResult = result as any

        return NextResponse.json({
            url: uploadResult.secure_url,
            public_id: uploadResult.public_id,
            width: uploadResult.width,
            height: uploadResult.height,
            format: uploadResult.format,
            responsive: uploadResult.responsive_breakpoints?.[0]?.breakpoints || []
        })

    } catch (error: any) {
        console.error('Cloudinary upload error:', error)
        return NextResponse.json(
            { error: error.message || 'Upload failed' },
            { status: 500 }
        )
    }
}

export async function DELETE(request: Request) {
    try {
        const { public_id } = await request.json()

        if (!public_id) {
            return NextResponse.json({ error: 'No public_id provided' }, { status: 400 })
        }

        await cloudinary.uploader.destroy(public_id, {
            invalidate: true
        })

        return NextResponse.json({ success: true })

    } catch (error: any) {
        console.error('Cloudinary delete error:', error)
        return NextResponse.json(
            { error: error.message || 'Delete failed' },
            { status: 500 }
        )
    }
}
