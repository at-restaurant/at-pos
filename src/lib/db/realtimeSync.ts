// src/lib/db/realtimeSync.ts - DEPRECATED (Use syncManager instead)
// This file is kept for backward compatibility only

import { syncManager } from './syncManager'

export class RealtimeSync {
    async syncAll() {
        return await syncManager.syncAll()
    }

    async getPendingCount() {
        return await syncManager.getPendingCount()
    }

    destroy() {
        // No-op
    }
}

export const realtimeSync = new RealtimeSync()

export default realtimeSync