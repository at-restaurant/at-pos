// src/app/(public)/test-menu/page.tsx
'use client'

import { useEffect, useState } from 'react'
import { db } from '@/lib/db/dexie'

export default function TestMenuPage() {
    const [menuItems, setMenuItems] = useState<any[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        const fetchMenuItems = async () => {
            try {
                const items = await db.menu_items.where('is_available').equals(true).toArray()
                setMenuItems(items)
                console.log('Fetched menu items:', items)
            } catch (error) {
                console.error('Error fetching menu items:', error)
            } finally {
                setLoading(false)
            }
        }
        fetchMenuItems()
    }, [])

    return (
        <div>
            <h1>Test Menu Page</h1>
            {loading ? (
                <p>Loading...</p>
            ) : (
                <div>
                    <p>Found {menuItems.length} menu items.</p>
                    <pre>{JSON.stringify(menuItems, null, 2)}</pre>
                </div>
            )}
        </div>
    )
}
