// src/components/cart/CartDrawer.tsx - CUSTOM QUANTITY INPUT
'use client'

import { useState, useEffect } from 'react'
import { useCart } from '@/lib/store/cart-store'
import { Plus, Minus, X, CheckCircle, Truck, Home, CreditCard, Banknote, ChevronDown, ChevronUp, AlertTriangle } from 'lucide-react'
import { useOrderManagement } from '@/lib/hooks'
import ReceiptModal from '@/components/features/receipt/ReceiptGenerator'
import { createClient } from '@/lib/supabase/client'

interface CartDrawerProps {
    isOpen: boolean
    onClose: () => void
    tables: Array<{ id: string; table_number: number; section: string; status: string }>
    waiters: Array<{ id: string; name: string }>
}

export default function CartDrawer({ isOpen, onClose, tables, waiters }: CartDrawerProps) {
    const cart = useCart()
    const { createOrder, loading } = useOrderManagement()
    const [showReceipt, setShowReceipt] = useState<any>(null)
    const [orderType, setOrderType] = useState<'dine-in' | 'delivery'>('dine-in')
    const [paymentMethod, setPaymentMethod] = useState<'cash' | 'online'>('cash')
    const [showDetails, setShowDetails] = useState(false)
    const [details, setDetails] = useState({ customer_name: '', customer_phone: '', delivery_address: '', delivery_charges: 0 })

    // Table occupancy detection
    const [tableWarning, setTableWarning] = useState<{ show: boolean; tableNumber: number; currentOrder?: any } | null>(null)
    const [confirmAddMore, setConfirmAddMore] = useState(false)

    // ✅ Track quantity editing state
    const [editingQuantity, setEditingQuantity] = useState<{ [key: string]: string }>({})

    // ✅ NEW: Custom tax percentage
    const [customTaxPercent, setCustomTaxPercent] = useState<string>('0')
    const [editingTax, setEditingTax] = useState(false)

    const supabase = createClient()

    useEffect(() => {
        if (cart.tableId && orderType === 'dine-in') {
            checkTableOccupancy(cart.tableId)
        }
    }, [cart.tableId, orderType])

    const checkTableOccupancy = async (tableId: string) => {
        const selectedTable = tables.find(t => t.id === tableId)
        if (!selectedTable) return

        if (selectedTable.status === 'occupied') {
            const { data: existingOrder } = await supabase
                .from('orders')
                .select('id, total_amount, order_items(quantity, menu_items(name))')
                .eq('table_id', tableId)
                .eq('status', 'pending')
                .single()

            if (existingOrder) {
                setTableWarning({
                    show: true,
                    tableNumber: selectedTable.table_number,
                    currentOrder: existingOrder
                })
                setConfirmAddMore(false)
            }
        } else {
            setTableWarning(null)
            setConfirmAddMore(false)
        }
    }

    const handleConfirmAddMore = () => {
        setConfirmAddMore(true)
        setTableWarning(null)
    }

    // ✅ Handle quantity input change (only allow numbers)
    const handleQuantityChange = (itemId: string, value: string) => {
        if (value === '' || /^\d+$/.test(value)) {
            setEditingQuantity({ ...editingQuantity, [itemId]: value })
        }
    }

    // ✅ Handle quantity input blur (apply changes)
    const handleQuantityBlur = (itemId: string) => {
        const value = editingQuantity[itemId]
        if (value && value !== '') {
            const num = parseInt(value)
            if (num > 0 && num <= 999) {
                cart.updateQuantity(itemId, num)
            } else if (num > 999) {
                cart.updateQuantity(itemId, 999)
            } else if (num <= 0) {
                cart.updateQuantity(itemId, 1)
            }
        }
        // Clear editing state
        const newState = { ...editingQuantity }
        delete newState[itemId]
        setEditingQuantity(newState)
    }

    // ✅ Handle Enter key in quantity input
    const handleQuantityKeyDown = (e: React.KeyboardEvent, itemId: string) => {
        if (e.key === 'Enter') {
            (e.target as HTMLInputElement).blur()
        }
    }

    // ✅ Handle focus - select all text for easy editing
    const handleQuantityFocus = (e: React.FocusEvent<HTMLInputElement>, itemId: string, currentQty: number) => {
        e.target.select()
        setEditingQuantity({ ...editingQuantity, [itemId]: currentQty.toString() })
    }

    // ✅ NEW: Handle tax input
    const handleTaxChange = (value: string) => {
        if (value === '' || /^\d*\.?\d*$/.test(value)) {
            const num = parseFloat(value)
            if (value === '' || (num >= 0 && num <= 100)) {
                setCustomTaxPercent(value)
            }
        }
    }

    const handleTaxBlur = () => {
        if (customTaxPercent === '') {
            setCustomTaxPercent('0')
        }
        setEditingTax(false)
    }

    const calculateTax = () => {
        const percent = parseFloat(customTaxPercent) || 0
        return (cart.subtotal() * percent) / 100
    }

    const placeOrder = async () => {
        if (cart.items.length === 0) return
        if (orderType === 'dine-in' && (!cart.tableId || !cart.waiterId)) return
        if (orderType === 'delivery' && !paymentMethod) return

        if (orderType === 'dine-in' && tableWarning?.show && !confirmAddMore) {
            return
        }

        const subtotal = cart.subtotal()
        const tax = calculateTax()
        const deliveryFee = orderType === 'delivery' ? details.delivery_charges : 0
        const total = subtotal + tax + deliveryFee

        const orderData: any = {
            waiter_id: cart.waiterId || null,
            status: 'pending',
            subtotal,
            tax,
            total_amount: total,
            notes: cart.notes || null,
            order_type: orderType,
            payment_method: orderType === 'delivery' ? paymentMethod : null,
            receipt_printed: false
        }

        if (orderType === 'dine-in') {
            orderData.table_id = cart.tableId || null
        } else {
            orderData.customer_name = details.customer_name || null
            orderData.customer_phone = details.customer_phone || null
            orderData.delivery_address = details.delivery_address || null
            orderData.delivery_charges = details.delivery_charges || 0
        }

        const result = await createOrder(orderData, cart.items)

        if (result.success && result.order) {
            const waiter = waiters.find(w => w.id === cart.waiterId)
            const table = tables.find(t => t.id === cart.tableId)

            setShowReceipt({
                ...result.order,
                restaurant_tables: orderType === 'dine-in' ? { table_number: table?.table_number || 0 } : null,
                customer_name: orderType === 'delivery' ? details.customer_name : null,
                customer_phone: orderType === 'delivery' ? details.customer_phone : null,
                waiters: { name: waiter?.name || 'N/A' },
                order_items: cart.items.map(i => ({
                    menu_items: { name: i.name, price: i.price },
                    quantity: i.quantity,
                    total_price: i.price * i.quantity
                }))
            })

            cart.clearCart()
            setDetails({ customer_name: '', customer_phone: '', delivery_address: '', delivery_charges: 0 })
            setConfirmAddMore(false)
            setTableWarning(null)
            setEditingQuantity({})
            setCustomTaxPercent('5')
            setEditingTax(false)
        }
    }

    if (!isOpen) return null

    return (
        <>
            <div className="fixed inset-0 bg-black/60 z-50 backdrop-blur-sm" onClick={onClose} />
            <div className="fixed right-0 top-0 h-full w-full sm:max-w-md bg-[var(--card)] border-l border-[var(--border)] z-50 flex flex-col shadow-2xl">

                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-[var(--border)] bg-[var(--card)]">
                    <h2 className="text-xl font-bold text-[var(--fg)]">Your Order</h2>
                    <button onClick={onClose} className="p-2 hover:bg-[var(--bg)] rounded-lg transition-colors">
                        <X className="w-5 h-5 text-[var(--muted)]" />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-[var(--card)]">
                    {/* Order Type */}
                    <div className="grid grid-cols-2 gap-2">
                        <button
                            onClick={() => {
                                setOrderType('dine-in')
                                setShowDetails(false)
                            }}
                            className={`p-3 rounded-lg border-2 flex flex-col items-center gap-2 transition-all ${
                                orderType === 'dine-in'
                                    ? 'border-blue-600 bg-blue-600/20'
                                    : 'border-[var(--border)] bg-[var(--bg)]'
                            }`}
                        >
                            <Home className={`w-6 h-6 ${orderType === 'dine-in' ? 'text-blue-600' : 'text-[var(--fg)]'}`} />
                            <span className={`text-sm font-medium ${orderType === 'dine-in' ? 'text-blue-600' : 'text-[var(--fg)]'}`}>
                                Dine-In
                            </span>
                        </button>
                        <button
                            onClick={() => setOrderType('delivery')}
                            className={`p-3 rounded-lg border-2 flex flex-col items-center gap-2 transition-all ${
                                orderType === 'delivery'
                                    ? 'border-blue-600 bg-blue-600/20'
                                    : 'border-[var(--border)] bg-[var(--bg)]'
                            }`}
                        >
                            <Truck className={`w-6 h-6 ${orderType === 'delivery' ? 'text-blue-600' : 'text-[var(--fg)]'}`} />
                            <span className={`text-sm font-medium ${orderType === 'delivery' ? 'text-blue-600' : 'text-[var(--fg)]'}`}>
                                Delivery
                            </span>
                        </button>
                    </div>

                    {/* Payment Method - Only for Delivery */}
                    {orderType === 'delivery' && (
                        <div className="space-y-2">
                            <label className="block text-sm font-medium text-[var(--fg)]">
                                Payment Method <span className="text-red-600">*</span>
                            </label>
                            <div className="grid grid-cols-2 gap-2">
                                <button
                                    onClick={() => setPaymentMethod('cash')}
                                    className={`p-3 rounded-lg border-2 flex flex-col items-center gap-2 transition-all ${
                                        paymentMethod === 'cash'
                                            ? 'border-green-600 bg-green-600/20'
                                            : 'border-[var(--border)] bg-[var(--bg)]'
                                    }`}
                                >
                                    <Banknote className={`w-6 h-6 ${paymentMethod === 'cash' ? 'text-green-600' : 'text-[var(--fg)]'}`} />
                                    <span className={`text-sm font-medium ${paymentMethod === 'cash' ? 'text-green-600' : 'text-[var(--fg)]'}`}>
                                        Cash
                                    </span>
                                </button>
                                <button
                                    onClick={() => setPaymentMethod('online')}
                                    className={`p-3 rounded-lg border-2 flex flex-col items-center gap-2 transition-all ${
                                        paymentMethod === 'online'
                                            ? 'border-green-600 bg-green-600/20'
                                            : 'border-[var(--border)] bg-[var(--bg)]'
                                    }`}
                                >
                                    <CreditCard className={`w-6 h-6 ${paymentMethod === 'online' ? 'text-green-600' : 'text-[var(--fg)]'}`} />
                                    <span className={`text-sm font-medium ${paymentMethod === 'online' ? 'text-green-600' : 'text-[var(--fg)]'}`}>
                                        Online
                                    </span>
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Dine-In Fields */}
                    {orderType === 'dine-in' && (
                        <div className="space-y-3">
                            <div>
                                <label className="block text-sm font-medium text-[var(--fg)] mb-2">
                                    Select Table <span className="text-red-600">*</span>
                                </label>
                                <select
                                    value={cart.tableId}
                                    onChange={e => cart.setTable(e.target.value)}
                                    className="w-full px-3 py-2 bg-[var(--bg)] border border-[var(--border)] rounded-lg text-sm text-[var(--fg)] focus:ring-2 focus:ring-blue-600 focus:outline-none"
                                >
                                    <option value="">Select table</option>
                                    {tables.filter(t => t.status === 'available' || t.status === 'occupied').map(t => (
                                        <option key={t.id} value={t.id}>
                                            Table {t.table_number} - {t.section} {t.status === 'occupied' ? '(Occupied ⚠️)' : ''}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {/* TABLE OCCUPANCY WARNING */}
                            {tableWarning?.show && (
                                <div className="p-4 bg-yellow-500/10 border-2 border-yellow-600 rounded-lg">
                                    <div className="flex items-start gap-3">
                                        <AlertTriangle className="w-6 h-6 text-yellow-600 flex-shrink-0 mt-0.5" />
                                        <div className="flex-1">
                                            <h4 className="font-bold text-[var(--fg)] mb-2">⚠️ Table {tableWarning.tableNumber} is Occupied!</h4>
                                            <p className="text-sm text-[var(--muted)] mb-3">
                                                Current order: PKR {tableWarning.currentOrder?.total_amount.toLocaleString()}
                                            </p>
                                            <div className="bg-[var(--bg)] rounded-lg p-3 mb-3 max-h-32 overflow-y-auto">
                                                <p className="text-xs font-semibold text-[var(--fg)] mb-2">Existing Items:</p>
                                                {tableWarning.currentOrder?.order_items?.slice(0, 5).map((item: any, idx: number) => (
                                                    <p key={idx} className="text-xs text-[var(--muted)]">
                                                        • {item.quantity}x {item.menu_items.name}
                                                    </p>
                                                ))}
                                            </div>
                                            <p className="text-sm font-semibold text-yellow-600 mb-3">
                                                Do you want to add {cart.items.length} more items to this table?
                                            </p>
                                            <div className="flex gap-2">
                                                <button
                                                    onClick={() => { setTableWarning(null); cart.setTable('') }}
                                                    className="flex-1 px-4 py-2 bg-[var(--bg)] border border-[var(--border)] rounded-lg text-sm font-medium hover:bg-[var(--card)]"
                                                >
                                                    Cancel
                                                </button>
                                                <button
                                                    onClick={handleConfirmAddMore}
                                                    className="flex-1 px-4 py-2 bg-yellow-600 text-white rounded-lg text-sm font-medium hover:bg-yellow-700"
                                                >
                                                    Yes, Add More
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            <div>
                                <label className="block text-sm font-medium text-[var(--fg)] mb-2">
                                    Select Waiter <span className="text-red-600">*</span>
                                </label>
                                <select
                                    value={cart.waiterId}
                                    onChange={e => cart.setWaiter(e.target.value)}
                                    className="w-full px-3 py-2 bg-[var(--bg)] border border-[var(--border)] rounded-lg text-sm text-[var(--fg)] focus:ring-2 focus:ring-blue-600 focus:outline-none"
                                >
                                    <option value="">Select waiter</option>
                                    {waiters.map(w => (
                                        <option key={w.id} value={w.id}>
                                            {w.name}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    )}

                    {/* Delivery Details */}
                    {orderType === 'delivery' && (
                        <>
                            <button
                                onClick={() => setShowDetails(!showDetails)}
                                className="w-full flex items-center justify-between px-4 py-3 bg-[var(--bg)] border border-[var(--border)] rounded-lg hover:border-blue-600 transition-colors"
                            >
                                <span className="text-sm font-medium text-[var(--fg)]">
                                    Delivery Details (Optional)
                                </span>
                                {showDetails ? (
                                    <ChevronUp className="w-5 h-5 text-[var(--fg)]" />
                                ) : (
                                    <ChevronDown className="w-5 h-5 text-[var(--fg)]" />
                                )}
                            </button>
                            {showDetails && (
                                <div className="space-y-3 p-4 bg-[var(--bg)] rounded-lg border border-[var(--border)]">
                                    <input
                                        type="text"
                                        value={details.customer_name}
                                        onChange={e => setDetails({ ...details, customer_name: e.target.value })}
                                        placeholder="Customer name"
                                        className="w-full px-3 py-2 bg-[var(--card)] border border-[var(--border)] rounded-lg text-sm text-[var(--fg)] placeholder:text-[var(--muted)] focus:ring-2 focus:ring-blue-600 focus:outline-none"
                                    />
                                    <input
                                        type="tel"
                                        value={details.customer_phone}
                                        onChange={e => setDetails({ ...details, customer_phone: e.target.value })}
                                        placeholder="Phone number"
                                        className="w-full px-3 py-2 bg-[var(--card)] border border-[var(--border)] rounded-lg text-sm text-[var(--fg)] placeholder:text-[var(--muted)] focus:ring-2 focus:ring-blue-600 focus:outline-none"
                                    />
                                    <textarea
                                        value={details.delivery_address}
                                        onChange={e => setDetails({ ...details, delivery_address: e.target.value })}
                                        placeholder="Delivery address"
                                        rows={2}
                                        className="w-full px-3 py-2 bg-[var(--card)] border border-[var(--border)] rounded-lg text-sm text-[var(--fg)] placeholder:text-[var(--muted)] focus:ring-2 focus:ring-blue-600 focus:outline-none resize-none"
                                    />
                                    <input
                                        type="number"
                                        value={details.delivery_charges}
                                        onChange={e => setDetails({ ...details, delivery_charges: Number(e.target.value) || 0 })}
                                        placeholder="Delivery charges (PKR)"
                                        className="w-full px-3 py-2 bg-[var(--card)] border border-[var(--border)] rounded-lg text-sm text-[var(--fg)] placeholder:text-[var(--muted)] focus:ring-2 focus:ring-blue-600 focus:outline-none"
                                    />
                                </div>
                            )}
                        </>
                    )}

                    {/* ✅ Cart Items with EDITABLE QUANTITY */}
                    {cart.items.length > 0 && (
                        <div className="space-y-2">
                            <h3 className="text-sm font-semibold text-[var(--fg)] px-1">Order Items</h3>
                            {cart.items.map(item => (
                                <div key={item.id} className="p-3 bg-[var(--bg)] border border-[var(--border)] rounded-lg hover:border-blue-400 transition-colors">
                                    <div className="flex justify-between items-start mb-3">
                                        <div className="flex-1 min-w-0 pr-2">
                                            <h4 className="font-semibold text-sm text-[var(--fg)] truncate">{item.name}</h4>
                                            <p className="text-xs text-[var(--muted)] mt-0.5">PKR {item.price} each</p>
                                        </div>
                                        <span className="font-bold text-blue-600 text-sm whitespace-nowrap">
                                            PKR {(item.price * item.quantity).toLocaleString()}
                                        </span>
                                    </div>

                                    {/* ✅ QUANTITY CONTROLS - NO HOVER */}
                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={() => cart.updateQuantity(item.id, item.quantity - 1)}
                                            disabled={item.quantity <= 1}
                                            className="p-1.5 bg-red-600 text-white border-2 border-red-600 rounded-lg transition-all active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed disabled:bg-[var(--bg)] disabled:text-[var(--muted)] disabled:border-[var(--border)]"
                                            title="Decrease quantity"
                                        >
                                            <Minus className="w-4 h-4" />
                                        </button>

                                        {/* ✅ CUSTOM QUANTITY INPUT */}
                                        <div className="relative flex-shrink-0">
                                            <input
                                                type="text"
                                                inputMode="numeric"
                                                value={editingQuantity[item.id] !== undefined ? editingQuantity[item.id] : item.quantity}
                                                onChange={(e) => handleQuantityChange(item.id, e.target.value)}
                                                onFocus={(e) => handleQuantityFocus(e, item.id, item.quantity)}
                                                onBlur={() => handleQuantityBlur(item.id)}
                                                onKeyDown={(e) => handleQuantityKeyDown(e, item.id)}
                                                placeholder="Qty"
                                                className="w-20 px-3 py-2 text-center font-bold text-sm text-[var(--fg)] bg-[var(--card)] border-2 border-[var(--border)] rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:outline-none transition-all cursor-text"
                                                maxLength={3}
                                                title="Click to edit quantity (1-999)"
                                            />
                                            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] pointer-events-none text-[var(--muted)]">
                                                ✏️
                                            </span>
                                        </div>

                                        <button
                                            onClick={() => cart.updateQuantity(item.id, item.quantity + 1)}
                                            disabled={item.quantity >= 999}
                                            className="p-1.5 bg-green-600 text-white border-2 border-green-600 rounded-lg transition-all active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed disabled:bg-[var(--bg)] disabled:text-[var(--muted)] disabled:border-[var(--border)]"
                                            title="Increase quantity"
                                        >
                                            <Plus className="w-4 h-4" />
                                        </button>

                                        <button
                                            onClick={() => cart.removeItem(item.id)}
                                            className="ml-auto px-3 py-1.5 text-xs bg-red-600 text-white font-medium border border-red-600 rounded-lg transition-all active:scale-95"
                                            title="Remove item"
                                        >
                                            Remove
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Empty Cart */}
                    {cart.items.length === 0 && (
                        <div className="flex flex-col items-center justify-center py-12">
                            <div className="text-6xl mb-4">🛒</div>
                            <p className="text-[var(--fg)] font-medium mb-1">Your cart is empty</p>
                            <p className="text-[var(--muted)] text-sm">Add items from the menu</p>
                        </div>
                    )}
                </div>

                {/* Footer */}
                {cart.items.length > 0 && (
                    <div className="border-t border-[var(--border)] p-4 bg-[var(--card)]">
                        <div className="space-y-2 mb-4">
                            <div className="flex justify-between text-sm">
                                <span className="text-[var(--muted)]">Subtotal</span>
                                <span className="font-medium text-[var(--fg)]">PKR {cart.subtotal().toFixed(2)}</span>
                            </div>

                            {/* ✅ CUSTOM TAX INPUT */}
                            <div className="flex justify-between items-center text-sm">
                                <span className="text-[var(--muted)]">Tax</span>
                                <div className="flex items-center gap-2">
                                    <div className="relative">
                                        <input
                                            type="text"
                                            inputMode="decimal"
                                            value={customTaxPercent}
                                            onChange={(e) => handleTaxChange(e.target.value)}
                                            onFocus={(e) => {
                                                e.target.select()
                                                setEditingTax(true)
                                            }}
                                            onBlur={handleTaxBlur}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter') {
                                                    (e.target as HTMLInputElement).blur()
                                                }
                                            }}
                                            className="w-14 px-2 py-1 text-center text-xs font-bold text-[var(--fg)] bg-[var(--bg)] border-2 border-[var(--border)] rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:outline-none transition-all cursor-text hover:border-blue-400"
                                            maxLength={5}
                                            title="Click to edit tax percentage (0-100%)"
                                        />
                                        <span className="absolute -right-1 top-1/2 -translate-y-1/2 text-[10px] font-bold text-[var(--muted)] pointer-events-none">
                                            %
                                        </span>
                                    </div>
                                    <span className="font-medium text-[var(--fg)] min-w-[80px] text-right">
                                        PKR {calculateTax().toFixed(2)}
                                    </span>
                                </div>
                            </div>

                            {orderType === 'delivery' && details.delivery_charges > 0 && (
                                <div className="flex justify-between text-sm">
                                    <span className="text-[var(--muted)]">Delivery</span>
                                    <span className="font-medium text-[var(--fg)]">PKR {details.delivery_charges}</span>
                                </div>
                            )}
                            <div className="flex justify-between text-lg font-bold pt-2 border-t border-[var(--border)]">
                                <span className="text-[var(--fg)]">Total</span>
                                <span className="text-blue-600">
                                    PKR {(cart.subtotal() + calculateTax() + (orderType === 'delivery' ? details.delivery_charges : 0)).toFixed(2)}
                                </span>
                            </div>
                        </div>
                        <button
                            onClick={placeOrder}
                            disabled={loading || (orderType === 'dine-in' && (!cart.tableId || !cart.waiterId || (tableWarning?.show && !confirmAddMore)))}
                            className="w-full py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed active:scale-95"
                        >
                            {loading ? (
                                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            ) : (
                                <CheckCircle className="w-5 h-5" />
                            )}
                            {loading ? 'Placing...' : 'Place Order'}
                        </button>

                        {orderType === 'dine-in' && (
                            <p className="text-xs text-center text-[var(--muted)] mt-2">
                                💡 Payment method will be selected when completing the order
                            </p>
                        )}
                    </div>
                )}
            </div>

            {showReceipt && <ReceiptModal order={showReceipt} onClose={() => { setShowReceipt(null); onClose() }} />}
        </>
    )
}