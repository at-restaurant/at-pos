// src/lib/hooks/useInventoryItems.ts - INVENTORY HOOK FOR ADMIN
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

interface UseInventoryOptions {
    table?: string
}

export function useInventoryItems(options?: UseInventoryOptions) {
    const [data, setData] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const supabase = createClient()

    const tableName = options?.table || 'inventory_items'

    const load = async () => {
        setLoading(true)
        setError(null)

        try {
            let query = supabase.from(tableName).select('*')

            // Add relations for inventory_items
            if (tableName === 'inventory_items') {
                query = supabase
                    .from('inventory_items')
                    .select(`
                        *,
                        inventory_categories(id, name, icon)
                    `)
                    .order('name')
            } else if (tableName === 'inventory_categories') {
                query = query.order('name')
            }

            const { data: result, error: err } = await query

            if (err) throw err

            // Calculate total_value for inventory items
            if (tableName === 'inventory_items' && result) {
                const enriched = result.map((item: any) => ({
                    ...item,
                    total_value: (item.quantity || 0) * (item.purchase_price || 0)
                }))
                setData(enriched)
            } else {
                setData(result || [])
            }
        } catch (err: any) {
            setError(err.message)
            console.error('Load inventory error:', err)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        load()
    }, [tableName])

    const refresh = () => load()

    return { data, loading, error, refresh }
}

export function useInventorySync(callback: () => void) {
    const supabase = createClient()

    useEffect(() => {
        const channel = supabase
            .channel('inventory_changes')
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'inventory_items'
            }, callback)
            .subscribe()

        return () => {
            supabase.removeChannel(channel)
        }
    }, [callback])
}