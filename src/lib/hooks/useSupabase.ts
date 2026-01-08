// src/lib/hooks/useSupabase.ts - FIXED ARRAY VALIDATION
'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { offlineManager } from '@/lib/db/offlineManager'
import { STORES } from '@/lib/db/schema'

// ✅ SAFE ARRAY VALIDATOR
function ensureArray<T>(data: any): T[] {
    if (Array.isArray(data)) return data
    if (data === null || data === undefined) return []
    if (typeof data === 'object' && 'data' in data && Array.isArray(data.data)) return data.data
    console.warn('⚠️ Data is not an array:', typeof data)
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
    const [isOffline, setIsOffline] = useState(false)
    const [isMounted, setIsMounted] = useState(false)
    const supabase = createClient()

    const getStoreName = (tableName: string) => {
        const map: Record<string, string> = {
            'menu_items': STORES.MENU_ITEMS,
            'menu_categories': STORES.MENU_CATEGORIES,
            'restaurant_tables': 'restaurant_tables',
            'waiters': 'waiters'
        }
        return map[tableName] || tableName
    }

    const load = async () => {
        if (typeof window === 'undefined') return

        setLoading(true)
        setError(null)

        try {
            const online = typeof navigator !== 'undefined' && navigator.onLine

            if (online) {
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

                // ✅ VALIDATE RESULT
                const validData = ensureArray<T>(result)
                setData(validData)
                setIsOffline(false)
            } else {
                throw new Error('Offline')
            }
        } catch (err: any) {
        console.log(`📴 Offline mode for ${table}`)

            try {
                const storeName = getStoreName(table)
                const offlineData = await offlineManager.getOfflineData(storeName)

                // ✅ VALIDATE OFFLINE DATA
                let filtered = ensureArray<T>(offlineData)

                // Apply filters
                if (options?.filter) {
                    filtered = filtered.filter(item =>
                        Object.entries(options.filter!).every(([key, value]) =>
                            (item as any)[key] === value
                        )
                    )
                }

                // Apply sorting
                if (options?.order) {
                    filtered.sort((a, b) => {
                        const aVal = (a as any)[options.order!.column]
                        const bVal = (b as any)[options.order!.column]
                        const direction = options.order!.ascending ?? true ? 1 : -1

                        if (aVal < bVal) return -direction
                        if (aVal > bVal) return direction
                        return 0
                    })
                }

                setData(filtered)
                setIsOffline(true)
                setError(null)
            } catch (offlineErr) {
                console.error('Offline load failed:', offlineErr) // ✅ FIXED
                setError('No offline data available')
                setData([])
            }
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        setIsMounted(true)
        if (typeof navigator !== 'undefined') {
            setIsOffline(!navigator.onLine)
        }

        load()

        if (typeof window === 'undefined') return

        const handleOnline = () => {
            setIsOffline(false)
            load()
        }
        const handleOffline = () => setIsOffline(true)

        window.addEventListener('online', handleOnline)
        window.addEventListener('offline', handleOffline)

        let channel: any
        if (options?.realtime && typeof navigator !== 'undefined' && navigator.onLine) {
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
            window.removeEventListener('online', handleOnline)
            window.removeEventListener('offline', handleOffline)
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
        isOffline,
        isMounted,
        refresh: load,
        insert,
        update,
        remove
    }
}