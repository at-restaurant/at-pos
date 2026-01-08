// src/components/OfflineInitializer.tsx - COMPLETE FIXED VERSION
'use client'

import { useEffect } from 'react'
import { offlineManager } from '@/lib/db/offlineManager'

export default function OfflineInitializer() {
    useEffect(() => {
        const initializeOfflineData = async () => {
            if (typeof navigator === 'undefined' || !navigator.onLine) {
                return
            }

            try {
                // ✅ Force sync on app load to clear stale data
                const result = await offlineManager.downloadEssentialData(true)

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