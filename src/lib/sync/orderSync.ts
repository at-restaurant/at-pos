import { createClient } from '@/lib/supabase/client'
import { db } from '@/lib/db/indexedDB'
import { STORES } from '@/lib/db/schema'

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