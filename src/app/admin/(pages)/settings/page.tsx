// src/app/admin/(pages)/settings/page.tsx - NESTED TOGGLES VERSION
'use client'
import { useState } from 'react'
import { Key, Save, Eye, EyeOff, User, Camera, ChevronDown, ChevronUp } from 'lucide-react'
import { useToast } from '@/components/ui/Toast'
import { PageHeader } from '@/components/ui/PageHeader'
import ResponsiveInput from '@/components/ui/ResponsiveInput'
import { useAdminAuth } from '@/lib/hooks/useAdminAuth'

export default function SettingsPage() {
    const { profile, updateProfile } = useAdminAuth()
    const [form, setForm] = useState({ current: '', new: '', confirm: '' })
    const [profileForm, setProfileForm] = useState({
        name: profile?.name || '',
        bio: profile?.bio || '',
        profile_pic: profile?.profile_pic || ''
    })

    // ✅ NESTED TOGGLE STATES
    const [openSections, setOpenSections] = useState({
        profile: true,
        password: false,
        danger: false
    })

    const [loading, setLoading] = useState(false)
    const [uploadingImage, setUploadingImage] = useState(false)
    const [showPasswords, setShowPasswords] = useState({ current: false, new: false, confirm: false })
    const [deleting, setDeleting] = useState(false)
    const toast = useToast()

    const toggleSection = (section: 'profile' | 'password' | 'danger') => {
        setOpenSections(prev => ({ ...prev, [section]: !prev[section] }))
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
            return toast.add('error', 'Name must be at least 2 characters')
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
                toast.add('error', data.error || 'Failed to update')
            }
        } catch (error) {
            toast.add('error', 'Network error')
        } finally {
            setLoading(false)
        }
    }

    const handleReset = async () => {
        if (!form.current || !form.new || !form.confirm) {
            return toast.add('error', 'All fields required')
        }
        if (form.new !== form.confirm) {
            return toast.add('error', 'New passwords do not match')
        }
        if (form.new.length < 8) {
            return toast.add('error', 'Password must be at least 8 characters')
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
            } else {
                toast.add('error', data.error || 'Failed to update')
            }
        } catch (error) {
            toast.add('error', 'Network error')
        } finally {
            setLoading(false)
        }
    }


    return (
        <div className="min-h-screen bg-[var(--bg)]">
            <PageHeader title="Admin Settings" subtitle="Manage your profile & security" />

            <div className="max-w-3xl mx-auto px-4 py-6 space-y-4">

                {/* ========================================= */}
                {/* 1. PROFILE SECTION */}
                {/* ========================================= */}
                <div className="bg-[var(--card)] border-2 border-[var(--border)] rounded-xl overflow-hidden transition-all hover:border-green-600/30">
                    {/* Header - Always Visible */}
                    <button
                        onClick={() => toggleSection('profile')}
                        className="w-full flex items-center justify-between p-5 hover:bg-[var(--bg)] transition-colors"
                    >
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 bg-green-600/10 rounded-lg flex items-center justify-center">
                                <User className="w-6 h-6 text-green-600" />
                            </div>
                            <div className="text-left">
                                <h2 className="text-xl font-bold text-[var(--fg)]">Profile Settings</h2>
                                <p className="text-sm text-[var(--muted)]">Update your personal information</p>
                            </div>
                        </div>
                        {openSections.profile ? (
                            <ChevronUp className="w-5 h-5 text-[var(--muted)]" />
                        ) : (
                            <ChevronDown className="w-5 h-5 text-[var(--muted)]" />
                        )}
                    </button>

                    {/* Content - Collapsible */}
                    {openSections.profile && (
                        <div className="p-6 pt-0 border-t border-[var(--border)] space-y-6 animate-in slide-in-from-top-2">
                            {/* Profile Picture */}
                            <div>
                                <label className="block text-sm font-medium text-[var(--fg)] mb-3">
                                    Profile Picture
                                </label>
                                <div className="flex items-center gap-6">
                                    <div className="relative group">
                                        {profileForm.profile_pic ? (
                                            <img
                                                src={profileForm.profile_pic}
                                                alt="Profile"
                                                className="w-24 h-24 rounded-full object-cover border-4 border-green-600 shadow-lg"
                                            />
                                        ) : (
                                            <div className="w-24 h-24 rounded-full bg-green-600 flex items-center justify-center text-white text-3xl font-bold shadow-lg">
                                                {profileForm.name.charAt(0).toUpperCase() || 'A'}
                                            </div>
                                        )}
                                        {uploadingImage && (
                                            <div className="absolute inset-0 bg-black/50 rounded-full flex items-center justify-center">
                                                <div className="w-8 h-8 border-4 border-white border-t-transparent rounded-full animate-spin" />
                                            </div>
                                        )}
                                    </div>

                                    <div className="flex-1">
                                        <label className="cursor-pointer inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-all font-medium text-sm active:scale-95">
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

                            {/* Form Fields */}
                            <div className="space-y-4">
                                <ResponsiveInput
                                    label="Name"
                                    value={profileForm.name}
                                    onChange={e => setProfileForm({ ...profileForm, name: e.target.value })}
                                    placeholder="Your name"
                                    required
                                />

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
                                        className="w-full px-4 py-3 bg-[var(--bg)] border border-[var(--border)] rounded-lg text-[var(--fg)] placeholder:text-[var(--muted)] focus:outline-none focus:ring-2 focus:ring-green-600 resize-none"
                                    />
                                    <p className="text-xs text-[var(--muted)] mt-1">
                                        {profileForm.bio.length}/200 characters
                                    </p>
                                </div>

                                <button
                                    onClick={handleProfileUpdate}
                                    disabled={loading || uploadingImage}
                                    className="w-full px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium flex items-center justify-center gap-2 disabled:opacity-50 transition-all active:scale-95"
                                >
                                    {loading ? (
                                        <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                    ) : (
                                        <Save className="w-5 h-5" />
                                    )}
                                    {loading ? 'Updating...' : 'Update Profile'}
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                {/* ========================================= */}
                {/* 2. PASSWORD SECTION */}
                {/* ========================================= */}
                <div className="bg-[var(--card)] border-2 border-[var(--border)] rounded-xl overflow-hidden transition-all hover:border-blue-600/30">
                    {/* Header - Always Visible */}
                    <button
                        onClick={() => toggleSection('password')}
                        className="w-full flex items-center justify-between p-5 hover:bg-[var(--bg)] transition-colors"
                    >
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 bg-blue-600/10 rounded-lg flex items-center justify-center">
                                <Key className="w-6 h-6 text-blue-600" />
                            </div>
                            <div className="text-left">
                                <h2 className="text-xl font-bold text-[var(--fg)]">Password Settings</h2>
                                <p className="text-sm text-[var(--muted)]">Change your admin password</p>
                            </div>
                        </div>
                        {openSections.password ? (
                            <ChevronUp className="w-5 h-5 text-[var(--muted)]" />
                        ) : (
                            <ChevronDown className="w-5 h-5 text-[var(--muted)]" />
                        )}
                    </button>

                    {/* Content - Collapsible */}
                    {openSections.password && (
                        <div className="p-6 pt-0 border-t border-[var(--border)] space-y-4 animate-in slide-in-from-top-2">
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
                                        className="w-full pl-4 pr-12 py-3 bg-[var(--bg)] border border-[var(--border)] rounded-lg text-[var(--fg)] placeholder:text-[var(--muted)] focus:outline-none focus:ring-2 focus:ring-blue-600"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPasswords({ ...showPasswords, current: !showPasswords.current })}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--muted)] hover:text-[var(--fg)]"
                                    >
                                        {showPasswords.current ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
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
                                        className="w-full pl-4 pr-12 py-3 bg-[var(--bg)] border border-[var(--border)] rounded-lg text-[var(--fg)] placeholder:text-[var(--muted)] focus:outline-none focus:ring-2 focus:ring-blue-600"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPasswords({ ...showPasswords, new: !showPasswords.new })}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--muted)] hover:text-[var(--fg)]"
                                    >
                                        {showPasswords.new ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
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
                                        className="w-full pl-4 pr-12 py-3 bg-[var(--bg)] border border-[var(--border)] rounded-lg text-[var(--fg)] placeholder:text-[var(--muted)] focus:outline-none focus:ring-2 focus:ring-blue-600"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPasswords({ ...showPasswords, confirm: !showPasswords.confirm })}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--muted)] hover:text-[var(--fg)]"
                                    >
                                        {showPasswords.confirm ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                                    </button>
                                </div>
                            </div>

                            <button
                                onClick={handleReset}
                                disabled={loading}
                                className="w-full px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium flex items-center justify-center gap-2 disabled:opacity-50 transition-all active:scale-95"
                            >
                                {loading ? (
                                    <>
                                        <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                        Updating...
                                    </>
                                ) : (
                                    <>
                                        <Save className="w-5 h-5" />
                                        Update Password
                                    </>
                                )}
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}