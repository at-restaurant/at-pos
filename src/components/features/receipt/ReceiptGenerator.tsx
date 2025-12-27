// src/components/features/receipt/ReceiptGenerator.tsx - FIXED PRINT VERSION
'use client'

import { useState, useEffect, useRef } from 'react'
import { Printer, Download, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

type ReceiptProps = {
    order: {
        id: string
        created_at: string
        subtotal: number
        tax: number
        total_amount: number
        order_type?: 'dine-in' | 'delivery'
        customer_name?: string
        customer_phone?: string
        delivery_address?: string
        delivery_charges?: number
        restaurant_tables?: { table_number: number }
        waiters?: { name: string }
        order_items: Array<{
            id: string
            quantity: number
            menu_items: { name: string; price: number; category_id: string }
            total_price: number
        }>
    }
    onClose: () => void
}

export default function ReceiptModal({ order, onClose }: ReceiptProps) {
    const [categories, setCategories] = useState<any[]>([])
    const [downloading, setDownloading] = useState(false)
    const receiptRef = useRef<HTMLDivElement>(null)
    const supabase = createClient()

    useEffect(() => {
        loadData()
    }, [])

    const loadData = async () => {
        const { data: cats } = await supabase
            .from('menu_categories')
            .select('id, name, icon')
            .order('display_order')
        setCategories(cats || [])
    }

    const groupedItems = order.order_items.reduce((acc: any, item) => {
        const categoryId = item.menu_items.category_id
        if (!acc[categoryId]) acc[categoryId] = []
        acc[categoryId].push(item)
        return acc
    }, {})

    const handlePrint = () => {
        window.print()
    }

    const handleDownload = async () => {
        setDownloading(true)
        try {
            const html2canvas = (await import('html2canvas')).default
            if (!receiptRef.current) return

            const canvas = await html2canvas(receiptRef.current, {
                backgroundColor: '#ffffff',
                scale: 2,
                logging: false,
                useCORS: true
            })

            canvas.toBlob((blob) => {
                if (!blob) return
                const url = URL.createObjectURL(blob)
                const a = document.createElement('a')
                a.href = url
                a.download = `receipt-${order.id.slice(0, 8)}.png`
                document.body.appendChild(a)
                a.click()
                document.body.removeChild(a)
                URL.revokeObjectURL(url)
            }, 'image/png')
        } catch (error) {
            console.error('Download failed:', error)
        } finally {
            setDownloading(false)
        }
    }

    return (
        <>
            {/* Print Styles */}
            <style jsx global>{`
                @media print {
                    body * {
                        visibility: hidden;
                    }
                    #receipt-content,
                    #receipt-content * {
                        visibility: visible;
                    }
                    #receipt-content {
                        position: absolute;
                        left: 0;
                        top: 0;
                        width: 100%;
                        background: white !important;
                        padding: 20px;
                    }
                    .print-hide {
                        display: none !important;
                    }
                }
            `}</style>

            <div className="fixed inset-0 flex items-center justify-center p-4 z-50 bg-black/70 print-hide">
                <div className="rounded-xl w-full max-w-md border bg-white">
                    {/* Header */}
                    <div className="flex items-center justify-between p-4 sm:p-6 border-b print-hide">
                        <div className="flex items-center gap-3">
                            <Printer className="w-5 h-5 sm:w-6 sm:h-6 text-blue-600" />
                            <h3 className="text-lg sm:text-xl font-bold text-gray-900">Receipt</h3>
                        </div>
                        <button onClick={onClose} className="p-2 hover:opacity-70 text-gray-500">
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    {/* Receipt Content */}
                    <div
                        id="receipt-content"
                        ref={receiptRef}
                        className="p-4 sm:p-6 font-mono bg-white"
                        style={{ maxHeight: '60vh', overflowY: 'auto' }}
                    >
                        {/* Restaurant Header */}
                        <div className="text-center mb-4 sm:mb-6">
                            <h2 className="text-xl sm:text-2xl font-bold mb-1 text-gray-900">AT Restaurant</h2>
                            <p className="text-xs sm:text-sm text-gray-600">Delicious Food, Memorable Moments</p>
                            <div className="border-t-2 border-dashed my-2 sm:my-3 border-gray-300"></div>
                            <p className="text-xs sm:text-sm text-gray-600">Sooter Mills Rd, Lahore</p>
                        </div>

                        <div className="border-t-2 border-dashed my-3 sm:my-4 border-gray-300"></div>

                        {/* Order Info */}
                        <div className="space-y-1 mb-3 sm:mb-4 text-xs sm:text-sm">
                            <div className="flex justify-between">
                                <span className="text-gray-600">Order #</span>
                                <span className="font-bold text-gray-900">{order.id.slice(0, 8).toUpperCase()}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-gray-600">Date</span>
                                <span className="text-gray-900">{new Date(order.created_at).toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-gray-600">Type</span>
                                <span className="text-gray-900 uppercase font-semibold">
                                    {order.order_type === 'delivery' ? '🚚 DELIVERY' : '🍽️ DINE-IN'}
                                </span>
                            </div>
                            {order.restaurant_tables && (
                                <div className="flex justify-between">
                                    <span className="text-gray-600">Table</span>
                                    <span className="text-gray-900">#{order.restaurant_tables.table_number}</span>
                                </div>
                            )}
                            {order.waiters && (
                                <div className="flex justify-between">
                                    <span className="text-gray-600">Waiter</span>
                                    <span className="text-gray-900">{order.waiters.name}</span>
                                </div>
                            )}
                        </div>

                        {/* Customer Details (Delivery Only) */}
                        {order.order_type === 'delivery' && (order.customer_name || order.customer_phone || order.delivery_address) && (
                            <>
                                <div className="border-t-2 border-dashed my-3 sm:my-4 border-gray-300"></div>
                                <div className="mb-3 sm:mb-4 bg-blue-50 p-3 rounded-lg">
                                    <p className="font-bold text-xs sm:text-sm mb-2 text-blue-900">📦 DELIVERY DETAILS</p>
                                    {order.customer_name && (
                                        <div className="flex justify-between text-xs mb-1">
                                            <span className="text-gray-600">Name:</span>
                                            <span className="text-gray-900 font-medium">{order.customer_name}</span>
                                        </div>
                                    )}
                                    {order.customer_phone && (
                                        <div className="flex justify-between text-xs mb-1">
                                            <span className="text-gray-600">Phone:</span>
                                            <span className="text-gray-900 font-medium">{order.customer_phone}</span>
                                        </div>
                                    )}
                                    {order.delivery_address && (
                                        <div className="text-xs mt-2">
                                            <span className="text-gray-600">Address:</span>
                                            <p className="text-gray-900 font-medium mt-1 leading-relaxed">{order.delivery_address}</p>
                                        </div>
                                    )}
                                </div>
                            </>
                        )}

                        <div className="border-t-2 border-dashed my-3 sm:my-4 border-gray-300"></div>

                        {/* Items by Category */}
                        <div className="mb-3 sm:mb-4">
                            <p className="font-bold text-xs sm:text-sm mb-2 text-gray-900">ORDER ITEMS</p>
                            {categories
                                .filter(cat => groupedItems[cat.id]?.length > 0)
                                .map(category => (
                                    <div key={category.id} className="mb-2 sm:mb-3">
                                        <div className="font-bold text-xs sm:text-sm mb-1 sm:mb-2 px-2 py-1 rounded bg-gray-100 text-gray-900" style={{ borderLeft: '3px solid #3b82f6' }}>
                                            {category.icon} {category.name.toUpperCase()}
                                        </div>
                                        <div className="space-y-1 sm:space-y-2">
                                            {groupedItems[category.id].map((item: any) => (
                                                <div key={item.id} className="text-xs sm:text-sm">
                                                    <div className="flex justify-between">
                                                        <span className="text-gray-900">
                                                            {item.quantity}x {item.menu_items.name}
                                                        </span>
                                                        <span className="font-bold text-gray-900">PKR {item.total_price}</span>
                                                    </div>
                                                    <div className="text-xs text-gray-500 ml-4">
                                                        @ PKR {item.menu_items.price} each
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                        </div>

                        <div className="border-t-2 border-dashed my-3 sm:my-4 border-gray-300"></div>

                        {/* Totals */}
                        <div className="space-y-1 sm:space-y-2 text-xs sm:text-sm">
                            <div className="flex justify-between">
                                <span className="text-gray-600">Subtotal</span>
                                <span className="text-gray-900">PKR {order.subtotal.toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-gray-600">Tax</span>
                                <span className="text-gray-900">PKR {order.tax.toFixed(2)}</span>
                            </div>
                            {order.order_type === 'delivery' && order.delivery_charges && order.delivery_charges > 0 && (
                                <div className="flex justify-between">
                                    <span className="text-gray-600">Delivery Charges</span>
                                    <span className="text-gray-900">PKR {order.delivery_charges.toFixed(2)}</span>
                                </div>
                            )}
                            <div className="flex justify-between text-base sm:text-lg font-bold pt-2 border-t border-gray-300">
                                <span className="text-gray-900">TOTAL</span>
                                <span className="text-blue-600">PKR {order.total_amount.toFixed(2)}</span>
                            </div>
                        </div>

                        <div className="border-t-2 border-dashed my-3 sm:my-4 border-gray-300"></div>

                        {/* Footer */}
                        <div className="text-center text-xs sm:text-sm text-gray-600">
                            <p className="mb-1 font-bold">Thank you for dining with us!</p>
                            <p className="mb-2">Please visit again</p>
                            <p className="text-xs text-gray-500 mt-3">Powered by AT Restaurant POS</p>
                        </div>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2 sm:gap-3 p-4 sm:p-6 border-t print-hide">
                        <button
                            onClick={handleDownload}
                            disabled={downloading}
                            className="flex-1 px-3 sm:px-4 py-2 sm:py-3 rounded-lg font-medium flex items-center justify-center gap-2 bg-gray-100 text-gray-900 hover:bg-gray-200 disabled:opacity-50 text-sm"
                        >
                            {downloading ? (
                                <>
                                    <div className="w-4 h-4 border-2 border-gray-900 border-t-transparent rounded-full animate-spin" />
                                    Downloading...
                                </>
                            ) : (
                                <>
                                    <Download className="w-4 h-4" />
                                    <span className="hidden sm:inline">Download</span>
                                    <span className="sm:hidden">Save</span>
                                </>
                            )}
                        </button>
                        <button
                            onClick={handlePrint}
                            className="flex-1 px-3 sm:px-4 py-2 sm:py-3 rounded-lg font-medium flex items-center justify-center gap-2 bg-blue-600 text-white hover:bg-blue-700 text-sm"
                        >
                            <Printer className="w-4 h-4" />
                            Print Receipt
                        </button>
                    </div>
                </div>
            </div>
        </>
    )
}