// src/app/admin/layout.tsx
// ✅ FIXED: No auth logic (handled by middleware)

"use client"

export default function AdminLayout({ children }: { children: React.ReactNode }) {
    // ✅ Middleware handles all auth checks
    // This layout just renders children

    return (
        <div className="min-h-screen bg-[var(--bg)]">
            {children}
        </div>
    )
}