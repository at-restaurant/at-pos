// src/components/admin/AdminProfileModal.tsx
'use client'

import { X, Shield } from 'lucide-react'
import { useAdminAuth } from '@/lib/hooks/useAdminAuth'
import Link from 'next/link'

interface AdminProfileModalProps {
    open: boolean
    onClose: () => void
}

export default function AdminProfileModal({ open, onClose }: AdminProfileModalProps) {
    const { profile } = useAdminAuth()

    if (!open || !profile) return null

    return (
        <div
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
            onClick={onClose}
        >
            <div
                className="bg-[var(--card)] border border-[var(--border)] rounded-xl w-full max-w-md shadow-2xl"
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="relative p-6 border-b border-[var(--border)]">
                    <button
                        onClick={onClose}
                        className="absolute top-4 right-4 p-2 hover:bg-[var(--bg)] rounded-lg transition-colors"
                    >
                        <X className="w-5 h-5 text-[var(--muted)]" />
                    </button>

                    <div className="flex items-center gap-3">
                        <div className="w-12 h-12 bg-blue-600/10 rounded-lg flex items-center justify-center">
                            <Shield className="w-6 h-6 text-blue-600" />
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-[var(--fg)]">Admin Profile</h3>
                            <p className="text-xs text-[var(--muted)]">Your account details</p>
                        </div>
                    </div>
                </div>

                {/* Content */}
                <div className="p-6 space-y-6">
                    {/* Profile Picture */}
                    <div className="flex flex-col items-center">
                        {profile.profile_pic ? (
                            <img
                                src={profile.profile_pic}
                                alt={profile.name}
                                className="w-24 h-24 rounded-full object-cover border-4 border-blue-600 shadow-lg mb-4"
                            />
                        ) : (
                            <div className="w-24 h-24 rounded-full bg-blue-600/10 flex items-center justify-center text-[var(--fg)] text-4xl font-bold shadow-lg mb-4">
                                {profile.name?.charAt(0)?.toUpperCase() || 'A'}
                            </div>
                        )}
                        <h2 className="text-2xl font-bold text-[var(--fg)]">{profile.name}</h2>
                        {profile.bio && (
                            <p className="text-sm text-[var(--muted)] text-center mt-2 max-w-xs">
                                {profile.bio}
                            </p>
                        )}
                    </div>

                    {/* Info Card */}
                    <div className="p-4 bg-[var(--card)] rounded-lg border border-[var(--border)]">
                        <div className="flex items-center gap-3 mb-3">
                            <div className="w-10 h-10 bg-blue-600/10 rounded-lg flex items-center justify-center">
                                <Shield className="w-5 h-5 text-blue-600" />
                            </div>
                            <div>
                                <p className="text-sm font-semibold text-[var(--fg)]">Administrator</p>
                                <p className="text-xs text-[var(--muted)]">Full system access</p>
                            </div>
                        </div>
                        <div className="pt-3 border-t border-[var(--border)]">
                            <p className="text-xs text-[var(--muted)]">
                                You have complete control over the restaurant management system
                            </p>
                        </div>
                    </div>

                    {/* Actions */}
                    <div className="space-y-2">
                        <Link
                            href="/admin/settings"
                            onClick={onClose}
                            className="w-full px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium text-sm flex items-center justify-center gap-2 transition-all active:scale-95"
                        >
                            Edit Profile & Settings
                        </Link>

                        <button
                            onClick={onClose}
                            className="w-full px-4 py-3 bg-[var(--card)] text-[var(--fg)] rounded-lg hover:bg-[var(--border)] font-medium text-sm transition-all active:scale-95"
                        >
                            Close
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}
