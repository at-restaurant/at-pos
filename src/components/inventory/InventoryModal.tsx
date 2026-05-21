// src/components/inventory/InventoryModal.tsx
"use client"

import { useState, useEffect } from 'react'
import { X, Package, TrendingDown, Plus, RefreshCw, CheckCircle, AlertTriangle } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/components/ui/Toast'
import UniversalModal from '@/components/ui/UniversalModal'
import { useOfflineFirst } from '@/lib/hooks/useOfflineFirst'

export function InventoryModal({ isOpen, onClose }: { isOpen: boolean, onClose: () => void }) {
    const [updatingId, setUpdatingId] = useState<string | null>(null)
    const [addQuantity, setAddQuantity] = useState<{ [key: string]: string }>({})
    const [addPrice, setAddPrice] = useState<{ [key: string]: string }>({})
    
    const supabase = createClient()
    const toast = useToast()

    const { data: items, loading, refresh } = useOfflineFirst<any>({
        store: 'inventory_items', // From STORES.INVENTORY_ITEMS
        table: 'inventory_items',
        autoSync: true,
        filter: { is_active: true }
    })

    const getStockStatus = (item: any) => {
        const stock = item.quantity
        const reorder = item.reorder_level || 10

        if (stock === 0) return { status: 'critical', color: 'text-red-500', bg: 'bg-red-500/10' }
        if (stock <= reorder) return { status: 'low', color: 'text-orange-500', bg: 'bg-orange-500/10' }
        return { status: 'good', color: 'text-green-500', bg: 'bg-green-500/10' }
    }

    const handleUpdateStock = async (id: string, currentQty: number) => {
        const addAmount = parseFloat(addQuantity[id])
        const price = parseFloat(addPrice[id])

        if (!addAmount || isNaN(addAmount) || addAmount <= 0) {
            toast.add('error', 'Enter a valid positive quantity')
            return
        }
        if (!price || isNaN(price) || price <= 0) {
            toast.add('error', 'Enter a valid positive price/amount')
            return
        }

        setUpdatingId(id)
        try {
            if (!navigator.onLine) {
                toast.add('error', 'Cannot update stock while offline')
                setUpdatingId(null)
                return
            }

            const newQty = currentQty + addAmount
            const { error } = await supabase
                .from('inventory_items')
                .update({ quantity: newQty, updated_at: new Date().toISOString() })
                .eq('id', id)

            if (error) throw error
            
            // Log the purchase history (optional but good practice)
            await supabase.from('inventory_history').insert({
                item_id: id,
                change_type: 'restock',
                quantity: addAmount,
                notes: `Purchased at price: ${price}`
            })

            refresh() // Refresh from Supabase
            
            setAddQuantity(prev => ({ ...prev, [id]: '' }))
            setAddPrice(prev => ({ ...prev, [id]: '' }))
            toast.add('success', 'Stock updated successfully')
        } catch (error: any) {
            toast.add('error', `Update failed: ${error.message}`)
        } finally {
            setUpdatingId(null)
        }
    }

    return (
        <UniversalModal open={isOpen} onClose={onClose} title="Raw Inventory Tracking" size="xl">
            <div className="p-4">
                {loading ? (
                    <div className="flex justify-center items-center py-12">
                        <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                    </div>
                ) : (
                    <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-2">
                        {items.length === 0 ? (
                            <div className="text-center py-8 text-[var(--muted)]">No raw inventory items found.</div>
                        ) : (
                            items.map(item => {
                                const stockInfo = getStockStatus(item)
                                return (
                                    <div key={item.id} className="bg-[var(--bg)] border border-[var(--border)] rounded-xl p-4 flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className={`w-12 h-12 rounded-lg flex items-center justify-center text-xl shrink-0 ${stockInfo.bg} ${stockInfo.color}`}>
                                                {item.inventory_categories?.icon || <Package size={20} />}
                                            </div>
                                            <div>
                                                <h4 className="font-bold text-[var(--fg)]">{item.name}</h4>
                                                <p className="text-xs text-[var(--muted)]">{item.inventory_categories?.name || 'Uncategorized'}</p>
                                                {stockInfo.status === 'critical' && (
                                                    <span className="inline-flex items-center gap-1 mt-1 text-[10px] text-red-500 font-bold bg-red-500/10 px-1.5 py-0.5 rounded">
                                                        <AlertTriangle size={10} /> OUT OF STOCK
                                                    </span>
                                                )}
                                                {stockInfo.status === 'low' && (
                                                    <span className="inline-flex items-center gap-1 mt-1 text-[10px] text-orange-500 font-bold bg-orange-500/10 px-1.5 py-0.5 rounded">
                                                        <AlertTriangle size={10} /> LOW STOCK
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                        
                                        <div className="flex items-center gap-4 w-full sm:w-auto">
                                            <div className="text-right flex-1 sm:flex-none">
                                                <div className={`text-2xl font-black ${stockInfo.color}`}>
                                                    {Number(item.quantity).toFixed(2)}
                                                </div>
                                                <div className="text-xs text-[var(--muted)] font-medium">{item.unit}</div>
                                            </div>
                                            
                                            <div className="flex flex-col items-end gap-2 bg-[var(--card)] border border-[var(--border)] rounded-lg p-2">
                                                <div className="flex gap-2">
                                                    <input 
                                                        type="number"
                                                        placeholder="Qty..."
                                                        className="w-20 bg-[var(--bg)] border border-[var(--border)] rounded text-sm px-2 py-1 outline-none text-[var(--fg)]"
                                                        value={addQuantity[item.id] || ''}
                                                        onChange={e => setAddQuantity(prev => ({ ...prev, [item.id]: e.target.value }))}
                                                    />
                                                    <input 
                                                        type="number"
                                                        placeholder="Price (PKR)..."
                                                        className="w-28 bg-[var(--bg)] border border-[var(--border)] rounded text-sm px-2 py-1 outline-none text-[var(--fg)]"
                                                        value={addPrice[item.id] || ''}
                                                        onChange={e => setAddPrice(prev => ({ ...prev, [item.id]: e.target.value }))}
                                                    />
                                                    <button 
                                                        onClick={() => handleUpdateStock(item.id, item.quantity)}
                                                        disabled={updatingId === item.id || !addQuantity[item.id] || !addPrice[item.id]}
                                                        className="p-1.5 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 transition-colors"
                                                    >
                                                        {updatingId === item.id ? <RefreshCw size={16} className="animate-spin" /> : <Plus size={16} />}
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )
                            })
                        )}
                    </div>
                )}
            </div>
        </UniversalModal>
    )
}
