import { db } from '@/lib/db/indexedDB'
import { STORES } from '@/lib/db/schema'

let inMemoryDeviceId: string | null = null;

export async function getDeviceId(): Promise<string> {
    if (inMemoryDeviceId) return inMemoryDeviceId;
    
    try {
        const cached = await db.get(STORES.SETTINGS, 'deviceId') as any
        if (cached && cached.value) {
            inMemoryDeviceId = cached.value;
            return cached.value;
        }

        const newId = crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 15)
        await db.put(STORES.SETTINGS, { key: 'deviceId', value: newId })
        inMemoryDeviceId = newId;
        return newId
    } catch (e) {
        // Fallback if IndexedDB isn't ready
        if (!inMemoryDeviceId) {
            inMemoryDeviceId = Math.random().toString(36).substring(2, 15);
        }
        return inMemoryDeviceId;
    }
}

export async function generateOrderUUID(): Promise<string> {
    const timestamp = Date.now().toString(36)
    const deviceId = await getDeviceId()
    const random = Math.random().toString(36).substring(2, 9)
    return `${deviceId}-${timestamp}-${random}`
}
