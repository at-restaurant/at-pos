// src/components/analytics/InventoryInsights.tsx - FIXED
'use client'

import { useState, useEffect } from 'react'
import { Package } from 'lucide-react'
import { useDataLoader } from '@/lib/hooks'

export default function InventoryInsights() {
    const [topUsage, setTopUsage] = useState<any[]>([])

    const { data: usage } = useDataLoader({
        table: 'inventory_usage',
        select: 'inventory_item_id, quantity_used, cost, inventory_items(name)',
        filter: {
            created_at: `gte.${new Date().toISOString().split('T')[0]}`
        }
    })

    useEffect(() => {
        if (!usage) return

        const grouped = usage.reduce((acc: any, item: any) => {
            const id = item.inventory_item_id
            if (!acc[id]) {
                acc[id] = {
                    name: item.inventory_items?.name || 'Unknown',
                    quantity: 0,
                    cost: 0
                }
            }
            acc[id].quantity += item.quantity_used || 0
            acc[id].cost += item.cost || 0
            return acc
        }, {})

        const sorted = Object.values(grouped)
            .sort((a: any, b: any) => b.cost - a.cost)
            .slice(0, 10)

        setTopUsage(sorted)
    }, [usage])

    return (
        <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-4 sm:p-6">
            <div className="flex items-center gap-3 mb-4 sm:mb-6">
                <Package className="w-5 h-5 text-orange-600" />
                <h3 className="text-base sm:text-lg font-bold text-[var(--fg)]">Top Inventory Usage (Today)</h3>
            </div>

            <div className="space-y-3">
                {topUsage.length > 0 ? topUsage.map((item: any, idx: number) => (
                    <div key={idx} className="flex items-center justify-between p-3 bg-[var(--bg)] rounded-lg">
                        <div className="flex-1 min-w-0">
                            <p className="font-medium text-[var(--fg)] truncate">{item.name}</p>
                            <p className="text-xs text-[var(--muted)]">{item.quantity} units used</p>
                        </div>
                        <p className="font-bold text-red-600 flex-shrink-0 ml-3">PKR {item.cost.toLocaleString()}</p>
                    </div>
                )) : (
                    <p className="text-center py-8 text-[var(--muted)] text-sm">No usage recorded today</p>
                )}
            </div>
        </div>
    )
}