'use client'

import { useState } from 'react'
import { Upload, X, Image as ImageIcon, Loader2 } from 'lucide-react'

interface CloudinaryUploadProps {
    value: string
    onChange: (url: string) => void
    folder?: string
}

export default function CloudinaryUpload({ value, onChange, folder = 'menu-items' }: CloudinaryUploadProps) {
    const [uploading, setUploading] = useState(false)
    const [preview, setPreview] = useState(value)

    const handleUpload = async (file: File) => {
        if (!file) return

        // Validate file type
        if (!file.type.startsWith('image/')) {
            alert('Please upload an image file')
            return
        }

        // Validate file size (max 5MB)
        if (file.size > 5 * 1024 * 1024) {
            alert('Image size must be less than 5MB')
            return
        }

        setUploading(true)

        try {
            const formData = new FormData()
            formData.append('file', file)
            formData.append('folder', folder)

            const response = await fetch('/api/upload/cloudinary', {
                method: 'POST',
                body: formData
            })

            if (!response.ok) {
                const error = await response.json()
                throw new Error(error.error || 'Upload failed')
            }

            const data = await response.json()
            setPreview(data.url)
            onChange(data.url)
        } catch (error: any) {
            console.error('Upload error:', error)
            alert(error.message || 'Failed to upload image')
        } finally {
            setUploading(false)
        }
    }

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (file) handleUpload(file)
    }

    const clearImage = () => {
        setPreview('')
        onChange('')
    }

    return (
        <div className="space-y-2">
            <label className="block text-sm font-medium text-[var(--fg)]">
                Image <span className="text-xs text-[var(--muted)]">(Optional)</span>
            </label>

            {/* Preview or Upload Area */}
            {preview ? (
                <div className="relative group">
                    <img
                        src={preview}
                        alt="Preview"
                        className="w-full h-48 object-cover rounded-lg border-2 border-[var(--border)]"
                    />
                    <button
                        onClick={clearImage}
                        className="absolute top-2 right-2 p-2 bg-red-600 text-white rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>
            ) : (
                <label className={`relative block w-full h-48 border-2 border-dashed rounded-lg transition-all cursor-pointer ${
                    uploading
                        ? 'border-blue-600 bg-blue-600/5'
                        : 'border-[var(--border)] hover:border-blue-600 hover:bg-blue-600/5'
                }`}>
                    <input
                        type="file"
                        accept="image/*"
                        onChange={handleFileChange}
                        disabled={uploading}
                        className="hidden"
                    />
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
                        {uploading ? (
                            <>
                                <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
                                <p className="text-sm text-[var(--fg)] font-medium">Uploading...</p>
                            </>
                        ) : (
                            <>
                                <div className="w-12 h-12 bg-[var(--bg)] rounded-full flex items-center justify-center">
                                    <Upload className="w-6 h-6 text-[var(--muted)]" />
                                </div>
                                <p className="text-sm text-[var(--fg)] font-medium">Click to upload image</p>
                                <p className="text-xs text-[var(--muted)]">PNG, JPG up to 5MB</p>
                            </>
                        )}
                    </div>
                </label>
            )}

            <p className="text-xs text-[var(--muted)]">
                💡 Images are automatically optimized and stored on Cloudinary
            </p>
        </div>
    )
}