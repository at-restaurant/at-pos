// src/components/OfflineInitializer.tsx - COMPLETE FIXED VERSION
'use client'

import { useEffect } from 'react'
import { offlineManager } from '@/lib/db/offlineManager'
import { scheduleAutoClose } from '@/lib/utils/autoClose'
import { db } from '@/lib/db/indexedDB'
import { STORES } from '@/lib/db/schema'
import { generateOrderUUID } from '@/lib/utils/deviceId'

export default function OfflineInitializer() {
    useEffect(() => {
        const initializeOfflineData = async () => {
            try {
                scheduleAutoClose()

                // Background migration: Add order_uuid to legacy offline orders
                const allOrders = await db.getAll(STORES.ORDERS) as any[]
                for (const order of allOrders) {
                    if (!order.order_uuid) {
                        const newUuid = await generateOrderUUID()
                        await db.put(STORES.ORDERS, { ...order, order_uuid: newUuid })
                    }
                }
            } catch (migErr) {
                console.error("Failed to run startup migration", migErr)
            }

            if (typeof navigator === 'undefined' || !navigator.onLine) {
                return
            }

            try {
                // ✅ Force sync on app load to clear stale data
                const result = await offlineManager.downloadAllData(true)


                if (result?.success) {
                    console.log('✅ Offline data synced on load:', {
                        categories: result.counts?.categories || 0,
                        items: result.counts?.items || 0,
                        tables: result.counts?.tables || 0,
                        waiters: result.counts?.waiters || 0
                    })
                }
            } catch (error) {
                console.error('❌ Failed to initialize offline data:', error)
            }
        }

        initializeOfflineData()
    }, [])

    return null
}