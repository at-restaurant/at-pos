// src/lib/db/imageCompressor.ts - IMAGE COMPRESSION FOR OFFLINE
export class ImageCompressor {
    // ✅ Compress image to base64 (max 50KB for offline)
    async compressImage(url: string, maxSizeKB: number = 50): Promise<string | null> {
        try {
            const response = await fetch(url)
            const blob = await response.blob()

            return new Promise((resolve) => {
                const img = new Image()
                const canvas = document.createElement('canvas')
                const ctx = canvas.getContext('2d')

                img.onload = () => {
                    // Calculate new dimensions (max 200x200 for menu items)
                    let width = img.width
                    let height = img.height
                    const maxDim = 200

                    if (width > height) {
                        if (width > maxDim) {
                            height = (height * maxDim) / width
                            width = maxDim
                        }
                    } else {
                        if (height > maxDim) {
                            width = (width * maxDim) / height
                            height = maxDim
                        }
                    }

                    canvas.width = width
                    canvas.height = height

                    ctx?.drawImage(img, 0, 0, width, height)

                    // Compress as JPEG with quality 0.6
                    const compressed = canvas.toDataURL('image/jpeg', 0.6)

                    // Check size
                    const sizeKB = (compressed.length * 0.75) / 1024

                    if (sizeKB > maxSizeKB) {
                        // Further compression
                        const lowerQuality = canvas.toDataURL('image/jpeg', 0.4)
                        resolve(lowerQuality)
                    } else {
                        resolve(compressed)
                    }
                }

                img.onerror = () => resolve(null)
                img.src = URL.createObjectURL(blob)
            })
        } catch (error) {
            console.error('Image compression failed:', error)
            return null
        }
    }

    // ✅ Get image size in KB
    getBase64Size(base64: string): number {
        return (base64.length * 0.75) / 1024
    }
}

export const imageCompressor = new ImageCompressor()