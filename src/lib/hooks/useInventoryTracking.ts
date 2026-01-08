// src/lib/hooks/useInventoryTracking.ts
import { useState, useCallback, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/components/ui/Toast'

type StockStatus = 'critical' | 'low' | 'medium' | 'high'

export function useInventoryTracking() {
    const [loading, setLoading] = useState(false)
    const supabase = createClient()
    const toast = useToast()

    // ✅ Get stock status
    const getStockStatus = useCallback((quantity: number, reorderLevel: number): StockStatus => {
        const percentage = (quantity / reorderLevel) * 100
        if (percentage <= 50) return 'critical'
        if (percentage <= 100) return 'low'
        if (percentage <= 200) return 'medium'
        return 'high'
    }, [])

    // ✅ Get stock color
    const getStockColor = useCallback((status: StockStatus): string => {
        const colors = { critical: '#ef4444', low: '#f59e0b', medium: '#3b82f6', high: '#10b981' }
        return colors[status]
    }, [])

    // ✅ Create inventory item
    const createItem = useCallback(async (data: any) => {
        setLoading(true)
        try {
            const { error } = await supabase
                .from('inventory_items')
                .insert({ ...data, is_active: true })

            if (error) throw error
            toast.add('success', '✅ Item added!')
            return { success: true }
        } catch (error: any) {
            toast.add('error', `❌ ${error.message}`)
            return { success: false, error: error.message }
        } finally {
            setLoading(false)
        }
    }, [supabase, toast])

    // ✅ Update inventory item
    const updateItem = useCallback(async (id: string, data: any) => {
        setLoading(true)
        try {
            const { error } = await supabase
                .from('inventory_items')
                .update(data)
                .eq('id', id)

            if (error) throw error
            toast.add('success', '✅ Item updated!')
            return { success: true }
        } catch (error: any) {
            toast.add('error', `❌ ${error.message}`)
            return { success: false, error: error.message }
        } finally {
            setLoading(false)
        }
    }, [supabase, toast])

    // ✅ Delete inventory item
    const deleteItem = useCallback(async (id: string, imageUrl?: string) => {
        setLoading(true)
        try {
            const { error } = await supabase
                .from('inventory_items')
                .delete()
                .eq('id', id)

            if (error) throw error

            // Delete Cloudinary image
            if (imageUrl?.includes('cloudinary')) {
                const publicId = imageUrl.split('/').slice(-2).join('/').split('.')[0]
                await fetch('/api/upload/cloudinary', {
                    method: 'DELETE',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ public_id: publicId })
                })
            }

            toast.add('success', '✅ Item deleted!')
            return { success: true }
        } catch (error: any) {
            toast.add('error', `❌ ${error.message}`)
            return { success: false, error: error.message }
        } finally {
            setLoading(false)
        }
    }, [supabase, toast])

    // ✅ Adjust stock (increase/decrease)
    const adjustStock = useCallback(async (id: string, adjustment: number, reason?: string) => {
        setLoading(true)
        try {
            const { data: item } = await supabase
                .from('inventory_items')
                .select('quantity')
                .eq('id', id)
                .single()

            if (!item) throw new Error('Item not found')

            const newQuantity = Math.max(0, item.quantity + adjustment)

            const { error } = await supabase
                .from('inventory_items')
                .update({ quantity: newQuantity })
                .eq('id', id)

            if (error) throw error

            toast.add('success', `✅ Stock ${adjustment > 0 ? 'added' : 'reduced'}!`)
            return { success: true, newQuantity }
        } catch (error: any) {
            toast.add('error', `❌ ${error.message}`)
            return { success: false, error: error.message }
        } finally {
            setLoading(false)
        }
    }, [supabase, toast])

    return {
        createItem,
        updateItem,
        deleteItem,
        adjustStock,
        getStockStatus,
        getStockColor,
        loading
    }
}