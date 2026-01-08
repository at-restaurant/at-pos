// src/app/(public)/page.tsx - FIXED TYPE ERROR
'use client'
export const dynamic = 'force-dynamic'

import { useState, useMemo, useEffect } from 'react'
import { ShoppingCart, Plus, WifiOff, Menu } from 'lucide-react'
import AutoSidebar, { useSidebarItems } from '@/components/layout/AutoSidebar'
import CartDrawer from '@/components/cart/CartDrawer'
import { useCart } from '@/lib/store/cart-store'
import { useHydration } from '@/lib/hooks/useHydration'
import { useSupabase } from '@/lib/hooks'
import { offlineManager } from '@/lib/db/offlineManager'

export default function MenuPage() {
    const { data: categories } = useSupabase('menu_categories', {
        filter: { is_active: true },
        order: { column: 'display_order' }
    })

    const { data: items, loading, isOffline } = useSupabase('menu_items', {
        filter: { is_available: true },
        order: { column: 'name' }
    })

    const { data: tables } = useSupabase('restaurant_tables')
    const { data: waiters } = useSupabase('waiters', { filter: { is_active: true } })

    const cart = useCart()
    const hydrated = useHydration()
    const [selectedCat, setSelectedCat] = useState('all')
    const [cartOpen, setCartOpen] = useState(false)
    const [sidebarOpen, setSidebarOpen] = useState(false)
    const [isMounted, setIsMounted] = useState(false)

    useEffect(() => {
        setIsMounted(true)
        if (typeof window !== 'undefined' && navigator.onLine) {
            offlineManager.downloadEssentialData()
        }
    }, [])

    const filtered = useMemo(
        () => items.filter(i => selectedCat === 'all' || i.category_id === selectedCat),
        [items, selectedCat]
    )

    const sidebarItems = useSidebarItems([
        { id: 'all', label: 'All Items', icon: '📋', count: items.length },
        ...categories.map(cat => ({
            id: cat.id,
            label: cat.name,
            icon: cat.icon,
            count: items.filter(i => i.category_id === cat.id).length
        }))
    ], selectedCat, setSelectedCat)

    const handleAddToCart = (item: any) => {
        if (!hydrated) return

        cart.addItem({
            id: item.id,
            name: item.name,
            price: item.price,
            image_url: item.image_url
        })
    }

    return (
        <>
            {/* Desktop Sidebar - Hidden on mobile */}
            <div className="hidden lg:block">
                <AutoSidebar items={sidebarItems} title="Categories" />
            </div>

            {/* Mobile Sidebar Overlay */}
            {sidebarOpen && (
                <>
                    {/* Backdrop */}
                    <div
                        className="fixed inset-0 bg-black/50 z-40 lg:hidden"
                        onClick={() => setSidebarOpen(false)}
                    />

                    {/* Sidebar */}
                    <div className="fixed top-0 left-0 h-full w-64 bg-[var(--card)] border-r border-[var(--border)] z-50 lg:hidden overflow-y-auto">
                        <div className="p-4 border-b border-[var(--border)] flex items-center justify-between">
                            <h2 className="text-lg font-bold text-[var(--fg)]">Categories</h2>
                            <button
                                onClick={() => setSidebarOpen(false)}
                                className="p-2 hover:bg-[var(--bg)] rounded-lg transition-colors"
                            >
                                ✕
                            </button>
                        </div>

                        <div className="p-2">
                            {sidebarItems.map(item => (
                                <button
                                    key={item.id}
                                    onClick={() => {
                                        item.onClick()
                                        setSidebarOpen(false)
                                    }}
                                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all mb-1 ${
                                        item.active
                                            ? 'bg-blue-600 text-white shadow-lg'
                                            : 'hover:bg-[var(--bg)] text-[var(--fg)]'
                                    }`}
                                >
                                    <span className="text-xl">{item.icon}</span>
                                    <span className="flex-1 text-left font-medium text-sm">
                                        {item.label}
                                    </span>
                                    <span className={`text-xs font-semibold px-2 py-1 rounded-full ${
                                        item.active
                                            ? 'bg-white/20'
                                            : 'bg-[var(--bg)] text-[var(--muted)]'
                                    }`}>
                                        {item.count}
                                    </span>
                                </button>
                            ))}
                        </div>
                    </div>
                </>
            )}

            <div className="min-h-screen bg-[var(--bg)] lg:ml-64">
                {/* Fixed Header with Menu Button */}
                <header className="sticky top-0 z-40 bg-[var(--card)]/95 border-b border-[var(--border)] backdrop-blur-lg shadow-sm">
                    <div className="max-w-7xl mx-auto px-3 sm:px-6 py-2.5 sm:py-3.5">
                        <div className="flex items-center justify-between gap-2 sm:gap-3">
                            {/* Left Side - Menu Button + Title */}
                            <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
                                {/* Mobile Menu Button */}
                                <button
                                    onClick={() => setSidebarOpen(true)}
                                    className="lg:hidden p-2 hover:bg-[var(--bg)] rounded-lg transition-colors shrink-0"
                                >
                                    <Menu className="w-5 h-5 text-[var(--fg)]" />
                                </button>

                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <h1 className="text-lg sm:text-2xl font-bold text-[var(--fg)]">
                                            Menu
                                        </h1>
                                        {isMounted && isOffline && (
                                            <span className="flex items-center gap-1 px-1.5 py-0.5 sm:px-2 sm:py-1 bg-yellow-500/10 border border-yellow-500/30 rounded-full text-[10px] sm:text-xs font-medium text-yellow-600">
                                                <WifiOff className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                                                <span className="hidden xs:inline">Offline</span>
                                            </span>
                                        )}
                                    </div>
                                    <p className="text-[10px] sm:text-sm text-[var(--muted)] mt-0.5">
                                        {filtered.length} items
                                    </p>
                                </div>
                            </div>

                            {/* Cart Button */}
                            <button
                                onClick={() => setCartOpen(!cartOpen)}
                                className="relative px-2.5 sm:px-4 py-1.5 sm:py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-1.5 sm:gap-2 font-medium text-xs sm:text-base shadow-lg active:scale-95 transition-all shrink-0"
                            >
                                <ShoppingCart className="w-4 h-4 sm:w-5 sm:h-5" />
                                <span className="hidden xs:inline">Cart</span>
                                {hydrated && cart.itemCount() > 0 && (
                                    <span className="absolute -top-1.5 -right-1.5 sm:-top-2 sm:-right-2 min-w-[18px] h-[18px] sm:min-w-[24px] sm:h-6 px-0.5 sm:px-1 bg-red-600 text-white rounded-full flex items-center justify-center text-[10px] sm:text-xs font-bold shadow-lg">
                                        {cart.itemCount()}
                                    </span>
                                )}
                            </button>
                        </div>
                    </div>

                    {/* Horizontal Scrollable Categories - Mobile Only */}
                    <div className="lg:hidden border-t border-[var(--border)] bg-[var(--card)]/95 backdrop-blur-lg">
                        <div className="max-w-7xl mx-auto overflow-x-auto scrollbar-hide">
                            <div className="flex gap-2 px-3 py-3 min-w-max">
                                {sidebarItems.map(item => (
                                    <button
                                        key={item.id}
                                        onClick={item.onClick}
                                        className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-all whitespace-nowrap shrink-0 ${
                                            item.active
                                                ? 'bg-blue-600 text-white shadow-lg'
                                                : 'bg-[var(--bg)] text-[var(--fg)] hover:bg-[var(--bg)]/80'
                                        }`}
                                    >
                                        <span className="text-base">{item.icon}</span>
                                        <span className="text-xs font-medium">
                                            {item.label}
                                        </span>
                                        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${
                                            item.active
                                                ? 'bg-white/20'
                                                : 'bg-[var(--card)] text-[var(--muted)]'
                                        }`}>
                                            {item.count}
                                        </span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                </header>

                {/* Content */}
                <div className="max-w-7xl mx-auto px-3 sm:px-6 py-4 sm:py-6">
                    {loading ? (
                        <div className="flex justify-center py-16 sm:py-20">
                            <div className="w-10 h-10 sm:w-12 sm:h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
                        </div>
                    ) : filtered.length === 0 ? (
                        <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-8 sm:p-12 text-center">
                            <div className="text-4xl sm:text-5xl mb-3 sm:mb-4">🍽️</div>
                            <p className="text-[var(--fg)] font-medium mb-2 text-sm sm:text-base">No items found</p>
                            <p className="text-xs sm:text-sm text-[var(--muted)]">
                                {isOffline ? 'Download menu when online' : 'Try selecting a different category'}
                            </p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2.5 sm:gap-3">
                            {filtered.map(item => (
                                <div
                                    key={item.id}
                                    className="bg-[var(--card)] border border-[var(--border)] rounded-lg sm:rounded-xl overflow-hidden hover:shadow-xl hover:border-blue-600 transition-all group flex flex-col h-full"
                                >
                                    {item.image_url && (
                                        <div className="relative w-full aspect-square overflow-hidden bg-[var(--bg)]">
                                            <img
                                                src={item.image_url}
                                                alt={item.name}
                                                className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                                                loading="lazy"
                                            />
                                            <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                                        </div>
                                    )}

                                    <div className="p-2.5 sm:p-3 flex flex-col flex-grow">
                                        <div className="flex-grow space-y-1 sm:space-y-2">
                                            <h3 className="font-semibold text-xs sm:text-sm text-[var(--fg)] leading-snug line-clamp-2">
                                                {item.name}
                                            </h3>

                                            {item.description && (
                                                <p className="text-[10px] sm:text-xs text-[var(--muted)] leading-relaxed line-clamp-2 hidden xs:block">
                                                    {item.description}
                                                </p>
                                            )}
                                        </div>

                                        <div className="flex items-center justify-between pt-2 mt-auto gap-1.5">
                                            <span className="text-xs sm:text-sm font-bold text-blue-600 shrink-0">
                                                PKR {item.price}
                                            </span>

                                            <button
                                                onClick={() => handleAddToCart(item)}
                                                disabled={!hydrated}
                                                className="px-2 sm:px-3 py-1 sm:py-1.5 text-[10px] sm:text-xs bg-blue-600 text-white rounded-md hover:bg-blue-700 active:scale-95 transition-all disabled:opacity-50 flex items-center gap-0.5 sm:gap-1 shrink-0"
                                            >
                                                <Plus className="w-3 h-3" />
                                                <span className="hidden xs:inline">Add</span>
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            <CartDrawer
                isOpen={cartOpen}
                onClose={() => setCartOpen(false)}
                tables={tables}
                waiters={waiters}
            />
        </>
    )
}