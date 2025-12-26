import { NextResponse } from 'next/server'
import { v2 as cloudinary } from 'cloudinary'

// Configure Cloudinary
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
})

export async function POST(request: Request) {
    try {
        const formData = await request.formData()
        const file = formData.get('file') as File
        const folder = formData.get('folder') as string || 'restaurant'

        if (!file) {
            return NextResponse.json({ error: 'No file provided' }, { status: 400 })
        }

        // Convert file to buffer
        const bytes = await file.arrayBuffer()
        const buffer = Buffer.from(bytes)

        // Upload to Cloudinary
        const result = await new Promise((resolve, reject) => {
            const uploadStream = cloudinary.uploader.upload_stream(
                {
                    folder: `restaurant/${folder}`,
                    resource_type: 'image',
                    transformation: [
                        { width: 800, height: 800, crop: 'limit' },
                        { quality: 'auto' },
                        { fetch_format: 'auto' }
                    ]
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
            public_id: uploadResult.public_id
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

        await cloudinary.uploader.destroy(public_id)

        return NextResponse.json({ success: true })

    } catch (error: any) {
        console.error('Cloudinary delete error:', error)
        return NextResponse.json(
            { error: error.message || 'Delete failed' },
            { status: 500 }
        )
    }
}