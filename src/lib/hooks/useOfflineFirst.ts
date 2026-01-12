// src/lib/hooks/useOfflineFirst.ts - PRODUCTION READY
'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { db, dbHelpers } from '@/lib/db/dexie'
import { compressImageFromURL } from '@/lib/db/dexie'

interface UseOfflineFirstOptions {
    table: string
    select?: string
    filter?: Record<string, any>
    orderBy?: { column: string; ascending?: boolean }
    limit?: number
    realtime?: boolean
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// HELPER: Convert boolean to number for Dexie
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
const toBooleanNumber = (value: any): any => {
    return typeof value === 'boolean' ? (value ? 1 : 0) : value
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// HELPER: Convert Dexie item booleans
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
const convertBooleanFields = (item: Record<string, any>): Record<string, any> => {
    const converted: Record<string, any> = {}
    const boolFields = ['is_available', 'is_active', 'is_on_duty', 'receipt_printed', 'synced']

    for (const key in item) {
        if (boolFields.includes(key) && typeof item[key] === 'boolean') {
            converted[key] = item[key] ? 1 : 0
        } else {
            converted[key] = item[key]
        }
    }

    return converted
}

export function useOfflineFirst<T = any>(options: UseOfflineFirstOptions) {
    const [data, setData] = useState<T[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [isOffline, setIsOffline] = useState(false)
    const [isSyncing, setIsSyncing] = useState(false)

    const supabase = createClient()

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // LOAD FROM DEXIE (INSTANT)
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    const loadFromDexie = useCallback(async (): Promise<T[]> => {
        try {
            let dexieTable: any

            // Get correct Dexie table
            switch (options.table) {
                case 'menu_items':
                    dexieTable = db.menu_items
                    break
                case 'menu_categories':
                    dexieTable = db.menu_categories
                    break
                case 'orders':
                    dexieTable = db.orders
                    break
                case 'restaurant_tables':
                    dexieTable = db.restaurant_tables
                    break
                case 'waiters':
                    dexieTable = db.waiters
                    break
                default:
                    return []
            }

            let result: any[] = []

            // Apply filters with boolean conversion
            if (options.filter && Object.keys(options.filter).length > 0) {
                const [firstKey, firstValue] = Object.entries(options.filter)[0]
                const convertedValue = toBooleanNumber(firstValue)

                result = await dexieTable.where(firstKey).equals(convertedValue).toArray()

                // Apply additional filters in memory
                const additionalFilters = Object.entries(options.filter).slice(1)
                if (additionalFilters.length > 0) {
                    result = result.filter(item =>
                        additionalFilters.every(([key, value]) => {
                            const convertedVal = toBooleanNumber(value)
                            return item[key] === convertedVal
                        })
                    )
                }
            } else {
                result = await dexieTable.toArray()
            }

            // Apply sorting
            if (options.orderBy) {
                const { column, ascending = true } = options.orderBy
                result.sort((a: any, b: any) => {
                    const aVal = a[column]
                    const bVal = b[column]
                    const direction = ascending ? 1 : -1

                    if (aVal < bVal) return -direction
                    if (aVal > bVal) return direction
                    return 0
                })
            }

            // Apply limit
            if (options.limit) {
                result = result.slice(0, options.limit)
            }

            return result as T[]
        } catch (err) {
            console.error('Dexie load error:', err)
            return []
        }
    }, [options.table, JSON.stringify(options.filter), JSON.stringify(options.orderBy), options.limit])

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // SAVE TO DEXIE
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    const saveToDexie = useCallback(async (items: any[]): Promise<void> => {
        if (!items || items.length === 0) return

        try {
            switch (options.table) {
                case 'menu_items': {
                    const compressed = await Promise.all(
                        items.map(async (item) => {
                            const converted = convertBooleanFields(item)

                            if (converted.image_url && !converted.image_url.startsWith('data:')) {
                                try {
                                    const compressedImg = await compressImageFromURL(converted.image_url, 800)
                                    converted.compressed_image = compressedImg || undefined
                                } catch {
                                    // Skip compression on error
                                }
                            }

                            return converted
                        })
                    )
                    await db.menu_items.bulkPut(compressed as any)
                    break
                }

                case 'menu_categories': {
                    const converted = items.map(convertBooleanFields)
                    await db.menu_categories.bulkPut(converted as any)
                    break
                }

                case 'orders': {
                    const converted = items.map(convertBooleanFields)
                    await db.orders.bulkPut(converted as any)
                    break
                }

                case 'restaurant_tables': {
                    const converted = items.map(convertBooleanFields)
                    await db.restaurant_tables.bulkPut(converted as any)
                    break
                }

                case 'waiters': {
                    const converted = items.map(convertBooleanFields)
                    await db.waiters.bulkPut(converted as any)
                    break
                }
            }

            // Update last sync timestamp
            await db.settings.put({
                key: `${options.table}_last_sync`,
                value: Date.now(),
                updated_at: new Date().toISOString()
            })
        } catch (err) {
            console.error('Dexie save error:', err)
        }
    }, [options.table])

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // SYNC WITH SUPABASE (BACKGROUND)
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    const syncWithSupabase = useCallback(async (): Promise<void> => {
        if (typeof window === 'undefined' || !navigator.onLine) return

        setIsSyncing(true)

        try {
            let query = supabase.from(options.table).select(options.select || '*')

            // Apply filters
            if (options.filter) {
                Object.entries(options.filter).forEach(([key, value]) => {
                    query = query.eq(key, value)
                })
            }

            // Apply ordering
            if (options.orderBy) {
                query = query.order(options.orderBy.column, {
                    ascending: options.orderBy.ascending ?? true
                })
            }

            // Apply limit
            if (options.limit) {
                query = query.limit(options.limit)
            }

            const { data: supabaseData, error: supabaseError } = await query

            if (supabaseError) throw supabaseError

            if (supabaseData && supabaseData.length > 0) {
                // Save to Dexie
                await saveToDexie(supabaseData)

                // Update UI
                setData(supabaseData as T[])
                setIsOffline(false)
            }
        } catch (err: any) {
            console.error('Supabase sync error:', err)
            setError(err.message)
        } finally {
            setIsSyncing(false)
        }
    }, [options.table, options.select, options.filter, options.orderBy, options.limit, supabase, saveToDexie])

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // MAIN LOAD FUNCTION
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    const load = useCallback(async (): Promise<void> => {
        setLoading(true)
        setError(null)

        try {
            // 1️⃣ Load from Dexie first (instant UI)
            const dexieData = await loadFromDexie()

            if (dexieData.length > 0) {
                setData(dexieData)
                setLoading(false)
            }

            // 2️⃣ Sync with Supabase in background (if online)
            if (typeof window !== 'undefined' && navigator.onLine) {
                await syncWithSupabase()
            } else {
                setIsOffline(true)
                if (dexieData.length === 0) {
                    setError('No cached data available offline')
                }
            }
        } catch (err: any) {
            setError(err.message)
            console.error('Load error:', err)
        } finally {
            setLoading(false)
        }
    }, [loadFromDexie, syncWithSupabase])

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // EFFECTS
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    useEffect(() => {
        if (typeof window === 'undefined') return

        // Set initial online status
        setIsOffline(!navigator.onLine)

        load()

        // Network status listeners
        const handleOnline = () => {
            setIsOffline(false)
            syncWithSupabase()
        }

        const handleOffline = () => {
            setIsOffline(true)
        }

        window.addEventListener('online', handleOnline)
        window.addEventListener('offline', handleOffline)

        // Realtime subscription
        let channel: any
        if (options.realtime && navigator.onLine) {
            channel = supabase
                .channel(`${options.table}_changes`)
                .on('postgres_changes', {
                    event: '*',
                    schema: 'public',
                    table: options.table
                }, () => {
                    load()
                })
                .subscribe()
        }

        return () => {
            window.removeEventListener('online', handleOnline)
            window.removeEventListener('offline', handleOffline)
            if (channel) supabase.removeChannel(channel)
        }
    }, [load, syncWithSupabase, options.realtime, options.table, supabase])

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // CRUD OPERATIONS
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    const insert = useCallback(async (values: Partial<T>): Promise<{ error: any }> => {
        try {
            if (typeof window !== 'undefined' && navigator.onLine) {
                const { error } = await supabase.from(options.table).insert(values as any)
                if (!error) {
                    await load()
                }
                return { error }
            } else {
                await dbHelpers.addToQueue(options.table, 'create', values)
                await load()
                return { error: null }
            }
        } catch (err: any) {
            return { error: err }
        }
    }, [options.table, supabase, load])

    const update = useCallback(async (id: string, values: Partial<T>): Promise<{ error: any }> => {
        try {
            if (typeof window !== 'undefined' && navigator.onLine) {
                const { error } = await supabase
                    .from(options.table)
                    .update(values as any)
                    .eq('id', id)

                if (!error) {
                    await load()
                }
                return { error }
            } else {
                await dbHelpers.addToQueue(options.table, 'update', { id, ...values })
                await load()
                return { error: null }
            }
        } catch (err: any) {
            return { error: err }
        }
    }, [options.table, supabase, load])

    const remove = useCallback(async (id: string): Promise<{ error: any }> => {
        try {
            if (typeof window !== 'undefined' && navigator.onLine) {
                const { error } = await supabase
                    .from(options.table)
                    .delete()
                    .eq('id', id)

                if (!error) {
                    await load()
                }
                return { error }
            } else {
                await dbHelpers.addToQueue(options.table, 'delete', { id })
                await load()
                return { error: null }
            }
        } catch (err: any) {
            return { error: err }
        }
    }, [options.table, supabase, load])

    return {
        data,
        loading,
        error,
        isOffline,
        isSyncing,
        refresh: load,
        insert,
        update,
        remove
    }
}

export default useOfflineFirst