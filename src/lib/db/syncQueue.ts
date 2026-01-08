import { db } from './indexedDB'
import { STORES, SyncQueueItem } from './schema'

export async function addToQueue(action: SyncQueueItem['action'], table: string, data: any) {
    const item: SyncQueueItem = {
        id: `${Date.now()}_${Math.random().toString(36)}`,
        action,
        table,
        data,
        timestamp: Date.now(),
        status: 'pending',
        retries: 0
    }
    await db.put(STORES.SYNC_QUEUE, item)
    return item.id
}

export async function getPendingQueue() {
    const items = await db.getAll(STORES.SYNC_QUEUE) as SyncQueueItem[]
    return items.filter(i => i.status === 'pending').sort((a, b) => a.timestamp - b.timestamp)
}

export async function updateQueueStatus(id: string, status: SyncQueueItem['status']) {
    const item = await db.get(STORES.SYNC_QUEUE, id) as SyncQueueItem
    if (item) {
        item.status = status
        if (status === 'failed') item.retries++
        await db.put(STORES.SYNC_QUEUE, item)
    }
}

export async function removeFromQueue(id: string) {
    await db.delete(STORES.SYNC_QUEUE, id)
}

export async function clearQueue() {
    await db.clear(STORES.SYNC_QUEUE)
}