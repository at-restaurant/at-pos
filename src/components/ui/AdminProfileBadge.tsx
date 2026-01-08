'use client'
import { useAdminAuth } from '@/lib/hooks/useAdminAuth'

export default function AdminProfileBadge({ onClick }: { onClick?: () => void }) {
    const { profile } = useAdminAuth()

    if (!profile) return null

    return (
        <div
            onClick={onClick}
            className="flex items-center gap-2 px-3 py-2 bg-[var(--bg)] border border-[var(--border)] rounded-lg cursor-pointer hover:bg-[var(--card)] transition"
        >
            {profile.profile_pic ? (
                <img
                    src={profile.profile_pic}
                    className="w-8 h-8 rounded-full object-cover"
                />
            ) : (
                <div className="w-8 h-8 rounded-full bg-blue-600/80 flex items-center justify-center text-[var(--fg)] font-bold">
                    {profile.name.charAt(0).toUpperCase()}
                </div>
            )}
            <span className="hidden sm:block text-sm font-medium text-[var(--fg)]">
                {profile.name}
            </span>
        </div>
    )
}
