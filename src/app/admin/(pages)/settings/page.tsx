// src/app/admin/(pages)/settings/page.tsx
// 🚀 FULLY OPTIMIZED - Fast, Mobile Perfect, User Friendly

'use client'

import { useState, useEffect } from 'react'
import { Key, Save, Eye, EyeOff, User, Camera, ChevronDown, ChevronUp, Shield, Bell, Printer, Clock, Trash2, AlertTriangle } from 'lucide-react'
import { useToast } from '@/components/ui/Toast'
import { PageHeader } from '@/components/ui/PageHeader'
import { useAdminAuth } from '@/lib/hooks/useAdminAuth'
import { createClient } from '@/lib/supabase/client'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { db } from '@/lib/db/indexedDB'
import { STORES } from '@/lib/db/schema'
import { scheduleAutoClose } from '@/lib/utils/autoClose'

export default function SettingsPage() {
    const { profile, updateProfile } = useAdminAuth()
    const toast = useToast()

    const [form, setForm] = useState({ current: '', new: '', confirm: '' })
    const [profileForm, setProfileForm] = useState({
        name: '',
        bio: '',
        profile_pic: ''
    })

    const [openSections, setOpenSections] = useState({
        profile: true,
        password: false,
        security: false,
        receipt: false,
        business: false,
        cleanup: false
    })

    // Data cleanup state
    const [cleanupForm, setCleanupForm] = useState({
        dataType: 'orders',
        olderThan: '30', // days
        confirmPin: ''
    })
    const [cleanupPreview, setCleanupPreview] = useState<number | null>(null)
    const [cleanupLoading, setCleanupLoading] = useState(false)
    const [cleanupStep, setCleanupStep] = useState<'config' | 'confirm' | 'done'>('config')

    const [receiptForm, setReceiptForm] = useState({ phone: '', tax_percent: '0' })
    const [businessForm, setBusinessForm] = useState({ start_of_day_time: '16:00', end_of_day_time: '04:00' })

    const [loading, setLoading] = useState(false)
    const [uploadingImage, setUploadingImage] = useState(false)
    const [showPasswords, setShowPasswords] = useState({ current: false, new: false, confirm: false })

    useEffect(() => {
        if (profile) {
            setProfileForm({
                name: profile.name || '',
                bio: profile.bio || '',
                profile_pic: profile.profile_pic || ''
            })
        }
    }, [profile])

    useEffect(() => {
        const loadSettings = async () => {
            // Load receipt settings
            const cached = await db.get(STORES.SETTINGS, 'receipt_settings')
            if (cached && (cached as any).value) {
                setReceiptForm((cached as any).value)
            } else {
                const savedReceipt = localStorage.getItem('receipt_settings')
                if (savedReceipt) {
                    setReceiptForm(JSON.parse(savedReceipt))
                }
            }
            // Load business settings
            const cachedBusiness = await db.get(STORES.SETTINGS, 'business_settings')
            if (cachedBusiness && (cachedBusiness as any).value) {
                setBusinessForm((cachedBusiness as any).value)
            } else {
                const savedBusiness = localStorage.getItem('business_settings')
                if (savedBusiness) {
                    setBusinessForm(JSON.parse(savedBusiness))
                }
            }
        }
        loadSettings()
    }, [])

    const toggleSection = (section: 'profile' | 'password' | 'security' | 'receipt' | 'business' | 'cleanup') => {
        setOpenSections(prev => ({ ...prev, [section]: !prev[section] }))
    }

    const handleCleanupPreview = async () => {
        if (!cleanupForm.olderThan || isNaN(Number(cleanupForm.olderThan)) || Number(cleanupForm.olderThan) < 1) {
            return toast.add('error', '❌ Enter a valid number of days (min 1)')
        }
        setCleanupLoading(true)
        try {
            const supabase = createClient()
            const cutoffDate = new Date()
            cutoffDate.setDate(cutoffDate.getDate() - Number(cleanupForm.olderThan))
            const cutoff = cutoffDate.toISOString()

            let count = 0
            if (cleanupForm.dataType === 'orders') {
                const { count: c } = await supabase
                    .from('orders')
                    .select('id', { count: 'exact', head: true })
                    .lt('created_at', cutoff)
                    .in('status', ['completed', 'cancelled'])
                count = c || 0
            } else if (cleanupForm.dataType === 'inventory_history') {
                const { count: c } = await supabase
                    .from('inventory_history')
                    .select('id', { count: 'exact', head: true })
                    .lt('created_at', cutoff)
                count = c || 0
            } else if (cleanupForm.dataType === 'attendance') {
                const { count: c } = await supabase
                    .from('attendance')
                    .select('id', { count: 'exact', head: true })
                    .lt('date', cutoffDate.toISOString().split('T')[0])
                count = c || 0
            }

            setCleanupPreview(count)
            setCleanupStep('confirm')
        } catch (err) {
            toast.add('error', '❌ Preview failed. Check connection.')
        } finally {
            setCleanupLoading(false)
        }
    }

    const handleCleanupExecute = async () => {
        if (cleanupForm.confirmPin !== 'DELETE') {
            return toast.add('error', '❌ Type DELETE exactly to confirm')
        }
        setCleanupLoading(true)
        try {
            const supabase = createClient()
            const cutoffDate = new Date()
            cutoffDate.setDate(cutoffDate.getDate() - Number(cleanupForm.olderThan))
            const cutoff = cutoffDate.toISOString()

            if (cleanupForm.dataType === 'orders') {
                // First get order IDs to delete their items
                const { data: ordersToDelete } = await supabase
                    .from('orders')
                    .select('id')
                    .lt('created_at', cutoff)
                    .in('status', ['completed', 'cancelled'])

                if (ordersToDelete && ordersToDelete.length > 0) {
                    const ids = ordersToDelete.map((o: any) => o.id)
                    // Delete order items first (FK constraint)
                    await supabase.from('order_items').delete().in('order_id', ids)
                    // Then delete orders
                    await supabase.from('orders').delete().in('id', ids)
                    // Also clean local IndexedDB cache
                    const localOrders = await db.getAll(STORES.ORDERS) as any[]
                    for (const o of localOrders) {
                        if (ids.includes(o.id)) await db.delete(STORES.ORDERS, o.id)
                    }
                }
            } else if (cleanupForm.dataType === 'inventory_history') {
                await supabase.from('inventory_history').delete().lt('created_at', cutoff)
            } else if (cleanupForm.dataType === 'attendance') {
                await supabase.from('attendance').delete().lt('date', cutoffDate.toISOString().split('T')[0])
            }

            toast.add('success', `✅ Cleaned up ${cleanupPreview} records from Supabase!`)
            setCleanupStep('done')
            setCleanupForm(prev => ({ ...prev, confirmPin: '' }))
            setCleanupPreview(null)
        } catch (err: any) {
            toast.add('error', `❌ Cleanup failed: ${err.message}`)
        } finally {
            setCleanupLoading(false)
        }
    }

    const handleBusinessUpdate = async () => {
        // Validate time format HH:MM
        const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/
        if (!timeRegex.test(businessForm.start_of_day_time) || !timeRegex.test(businessForm.end_of_day_time)) {
            return toast.add('error', '❌ Invalid time format. Use HH:MM (e.g. 04:00)')
        }

        localStorage.setItem('business_settings', JSON.stringify(businessForm))
        await db.put(STORES.SETTINGS, { key: 'business_settings', value: businessForm })

        let cloudSynced = false
        if (navigator.onLine) {
            try {
                const supabase = createClient()
                const { error } = await supabase
                    .from('restaurant_settings')
                    .upsert({ id: 1, start_of_day_time: businessForm.start_of_day_time, end_of_day_time: businessForm.end_of_day_time })

                if (!error) cloudSynced = true
            } catch (err) {
                console.error('Cloud sync failed:', err)
            }
        }

        toast.add('success', cloudSynced
            ? '✅ Business hours saved & synced!'
            : '✅ Business hours saved locally!'
        )

        // Reschedule auto-close based on new time
        await scheduleAutoClose()
    }

    const handleReceiptUpdate = async () => {
        localStorage.setItem('receipt_settings', JSON.stringify(receiptForm))
        await db.put(STORES.SETTINGS, { key: 'receipt_settings', value: receiptForm })

        // Push to cloud table (non-blocking)
        let cloudSynced = false
        if (navigator.onLine) {
            try {
                const supabase = createClient()
                const { error } = await supabase
                    .from('restaurant_settings')
                    .upsert({ id: 1, phone: receiptForm.phone, tax_percent: receiptForm.tax_percent })

                if (!error) cloudSynced = true
            } catch (err) {
                console.error('Cloud sync failed:', err)
            }
        }

        toast.add('success', cloudSynced
            ? '✅ Receipt settings saved & synced to cloud!'
            : '✅ Receipt settings saved locally!'
        )
    }

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return

        if (!file.type.startsWith('image/')) {
            toast.add('error', '❌ Please upload an image file')
            return
        }

        if (file.size > 5 * 1024 * 1024) {
            toast.add('error', '❌ Image must be less than 5MB')
            return
        }

        setUploadingImage(true)

        try {
            const resizedImage = await resizeImage(file, 400, 400)

            const formData = new FormData()
            formData.append('file', resizedImage)
            formData.append('folder', 'admin-profiles')

            const response = await fetch('/api/upload/cloudinary', {
                method: 'POST',
                body: formData
            })

            if (!response.ok) throw new Error('Upload failed')

            const { url } = await response.json()
            setProfileForm({ ...profileForm, profile_pic: url })
            toast.add('success', '✅ Image uploaded!')
        } catch (error) {
            toast.add('error', '❌ Upload failed')
        } finally {
            setUploadingImage(false)
        }
    }

    const resizeImage = (file: File, maxWidth: number, maxHeight: number): Promise<Blob> => {
        return new Promise((resolve, reject) => {
            const img = new Image()
            img.src = URL.createObjectURL(file)

            img.onload = () => {
                const canvas = document.createElement('canvas')
                let width = img.width
                let height = img.height

                const size = Math.min(width, height)
                const startX = (width - size) / 2
                const startY = (height - size) / 2

                canvas.width = maxWidth
                canvas.height = maxHeight

                const ctx = canvas.getContext('2d')
                if (!ctx) {
                    reject(new Error('Canvas not supported'))
                    return
                }

                ctx.drawImage(img, startX, startY, size, size, 0, 0, maxWidth, maxHeight)

                canvas.toBlob(
                    (blob) => {
                        if (blob) resolve(blob)
                        else reject(new Error('Resize failed'))
                    },
                    'image/jpeg',
                    0.9
                )
            }

            img.onerror = () => reject(new Error('Image load failed'))
        })
    }

    const handleProfileUpdate = async () => {
        if (!profileForm.name || profileForm.name.trim().length < 2) {
            return toast.add('error', '❌ Name must be at least 2 characters')
        }

        setLoading(true)
        try {
            const res = await fetch('/api/auth/update-profile', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(profileForm)
            })

            const data = await res.json()
            if (res.ok) {
                updateProfile(data.profile)
                toast.add('success', '✅ Profile updated!')
            } else {
                toast.add('error', data.error || '❌ Failed to update')
            }
        } catch (error) {
            toast.add('error', '❌ Network error')
        } finally {
            setLoading(false)
        }
    }

    const handleReset = async () => {
        if (!form.current || !form.new || !form.confirm) {
            return toast.add('error', '❌ All fields required')
        }
        if (form.new !== form.confirm) {
            return toast.add('error', '❌ New passwords do not match')
        }
        if (form.new.length < 8) {
            return toast.add('error', '❌ Password must be at least 8 characters')
        }

        setLoading(true)
        try {
            const res = await fetch('/api/auth/reset-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ currentPassword: form.current, newPassword: form.new })
            })

            const data = await res.json()
            if (res.ok) {
                toast.add('success', '✅ Password updated!')
                setForm({ current: '', new: '', confirm: '' })
                toggleSection('password')
            } else {
                toast.add('error', data.error || '❌ Failed to update')
            }
        } catch (error) {
            toast.add('error', '❌ Network error')
        } finally {
            setLoading(false)
        }
    }

    return (
        <ErrorBoundary>
            <div className="min-h-screen bg-[var(--bg)]">
                <PageHeader title="Admin Settings" subtitle="Manage your profile & security" />

                <div className="max-w-4xl mx-auto px-3 sm:px-4 py-4 sm:py-6 space-y-3 sm:space-y-4">

                    {/* PROFILE SECTION */}
                    <div className="bg-[var(--card)] border-2 border-[var(--border)] rounded-xl overflow-hidden transition-all hover:border-green-600/30">
                        <button
                            onClick={() => toggleSection('profile')}
                            className="w-full flex items-center justify-between p-4 sm:p-5 hover:bg-[var(--bg)] transition-colors"
                        >
                            <div className="flex items-center gap-3 sm:gap-4">
                                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-green-600/10 rounded-lg flex items-center justify-center shrink-0">
                                    <User className="w-5 h-5 sm:w-6 sm:h-6 text-green-600" />
                                </div>
                                <div className="text-left">
                                    <h2 className="text-base sm:text-xl font-bold text-[var(--fg)]">Profile Settings</h2>
                                    <p className="text-xs sm:text-sm text-[var(--muted)] mt-0.5">Update your personal information</p>
                                </div>
                            </div>
                            {openSections.profile ? (
                                <ChevronUp className="w-5 h-5 text-[var(--muted)] shrink-0" />
                            ) : (
                                <ChevronDown className="w-5 h-5 text-[var(--muted)] shrink-0" />
                            )}
                        </button>

                        {openSections.profile && (
                            <div className="p-4 sm:p-6 pt-0 border-t border-[var(--border)] space-y-4 sm:space-y-6 animate-in slide-in-from-top-2">
                                <div>
                                    <label className="block text-sm font-medium text-[var(--fg)] mb-3">
                                        Profile Picture
                                    </label>
                                    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 sm:gap-6">
                                        <div className="relative group">
                                            {profileForm.profile_pic ? (
                                                <img
                                                    src={profileForm.profile_pic}
                                                    alt="Profile"
                                                    className="w-20 h-20 sm:w-24 sm:h-24 rounded-full object-cover border-4 border-green-600 shadow-lg"
                                                />
                                            ) : (
                                                <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-green-600 flex items-center justify-center text-white text-2xl sm:text-3xl font-bold shadow-lg">
                                                    {profileForm.name.charAt(0).toUpperCase() || 'A'}
                                                </div>
                                            )}
                                            {uploadingImage && (
                                                <div className="absolute inset-0 bg-black/50 rounded-full flex items-center justify-center">
                                                    <div className="w-8 h-8 border-4 border-white border-t-transparent rounded-full animate-spin" />
                                                </div>
                                            )}
                                        </div>

                                        <div className="flex-1 w-full sm:w-auto">
                                            <label className="cursor-pointer inline-flex items-center gap-2 px-3 sm:px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-all font-medium text-sm active:scale-95">
                                                <Camera className="w-4 h-4" />
                                                <span>{profileForm.profile_pic ? 'Change Photo' : 'Upload Photo'}</span>
                                                <input
                                                    type="file"
                                                    accept="image/*"
                                                    onChange={handleImageUpload}
                                                    disabled={uploadingImage}
                                                    className="hidden"
                                                />
                                            </label>
                                            <p className="text-xs text-[var(--muted)] mt-2">
                                                Square image, max 5MB. Auto-resized to 400x400px
                                            </p>
                                            {profileForm.profile_pic && (
                                                <button
                                                    onClick={() => setProfileForm({ ...profileForm, profile_pic: '' })}
                                                    className="text-xs text-red-600 hover:text-red-700 mt-2"
                                                >
                                                    Remove Photo
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-sm font-medium text-[var(--fg)] mb-2">
                                            Name <span className="text-red-600">*</span>
                                        </label>
                                        <input
                                            type="text"
                                            value={profileForm.name}
                                            onChange={e => setProfileForm({ ...profileForm, name: e.target.value })}
                                            placeholder="Your name"
                                            className="w-full px-3 sm:px-4 py-2.5 sm:py-3 bg-[var(--bg)] border border-[var(--border)] rounded-lg text-[var(--fg)] placeholder:text-[var(--muted)] focus:outline-none focus:ring-2 focus:ring-green-600 text-sm sm:text-base"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-[var(--fg)] mb-2">
                                            Bio <span className="text-xs text-[var(--muted)]">(Optional)</span>
                                        </label>
                                        <textarea
                                            value={profileForm.bio}
                                            onChange={e => setProfileForm({ ...profileForm, bio: e.target.value })}
                                            placeholder="Tell us about yourself..."
                                            rows={3}
                                            maxLength={200}
                                            className="w-full px-3 sm:px-4 py-2.5 sm:py-3 bg-[var(--bg)] border border-[var(--border)] rounded-lg text-[var(--fg)] placeholder:text-[var(--muted)] focus:outline-none focus:ring-2 focus:ring-green-600 resize-none text-sm sm:text-base"
                                        />
                                        <p className="text-xs text-[var(--muted)] mt-1">
                                            {profileForm.bio.length}/200 characters
                                        </p>
                                    </div>

                                    <button
                                        onClick={handleProfileUpdate}
                                        disabled={loading || uploadingImage}
                                        className="w-full px-4 py-2.5 sm:py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium flex items-center justify-center gap-2 disabled:opacity-50 transition-all active:scale-95 text-sm sm:text-base"
                                    >
                                        {loading ? (
                                            <>
                                                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                                Updating...
                                            </>
                                        ) : (
                                            <>
                                                <Save className="w-4 h-4 sm:w-5 sm:h-5" />
                                                Update Profile
                                            </>
                                        )}
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* PASSWORD SECTION */}
                    <div className="bg-[var(--card)] border-2 border-[var(--border)] rounded-xl overflow-hidden transition-all hover:border-blue-600/30">
                        <button
                            onClick={() => toggleSection('password')}
                            className="w-full flex items-center justify-between p-4 sm:p-5 hover:bg-[var(--bg)] transition-colors"
                        >
                            <div className="flex items-center gap-3 sm:gap-4">
                                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-blue-600/10 rounded-lg flex items-center justify-center shrink-0">
                                    <Key className="w-5 h-5 sm:w-6 sm:h-6 text-blue-600" />
                                </div>
                                <div className="text-left">
                                    <h2 className="text-base sm:text-xl font-bold text-[var(--fg)]">Password Settings</h2>
                                    <p className="text-xs sm:text-sm text-[var(--muted)] mt-0.5">Change your admin password</p>
                                </div>
                            </div>
                            {openSections.password ? (
                                <ChevronUp className="w-5 h-5 text-[var(--muted)] shrink-0" />
                            ) : (
                                <ChevronDown className="w-5 h-5 text-[var(--muted)] shrink-0" />
                            )}
                        </button>

                        {openSections.password && (
                            <div className="p-4 sm:p-6 pt-0 border-t border-[var(--border)] space-y-4 animate-in slide-in-from-top-2">
                                <div>
                                    <label className="block text-sm font-medium text-[var(--fg)] mb-2">
                                        Current Password <span className="text-red-600">*</span>
                                    </label>
                                    <div className="relative">
                                        <input
                                            type={showPasswords.current ? 'text' : 'password'}
                                            value={form.current}
                                            onChange={e => setForm({ ...form, current: e.target.value })}
                                            placeholder="Enter current password"
                                            className="w-full pl-3 sm:pl-4 pr-10 sm:pr-12 py-2.5 sm:py-3 bg-[var(--bg)] border border-[var(--border)] rounded-lg text-[var(--fg)] placeholder:text-[var(--muted)] focus:outline-none focus:ring-2 focus:ring-blue-600 text-sm sm:text-base"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowPasswords({ ...showPasswords, current: !showPasswords.current })}
                                            className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--muted)] hover:text-[var(--fg)]"
                                        >
                                            {showPasswords.current ? <EyeOff className="w-4 h-4 sm:w-5 sm:h-5" /> : <Eye className="w-4 h-4 sm:w-5 sm:h-5" />}
                                        </button>
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-[var(--fg)] mb-2">
                                        New Password <span className="text-red-600">*</span>
                                    </label>
                                    <div className="relative">
                                        <input
                                            type={showPasswords.new ? 'text' : 'password'}
                                            value={form.new}
                                            onChange={e => setForm({ ...form, new: e.target.value })}
                                            placeholder="Enter new password (min 8 chars)"
                                            className="w-full pl-3 sm:pl-4 pr-10 sm:pr-12 py-2.5 sm:py-3 bg-[var(--bg)] border border-[var(--border)] rounded-lg text-[var(--fg)] placeholder:text-[var(--muted)] focus:outline-none focus:ring-2 focus:ring-blue-600 text-sm sm:text-base"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowPasswords({ ...showPasswords, new: !showPasswords.new })}
                                            className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--muted)] hover:text-[var(--fg)]"
                                        >
                                            {showPasswords.new ? <EyeOff className="w-4 h-4 sm:w-5 sm:h-5" /> : <Eye className="w-4 h-4 sm:w-5 sm:h-5" />}
                                        </button>
                                    </div>
                                    <p className="text-xs text-[var(--muted)] mt-1">Must be at least 8 characters</p>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-[var(--fg)] mb-2">
                                        Confirm New Password <span className="text-red-600">*</span>
                                    </label>
                                    <div className="relative">
                                        <input
                                            type={showPasswords.confirm ? 'text' : 'password'}
                                            value={form.confirm}
                                            onChange={e => setForm({ ...form, confirm: e.target.value })}
                                            placeholder="Re-enter new password"
                                            className="w-full pl-3 sm:pl-4 pr-10 sm:pr-12 py-2.5 sm:py-3 bg-[var(--bg)] border border-[var(--border)] rounded-lg text-[var(--fg)] placeholder:text-[var(--muted)] focus:outline-none focus:ring-2 focus:ring-blue-600 text-sm sm:text-base"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowPasswords({ ...showPasswords, confirm: !showPasswords.confirm })}
                                            className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--muted)] hover:text-[var(--fg)]"
                                        >
                                            {showPasswords.confirm ? <EyeOff className="w-4 h-4 sm:w-5 sm:h-5" /> : <Eye className="w-4 h-4 sm:w-5 sm:h-5" />}
                                        </button>
                                    </div>
                                </div>

                                <button
                                    onClick={handleReset}
                                    disabled={loading}
                                    className="w-full px-4 py-2.5 sm:py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium flex items-center justify-center gap-2 disabled:opacity-50 transition-all active:scale-95 text-sm sm:text-base"
                                >
                                    {loading ? (
                                        <>
                                            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                            Updating...
                                        </>
                                    ) : (
                                        <>
                                            <Save className="w-4 h-4 sm:w-5 sm:h-5" />
                                            Update Password
                                        </>
                                    )}
                                </button>
                            </div>
                        )}
                    </div>

                    {/* SECURITY SECTION */}
                    <div className="bg-[var(--card)] border-2 border-[var(--border)] rounded-xl overflow-hidden transition-all hover:border-purple-600/30">
                        <button
                            onClick={() => toggleSection('security')}
                            className="w-full flex items-center justify-between p-4 sm:p-5 hover:bg-[var(--bg)] transition-colors"
                        >
                            <div className="flex items-center gap-3 sm:gap-4">
                                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-purple-600/10 rounded-lg flex items-center justify-center shrink-0">
                                    <Shield className="w-5 h-5 sm:w-6 sm:h-6 text-purple-600" />
                                </div>
                                <div className="text-left">
                                    <h2 className="text-base sm:text-xl font-bold text-[var(--fg)]">Security Info</h2>
                                    <p className="text-xs sm:text-sm text-[var(--muted)] mt-0.5">Account security details</p>
                                </div>
                            </div>
                            {openSections.security ? (
                                <ChevronUp className="w-5 h-5 text-[var(--muted)] shrink-0" />
                            ) : (
                                <ChevronDown className="w-5 h-5 text-[var(--muted)] shrink-0" />
                            )}
                        </button>

                        {openSections.security && (
                            <div className="p-4 sm:p-6 pt-0 border-t border-[var(--border)] space-y-4 animate-in slide-in-from-top-2">
                                <div className="p-3 sm:p-4 bg-purple-600/10 border border-purple-600/30 rounded-lg">
                                    <div className="flex items-start gap-3">
                                        <Shield className="w-5 h-5 text-purple-600 flex-shrink-0 mt-0.5" />
                                        <div>
                                            <p className="font-semibold text-[var(--fg)] text-sm sm:text-base">🔒 Account Security</p>
                                            <p className="text-xs sm:text-sm text-[var(--muted)] mt-1">
                                                Your account is protected with password authentication. Change your password regularly to maintain security.
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                                    <div className="p-3 sm:p-4 bg-[var(--bg)] rounded-lg border border-[var(--border)]">
                                        <p className="text-xs text-[var(--muted)] mb-1">Account Type</p>
                                        <p className="font-semibold text-[var(--fg)] text-sm sm:text-base">Admin</p>
                                    </div>
                                    <div className="p-3 sm:p-4 bg-[var(--bg)] rounded-lg border border-[var(--border)]">
                                        <p className="text-xs text-[var(--muted)] mb-1">Status</p>
                                        <p className="font-semibold text-green-600 text-sm sm:text-base">✓ Active</p>
                                    </div>
                                </div>

                                <div className="p-3 sm:p-4 bg-blue-600/10 border border-blue-600/30 rounded-lg">
                                    <p className="text-xs sm:text-sm text-blue-600">
                                        💡 <strong>Tip:</strong> Use a strong password with at least 8 characters including letters, numbers, and symbols.
                                    </p>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* BUSINESS HOURS SECTION */}
                    <div className="bg-[var(--card)] border-2 border-[var(--border)] rounded-xl overflow-hidden transition-all hover:border-blue-600/30">
                        <button
                            onClick={() => toggleSection('business')}
                            className="w-full flex items-center justify-between p-4 sm:p-5 hover:bg-[var(--bg)] transition-colors"
                        >
                            <div className="flex items-center gap-3 sm:gap-4">
                                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-blue-600/10 rounded-lg flex items-center justify-center shrink-0">
                                    <Clock className="w-5 h-5 sm:w-6 sm:h-6 text-blue-600" />
                                </div>
                                <div className="text-left">
                                    <h2 className="text-base sm:text-xl font-bold text-[var(--fg)]">Business Hours</h2>
                                    <p className="text-xs sm:text-sm text-[var(--muted)] mt-0.5">Set your custom End-of-Day reset time</p>
                                </div>
                            </div>
                            {openSections.business ? (
                                <ChevronUp className="w-5 h-5 text-[var(--muted)] shrink-0" />
                            ) : (
                                <ChevronDown className="w-5 h-5 text-[var(--muted)] shrink-0" />
                            )}
                        </button>

                        {openSections.business && (
                            <div className="p-4 sm:p-6 pt-0 border-t border-[var(--border)] space-y-4 animate-in slide-in-from-top-2">
                                <div className="p-3 sm:p-4 bg-blue-600/10 border border-blue-600/30 rounded-lg">
                                    <div className="flex items-start gap-3">
                                        <Clock className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                                        <div>
                                            <p className="font-semibold text-[var(--fg)] text-sm">📅 How this works</p>
                                            <p className="text-xs text-[var(--muted)] mt-1">
                                                Set the opening and closing times for your business "day". For example, if you open at <strong>16:00 (4 PM)</strong> and close at <strong>04:00 (4 AM)</strong>, the system considers everything between those hours as a single business day. All dashboard stats ("Today", etc.) and attendance resets will use this specific shift.
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-[var(--fg)] mb-2">
                                            Opening Time <span className="text-red-600">*</span>
                                        </label>
                                        <input
                                            type="time"
                                            value={businessForm.start_of_day_time}
                                            onChange={e => setBusinessForm({ ...businessForm, start_of_day_time: e.target.value })}
                                            className="w-full px-3 sm:px-4 py-2.5 sm:py-3 bg-[var(--bg)] border border-[var(--border)] rounded-lg text-[var(--fg)] placeholder:text-[var(--muted)] focus:outline-none focus:ring-2 focus:ring-blue-600 text-sm sm:text-base"
                                            style={{ colorScheme: 'dark' }}
                                        />
                                        <p className="text-xs text-[var(--muted)] mt-1">Default: 16:00 (4 PM)</p>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-[var(--fg)] mb-2">
                                            Closing Time <span className="text-red-600">*</span>
                                        </label>
                                        <input
                                            type="time"
                                            value={businessForm.end_of_day_time}
                                            onChange={e => setBusinessForm({ ...businessForm, end_of_day_time: e.target.value })}
                                            className="w-full px-3 sm:px-4 py-2.5 sm:py-3 bg-[var(--bg)] border border-[var(--border)] rounded-lg text-[var(--fg)] placeholder:text-[var(--muted)] focus:outline-none focus:ring-2 focus:ring-blue-600 text-sm sm:text-base"
                                            style={{ colorScheme: 'dark' }}
                                        />
                                        <p className="text-xs text-[var(--muted)] mt-1">Default: 04:00 (4 AM)</p>
                                    </div>
                                </div>

                                <div className="p-3 bg-[var(--bg)] border border-[var(--border)] rounded-lg text-xs text-[var(--muted)]">
                                    <p className="font-semibold text-[var(--fg)] mb-1">⚠️ Current Setting</p>
                                    <p>Business day shift: <strong className="text-blue-600">{businessForm.start_of_day_time}</strong> to <strong className="text-blue-600">{businessForm.end_of_day_time}</strong></p>
                                    <p className="mt-1 text-yellow-600">✨ Attendance & stats will reset automatically when crossing the closing time.</p>
                                </div>

                                <button
                                    onClick={handleBusinessUpdate}
                                    className="w-full px-4 py-2.5 sm:py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium flex items-center justify-center gap-2 transition-all active:scale-95 text-sm sm:text-base"
                                >
                                    <Save className="w-4 h-4 sm:w-5 sm:h-5" />
                                    Save Business Hours
                                </button>
                            </div>
                        )}
                    </div>

                    {/* RECEIPT SECTION */}
                    <div className="bg-[var(--card)] border-2 border-[var(--border)] rounded-xl overflow-hidden transition-all hover:border-orange-600/30">
                        <button
                            onClick={() => toggleSection('receipt')}
                            className="w-full flex items-center justify-between p-4 sm:p-5 hover:bg-[var(--bg)] transition-colors"
                        >
                            <div className="flex items-center gap-3 sm:gap-4">
                                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-orange-600/10 rounded-lg flex items-center justify-center shrink-0">
                                    <Printer className="w-5 h-5 sm:w-6 sm:h-6 text-orange-600" />
                                </div>
                                <div className="text-left">
                                    <h2 className="text-base sm:text-xl font-bold text-[var(--fg)]">Receipt Settings</h2>
                                    <p className="text-xs sm:text-sm text-[var(--muted)] mt-0.5">Customize printed receipts</p>
                                </div>
                            </div>
                            {openSections.receipt ? (
                                <ChevronUp className="w-5 h-5 text-[var(--muted)] shrink-0" />
                            ) : (
                                <ChevronDown className="w-5 h-5 text-[var(--muted)] shrink-0" />
                            )}
                        </button>

                        {openSections.receipt && (
                            <div className="p-4 sm:p-6 pt-0 border-t border-[var(--border)] space-y-4 animate-in slide-in-from-top-2">
                                <div>
                                    <label className="block text-sm font-medium text-[var(--fg)] mb-2">
                                        Restaurant Phone Number
                                    </label>
                                    <input
                                        type="text"
                                        value={receiptForm.phone}
                                        onChange={e => setReceiptForm({ ...receiptForm, phone: e.target.value })}
                                        placeholder="e.g. +92 300 1234567"
                                        className="w-full px-3 sm:px-4 py-2.5 sm:py-3 bg-[var(--bg)] border border-[var(--border)] rounded-lg text-[var(--fg)] placeholder:text-[var(--muted)] focus:outline-none focus:ring-2 focus:ring-orange-600 text-sm sm:text-base"
                                    />
                                    <p className="text-xs text-[var(--muted)] mt-1">This will be printed on the receipt header.</p>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-[var(--fg)] mb-2">
                                        Default Tax Percentage (%)
                                    </label>
                                    <input
                                        type="number"
                                        min="0"
                                        max="100"
                                        step="0.1"
                                        value={receiptForm.tax_percent}
                                        onChange={e => setReceiptForm({ ...receiptForm, tax_percent: e.target.value })}
                                        placeholder="e.g. 16"
                                        className="w-full px-3 sm:px-4 py-2.5 sm:py-3 bg-[var(--bg)] border border-[var(--border)] rounded-lg text-[var(--fg)] placeholder:text-[var(--muted)] focus:outline-none focus:ring-2 focus:ring-orange-600 text-sm sm:text-base"
                                    />
                                    <p className="text-xs text-[var(--muted)] mt-1">Applied automatically to new orders.</p>
                                </div>

                                <button
                                    onClick={handleReceiptUpdate}
                                    className="w-full px-4 py-2.5 sm:py-3 bg-orange-600 text-white rounded-lg hover:bg-orange-700 font-medium flex items-center justify-center gap-2 transition-all active:scale-95 text-sm sm:text-base"
                                >
                                    <Save className="w-4 h-4 sm:w-5 sm:h-5" />
                                    Save Receipt Settings
                                </button>
                            </div>
                        )}
                    </div>

                    {/* DATA CLEANUP SECTION */}
                    <div className="bg-[var(--card)] border-2 border-[var(--border)] rounded-xl overflow-hidden transition-all hover:border-red-600/20">
                        <button
                            onClick={() => toggleSection('cleanup')}
                            className="w-full flex items-center justify-between p-4 sm:p-5 hover:bg-[var(--bg)] transition-colors"
                        >
                            <div className="flex items-center gap-3 sm:gap-4">
                                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-red-600/10 rounded-lg flex items-center justify-center shrink-0">
                                    <Trash2 className="w-5 h-5 sm:w-6 sm:h-6 text-red-600/70" />
                                </div>
                                <div className="text-left">
                                    <h2 className="text-base sm:text-xl font-bold text-[var(--fg)]">Data Maintenance</h2>
                                    <p className="text-xs sm:text-sm text-[var(--muted)] mt-0.5">Clear old historical records to free up database space</p>
                                </div>
                            </div>
                            {openSections.cleanup ? (
                                <ChevronUp className="w-5 h-5 text-[var(--muted)] shrink-0" />
                            ) : (
                                <ChevronDown className="w-5 h-5 text-[var(--muted)] shrink-0" />
                            )}
                        </button>

                        {openSections.cleanup && (
                            <div className="p-4 sm:p-6 pt-0 border-t border-red-600/20 space-y-4 animate-in slide-in-from-top-2">
                                <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg flex items-start gap-3">
                                    <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                                    <div>
                                        <p className="text-sm font-semibold text-red-600">Permanent Deletion</p>
                                        <p className="text-xs text-[var(--muted)] mt-1">
                                            Records deleted from Supabase <strong>cannot be recovered</strong>. Use this only to free up database space. Only <em>completed/cancelled</em> orders are eligible.
                                        </p>
                                    </div>
                                </div>

                                {cleanupStep === 'done' ? (
                                    <div className="text-center py-8">
                                        <div className="text-5xl mb-3">✅</div>
                                        <p className="font-bold text-[var(--fg)]">Cleanup Complete!</p>
                                        <p className="text-sm text-[var(--muted)] mt-1">Old records have been permanently deleted.</p>
                                        <button onClick={() => setCleanupStep('config')} className="mt-4 px-4 py-2 border border-[var(--border)] rounded-lg text-sm text-[var(--fg)] hover:bg-[var(--bg)] transition-colors">
                                            ← Run Another Cleanup
                                        </button>
                                    </div>
                                ) : cleanupStep === 'confirm' ? (
                                    <div className="space-y-4">
                                        <div className="p-4 bg-orange-500/10 border-2 border-orange-500/40 rounded-lg text-center">
                                            <p className="text-3xl font-bold text-orange-600">{cleanupPreview}</p>
                                            <p className="text-sm text-[var(--muted)] mt-1">
                                                records older than <strong>{cleanupForm.olderThan} days</strong> in <strong>{cleanupForm.dataType.replace('_', ' ')}</strong>
                                            </p>
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-[var(--fg)] mb-2">
                                                Type <strong className="text-red-600">DELETE</strong> to permanently remove these {cleanupPreview} records
                                            </label>
                                            <input
                                                type="text"
                                                value={cleanupForm.confirmPin}
                                                onChange={e => setCleanupForm({ ...cleanupForm, confirmPin: e.target.value })}
                                                placeholder="Type DELETE here..."
                                                className="w-full px-3 py-2.5 bg-[var(--bg)] border-2 border-red-500/40 rounded-lg text-[var(--fg)] placeholder:text-[var(--muted)] focus:outline-none focus:border-red-600 text-sm font-mono tracking-wider"
                                            />
                                        </div>
                                        <div className="flex gap-3">
                                            <button
                                                onClick={() => { setCleanupStep('config'); setCleanupForm(p => ({ ...p, confirmPin: '' })); setCleanupPreview(null) }}
                                                className="flex-1 px-4 py-2.5 border border-[var(--border)] rounded-lg text-sm text-[var(--fg)] hover:bg-[var(--bg)] transition-colors"
                                            >
                                                ← Cancel
                                            </button>
                                            <button
                                                onClick={handleCleanupExecute}
                                                disabled={cleanupLoading || cleanupForm.confirmPin !== 'DELETE'}
                                                className="flex-1 px-4 py-2.5 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm font-semibold transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                                            >
                                                {cleanupLoading
                                                    ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                                    : <Trash2 className="w-4 h-4" />
                                                }
                                                Delete {cleanupPreview} Records
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="space-y-4">
                                        <div>
                                            <label className="block text-sm font-medium text-[var(--fg)] mb-2">What to clean up</label>
                                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                                                {[
                                                    { value: 'orders', label: '🛒 Orders', desc: 'Completed & cancelled orders with their items' },
                                                    { value: 'inventory_history', label: '📦 Inventory Log', desc: 'Purchase & usage history records' },
                                                    { value: 'attendance', label: '🕐 Attendance', desc: 'Staff check-in/out records' }
                                                ].map(opt => (
                                                    <button
                                                        key={opt.value}
                                                        type="button"
                                                        onClick={() => setCleanupForm(p => ({ ...p, dataType: opt.value }))}
                                                        className={`p-3 rounded-lg border-2 text-left transition-all ${cleanupForm.dataType === opt.value ? 'border-red-600 bg-red-600/10' : 'border-[var(--border)] hover:border-red-600/40'}`}
                                                    >
                                                        <p className="text-sm font-semibold text-[var(--fg)]">{opt.label}</p>
                                                        <p className="text-[10px] text-[var(--muted)] mt-1 leading-tight">{opt.desc}</p>
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-[var(--fg)] mb-2">Delete records older than</label>
                                            <div className="flex items-center gap-3 flex-wrap">
                                                <input
                                                    type="number"
                                                    min="1"
                                                    max="3650"
                                                    value={cleanupForm.olderThan}
                                                    onChange={e => setCleanupForm(p => ({ ...p, olderThan: e.target.value }))}
                                                    className="w-28 px-3 py-2.5 bg-[var(--bg)] border border-[var(--border)] rounded-lg text-[var(--fg)] focus:outline-none focus:ring-2 focus:ring-red-600 text-sm text-center font-bold"
                                                />
                                                <span className="text-sm text-[var(--muted)]">days</span>
                                                <span className="text-xs text-[var(--muted)]">
                                                    (before: {(() => { const d = new Date(); d.setDate(d.getDate() - Number(cleanupForm.olderThan || 30)); return d.toLocaleDateString('en-PK') })()})
                                                </span>
                                            </div>
                                            <div className="flex flex-wrap gap-2 mt-2">
                                                {[30, 60, 90, 180, 365].map(d => (
                                                    <button
                                                        key={d}
                                                        type="button"
                                                        onClick={() => setCleanupForm(p => ({ ...p, olderThan: d.toString() }))}
                                                        className={`px-2.5 py-1 text-xs rounded-full border transition-all ${cleanupForm.olderThan === d.toString() ? 'bg-red-600 text-white border-red-600' : 'border-[var(--border)] text-[var(--muted)] hover:border-red-600/50'}`}
                                                    >
                                                        {d}d
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                        <button
                                            onClick={handleCleanupPreview}
                                            disabled={cleanupLoading}
                                            className="w-full px-4 py-2.5 bg-[var(--bg)] border-2 border-red-600/40 text-red-600 rounded-lg hover:bg-red-600/10 font-medium text-sm transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
                                        >
                                            {cleanupLoading
                                                ? <div className="w-4 h-4 border-2 border-red-600 border-t-transparent rounded-full animate-spin" />
                                                : <AlertTriangle className="w-4 h-4" />
                                            }
                                            Preview Records to Delete
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                </div>
            </div>
        </ErrorBoundary>
    )
}