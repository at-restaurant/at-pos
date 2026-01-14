// src/app/(public)/page.tsx - PRODUCTION FIXED
'use client'
export const dynamic = 'force-dynamic'

import { useState, useMemo, useEffect } from 'react'
import { ShoppingCart, Plus, WifiOff, Menu, RefreshCw } from 'lucide-react'
import { useSidebarItems } from '@/lib/hooks/useSidebarItems'
import AutoSidebar from '@/components/layout/AutoSidebar'
import CartDrawer from '@/components/cart/CartDrawer'
import { useCart } from '@/lib/store/cart-store'
import { useHydration } from '@/lib/hooks/useHydration'
import { syncManager } from '@/lib/db/syncManager'
import { db } from '@/lib/db/dexie'
import { createClient } from '@/lib/supabase/client'
import type { MenuItem, MenuCategory } from '@/lib/db/dexie'

export default function MenuPage() {
    const [categories, setCategories] = useState<MenuCategory[]>([])
    const [items, setItems] = useState<MenuItem[]>([])
    const [tables, setTables] = useState<any[]>([])
    const [waiters, setWaiters] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [isOffline, setIsOffline] = useState(false)
    const [isSyncing, setIsSyncing] = useState(false)
    const [selectedCat, setSelectedCat] = useState('all')
    const [cartOpen, setCartOpen] = useState(false)
    const [sidebarOpen, setSidebarOpen] = useState(false)

    const cart = useCart()
    const hydrated = useHydration()
    const supabase = createClient()

    useEffect(() => {
        // Set initial online status
        setIsOffline(!navigator.onLine)

        // Initial load
        loadAllData()

        // Auto-sync if online
        if (navigator.onLine) {
            syncManager.isOfflineReady().then(ready => {
                if (!ready) {
                    console.log('📥 Auto-downloading menu data...')
                    syncManager.downloadEssentialData()
                }
            })
        }

        // Refresh every 10 seconds
        const interval = setInterval(loadAllData, 10000)

        // Network listeners
        const handleOnline = () => {
            setIsOffline(false)
            syncManager.syncAll()
            loadAllData()
        }
        const handleOffline = () => setIsOffline(true)

        window.addEventListener('online', handleOnline)
        window.addEventListener('offline', handleOffline)

        return () => {
            clearInterval(interval)
            window.removeEventListener('online', handleOnline)
            window.removeEventListener('offline', handleOffline)
        }
    }, [])

    const loadAllData = async () => {
        try {
            // Always load from Dexie first (instant)
            const [dexieCategories, dexieItems, dexieTables, dexieWaiters] = await Promise.all([
                db.menu_categories.where('is_active').equals(1).sortBy('display_order'),
                db.menu_items.where('is_available').equals(1).sortBy('name'),
                db.restaurant_tables.toArray(),
                db.waiters.where('is_active').equals(1).toArray()
            ])

            setCategories(dexieCategories)
            setItems(dexieItems)
            setTables(dexieTables)
            setWaiters(dexieWaiters)
            setLoading(false)

            // Update from Supabase if online
            if (navigator.onLine) {
                setIsSyncing(true)

                const [
                    { data: onlineCategories },
                    { data: onlineItems },
                    { data: onlineTables },
                    { data: onlineWaiters }
                ] = await Promise.all([
                    supabase
                        .from('menu_categories')
                        .select('*')
                        .eq('is_active', true)
                        .order('display_order'),
                    supabase
                        .from('menu_items')
                        .select('*')
                        .eq('is_available', true)
                        .order('name'),
                    supabase
                        .from('restaurant_tables')
                        .select('*')
                        .order('table_number'),
                    supabase
                        .from('waiters')
                        .select('*')
                        .eq('is_active', true)
                        .order('name')
                ])

                // Save to Dexie
                if (onlineCategories && onlineCategories.length > 0) {
                    await db.menu_categories.bulkPut(onlineCategories)
                    setCategories(onlineCategories)
                }

                if (onlineItems && onlineItems.length > 0) {
                    await db.menu_items.bulkPut(onlineItems)
                    setItems(onlineItems)
                }

                if (onlineTables && onlineTables.length > 0) {
                    await db.restaurant_tables.bulkPut(onlineTables)
                    setTables(onlineTables)
                }

                if (onlineWaiters && onlineWaiters.length > 0) {
                    await db.waiters.bulkPut(onlineWaiters)
                    setWaiters(onlineWaiters)
                }

                setIsSyncing(false)
            }
        } catch (error) {
            console.error('Load error:', error)
            setLoading(false)
            setIsSyncing(false)
        }
    }

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

    const handleAddToCart = (item: MenuItem) => {
        if (!hydrated) return
        cart.addItem({
            id: item.id,
            name: item.name,
            price: item.price,
            image_url: item.image_url
        })
    }

    const getItemImage = (item: MenuItem) => {
        if (isOffline && item.compressed_image) {
            return item.compressed_image
        }
        return item.image_url
    }

    return (
        <>
            <div className="hidden lg:block">
                <AutoSidebar items={sidebarItems} title="Categories" />
            </div>

            {sidebarOpen && (
                <>
                    <div
                        className="fixed inset-0 bg-black/50 z-40 lg:hidden"
                        onClick={() => setSidebarOpen(false)}
                    />
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
                <header className="sticky top-0 z-40 bg-[var(--card)]/95 border-b border-[var(--border)] backdrop-blur-lg shadow-sm">
                    <div className="max-w-7xl mx-auto px-3 sm:px-6 py-2.5 sm:py-3.5">
                        <div className="flex items-center justify-between gap-2 sm:gap-3">
                            <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
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
                                        {isOffline && (
                                            <span className="flex items-center gap-1 px-1.5 py-0.5 sm:px-2 sm:py-1 bg-yellow-500/10 border border-yellow-500/30 rounded-full text-[10px] sm:text-xs font-medium text-yellow-600">
                                                <WifiOff className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                                                <span className="hidden xs:inline">Offline</span>
                                            </span>
                                        )}
                                        {isSyncing && (
                                            <span className="flex items-center gap-1 px-2 py-1 bg-blue-500/10 border border-blue-500/30 rounded-full text-xs font-medium text-blue-600">
                                                <div className="w-3 h-3 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                                                Syncing
                                            </span>
                                        )}
                                    </div>
                                    <p className="text-[10px] sm:text-sm text-[var(--muted)] mt-0.5">
                                        {filtered.length} items
                                    </p>
                                </div>
                            </div>

                            <div className="flex items-center gap-2">
                                <button
                                    onClick={loadAllData}
                                    className="p-2 hover:bg-[var(--bg)] rounded-lg active:scale-95 transition-all"
                                >
                                    <RefreshCw className={`w-4 h-4 sm:w-5 sm:h-5 text-[var(--muted)] ${loading ? 'animate-spin' : ''}`} />
                                </button>

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
                    </div>

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
                                        <span className="text-xs font-medium">{item.label}</span>
                                        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${
                                            item.active ? 'bg-white/20' : 'bg-[var(--card)] text-[var(--muted)]'
                                        }`}>
                                            {item.count}
                                        </span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                </header>

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
                                {isOffline ? 'Go online to load menu' : 'Try selecting a different category'}
                            </p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2.5 sm:gap-3">
                            {filtered.map(item => (
                                <div
                                    key={item.id}
                                    className="bg-[var(--card)] border border-[var(--border)] rounded-lg sm:rounded-xl overflow-hidden hover:shadow-xl hover:border-blue-600 transition-all group flex flex-col h-full"
                                >
                                    {getItemImage(item) && (
                                        <div className="relative w-full aspect-square overflow-hidden bg-[var(--bg)]">
                                            <img
                                                src={getItemImage(item)}
                                                alt={item.name}
                                                className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                                                loading="lazy"
                                            />
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