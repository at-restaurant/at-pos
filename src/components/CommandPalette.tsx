// src/components/CommandPalette.tsx
"use client"

import { useState, useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { Search, X } from 'lucide-react'

// ✅ Reusable Action Type
type Action = {
    id: string
    label: string
    icon: any
    href: string
    category: 'public' | 'admin' | 'shared'
    keywords: string[]
}

// ✅ Single Config - Context Aware
const ACTIONS: Action[] = [
    // Public Only
    { id: 'new-order', label: 'Start New Order', icon: '🍽️', href: '/', category: 'public', keywords: ['order', 'new', 'menu'] },
    { id: 'view-tables', label: 'View Tables', icon: '🪑', href: '/tables', category: 'public', keywords: ['table', 'seating'] },
    { id: 'view-orders', label: 'View Orders', icon: '📋', href: '/orders', category: 'public', keywords: ['order', 'bill'] },
    { id: 'attendance', label: 'Mark Attendance', icon: '⏰', href: '/attendance', category: 'public', keywords: ['clock', 'shift'] },

    // Admin Only
    { id: 'dashboard', label: 'Dashboard', icon: '📊', href: '/admin', category: 'admin', keywords: ['admin', 'overview'] },
    { id: 'inventory', label: 'Manage Inventory', icon: '📦', href: '/admin/inventory', category: 'admin', keywords: ['stock', 'items'] },
    { id: 'menu-admin', label: 'Manage Menu', icon: '🍔', href: '/admin/menu', category: 'admin', keywords: ['menu', 'items'] },
    { id: 'staff', label: 'Manage Staff', icon: '👥', href: '/admin/waiters', category: 'admin', keywords: ['staff', 'waiter', 'employee'] },
    { id: 'tables-admin', label: 'Setup Tables', icon: '🏠', href: '/admin/tables', category: 'admin', keywords: ['table', 'setup'] },
    { id: 'history', label: 'Reports & History', icon: '📈', href: '/admin/history', category: 'admin', keywords: ['report', 'analytics'] },
    { id: 'settings', label: 'Settings', icon: '⚙️', href: '/admin/settings', category: 'admin', keywords: ['password', 'config'] },

    // Shared (Both)
    { id: 'search', label: 'Search Everything', icon: '🔍', href: '#', category: 'shared', keywords: ['search', 'find'] },
]

export default function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
    const router = useRouter()
    const pathname = usePathname()
    const [search, setSearch] = useState('')
    const [selected, setSelected] = useState(0)

    // ✅ Auto-detect context
    const isAdmin = pathname.startsWith('/admin')
    const context = isAdmin ? 'admin' : 'public'

    // ✅ Filter based on context
    const filtered = ACTIONS
        .filter(a => a.category === context || a.category === 'shared')
        .filter(a => {
            const s = search.toLowerCase()
            return a.label.toLowerCase().includes(s) || a.keywords.some(k => k.includes(s))
        })

    useEffect(() => setSelected(0), [search])

    useEffect(() => {
        if (!open) { setSearch(''); setSelected(0); return }
        const down = (e: KeyboardEvent) => {
            if (e.key === 'Escape') { e.preventDefault(); onClose() }
            if (e.key === 'ArrowDown') { e.preventDefault(); setSelected(i => Math.min(i + 1, filtered.length - 1)) }
            if (e.key === 'ArrowUp') { e.preventDefault(); setSelected(i => Math.max(i - 1, 0)) }
            if (e.key === 'Enter' && filtered[selected]) { e.preventDefault(); router.push(filtered[selected].href); onClose() }
        }
        document.addEventListener('keydown', down)
        return () => document.removeEventListener('keydown', down)
    }, [open, search, selected, filtered])

    if (!open) return null

    return (
        <>
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100]" onClick={onClose} />

            <div className="fixed inset-0 z-[101] flex items-start justify-center pt-20 px-4">
                <div className="w-full max-w-2xl bg-[var(--card)] border-2 border-blue-600/50 rounded-xl shadow-2xl overflow-hidden animate-in slide-in-from-top-4">

                    {/* Header */}
                    <div className="flex items-center gap-3 px-4 py-4 border-b border-[var(--border)]">
                        <Search className="w-5 h-5 text-blue-600" />
                        <input autoFocus value={search} onChange={e => setSearch(e.target.value)}
                               placeholder={`Search ${context === 'admin' ? 'Admin' : 'Restaurant'}...`}
                               className="flex-1 bg-transparent outline-none text-[var(--fg)] placeholder:text-[var(--muted)] text-lg" />
                        <span className="px-3 py-1 bg-blue-600 text-white text-xs font-bold rounded">
                            {context === 'admin' ? '🛡️ Admin' : '🍽️ Public'}
                        </span>
                    </div>

                    {/* Results */}
                    <div className="max-h-[60vh] overflow-y-auto p-2">
                        {filtered.length === 0 ? (
                            <div className="py-16 text-center">
                                <Search className="w-16 h-16 text-[var(--muted)] mx-auto mb-4" />
                                <p className="text-[var(--fg)] font-medium">No results</p>
                            </div>
                        ) : (
                            <div className="space-y-1">
                                {filtered.map((action, idx) => (
                                    <button key={action.id}
                                            onClick={() => { router.push(action.href); onClose() }}
                                            onMouseEnter={() => setSelected(idx)}
                                            className={`w-full flex items-center gap-4 px-4 py-3 rounded-lg transition-all ${selected === idx ? 'bg-blue-600 text-white' : 'hover:bg-[var(--bg)] text-[var(--fg)]'}`}>
                                        <span className="text-2xl">{action.icon}</span>
                                        <div className="flex-1 text-left">
                                            <p className="font-medium">{action.label}</p>
                                            <p className={`text-xs ${selected === idx ? 'text-white/70' : 'text-[var(--muted)]'}`}>{action.href}</p>
                                        </div>
                                        {selected === idx && <kbd className="px-2 py-1 bg-white/20 text-xs rounded">↵</kbd>}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Footer */}
                    <div className="px-4 py-3 border-t border-[var(--border)] bg-[var(--bg)] flex justify-between text-xs text-[var(--muted)]">
                        <span>↑↓ Navigate • ↵ Select</span>
                        <span>⌘K to open</span>
                    </div>
                </div>
            </div>
        </>
    )
}