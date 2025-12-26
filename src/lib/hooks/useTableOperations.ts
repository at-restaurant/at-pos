// src/lib/hooks/useTableOperations.ts
import { useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/components/ui/Toast'

export function useTableOperations() {
    const [loading, setLoading] = useState(false)
    const supabase = createClient()
    const toast = useToast()

    // ✅ Create table
    const createTable = useCallback(async (data: { table_number: number; capacity: number; section?: string }) => {
        setLoading(true)
        try {
            const { error } = await supabase
                .from('restaurant_tables')
                .insert({ ...data, status: 'available' })

            if (error) throw error
            toast.add('success', '✅ Table created!')
            return { success: true }
        } catch (error: any) {
            toast.add('error', `❌ ${error.message}`)
            return { success: false, error: error.message }
        } finally {
            setLoading(false)
        }
    }, [supabase, toast])

    // ✅ Update table
    const updateTable = useCallback(async (id: string, data: any) => {
        setLoading(true)
        try {
            const { error } = await supabase
                .from('restaurant_tables')
                .update(data)
                .eq('id', id)

            if (error) throw error
            toast.add('success', '✅ Table updated!')
            return { success: true }
        } catch (error: any) {
            toast.add('error', `❌ ${error.message}`)
            return { success: false, error: error.message }
        } finally {
            setLoading(false)
        }
    }, [supabase, toast])

    // ✅ Delete table (only if not occupied)
    const deleteTable = useCallback(async (id: string, status: string) => {
        if (status === 'occupied' || status === 'reserved') {
            toast.add('error', '❌ Cannot delete occupied/reserved table')
            return { success: false }
        }

        setLoading(true)
        try {
            const { error } = await supabase
                .from('restaurant_tables')
                .delete()
                .eq('id', id)

            if (error) throw error
            toast.add('success', '✅ Table deleted!')
            return { success: true }
        } catch (error: any) {
            toast.add('error', `❌ ${error.message}`)
            return { success: false, error: error.message }
        } finally {
            setLoading(false)
        }
    }, [supabase, toast])

    // ✅ Transfer table (move order to another table)
    const transferTable = useCallback(async (fromTableId: string, toTableId: string, orderId: string, waiterId?: string) => {
        setLoading(true)
        try {
            // Free old table
            await supabase
                .from('restaurant_tables')
                .update({ status: 'available', current_order_id: null, waiter_id: null })
                .eq('id', fromTableId)

            // Occupy new table
            await supabase
                .from('restaurant_tables')
                .update({ status: 'occupied', current_order_id: orderId, waiter_id: waiterId || null })
                .eq('id', toTableId)

            // Update order
            await supabase
                .from('orders')
                .update({ table_id: toTableId })
                .eq('id', orderId)

            toast.add('success', '✅ Table transferred!')
            return { success: true }
        } catch (error: any) {
            toast.add('error', `❌ ${error.message}`)
            return { success: false, error: error.message }
        } finally {
            setLoading(false)
        }
    }, [supabase, toast])

    return { createTable, updateTable, deleteTable, transferTable, loading }
}