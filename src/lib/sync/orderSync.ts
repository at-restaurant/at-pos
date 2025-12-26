import { createClient } from '@/lib/supabase/client'
import { db } from '@/lib/db/indexedDB'
import { STORES } from '@/lib/db/schema'
import { getPendingQueue, updateQueueStatus, removeFromQueue } from '@/lib/db/syncQueue'

export async function syncOrders() {
    const queue = await getPendingQueue()
    const supabase = createClient()
    let synced = 0
    let failed = 0

    for (const item of queue) {
        try {
            updateQueueStatus(item.id, 'syncing')

            if (item.table === 'orders') {
                if (item.action === 'create') {
                    const { error } = await supabase.from('orders').insert(item.data)
                    if (error) throw error

                    // Update local order as synced
                    const localOrder = await db.get(STORES.ORDERS, item.data.id)
                    if (localOrder) {
                        await db.put(STORES.ORDERS, { ...localOrder, synced: true })
                    }
                }
            }

            await removeFromQueue(item.id)
            synced++
        } catch (error) {
            console.error('Sync failed:', error)
            updateQueueStatus(item.id, 'failed')
            failed++
        }
    }

    return { synced, failed, total: queue.length }
}

export async function downloadMenuData() {
    const supabase = createClient()

    try {
        const [categories, items] = await Promise.all([
            supabase.from('menu_categories').select('*').eq('is_active', true),
            supabase.from('menu_items').select('*').eq('is_available', true)
        ])

        if (categories.data) {
            await db.bulkPut(STORES.MENU_CATEGORIES, categories.data)
        }

        if (items.data) {
            await db.bulkPut(STORES.MENU_ITEMS, items.data)
        }

        await db.put(STORES.SETTINGS, {
            key: 'last_menu_sync',
            value: Date.now()
        })

        return { success: true, count: items.data?.length || 0 }
    } catch (error) {
        console.error('Download failed:', error)
        return { success: false, error }
    }
}