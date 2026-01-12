// src/lib/hooks/useOfflineFirst.ts - FULLY FIXED (SSR + IDBKeyRange)
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

export function useOfflineFirst<T = any>(options: UseOfflineFirstOptions) {
    const [data, setData] = useState<T[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [isOffline, setIsOffline] = useState(false) // ✅ SSR-safe default
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

            let query = dexieTable

            // ✅ FIX: Apply filters with boolean→number conversion
            if (options.filter) {
                Object.entries(options.filter).forEach(([key, value]) => {
                    // Convert boolean to number for Dexie (true→1, false→0)
                    const filterValue = typeof value === 'boolean' ? (value ? 1 : 0) : value
                    query = query.where(key).equals(filterValue)
                })
            }

            let result = await query.toArray()

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
        } catch (error) {
            console.error('Dexie load failed:', error)
            return []
        }
    }, [options.table, JSON.stringify(options.filter), JSON.stringify(options.orderBy), options.limit])

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // SYNC WITH SUPABASE (BACKGROUND)
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    const syncWithSupabase = useCallback(async () => {
        // ✅ FIX: Check if we're in browser before using navigator
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
                // Update Dexie with fresh data
                await saveToDexie(supabaseData)

                // Update UI
                setData(supabaseData as T[])
                setIsOffline(false)
            }
        } catch (error: any) {
            console.error('Supabase sync failed:', error)
            setError(error.message)
        } finally {
            setIsSyncing(false)
        }
    }, [options.table, options.select, JSON.stringify(options.filter), JSON.stringify(options.orderBy), options.limit])

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // SAVE TO DEXIE
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    const saveToDexie = async (items: any[]) => {
        try {
            switch (options.table) {
                case 'menu_items':
                    // Compress images for offline
                    const compressedItems = await Promise.all(
                        items.map(async (item) => {
                            if (item.image_url && !item.image_url.startsWith('data:')) {
                                const compressed = await compressImageFromURL(item.image_url, 800)
                                return {
                                    ...item,
                                    compressed_image: compressed || undefined
                                }
                            }
                            return item
                        })
                    )
                    await db.menu_items.bulkPut(compressedItems)
                    break

                case 'menu_categories':
                    await db.menu_categories.bulkPut(items)
                    break

                case 'orders':
                    await db.orders.bulkPut(items)
                    break

                case 'restaurant_tables':
                    await db.restaurant_tables.bulkPut(items)
                    break

                case 'waiters':
                    await db.waiters.bulkPut(items)
                    break
            }

            // Update last sync timestamp
            await db.settings.put({
                key: `${options.table}_last_sync`,
                value: Date.now(),
                updated_at: new Date().toISOString()
            })
        } catch (error) {
            console.error('Save to Dexie failed:', error)
        }
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // MAIN LOAD FUNCTION
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    const load = useCallback(async () => {
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
            // ✅ FIX: Check if we're in browser before using navigator
            if (typeof window !== 'undefined' && navigator.onLine) {
                await syncWithSupabase()
            } else {
                setIsOffline(true)
                if (dexieData.length === 0) {
                    setError('No cached data available offline')
                }
            }
        } catch (error: any) {
            setError(error.message)
            console.error('Load failed:', error)
        } finally {
            setLoading(false)
        }
    }, [loadFromDexie, syncWithSupabase])

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // EFFECTS
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    useEffect(() => {
        // ✅ FIX: Only run in browser
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
    }, [load, syncWithSupabase, options.realtime, options.table])

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // CRUD OPERATIONS
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    const insert = async (values: Partial<T>) => {
        try {
            // ✅ FIX: Check if we're in browser
            if (typeof window !== 'undefined' && navigator.onLine) {
                const { error } = await supabase.from(options.table).insert(values)
                if (!error) {
                    await load()
                }
                return { error }
            } else {
                // Offline insert - queue for sync
                await dbHelpers.addToQueue(options.table, 'create', values)
                await load()
                return { error: null }
            }
        } catch (error: any) {
            return { error }
        }
    }

    const update = async (id: string, values: Partial<T>) => {
        try {
            // ✅ FIX: Check if we're in browser
            if (typeof window !== 'undefined' && navigator.onLine) {
                const { error } = await supabase
                    .from(options.table)
                    .update(values)
                    .eq('id', id)

                if (!error) {
                    await load()
                }
                return { error }
            } else {
                // Offline update - queue for sync
                await dbHelpers.addToQueue(options.table, 'update', { id, ...values })
                await load()
                return { error: null }
            }
        } catch (error: any) {
            return { error }
        }
    }

    const remove = async (id: string) => {
        try {
            // ✅ FIX: Check if we're in browser
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
                // Offline delete - queue for sync
                await dbHelpers.addToQueue(options.table, 'delete', { id })
                await load()
                return { error: null }
            }
        } catch (error: any) {
            return { error }
        }
    }

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