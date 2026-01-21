'use client'
export const dynamic = 'force-dynamic'

import { useState, useMemo, useEffect } from 'react'
import { ShoppingCart, Plus, WifiOff, Menu, Minus, X } from 'lucide-react'
import AutoSidebar, { useSidebarItems } from '@/components/layout/AutoSidebar'
import CartDrawer from '@/components/cart/CartDrawer'
import { useCart } from '@/lib/store/cart-store'
import { useHydration } from '@/lib/hooks/useHydration'
import { useOfflineFirst } from '@/lib/hooks/useOfflineFirst'
import { offlineManager } from '@/lib/db/offlineManager'
import { createClient } from '@/lib/supabase/client' // ✅ ADD THIS LINE

export default function MenuPage() {
    const { data: categories, loading: catLoading } = useOfflineFirst({
        store: 'menu_categories',
        table: 'menu_categories',
        filter: { is_active: true },
        order: { column: 'display_order' }
    })

    const { data: items, loading: itemsLoading, isOffline, refresh } = useOfflineFirst({
        store: 'menu_items',
        table: 'menu_items',
        filter: { is_available: true },
        order: { column: 'name' }
    })

    const { data: tables } = useOfflineFirst({
        store: 'restaurant_tables',
        table: 'restaurant_tables'
    })

    const { data: waiters } = useOfflineFirst({
        store: 'waiters',
        table: 'waiters',
        filter: { is_active: true }
    })

    const loading = catLoading || itemsLoading

    const cart = useCart()
    const hydrated = useHydration()
    const [selectedCat, setSelectedCat] = useState('all')
    const [cartOpen, setCartOpen] = useState(false)
    const [sidebarOpen, setSidebarOpen] = useState(false)
    const [isMounted, setIsMounted] = useState(false)

    // ✅ Quantity modal state
    const [quantityModal, setQuantityModal] = useState<{
        show: boolean
        item: any
        currentQty: number
        inputValue: string
    } | null>(null)

    useEffect(() => {
        setIsMounted(true)
        if (typeof window !== 'undefined' && navigator.onLine) {
            offlineManager.downloadAllData()
        }
    }, [])

    // ✅ NEW: Listen for order completion
    useEffect(() => {
        const handleOrderPlaced = () => {
            console.log('🔄 Order placed, refreshing menu...')
            // Just refresh the menu items, no page reload
            if (refresh) {
                setTimeout(() => refresh(), 500)
            }
        }

        window.addEventListener('order-placed', handleOrderPlaced)
        return () => window.removeEventListener('order-placed', handleOrderPlaced)
    }, [refresh])

    // ✅ FIXED: Auto-reload when all stock items are finished
    useEffect(() => {
        if (loading || isOffline || items.length === 0) return

        // Check if ALL items with limited stock are now out of stock
        const itemsWithStock = items.filter(i => (i.stock_quantity ?? 999) !== 999)
        const allStockItemsFinished = itemsWithStock.length > 0 &&
            itemsWithStock.every(i => (i.stock_quantity ?? 0) === 0)

        if (allStockItemsFinished) {
            console.log('🔄 All stock items finished, reloading in 3 seconds...')
            const timer = setTimeout(() => {
                window.location.reload()
            }, 3000)
            return () => clearTimeout(timer)
        }
    }, [items, loading, isOffline])

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

    // ✅ Get current quantity in cart
    const getCartQuantity = (itemId: string) => {
        const cartItem = cart.items.find(i => i.id === itemId)
        return cartItem?.quantity || 0
    }

    // ✅ Check if item is out of stock
    const isOutOfStock = (item: any) => {
        const stock = item.stock_quantity ?? 999
        return stock === 0
    }

    // ✅ Check if can add more to cart
    const canAddMore = (item: any) => {
        const stock = item.stock_quantity ?? 999
        const inCart = getCartQuantity(item.id)
        return stock === 999 || inCart < stock
    }

    // ✅ Handle add to cart with stock validation
    const handleAddToCart = (item: any) => {
        if (!hydrated) return
        if (isOutOfStock(item)) return
        if (!canAddMore(item)) return

        cart.addItem({
            id: item.id,
            name: item.name,
            price: item.price,
            image_url: item.image_url,
            stock_quantity: item.stock_quantity ?? 999
        })
    }

    // ✅ Open quantity modal
    const openQuantityModal = (item: any) => {
        const currentQty = getCartQuantity(item.id)
        setQuantityModal({
            show: true,
            item,
            currentQty,
            inputValue: currentQty > 0 ? currentQty.toString() : '1'
        })
    }

    // ✅ Handle quantity change in modal
    const handleQuantityChange = (value: string) => {
        if (value === '' || /^\d+$/.test(value)) {
            const num = parseInt(value) || 0
            const maxStock = quantityModal?.item?.stock_quantity ?? 999

            if (num <= maxStock || maxStock === 999) {
                setQuantityModal(prev => prev ? { ...prev, inputValue: value } : null)
            }
        }
    }

    // ✅ Save quantity from modal
    const saveQuantity = () => {
        if (!quantityModal || !hydrated) return

        const qty = parseInt(quantityModal.inputValue) || 0
        const item = quantityModal.item
        const maxStock = item.stock_quantity ?? 999

        if (qty <= 0) {
            cart.removeItem(item.id)
        } else if (qty <= maxStock || maxStock === 999) {
            // Remove first, then add with new quantity
            cart.removeItem(item.id)
            for (let i = 0; i < qty; i++) {
                cart.addItem({
                    id: item.id,
                    name: item.name,
                    price: item.price,
                    image_url: item.image_url,
                    stock_quantity: item.stock_quantity ?? 999
                })
            }
        }

        setQuantityModal(null)
    }

    return (
        <>
            {/* Desktop Sidebar */}
            <div className="hidden lg:block">
                <AutoSidebar items={sidebarItems} title="Categories" />
            </div>

            {/* Mobile Sidebar */}
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
                {/* Fixed Header */}
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

                    {/* Horizontal Categories - Mobile */}
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
                            {filtered.map(item => {
                                const cartQty = getCartQuantity(item.id)
                                const outOfStock = isOutOfStock(item)
                                const stock = item.stock_quantity ?? 999
                                const remaining = stock === 999 ? 999 : stock - cartQty

                                return (
                                    <div
                                        key={item.id}
                                        className={`bg-[var(--card)] border border-[var(--border)] rounded-lg sm:rounded-xl overflow-hidden hover:shadow-xl hover:border-blue-600 transition-all group flex flex-col h-full ${
                                            outOfStock ? 'opacity-60' : ''
                                        }`}
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

                                                {/* Stock badge */}
                                                {stock !== 999 && (
                                                    <div className="absolute top-2 right-2">
                                                        <div className={`px-2 py-1 rounded-full text-xs font-bold text-white shadow-lg ${
                                                            outOfStock ? 'bg-red-600' :
                                                                remaining <= 5 ? 'bg-orange-600' : 'bg-green-600'
                                                        }`}>
                                                            {outOfStock ? 'Out' : `${remaining} left`}
                                                        </div>
                                                    </div>
                                                )}
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

                                            <div className="flex items-center justify-between pt-2 mt-auto gap-1">
                                                <span className="text-[10px] sm:text-sm font-bold text-blue-600 shrink-0">
                                                    PKR {item.price}
                                                </span>

                                                {/* Quantity badge + Add button */}
                                                <div className="flex items-center gap-0.5 sm:gap-1">
                                                    {cartQty > 0 && (
                                                        <button
                                                            onClick={() => openQuantityModal(item)}
                                                            className="px-1 py-0.5 sm:px-1.5 sm:py-1 text-[9px] sm:text-xs bg-blue-600 text-white rounded hover:bg-blue-700 active:scale-95 transition-all font-bold min-w-[20px] sm:min-w-[26px] h-[20px] sm:h-auto flex items-center justify-center"
                                                        >
                                                            {cartQty}
                                                        </button>
                                                    )}
                                                    <button
                                                        onClick={() => handleAddToCart(item)}
                                                        disabled={!hydrated || outOfStock || !canAddMore(item)}
                                                        className="px-1.5 py-0.5 sm:px-2.5 sm:py-1.5 text-[9px] sm:text-xs bg-blue-600 text-white rounded hover:bg-blue-700 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-0.5 shrink-0 h-[20px] sm:h-auto"
                                                    >
                                                        <Plus className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                                                        <span className="hidden xs:inline">
                                                            {outOfStock ? 'Out' : !canAddMore(item) ? 'Max' : 'Add'}
                                                        </span>
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    )}
                </div>
            </div>

            {/* ✅ FIXED: Quantity Modal - Fully Responsive */}
            {quantityModal?.show && (
                <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
                    <div className="bg-[var(--card)] rounded-xl w-full max-w-sm border border-[var(--border)] shadow-2xl">
                        <div className="p-4 border-b border-[var(--border)] flex items-center justify-between">
                            <h3 className="text-base sm:text-lg font-bold text-[var(--fg)]">Set Quantity</h3>
                            <button
                                onClick={() => setQuantityModal(null)}
                                className="p-2 hover:bg-[var(--bg)] rounded-lg transition-colors"
                            >
                                <X className="w-5 h-5 text-[var(--muted)]" />
                            </button>
                        </div>

                        <div className="p-4 sm:p-6">
                            <p className="text-sm text-[var(--fg)] mb-2 font-medium">
                                {quantityModal.item.name}
                            </p>
                            <p className="text-xs text-[var(--muted)] mb-4">
                                {quantityModal.item.stock_quantity === 999
                                    ? 'Unlimited stock available'
                                    : `${quantityModal.item.stock_quantity} available`}
                            </p>

                            {/* ✅ FIXED: Fully Responsive Layout */}
                            <div className="flex items-stretch gap-2 sm:gap-3 mb-6">
                                <button
                                    onClick={() => {
                                        const current = parseInt(quantityModal.inputValue) || 0
                                        if (current > 1) {
                                            handleQuantityChange((current - 1).toString())
                                        }
                                    }}
                                    className="shrink-0 w-12 h-12 sm:w-14 sm:h-14 bg-red-600 text-white rounded-lg hover:bg-red-700 active:scale-95 transition-all flex items-center justify-center"
                                >
                                    <Minus className="w-5 h-5 sm:w-6 sm:h-6" />
                                </button>

                                <input
                                    type="text"
                                    inputMode="numeric"
                                    value={quantityModal.inputValue}
                                    onChange={(e) => handleQuantityChange(e.target.value)}
                                    onFocus={(e) => e.target.select()}
                                    className="flex-1 min-w-0 px-3 sm:px-4 py-2 sm:py-3 text-center text-xl sm:text-2xl font-bold text-[var(--fg)] bg-[var(--bg)] border-2 border-[var(--border)] rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:outline-none"
                                    maxLength={3}
                                />

                                <button
                                    onClick={() => {
                                        const current = parseInt(quantityModal.inputValue) || 0
                                        const max = quantityModal.item.stock_quantity ?? 999
                                        if (max === 999 || current < max) {
                                            handleQuantityChange((current + 1).toString())
                                        }
                                    }}
                                    disabled={
                                        quantityModal.item.stock_quantity !== 999 &&
                                        parseInt(quantityModal.inputValue) >= quantityModal.item.stock_quantity
                                    }
                                    className="shrink-0 w-12 h-12 sm:w-14 sm:h-14 bg-green-600 text-white rounded-lg hover:bg-green-700 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                                >
                                    <Plus className="w-5 h-5 sm:w-6 sm:h-6" />
                                </button>
                            </div>

                            <div className="flex gap-3">
                                <button
                                    onClick={() => setQuantityModal(null)}
                                    className="flex-1 px-4 py-2.5 border border-[var(--border)] text-[var(--fg)] rounded-lg hover:bg-[var(--bg)] transition-colors font-medium text-sm"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={saveQuantity}
                                    className="flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium text-sm"
                                >
                                    Save
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <CartDrawer
                isOpen={cartOpen}
                onClose={() => setCartOpen(false)}
                tables={tables}
                waiters={waiters}
            />
        </>
    )
}