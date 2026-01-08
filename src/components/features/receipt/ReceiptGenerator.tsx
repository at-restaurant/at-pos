// src/components/features/receipt/ReceiptGenerator.tsx - TEXT FILE MODE
'use client'

import { useState, useEffect, useRef } from 'react'
import { Printer, Download, X, AlertCircle, CheckCircle, FileText } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { textFilePrinter } from '@/lib/print/textFilePrinter'
import { ReceiptData } from '@/types'

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
        payment_method?: string
        notes?: string
        restaurant_tables?: { table_number: number }
        waiters?: { name: string }
        order_items: Array<{
            id: string
            quantity: number
            menu_items: { name: string; price: number; category_id?: string }
            total_price: number
        }>
    }
    onClose: () => void
}

export default function ReceiptModal({ order, onClose }: ReceiptProps) {
    const [categories, setCategories] = useState<any[]>([])
    const [downloading, setDownloading] = useState(false)
    const [printing, setPrinting] = useState(false)
    const [statusMessage, setStatusMessage] = useState('')
    const [printStatus, setPrintStatus] = useState<'idle' | 'success' | 'error'>('idle')
    const receiptRef = useRef<HTMLDivElement>(null)
    const supabase = createClient()

    useEffect(() => {
        loadCategories()
    }, [])

    const loadCategories = async () => {
        const { data } = await supabase
            .from('menu_categories')
            .select('id, name, icon')
            .order('display_order')
        setCategories(data || [])
    }

    // ===================================
    // TEXT FILE PRINT (Main Method)
    // ===================================
    const handlePrint = async () => {
        setPrinting(true)
        setPrintStatus('idle')
        setStatusMessage('Creating print file...')

        try {
            // Build receipt data
            const itemsWithCategories = order.order_items.map(item => {
                const category = categories.find(c => c.id === item.menu_items.category_id)
                return {
                    name: item.menu_items.name,
                    quantity: item.quantity,
                    price: item.menu_items.price,
                    total: item.total_price,
                    category: category ? `${category.icon} ${category.name}` : '📋 Other'
                }
            })

            const receiptData: ReceiptData = {
                restaurantName: 'AT RESTAURANT',
                tagline: 'Delicious Food, Memorable Moments',
                address: 'Sooter Mills Rd, Lahore',
                orderNumber: order.id.slice(0, 8).toUpperCase(),
                date: new Date(order.created_at).toLocaleString('en-PK', {
                    dateStyle: 'medium',
                    timeStyle: 'short'
                }),
                orderType: order.order_type || 'dine-in',
                items: itemsWithCategories,
                subtotal: order.subtotal,
                tax: order.tax,
                total: order.total_amount,
                paymentMethod: order.payment_method as 'cash' | 'online' | 'card' | undefined,
                customerName: order.customer_name,
                customerPhone: order.customer_phone,
                deliveryAddress: order.delivery_address,
                deliveryCharges: order.delivery_charges,
                waiter: order.waiters?.name,
                tableNumber: order.restaurant_tables?.table_number,
                notes: order.notes
            }

            // Print using text file printer
            const result = await textFilePrinter.print(receiptData)

            if (result.success) {
                setPrintStatus('success')
                setStatusMessage('✅ Receipt file ready! Check your downloads.')
            } else {
                setPrintStatus('error')
                setStatusMessage('❌ Failed to create print file')
            }
        } catch (error: any) {
            console.error('Print error:', error)
            setPrintStatus('error')
            setStatusMessage('❌ Error: ' + error.message)
        } finally {
            setPrinting(false)
        }
    }

    // ===================================
    // DOWNLOAD AS IMAGE (Optional)
    // ===================================
    const handleDownload = async () => {
        setDownloading(true)
        try {
            const html2canvas = (await import('html2canvas')).default
            if (!receiptRef.current) return

            const canvas = await html2canvas(receiptRef.current, {
                backgroundColor: '#ffffff',
                scale: 2,
                logging: false
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

    const renderItems = () => {
        const grouped: Record<string, typeof order.order_items> = {}

        order.order_items.forEach(item => {
            const category = categories.find(c => c.id === item.menu_items.category_id)
            const key = category ? `${category.icon} ${category.name}` : '📋 Other'
            if (!grouped[key]) grouped[key] = []
            grouped[key].push(item)
        })

        return Object.entries(grouped).map(([category, items]) => (
            <div key={category} className="mb-3">
                <div className="font-bold text-xs mb-2 px-2 py-1 rounded bg-gray-100 text-gray-900"
                     style={{ borderLeft: '3px solid #3b82f6' }}>
                    {category}
                </div>
                <div className="space-y-2">
                    {items.map((item: any, index: number) => (
                        <div key={`${category}-${item.id}-${index}`} className="text-xs">
                            <div className="flex justify-between">
                                <span className="text-gray-900">
                                    {item.quantity}x {item.menu_items?.name}
                                </span>
                                <span className="font-bold text-gray-900">PKR {item.total_price}</span>
                            </div>
                            <div className="text-xs text-gray-500 ml-4">
                                @ PKR {item.menu_items?.price} each
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        ))
    }

    return (
        <>
            <div className="fixed inset-0 flex items-center justify-center p-4 z-50 bg-black/70">
                <div className="rounded-xl w-full max-w-md border bg-white max-h-[90vh] overflow-y-auto">
                    {/* Header */}
                    <div className="sticky top-0 flex items-center justify-between p-6 border-b bg-white z-10">
                        <div className="flex items-center gap-3">
                            <FileText className="w-6 h-6 text-blue-600" />
                            <div>
                                <h3 className="text-xl font-bold text-gray-900">Receipt</h3>
                                <p className="text-xs text-gray-600 mt-1">Order #{order.id.slice(0, 8).toUpperCase()}</p>
                            </div>
                        </div>
                        <button onClick={onClose} className="p-2 hover:opacity-70 text-gray-500">
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    {/* Status Messages */}
                    {printStatus !== 'idle' && (
                        <div className={`mx-6 mt-4 p-4 rounded-lg flex items-center gap-3 ${
                            printStatus === 'success'
                                ? 'bg-green-50 border border-green-200'
                                : 'bg-red-50 border border-red-200'
                        }`}>
                            {printStatus === 'success' ? (
                                <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
                            ) : (
                                <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
                            )}
                            <p className={`text-sm font-medium ${
                                printStatus === 'success' ? 'text-green-600' : 'text-red-600'
                            }`}>
                                {statusMessage}
                            </p>
                        </div>
                    )}

                    {/* Info Banner */}
                    <div className="mx-6 mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                        <div className="flex items-start gap-2">
                            <FileText className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
                            <div className="text-xs text-blue-700">
                                <p className="font-semibold mb-1">📄 Text File Printing</p>
                                <p>Receipt will download as a <strong>.txt</strong> file. Open it and press <kbd className="px-1 py-0.5 bg-white rounded border">Ctrl+P</kbd> to print.</p>
                            </div>
                        </div>
                    </div>

                    {/* Receipt Content */}
                    <div ref={receiptRef} className="p-6 font-mono bg-white" style={{ maxHeight: '50vh', overflowY: 'auto' }}>
                        <div className="text-center mb-6">
                            <h2 className="text-2xl font-bold mb-1 text-gray-900">AT Restaurant</h2>
                            <p className="text-sm text-gray-600">Delicious Food, Memorable Moments</p>
                            <div className="border-t-2 border-dashed my-3 border-gray-300"></div>
                            <p className="text-sm text-gray-600">Sooter Mills Rd, Lahore</p>
                        </div>

                        <div className="border-t-2 border-dashed my-4 border-gray-300"></div>

                        <div className="space-y-1 mb-4 text-sm">
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

                        {order.order_type === 'delivery' && (order.customer_name || order.customer_phone) && (
                            <>
                                <div className="border-t-2 border-dashed my-4 border-gray-300"></div>
                                <div className="mb-4 bg-blue-50 p-3 rounded-lg">
                                    <p className="font-bold text-sm mb-2 text-blue-900">📦 DELIVERY DETAILS</p>
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
                                            <p className="text-gray-900 font-medium mt-1">{order.delivery_address}</p>
                                        </div>
                                    )}
                                </div>
                            </>
                        )}

                        <div className="border-t-2 border-dashed my-4 border-gray-300"></div>

                        <div className="mb-4">
                            <p className="font-bold text-sm mb-2 text-gray-900">ORDER ITEMS</p>
                            {renderItems()}
                        </div>

                        <div className="border-t-2 border-dashed my-4 border-gray-300"></div>

                        <div className="space-y-2 text-sm">
                            <div className="flex justify-between">
                                <span className="text-gray-600">Subtotal</span>
                                <span className="text-gray-900">PKR {order.subtotal.toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-gray-600">Tax</span>
                                <span className="text-gray-900">PKR {order.tax.toFixed(2)}</span>
                            </div>
                            {order.delivery_charges && order.delivery_charges > 0 && (
                                <div className="flex justify-between">
                                    <span className="text-gray-600">Delivery</span>
                                    <span className="text-gray-900">PKR {order.delivery_charges.toFixed(2)}</span>
                                </div>
                            )}
                            <div className="flex justify-between text-lg font-bold pt-2 border-t">
                                <span className="text-gray-900">TOTAL</span>
                                <span className="text-blue-600">PKR {order.total_amount.toFixed(2)}</span>
                            </div>
                        </div>

                        {order.payment_method && (
                            <div className="mt-4 text-center p-2 bg-gray-100 rounded">
                                <span className="font-bold text-sm text-gray-900">
                                    Payment: {order.payment_method.toUpperCase()}
                                </span>
                            </div>
                        )}

                        <div className="border-t-2 border-dashed my-4 border-gray-300"></div>

                        <div className="text-center text-sm text-gray-600">
                            <p className="mb-1 font-bold">Thank you for dining with us!</p>
                            <p className="text-xs text-gray-500 mt-3">Powered by AT Restaurant POS</p>
                        </div>
                    </div>

                    {/* Actions */}
                    <div className="sticky bottom-0 flex gap-3 p-6 border-t bg-white">
                        <button
                            onClick={handleDownload}
                            disabled={downloading}
                            className="flex-1 px-4 py-3 rounded-lg font-medium flex items-center justify-center gap-2 bg-gray-100 text-gray-900 hover:bg-gray-200 disabled:opacity-50 text-sm"
                        >
                            {downloading ? (
                                <div className="w-4 h-4 border-2 border-gray-900 border-t-transparent rounded-full animate-spin" />
                            ) : (
                                <Download className="w-4 h-4" />
                            )}
                            {downloading ? 'Downloading...' : 'Save Image'}
                        </button>

                        <button
                            onClick={handlePrint}
                            disabled={printing}
                            className="flex-1 px-4 py-3 rounded-lg font-medium flex items-center justify-center gap-2 bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 text-sm"
                        >
                            {printing ? (
                                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            ) : (
                                <FileText className="w-4 h-4" />
                            )}
                            {printing ? 'Creating...' : 'Print (Text File)'}
                        </button>
                    </div>
                </div>
            </div>
        </>
    )
}