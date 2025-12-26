// src/app/(public)/page.tsx - FIXED MENU (NO AUTO-OPEN CART)
'use client'

import { useState, useMemo, useEffect } from 'react'
import { ShoppingCart, Plus, WifiOff } from 'lucide-react'
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

    // ✅ FIX: NO AUTO-OPEN - Just add silently
    const handleAddToCart = (item: any) => {
        if (!hydrated) return

        cart.addItem({
            id: item.id,
            name: item.name,
            price: item.price,
            image_url: item.image_url
        })

        // Don't open cart automatically - user must click cart button
    }

    return (
        <>
            <AutoSidebar items={sidebarItems} title="Categories" />

            <div className="min-h-screen bg-[var(--bg)] lg:ml-64">
                {/* Header */}
                <header className="sticky top-0 z-20 bg-[var(--card)] border-b border-[var(--border)] backdrop-blur-lg shadow-sm">
                    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 sm:py-4">
                        <div className="flex items-center justify-between gap-3">
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                    <h1 className="text-xl sm:text-2xl font-bold text-[var(--fg)]">
                                        Menu
                                    </h1>
                                    {isMounted && isOffline && (
                                        <span className="flex items-center gap-1 px-2 py-1 bg-yellow-500/10 border border-yellow-500/30 rounded-full text-xs font-medium text-yellow-600">
                                            <WifiOff className="w-3 h-3" />
                                            Offline
                                        </span>
                                    )}
                                </div>
                                <p className="text-xs sm:text-sm text-[var(--muted)] mt-1">
                                    {filtered.length} items available
                                </p>
                            </div>

                            {/* Cart Button */}
                            <button
                                onClick={() => setCartOpen(!cartOpen)}
                                className="relative px-3 sm:px-4 py-2 sm:py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2 font-medium text-sm sm:text-base shadow-lg active:scale-95 transition-all"
                            >
                                <ShoppingCart className="w-4 h-4 sm:w-5 sm:h-5" />
                                <span className="hidden sm:inline">Cart</span>
                                {hydrated && cart.itemCount() > 0 && (
                                    <span className="absolute -top-2 -right-2 min-w-[20px] h-5 sm:min-w-[24px] sm:h-6 px-1 bg-red-600 text-white rounded-full flex items-center justify-center text-xs font-bold shadow-lg">
                                        {cart.itemCount()}
                                    </span>
                                )}
                            </button>
                        </div>
                    </div>
                </header>

                {/* Content */}
                <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
                    {loading ? (
                        <div className="flex justify-center py-20">
                            <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
                        </div>
                    ) : filtered.length === 0 ? (
                        <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-12 text-center">
                            <div className="text-5xl mb-4">🍽️</div>
                            <p className="text-[var(--fg)] font-medium mb-2">No items found</p>
                            <p className="text-sm text-[var(--muted)]">
                                {isOffline ? 'Download menu when online' : 'Try selecting a different category'}
                            </p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                            {filtered.map(item => (
                                <div
                                    key={item.id}
                                    className="bg-[var(--card)] border border-[var(--border)] rounded-xl overflow-hidden hover:shadow-xl hover:border-blue-600 transition-all group flex flex-col h-full"
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

                                    <div className="p-3 flex flex-col flex-grow">
                                        <div className="flex-grow space-y-2">
                                            <h3 className="font-semibold text-sm text-[var(--fg)] leading-snug">
                                                {item.name}
                                            </h3>

                                            {item.description && (
                                                <p className="text-xs text-[var(--muted)] leading-relaxed line-clamp-2">
                                                    {item.description}
                                                </p>
                                            )}
                                        </div>

                                        <div className="flex items-center justify-between pt-2 mt-auto">
                                            <span className="text-sm font-bold text-blue-600">
                                                PKR {item.price}
                                            </span>

                                            <button
                                                onClick={() => handleAddToCart(item)}
                                                disabled={!hydrated}
                                                className="px-3 py-1.5 text-xs bg-blue-600 text-white rounded-md hover:bg-blue-700 active:scale-95 transition-all disabled:opacity-50 flex items-center gap-1"
                                            >
                                                <Plus className="w-3 h-3" />
                                                Add
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