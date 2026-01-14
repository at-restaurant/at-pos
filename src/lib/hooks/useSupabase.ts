// src/lib/hooks/useSupabase.ts - ADMIN ONLY (No Dexie)
'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

function ensureArray<T>(data: any): T[] {
    if (Array.isArray(data)) return data
    if (data === null || data === undefined) return []
    if (typeof data === 'object' && 'data' in data && Array.isArray(data.data)) return data.data
    return []
}

export function useSupabase<T = any>(
    table: string,
    options?: {
        select?: string
        filter?: Record<string, any>
        order?: { column: string; ascending?: boolean }
        realtime?: boolean
    }
) {
    const [data, setData] = useState<T[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const supabase = createClient()

    const load = async () => {
        setLoading(true)
        setError(null)

        try {
            let query = supabase.from(table).select(options?.select || '*')

            if (options?.filter) {
                Object.entries(options.filter).forEach(([key, value]) => {
                    query = query.eq(key, value)
                })
            }

            if (options?.order) {
                query = query.order(options.order.column, {
                    ascending: options.order.ascending ?? true
                })
            }

            const { data: result, error: err } = await query

            if (err) throw err

            const validData = ensureArray<T>(result)
            setData(validData)
        } catch (err: any) {
            const errorMsg = err.message || 'Failed to load data'
            setError(errorMsg)
            console.error(`Error loading ${table}:`, err)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        load()

        let channel: any
        if (options?.realtime && navigator.onLine) {
            channel = supabase
                .channel(`${table}_changes`)
                .on('postgres_changes', {
                    event: '*',
                    schema: 'public',
                    table
                }, load)
                .subscribe()
        }

        return () => {
            if (channel) supabase.removeChannel(channel)
        }
    }, [table, JSON.stringify(options)])

    const insert = async (values: Partial<T>) => {
        const { error } = await supabase.from(table).insert(values)
        if (!error) load()
        return { error }
    }

    const update = async (id: string, values: Partial<T>) => {
        const { error } = await supabase.from(table).update(values).eq('id', id)
        if (!error) load()
        return { error }
    }

    const remove = async (id: string) => {
        const { error } = await supabase.from(table).delete().eq('id', id)
        if (!error) load()
        return { error }
    }

    return {
        data,
        loading,
        error,
        isOffline: false, // Admin is always online
        isMounted: true,
        refresh: load,
        insert,
        update,
        remove
    }
}