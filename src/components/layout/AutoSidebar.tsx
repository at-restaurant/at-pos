// File: components/AutoSidebar.tsx

"use client"

import { X, Menu } from 'lucide-react'
import { useState } from 'react'

export interface SidebarItem {
    id: string
    label: string
    icon?: string
    count?: number
    active?: boolean
    onClick: () => void
}

export default function AutoSidebar({ items, title }: { items: SidebarItem[]; title?: string }) {
    const [mobileOpen, setMobileOpen] = useState(false)

    if (!items || items.length === 0) return null

    return (
        <>
            {/* Mobile: Top Bar with Toggle Button + Chips */}
            <div className="lg:hidden sticky top-0 z-20 bg-[var(--card)] border-b border-[var(--border)]">
                <div className="px-3 py-2.5">
                    <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide pb-1">
                        {/* Toggle Button */}
                        <button
                            onClick={() => setMobileOpen(!mobileOpen)}
                            className="flex-shrink-0 relative p-2.5 rounded-xl bg-gradient-to-br from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 active:scale-95 transition-all shadow-lg hover:shadow-xl group"
                            aria-label="Toggle menu"
                        >
                            <div className="absolute inset-0 rounded-xl bg-white/20 opacity-0 group-hover:opacity-100 transition-opacity" />
                            <Menu className="w-4 h-4 text-white relative z-10" />
                            <div className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                        </button>

                        {/* Scrollable Chips */}
                        {items.map(item => (
                            <button
                                key={item.id}
                                onClick={() => {
                                    item.onClick()
                                    setMobileOpen(false)
                                }}
                                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium whitespace-nowrap transition-all flex-shrink-0 active:scale-95 ${
                                    item.active
                                        ? 'bg-blue-600 text-white shadow-md'
                                        : 'bg-[var(--bg)] text-[var(--fg)] border border-[var(--border)] hover:border-blue-600'
                                }`}
                            >
                                {item.icon && <span className="text-sm">{item.icon}</span>}
                                <span>{item.label}</span>
                                {item.count !== undefined && (
                                    <span className={`px-1.5 py-0.5 rounded-full text-xs font-bold ${
                                        item.active
                                            ? 'bg-white/20 text-white'
                                            : 'bg-[var(--card)] text-[var(--muted)]'
                                    }`}>
                                        {item.count}
                                    </span>
                                )}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Mobile Drawer */}
            {mobileOpen && (
                <div className="lg:hidden fixed inset-0 z-50">
                    {/* Backdrop */}
                    <div className="absolute inset-0 bg-black/50" onClick={() => setMobileOpen(false)} />

                    {/* Drawer Content */}
                    <div className="absolute left-0 top-0 bottom-0 w-64 bg-[var(--card)] shadow-xl">
                        {/* Header */}
                        <div className="flex items-center justify-between px-4 h-16 border-b border-[var(--border)]">
                            {title && <h3 className="font-semibold text-[var(--fg)]">{title}</h3>}
                            <button
                                onClick={() => setMobileOpen(false)}
                                className="ml-auto p-2 hover:bg-[var(--bg)] rounded-lg active:scale-95 transition-all"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Items */}
                        <div className="p-2 space-y-1 overflow-y-auto" style={{ height: 'calc(100vh - 64px)' }}>
                            {items.map(item => (
                                <button
                                    key={item.id}
                                    onClick={() => {
                                        item.onClick()
                                        setMobileOpen(false)
                                    }}
                                    className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition-all active:scale-95 ${
                                        item.active
                                            ? 'bg-blue-600 text-white shadow-lg'
                                            : 'text-[var(--fg)] hover:bg-[var(--bg)]'
                                    }`}
                                >
                                    <div className="flex items-center gap-2 min-w-0">
                                        {item.icon && <span className="flex-shrink-0 text-base">{item.icon}</span>}
                                        <span className="truncate">{item.label}</span>
                                    </div>
                                    {item.count !== undefined && (
                                        <span className={`px-2 py-0.5 rounded-full text-xs font-bold flex-shrink-0 ml-2 ${
                                            item.active
                                                ? 'bg-white/20 text-white'
                                                : 'bg-[var(--bg)] text-[var(--muted)]'
                                        }`}>
                                            {item.count}
                                        </span>
                                    )}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* Desktop: Fixed Nested Sidebar - Starts after UnifiedSidebar (64px) */}
            <aside className="hidden lg:block fixed top-0 left-16 h-screen w-64 min-w-64 max-w-64 bg-[var(--card)] border-r border-[var(--border)] z-30 overflow-y-auto overflow-x-hidden">
            {title && (
                    <div className="h-16 flex items-center px-4 border-b border-[var(--border)]">
                        <h3 className="font-semibold text-[var(--fg)]">{title}</h3>
                    </div>
                )}
                <div className="p-2 space-y-1 overflow-y-auto" style={{ height: title ? 'calc(100vh - 64px)' : '100vh' }}>
                    {items.map(item => (
                        <button
                            key={item.id}
                            onClick={item.onClick}
                            className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition-all active:scale-95 ${
                                item.active
                                    ? 'bg-blue-600 text-white shadow-lg'
                                    : 'text-[var(--fg)] hover:bg-[var(--bg)]'
                            }`}
                        >
                            <div className="flex items-center gap-2 min-w-0">
                                {item.icon && <span className="flex-shrink-0 text-base">{item.icon}</span>}
                                <span className="truncate">{item.label}</span>
                            </div>
                            {item.count !== undefined && (
                                <span className={`px-2 py-0.5 rounded-full text-xs font-bold flex-shrink-0 ml-2 ${
                                    item.active
                                        ? 'bg-white/20 text-white'
                                        : 'bg-[var(--bg)] text-[var(--muted)]'
                                }`}>
                                    {item.count}
                                </span>
                            )}
                        </button>
                    ))}
                </div>
            </aside>
        </>
    )
}

export function useSidebarItems(routeConfig: any[], currentFilter: string, onFilterChange: (id: string) => void): SidebarItem[] {
    return routeConfig.map(config => ({
        id: config.id,
        label: config.label,
        icon: config.icon,
        count: config.count,
        active: currentFilter === config.id,
        onClick: () => onFilterChange(config.id)
    }))
}