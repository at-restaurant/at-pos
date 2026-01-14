// src/components/cart/CartDrawer.tsx - PRINT IMMEDIATELY FOR DINE-IN
'use client'

import { useState, useEffect } from 'react'
import { useCart } from '@/lib/store/cart-store'
import { Plus, Minus, X, CheckCircle, Truck, Home, CreditCard, Banknote, ChevronDown, ChevronUp, AlertTriangle } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { productionPrinter } from '@/lib/print/ProductionPrinter'
import { db, dbHelpers } from '@/lib/db/dexie'
import type { ReceiptData } from '@/types'

interface CartDrawerProps {
    isOpen: boolean
    onClose: () => void
    tables: Array<{ id: string; table_number: number; section: string; status: string; current_order_id?: string }>
    waiters: Array<{ id: string; name: string }>
}

export default function CartDrawer({ isOpen, onClose, tables, waiters }: CartDrawerProps) {
    const cart = useCart()
    const [loading, setLoading] = useState(false)
    const [orderType, setOrderType] = useState<'dine-in' | 'delivery'>('dine-in')
    const [paymentMethod, setPaymentMethod] = useState<'cash' | 'online'>('cash')
    const [showDetails, setShowDetails] = useState(false)
    const [details, setDetails] = useState({ customer_name: '', customer_phone: '', delivery_address: '', delivery_charges: 0 })
    const [tableWarning, setTableWarning] = useState<{ show: boolean; tableNumber: number; existingOrderId: string; currentTotal: number } | null>(null)
    const [customTaxPercent, setCustomTaxPercent] = useState<string>('0')
    const [menuCategories, setMenuCategories] = useState<{ [key: string]: { name: string; icon: string } }>({})

    const supabase = createClient()

    useEffect(() => {
        loadMenuCategories()
    }, [])

    const loadMenuCategories = async () => {
        const { data } = await supabase.from('menu_items').select('id, menu_categories(name, icon)')
        if (data) {
            const categoryMap: { [key: string]: { name: string; icon: string } } = {}
            data.forEach((item: any) => {
                if (item.menu_categories) {
                    categoryMap[item.id] = { name: item.menu_categories.name, icon: item.menu_categories.icon || '📋' }
                }
            })
            setMenuCategories(categoryMap)
        }
    }

    useEffect(() => {
        if (cart.tableId && orderType === 'dine-in') {
            checkTableOccupancy(cart.tableId)
        }
    }, [cart.tableId, orderType])

    const checkTableOccupancy = async (tableId: string) => {
        const selectedTable = tables.find(t => t.id === tableId)
        if (!selectedTable) return

        if (selectedTable.status === 'occupied' && selectedTable.current_order_id) {
            const { data: existingOrder } = await supabase
                .from('orders')
                .select('id, total_amount')
                .eq('id', selectedTable.current_order_id)
                .eq('status', 'pending')
                .single()

            if (existingOrder) {
                setTableWarning({
                    show: true,
                    tableNumber: selectedTable.table_number,
                    existingOrderId: existingOrder.id,
                    currentTotal: existingOrder.total_amount
                })
            }
        } else {
            setTableWarning(null)
        }
    }

    const calculateTax = () => {
        const percent = parseFloat(customTaxPercent) || 0
        return (cart.subtotal() * percent) / 100
    }

    const generateUUID = () => 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = Math.random() * 16 | 0
        const v = c === 'x' ? r : (r & 0x3 | 0x8)
        return v.toString(16)
    })

    // ✅ PRINT BILL IMMEDIATELY FOR DINE-IN
    const placeOrder = async () => {
        if (cart.items.length === 0) return
        if (orderType === 'dine-in' && (!cart.tableId || !cart.waiterId)) return
        if (orderType === 'delivery' && !paymentMethod) return

        setLoading(true)

        try {
            const subtotal = cart.subtotal()
            const tax = calculateTax()
            const deliveryFee = orderType === 'delivery' ? details.delivery_charges : 0
            const total = subtotal + tax + deliveryFee
            const now = new Date().toISOString()

            // ✅ CHECK: Merge or create new
            if (orderType === 'dine-in' && tableWarning?.existingOrderId) {
                await mergeWithExistingOrder(tableWarning.existingOrderId, subtotal, tax, total, now)
            } else {
                const orderId = await createNewOrder(subtotal, tax, total, deliveryFee, now)

                // ✅ PRINT IMMEDIATELY FOR DINE-IN
                if (orderType === 'dine-in' && orderId) {
                    await printReceipt(orderId, subtotal, tax, total, now)
                }
            }

            // Clear cart
            cart.clearCart()
            setDetails({ customer_name: '', customer_phone: '', delivery_address: '', delivery_charges: 0 })
            setTableWarning(null)
            setCustomTaxPercent('0')
            onClose()
        } catch (error: any) {
            console.error('Place order error:', error)
            alert(`❌ Failed: ${error.message}`)
        } finally {
            setLoading(false)
        }
    }

    // ✅ MERGE WITH EXISTING ORDER + PRINT
    const mergeWithExistingOrder = async (existingOrderId: string, newSubtotal: number, newTax: number, newTotal: number, now: string) => {
        const existingOrder = await db.orders.get(existingOrderId)
        if (!existingOrder) throw new Error('Existing order not found')

        const mergedSubtotal = existingOrder.subtotal + newSubtotal
        const mergedTax = existingOrder.tax + newTax
        const mergedTotal = existingOrder.total_amount + newTotal

        await db.orders.update(existingOrderId, {
            subtotal: mergedSubtotal,
            tax: mergedTax,
            total_amount: mergedTotal,
            updated_at: now
        })

        for (const item of cart.items) {
            const orderItemId = `item_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
            await db.order_items.add({
                id: orderItemId,
                order_id: existingOrderId,
                menu_item_id: item.id,
                quantity: item.quantity,
                unit_price: item.price,
                total_price: item.price * item.quantity,
                created_at: now
            })
        }

        if (navigator.onLine) {
            await supabase.from('orders').update({
                subtotal: mergedSubtotal,
                tax: mergedTax,
                total_amount: mergedTotal,
                updated_at: now
            }).eq('id', existingOrderId)

            const itemsToInsert = cart.items.map(item => ({
                order_id: existingOrderId,
                menu_item_id: item.id,
                quantity: item.quantity,
                unit_price: item.price,
                total_price: item.price * item.quantity
            }))
            await supabase.from('order_items').insert(itemsToInsert)
        }

        // ✅ PRINT MERGED BILL
        await printReceipt(existingOrderId, newSubtotal, newTax, newTotal, now, true)
        alert(`✅ Added ${cart.items.length} items & printed bill!`)
    }

    // ✅ CREATE NEW ORDER
    const createNewOrder = async (subtotal: number, tax: number, total: number, deliveryFee: number, now: string): Promise<string> => {
        const orderId = generateUUID()

        const orderData: any = {
            id: orderId,
            waiter_id: cart.waiterId || null,
            status: orderType === 'delivery' ? 'completed' : 'pending',
            subtotal,
            tax,
            total_amount: total,
            notes: cart.notes || null,
            order_type: orderType,
            payment_method: orderType === 'delivery' ? paymentMethod : null,
            receipt_printed: true,
            synced: false,
            created_at: now,
            updated_at: now
        }

        if (orderType === 'dine-in') {
            orderData.table_id = cart.tableId || null
        } else {
            orderData.customer_name = details.customer_name || null
            orderData.customer_phone = details.customer_phone || null
            orderData.delivery_address = details.delivery_address || null
            orderData.delivery_charges = details.delivery_charges || 0
        }

        await db.orders.add(orderData)

        const orderItems = cart.items.map(item => ({
            id: `item_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            order_id: orderId,
            menu_item_id: item.id,
            quantity: item.quantity,
            unit_price: item.price,
            total_price: item.price * item.quantity,
            created_at: now
        }))
        await db.order_items.bulkAdd(orderItems)

        if (orderType === 'dine-in' && cart.tableId) {
            await db.restaurant_tables.update(cart.tableId, {
                status: 'occupied',
                waiter_id: cart.waiterId,
                current_order_id: orderId
            })
        }

        if (navigator.onLine) {
            try {
                const { data: newOrder } = await supabase.from('orders').insert(orderData).select().single()
                if (newOrder) {
                    await db.orders.update(orderId, { id: newOrder.id, synced: true })

                    const itemsToInsert = orderItems.map(item => ({
                        order_id: newOrder.id,
                        menu_item_id: item.menu_item_id,
                        quantity: item.quantity,
                        unit_price: item.unit_price,
                        total_price: item.total_price
                    }))
                    await supabase.from('order_items').insert(itemsToInsert)

                    if (orderType === 'dine-in' && cart.tableId) {
                        await supabase.from('restaurant_tables').update({
                            status: 'occupied',
                            waiter_id: cart.waiterId,
                            current_order_id: newOrder.id
                        }).eq('id', cart.tableId)
                    }

                    return newOrder.id
                }
            } catch (error) {
                await dbHelpers.addToQueue('orders', 'create', orderData)
            }
        } else {
            await dbHelpers.addToQueue('orders', 'create', orderData)
        }

        return orderId
    }

    // ✅ PRINT RECEIPT
    const printReceipt = async (orderId: string, subtotal: number, tax: number, total: number, date: string, isAddition = false) => {
        const selectedTable = tables.find(t => t.id === cart.tableId)
        const selectedWaiter = waiters.find(w => w.id === cart.waiterId)

        const receiptData: ReceiptData = {
            restaurantName: 'AT RESTAURANT',
            tagline: 'Delicious Food, Memorable Moments',
            address: 'Sooter Mills Rd, Lahore',
            orderNumber: orderId.slice(0, 8).toUpperCase(),
            date: new Date(date).toLocaleString('en-PK'),
            orderType,
            customerName: orderType === 'delivery' ? details.customer_name : undefined,
            customerPhone: orderType === 'delivery' ? details.customer_phone : undefined,
            deliveryAddress: orderType === 'delivery' ? details.delivery_address : undefined,
            deliveryCharges: orderType === 'delivery' ? details.delivery_charges : undefined,
            tableNumber: selectedTable?.table_number,
            waiter: selectedWaiter?.name,
            items: cart.items.map(i => {
                const category = menuCategories[i.id]
                return {
                    name: i.name,
                    quantity: i.quantity,
                    price: i.price,
                    total: i.price * i.quantity,
                    category: category ? `${category.icon} ${category.name}` : '📋 Uncategorized'
                }
            }),
            subtotal,
            tax,
            total,
            paymentMethod: orderType === 'delivery' ? paymentMethod : undefined,
            notes: isAddition ? 'ADDITIONAL ITEMS' : cart.notes
        }

        await productionPrinter.print(receiptData)
        console.log('🖨️ Bill printed immediately!')
    }

    const groupedItems = cart.items.reduce((acc: { [key: string]: typeof cart.items }, item) => {
        const category = menuCategories[item.id]
        const categoryKey = category ? `${category.icon} ${category.name}` : '📋 Uncategorized'
        if (!acc[categoryKey]) acc[categoryKey] = []
        acc[categoryKey].push(item)
        return acc
    }, {})

    if (!isOpen) return null

    return (
        <>
            <div className="fixed inset-0 bg-black/60 z-50 backdrop-blur-sm" onClick={onClose} />
            <div className="fixed right-0 top-0 h-full w-full sm:max-w-md bg-[var(--card)] border-l border-[var(--border)] z-50 flex flex-col shadow-2xl">
                <div className="flex items-center justify-between p-4 border-b border-[var(--border)]">
                    <div>
                        <h2 className="text-xl font-bold text-[var(--fg)]">Your Order</h2>
                        <p className="text-xs text-[var(--muted)] mt-1">{cart.items.length} items • {Object.keys(groupedItems).length} categories</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-[var(--bg)] rounded-lg">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                    <div className="grid grid-cols-2 gap-2">
                        <button
                            onClick={() => { setOrderType('dine-in'); setShowDetails(false) }}
                            className={`p-3 rounded-lg border-2 flex flex-col items-center gap-2 ${orderType === 'dine-in' ? 'border-blue-600 bg-blue-600/20' : 'border-[var(--border)]'}`}
                        >
                            <Home className={`w-6 h-6 ${orderType === 'dine-in' ? 'text-blue-600' : 'text-[var(--fg)]'}`} />
                            <span className={`text-sm font-medium ${orderType === 'dine-in' ? 'text-blue-600' : 'text-[var(--fg)]'}`}>Dine-In</span>
                        </button>
                        <button
                            onClick={() => setOrderType('delivery')}
                            className={`p-3 rounded-lg border-2 flex flex-col items-center gap-2 ${orderType === 'delivery' ? 'border-blue-600 bg-blue-600/20' : 'border-[var(--border)]'}`}
                        >
                            <Truck className={`w-6 h-6 ${orderType === 'delivery' ? 'text-blue-600' : 'text-[var(--fg)]'}`} />
                            <span className={`text-sm font-medium ${orderType === 'delivery' ? 'text-blue-600' : 'text-[var(--fg)]'}`}>Delivery</span>
                        </button>
                    </div>

                    {orderType === 'delivery' && (
                        <div className="space-y-2">
                            <label className="block text-sm font-medium">Payment Method <span className="text-red-600">*</span></label>
                            <div className="grid grid-cols-2 gap-2">
                                <button onClick={() => setPaymentMethod('cash')} className={`p-3 rounded-lg border-2 flex flex-col items-center gap-2 ${paymentMethod === 'cash' ? 'border-green-600 bg-green-600/20' : 'border-[var(--border)]'}`}>
                                    <Banknote className={`w-6 h-6 ${paymentMethod === 'cash' ? 'text-green-600' : 'text-[var(--fg)]'}`} />
                                    <span className={`text-sm font-medium ${paymentMethod === 'cash' ? 'text-green-600' : 'text-[var(--fg)]'}`}>Cash</span>
                                </button>
                                <button onClick={() => setPaymentMethod('online')} className={`p-3 rounded-lg border-2 flex flex-col items-center gap-2 ${paymentMethod === 'online' ? 'border-green-600 bg-green-600/20' : 'border-[var(--border)]'}`}>
                                    <CreditCard className={`w-6 h-6 ${paymentMethod === 'online' ? 'text-green-600' : 'text-[var(--fg)]'}`} />
                                    <span className={`text-sm font-medium ${paymentMethod === 'online' ? 'text-green-600' : 'text-[var(--fg)]'}`}>Online</span>
                                </button>
                            </div>
                        </div>
                    )}

                    {orderType === 'dine-in' && (
                        <div className="space-y-3">
                            <div>
                                <label className="block text-sm font-medium mb-2">Select Table <span className="text-red-600">*</span></label>
                                <select value={cart.tableId} onChange={e => cart.setTable(e.target.value)} className="w-full px-3 py-2 bg-[var(--bg)] border rounded-lg text-sm">
                                    <option value="">Select table</option>
                                    {tables.filter(t => t.status === 'available' || t.status === 'occupied').map(t => (
                                        <option key={t.id} value={t.id}>Table {t.table_number} {t.status === 'occupied' ? '(Occupied - Will Add & Print)' : ''}</option>
                                    ))}
                                </select>
                            </div>

                            {tableWarning?.show && (
                                <div className="p-4 bg-blue-500/10 border-2 border-blue-600 rounded-lg">
                                    <h4 className="font-bold text-blue-600 mb-2">📋 Adding to Table {tableWarning.tableNumber}</h4>
                                    <p className="text-sm text-[var(--muted)] mb-2">Current: PKR {tableWarning.currentTotal.toLocaleString()}</p>
                                    <p className="text-sm text-blue-600 font-semibold">Bill will print automatically!</p>
                                </div>
                            )}

                            <div>
                                <label className="block text-sm font-medium mb-2">Select Waiter <span className="text-red-600">*</span></label>
                                <select value={cart.waiterId} onChange={e => cart.setWaiter(e.target.value)} className="w-full px-3 py-2 bg-[var(--bg)] border rounded-lg text-sm">
                                    <option value="">Select waiter</option>
                                    {waiters.map(w => (<option key={w.id} value={w.id}>{w.name}</option>))}
                                </select>
                            </div>
                        </div>
                    )}

                    {orderType === 'delivery' && (
                        <>
                            <button onClick={() => setShowDetails(!showDetails)} className="w-full flex items-center justify-between px-4 py-3 bg-[var(--bg)] border rounded-lg">
                                <span className="text-sm font-medium">Delivery Details (Optional)</span>
                                {showDetails ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                            </button>
                            {showDetails && (
                                <div className="space-y-3 p-4 bg-[var(--bg)] rounded-lg border">
                                    <input type="text" value={details.customer_name} onChange={e => setDetails({ ...details, customer_name: e.target.value })} placeholder="Customer name" className="w-full px-3 py-2 bg-[var(--card)] border rounded-lg text-sm" />
                                    <input type="tel" value={details.customer_phone} onChange={e => setDetails({ ...details, customer_phone: e.target.value })} placeholder="Phone number" className="w-full px-3 py-2 bg-[var(--card)] border rounded-lg text-sm" />
                                    <textarea value={details.delivery_address} onChange={e => setDetails({ ...details, delivery_address: e.target.value })} placeholder="Delivery address" rows={2} className="w-full px-3 py-2 bg-[var(--card)] border rounded-lg text-sm resize-none" />
                                    <input type="number" value={details.delivery_charges || ''} onChange={e => setDetails({ ...details, delivery_charges: Number(e.target.value) || 0 })} placeholder="Delivery charges (PKR)" className="w-full px-3 py-2 bg-[var(--card)] border rounded-lg text-sm" />
                                </div>
                            )}
                        </>
                    )}

                    {cart.items.length > 0 && (
                        <div className="space-y-4">
                            <h3 className="text-sm font-semibold px-1">Order Items</h3>
                            {Object.entries(groupedItems).map(([category, items]) => (
                                <div key={category} className="space-y-2">
                                    <div className="flex items-center gap-2 px-2 py-1 bg-[var(--bg)] rounded-lg border">
                                        <span className="text-sm font-bold">{category}</span>
                                        <span className="ml-auto text-xs text-[var(--muted)] bg-blue-600/10 px-2 py-0.5 rounded-full">{items.length}</span>
                                    </div>
                                    {items.map(item => (
                                        <div key={item.id} className="p-3 bg-[var(--bg)] border rounded-lg ml-2">
                                            <div className="flex justify-between mb-3">
                                                <div className="flex-1">
                                                    <h4 className="font-semibold text-sm truncate">{item.name}</h4>
                                                    <p className="text-xs text-[var(--muted)]">PKR {item.price} each</p>
                                                </div>
                                                <span className="font-bold text-blue-600 text-sm">PKR {(item.price * item.quantity).toLocaleString()}</span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <button onClick={() => cart.updateQuantity(item.id, item.quantity - 1)} disabled={item.quantity <= 1} className="p-1.5 bg-red-600 text-white rounded-lg active:scale-95 disabled:opacity-30">
                                                    <Minus className="w-4 h-4" />
                                                </button>
                                                <input type="text" value={item.quantity} readOnly className="w-20 px-3 py-2 text-center font-bold text-sm bg-[var(--card)] border-2 rounded-lg" />
                                                <button onClick={() => cart.updateQuantity(item.id, item.quantity + 1)} className="p-1.5 bg-green-600 text-white rounded-lg active:scale-95">
                                                    <Plus className="w-4 h-4" />
                                                </button>
                                                <button onClick={() => cart.removeItem(item.id)} className="ml-auto px-3 py-1.5 text-xs bg-red-600 text-white rounded-lg">Remove</button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ))}
                        </div>
                    )}

                    {cart.items.length === 0 && (
                        <div className="flex flex-col items-center py-12">
                            <div className="text-6xl mb-4">🛒</div>
                            <p className="font-medium mb-1">Your cart is empty</p>
                            <p className="text-sm text-[var(--muted)]">Add items from the menu</p>
                        </div>
                    )}
                </div>

                {cart.items.length > 0 && (
                    <div className="border-t p-4">
                        <div className="space-y-2 mb-4">
                            <div className="flex justify-between text-sm">
                                <span className="text-[var(--muted)]">Subtotal</span>
                                <span className="font-medium">PKR {cart.subtotal().toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between items-center text-sm">
                                <span className="text-[var(--muted)]">Tax</span>
                                <div className="flex items-center gap-2">
                                    <input type="text" value={customTaxPercent} onChange={(e) => {
                                        const val = e.target.value
                                        if (val === '' || /^\d*\.?\d*$/.test(val)) {
                                            const num = parseFloat(val)
                                            if (val === '' || (num >= 0 && num <= 100)) setCustomTaxPercent(val)
                                        }
                                    }} onBlur={() => { if (customTaxPercent === '') setCustomTaxPercent('0') }} className="w-14 px-2 py-1 text-center text-xs font-bold bg-[var(--bg)] border-2 rounded-lg" maxLength={5} />
                                    <span className="text-xs">%</span>
                                    <span className="font-medium min-w-[80px] text-right">PKR {calculateTax().toFixed(2)}</span>
                                </div>
                            </div>
                            {orderType === 'delivery' && details.delivery_charges > 0 && (
                                <div className="flex justify-between text-sm">
                                    <span className="text-[var(--muted)]">Delivery</span>
                                    <span className="font-medium">PKR {details.delivery_charges}</span>
                                </div>
                            )}
                            <div className="flex justify-between text-lg font-bold pt-2 border-t">
                                <span>Total</span>
                                <span className="text-blue-600">PKR {(cart.subtotal() + calculateTax() + (orderType === 'delivery' ? details.delivery_charges : 0)).toFixed(2)}</span>
                            </div>
                        </div>
                        <button onClick={placeOrder} disabled={loading || (orderType === 'dine-in' && (!cart.tableId || !cart.waiterId))} className="w-full py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold flex items-center justify-center gap-2 disabled:opacity-50 active:scale-95">
                            {loading ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <CheckCircle className="w-5 h-5" />}
                            {loading ? 'Processing...' : orderType === 'delivery' ? 'Place Delivery' : '🖨️ Place & Print Bill'}
                        </button>
                        {orderType === 'dine-in' && <p className="text-xs text-center text-[var(--muted)] mt-2">💡 Bill will print automatically</p>}
                    </div>
                )}
            </div>
        </>
    )
}