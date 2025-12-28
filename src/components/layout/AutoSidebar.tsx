// src/components/layout/AutoSidebar.tsx - FULLY MOBILE RESPONSIVE
"use client"

import { X, Menu } from 'lucide-react'
import { useState, useEffect } from 'react'

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
    const [mounted, setMounted] = useState(false)

    useEffect(() => {
        setMounted(true)
    }, [])

    if (!items || items.length === 0) return null
    if (!mounted) return null

    return (
        <>
            {/* ========================================= */}
            {/* MOBILE VIEW (< lg breakpoint) */}
            {/* ========================================= */}

            {/* Mobile: Top Floating Bar with Toggle + Scrollable Chips */}
            <div className="lg:hidden fixed top-0 left-0 right-0 z-30 bg-[var(--card)]/95 backdrop-blur-lg border-b border-[var(--border)] shadow-lg">
                <div className="px-3 py-2.5">
                    <div className="flex items-center gap-2">
                        {/* Toggle Button - Fixed */}
                        <button
                            onClick={() => setMobileOpen(!mobileOpen)}
                            className="flex-shrink-0 relative p-2.5 rounded-xl bg-gradient-to-br from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 active:scale-95 transition-all shadow-lg hover:shadow-xl group"
                            aria-label="Toggle menu"
                        >
                            <div className="absolute inset-0 rounded-xl bg-white/20 opacity-0 group-hover:opacity-100 transition-opacity" />
                            <Menu className="w-5 h-5 text-white relative z-10" />
                            {items.some(i => i.active) && (
                                <div className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-green-400 rounded-full animate-pulse shadow-lg" />
                            )}
                        </button>

                        {/* Scrollable Chips */}
                        <div className="flex-1 overflow-x-auto scrollbar-hide">
                            <div className="flex gap-2 pb-1">
                                {items.map(item => (
                                    <button
                                        key={item.id}
                                        onClick={() => {
                                            item.onClick()
                                            setMobileOpen(false)
                                        }}
                                        className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium whitespace-nowrap transition-all flex-shrink-0 active:scale-95 shadow-sm ${
                                            item.active
                                                ? 'bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-lg shadow-blue-600/30'
                                                : 'bg-[var(--bg)] text-[var(--fg)] border border-[var(--border)] hover:border-blue-400'
                                        }`}
                                    >
                                        {item.icon && <span className="text-sm">{item.icon}</span>}
                                        <span>{item.label}</span>
                                        {item.count !== undefined && item.count > 0 && (
                                            <span className={`px-1.5 py-0.5 rounded-full text-xs font-bold ${
                                                item.active
                                                    ? 'bg-white/25 text-white'
                                                    : 'bg-blue-600/10 text-blue-600'
                                            }`}>
                                                {item.count}
                                            </span>
                                        )}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Mobile Drawer Overlay */}
            {mobileOpen && (
                <>
                    <div
                        className="lg:hidden fixed inset-0 bg-black/60 backdrop-blur-sm z-40 animate-in fade-in duration-200"
                        onClick={() => setMobileOpen(false)}
                    />

                    {/* Drawer Content */}
                    <div className="lg:hidden fixed left-0 top-0 bottom-0 w-72 bg-[var(--card)] shadow-2xl z-50 animate-in slide-in-from-left duration-300">
                        {/* Header */}
                        <div className="flex items-center justify-between px-4 h-16 border-b border-[var(--border)] bg-gradient-to-r from-blue-600/10 to-purple-600/10">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-blue-700 flex items-center justify-center shadow-lg">
                                    <span className="text-white font-bold text-lg">📋</span>
                                </div>
                                {title && <h3 className="font-bold text-[var(--fg)] text-lg">{title}</h3>}
                            </div>
                            <button
                                onClick={() => setMobileOpen(false)}
                                className="p-2 hover:bg-[var(--bg)] rounded-lg active:scale-95 transition-all"
                            >
                                <X className="w-5 h-5 text-[var(--muted)]" />
                            </button>
                        </div>

                        {/* Items */}
                        <div className="p-3 space-y-2 overflow-y-auto" style={{ height: 'calc(100vh - 64px)' }}>
                            {items.map(item => (
                                <button
                                    key={item.id}
                                    onClick={() => {
                                        item.onClick()
                                        setMobileOpen(false)
                                    }}
                                    className={`w-full flex items-center justify-between px-4 py-3.5 rounded-xl text-sm font-medium transition-all active:scale-95 shadow-sm ${
                                        item.active
                                            ? 'bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-lg shadow-blue-600/30'
                                            : 'text-[var(--fg)] bg-[var(--bg)] hover:bg-[var(--border)] border border-[var(--border)]'
                                    }`}
                                >
                                    <div className="flex items-center gap-3 min-w-0 flex-1">
                                        {item.icon && (
                                            <span className={`flex-shrink-0 text-xl ${
                                                item.active ? 'drop-shadow-lg' : ''
                                            }`}>
                                                {item.icon}
                                            </span>
                                        )}
                                        <span className="truncate font-semibold">{item.label}</span>
                                    </div>
                                    {item.count !== undefined && item.count > 0 && (
                                        <span className={`px-2.5 py-1 rounded-full text-xs font-bold flex-shrink-0 ml-2 shadow-sm ${
                                            item.active
                                                ? 'bg-white/25 text-white'
                                                : 'bg-blue-600/10 text-blue-600 border border-blue-600/20'
                                        }`}>
                                            {item.count}
                                        </span>
                                    )}
                                </button>
                            ))}
                        </div>

                        {/* Footer Info */}
                        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-[var(--border)] bg-[var(--bg)]/50">
                            <p className="text-xs text-[var(--muted)] text-center">
                                {items.filter(i => i.active).length > 0 ? (
                                    <>📌 {items.find(i => i.active)?.label}</>
                                ) : (
                                    <>✨ Select a category</>
                                )}
                            </p>
                        </div>
                    </div>
                </>
            )}

            {/* ========================================= */}
            {/* DESKTOP VIEW (>= lg breakpoint) */}
            {/* ========================================= */}
            <aside className="hidden lg:block fixed top-0 left-16 h-screen w-64 min-w-64 max-w-64 bg-[var(--card)] border-r border-[var(--border)] z-30 overflow-hidden shadow-lg">
                {/* Desktop Header */}
                {title && (
                    <div className="h-16 flex items-center px-4 border-b border-[var(--border)] bg-gradient-to-r from-blue-600/10 to-purple-600/10">
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-600 to-blue-700 flex items-center justify-center shadow-md">
                                <span className="text-white font-bold">📋</span>
                            </div>
                            <h3 className="font-bold text-[var(--fg)]">{title}</h3>
                        </div>
                    </div>
                )}

                {/* Desktop Items */}
                <div className="p-3 space-y-2 overflow-y-auto" style={{ height: title ? 'calc(100vh - 64px)' : '100vh' }}>
                    {items.map(item => (
                        <button
                            key={item.id}
                            onClick={item.onClick}
                            className={`w-full flex items-center justify-between px-4 py-3 rounded-xl text-sm font-medium transition-all active:scale-95 shadow-sm ${
                                item.active
                                    ? 'bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-lg shadow-blue-600/20'
                                    : 'text-[var(--fg)] bg-[var(--bg)] hover:bg-[var(--border)] border border-[var(--border)]'
                            }`}
                        >
                            <div className="flex items-center gap-3 min-w-0 flex-1">
                                {item.icon && (
                                    <span className={`flex-shrink-0 text-lg ${
                                        item.active ? 'drop-shadow-lg' : ''
                                    }`}>
                                        {item.icon}
                                    </span>
                                )}
                                <span className="truncate font-semibold">{item.label}</span>
                            </div>
                            {item.count !== undefined && item.count > 0 && (
                                <span className={`px-2.5 py-1 rounded-full text-xs font-bold flex-shrink-0 ml-2 shadow-sm ${
                                    item.active
                                        ? 'bg-white/25 text-white'
                                        : 'bg-blue-600/10 text-blue-600 border border-blue-600/20'
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

export function useSidebarItems(
    routeConfig: any[],
    currentFilter: string,
    onFilterChange: (id: string) => void
): SidebarItem[] {
    return routeConfig.map(config => ({
        id: config.id,
        label: config.label,
        icon: config.icon,
        count: config.count,
        active: currentFilter === config.id,
        onClick: () => onFilterChange(config.id)
    }))
}