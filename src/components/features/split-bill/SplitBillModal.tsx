'use client'

import { useState } from 'react'
import { X, Users, DollarSign, Printer } from 'lucide-react'

type SplitBillProps = {
    order: {
        id: string
        total_amount: number
        order_items: Array<{
            id: string
            menu_items: { name: string }
            quantity: number
            total_price: number
        }>
    }
    onClose: () => void
}

export default function SplitBillModal({ order, onClose }: SplitBillProps) {
    const [splitType, setSplitType] = useState<'equal' | 'items'>('equal')
    const [peopleCount, setPeopleCount] = useState(2)
    const [selectedItems, setSelectedItems] = useState<Record<string, number>>({})

    const handleItemSplit = (itemId: string, person: number) => {
        setSelectedItems(prev => ({
            ...prev,
            [itemId]: person
        }))
    }

    const calculateSplits = () => {
        if (splitType === 'equal') {
            const perPerson = order.total_amount / peopleCount
            return Array(peopleCount).fill(perPerson)
        }

        const splits = Array(peopleCount).fill(0)
        order.order_items.forEach(item => {
            const assignedPerson = selectedItems[item.id]
            if (assignedPerson !== undefined) {
                splits[assignedPerson] += item.total_price
            }
        })
        return splits
    }

    const handlePrintBills = () => {
        const splits = calculateSplits()
        const printContent = splits.map((amount, i) => `
            <div style="page-break-after: always; padding: 20px; font-family: monospace;">
                <h2>RT Restaurant - Split Bill ${i + 1}/${peopleCount}</h2>
                <p>Order #${order.id.slice(0, 8)}</p>
                <hr/>
                <h3>Amount Due: PKR ${amount.toFixed(2)}</h3>
            </div>
        `).join('')

        const printWindow = window.open('', '_blank')
        if (printWindow) {
            printWindow.document.write(`
                <html>
                    <head><title>Split Bills</title></head>
                    <body>${printContent}</body>
                </html>
            `)
            printWindow.document.close()
            printWindow.print()
        }
    }

    const splits = calculateSplits()

    return (
        <div className="fixed inset-0 flex items-center justify-center p-4 z-50" style={{ backgroundColor: 'rgba(0,0,0,0.7)' }}>
            <div className="rounded-xl w-full max-w-2xl border" style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)' }}>
                <div className="flex items-center justify-between p-6 border-b" style={{ borderColor: 'var(--border)' }}>
                    <div className="flex items-center gap-3">
                        <Users className="w-6 h-6" style={{ color: '#3b82f6' }} />
                        <h3 className="text-xl font-bold" style={{ color: 'var(--fg)' }}>Split Bill</h3>
                    </div>
                    <button onClick={onClose} className="p-2 hover:opacity-70" style={{ color: 'var(--muted)' }}>
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="p-6 space-y-6">
                    <div className="flex gap-3">
                        <button
                            onClick={() => setSplitType('equal')}
                            className={`flex-1 p-4 rounded-lg border-2 transition-all ${splitType === 'equal' ? 'border-blue-600' : 'border-transparent'}`}
                            style={{ backgroundColor: 'var(--bg)' }}
                        >
                            <div className="text-2xl mb-2">⚖️</div>
                            <div className="font-semibold" style={{ color: 'var(--fg)' }}>Equal Split</div>
                            <div className="text-sm" style={{ color: 'var(--muted)' }}>Divide equally</div>
                        </button>

                        <button
                            onClick={() => setSplitType('items')}
                            className={`flex-1 p-4 rounded-lg border-2 transition-all ${splitType === 'items' ? 'border-blue-600' : 'border-transparent'}`}
                            style={{ backgroundColor: 'var(--bg)' }}
                        >
                            <div className="text-2xl mb-2">📋</div>
                            <div className="font-semibold" style={{ color: 'var(--fg)' }}>By Items</div>

                            <div className="text-sm" style={{ color: 'var(--muted)' }}>Assign items</div>
                        </button>
                    </div>
                    {splitType === 'equal' && (
                        <div>
                            <label className="block text-sm font-medium mb-3" style={{ color: 'var(--fg)' }}>
                                Number of People
                            </label>
                            <div className="flex items-center gap-3">
                                <button
                                    onClick={() => setPeopleCount(Math.max(2, peopleCount - 1))}
                                    className="w-12 h-12 rounded-lg font-bold text-lg"
                                    style={{ backgroundColor: 'var(--bg)', color: 'var(--fg)' }}
                                >
                                    -
                                </button>
                                <div className="flex-1 text-center">
                                    <div className="text-4xl font-bold" style={{ color: 'var(--fg)' }}>{peopleCount}</div>
                                </div>
                                <button
                                    onClick={() => setPeopleCount(Math.min(10, peopleCount + 1))}
                                    className="w-12 h-12 rounded-lg font-bold text-lg"
                                    style={{ backgroundColor: 'var(--bg)', color: 'var(--fg)' }}
                                >
                                    +
                                </button>
                            </div>
                        </div>
                    )}

                    {splitType === 'items' && (
                        <div>
                            <label className="block text-sm font-medium mb-3" style={{ color: 'var(--fg)' }}>
                                Assign Items to People
                            </label>
                            <div className="flex gap-2 mb-4">
                                {Array.from({ length: peopleCount }, (_, i) => (
                                    <button
                                        key={i}
                                        className="flex-1 px-4 py-2 rounded-lg font-medium"
                                        style={{ backgroundColor: 'var(--bg)', color: 'var(--fg)' }}
                                    >
                                        Person {i + 1}
                                    </button>
                                ))}
                            </div>

                            <div className="space-y-2 max-h-64 overflow-y-auto">
                                {order.order_items.map(item => (
                                    <div key={item.id} className="p-3 rounded-lg" style={{ backgroundColor: 'var(--bg)' }}>
                                        <div className="flex items-center justify-between mb-2">
                                        <span className="font-medium" style={{ color: 'var(--fg)' }}>
                                            {item.quantity}x {item.menu_items.name}
                                        </span>
                                            <span className="font-bold" style={{ color: 'var(--fg)' }}>
                                            PKR {item.total_price}
                                        </span>
                                        </div>
                                        <div className="flex gap-2">
                                            {Array.from({ length: peopleCount }, (_, i) => (
                                                <button
                                                    key={i}
                                                    onClick={() => handleItemSplit(item.id, i)}
                                                    className={`flex-1 px-3 py-1.5 rounded text-sm font-medium transition-all ${
                                                        selectedItems[item.id] === i
                                                            ? 'bg-blue-600 text-white'
                                                            : 'bg-transparent border border-[var(--border)]'
                                                    }`}
                                                    style={{ color: selectedItems[item.id] === i ? '#fff' : 'var(--fg)' }}
                                                >
                                                    P{i + 1}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    <div className="p-4 rounded-xl" style={{ backgroundColor: 'var(--bg)' }}>
                        <div className="flex items-center gap-2 mb-4">
                            <DollarSign className="w-5 h-5" style={{ color: '#3b82f6' }} />
                            <h4 className="font-bold" style={{ color: 'var(--fg)' }}>Split Breakdown</h4>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            {splits.map((amount, i) => (
                                <div key={i} className="p-3 rounded-lg" style={{ backgroundColor: 'var(--card)' }}>
                                    <p className="text-sm mb-1" style={{ color: 'var(--muted)' }}>Person {i + 1}</p>
                                    <p className="text-2xl font-bold" style={{ color: '#3b82f6' }}>
                                        PKR {amount.toFixed(2)}
                                    </p>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="flex gap-3 p-6 border-t" style={{ borderColor: 'var(--border)' }}>
                    <button
                        onClick={onClose}
                        className="flex-1 px-4 py-3 rounded-lg font-medium"
                        style={{ backgroundColor: 'var(--bg)', color: 'var(--fg)' }}
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handlePrintBills}
                        className="flex-1 px-4 py-3 rounded-lg font-medium flex items-center justify-center gap-2"
                        style={{ backgroundColor: '#3b82f6', color: '#fff' }}
                    >
                        <Printer className="w-4 h-4" />
                        Print Bills
                    </button>
                </div>
            </div>
        </div>
    )
}