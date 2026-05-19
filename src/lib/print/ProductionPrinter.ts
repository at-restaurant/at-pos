// src/lib/print/ProductionPrinter.ts
// ✅ PRODUCTION-READY: Queue, Retry, Offline Support, Error Recovery

import { ReceiptData, PrintResponse } from '@/types'
import { thermalPrinter } from './ThermalPrinter'
import { db } from '@/lib/db/indexedDB'
import { STORES } from '@/lib/db/schema'

interface QueuedPrint {
    id: string
    receipt: ReceiptData
    attempts: number
    status: 'pending' | 'printing' | 'failed' | 'completed'
    created_at: string
    last_attempt?: string
    error?: string
}

const MAX_RETRIES = 3
const RETRY_DELAY = 2000 // 2 seconds

export class ProductionPrinter {
    private queue: QueuedPrint[] = []
    private isProcessing: boolean = false
    private retryTimeout: NodeJS.Timeout | null = null

    constructor() {
        if (typeof window !== 'undefined') {
            this.initPrintQueue()
            this.setupEventListeners()
        }
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // INITIALIZATION
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

    private async initPrintQueue() {
        try {
            // Load pending prints from IndexedDB
            const stored = await db.getAll(STORES.SETTINGS) as any[]
            const queueData = stored.find(item => item.key === 'print_queue')

            if (queueData?.value) {
                this.queue = queueData.value
                console.log(`📋 Loaded ${this.queue.length} pending prints from queue`)

                // Start processing if online
                if (navigator.onLine) {
                    this.processQueue()
                }
            }
        } catch (error) {
            console.error('Failed to load print queue:', error)
        }
    }

    private setupEventListeners() {
        // Auto-process when coming online
        window.addEventListener('online', () => {
            console.log('🌐 Back online - processing print queue')
            this.processQueue()
        })

        // Save queue before page unload
        window.addEventListener('beforeunload', () => {
            this.saveQueue()
        })

        // Process queue periodically (every 30 seconds)
        setInterval(() => {
            if (navigator.onLine && this.queue.some(q => q.status === 'pending' || q.status === 'failed')) {
                this.processQueue()
            }
        }, 30000)
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // MAIN PRINT METHOD (PUBLIC API)
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

    async print(receipt: ReceiptData): Promise<PrintResponse> {
        const printId = `print_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

        console.log('🖨️ Print request:', receipt.orderNumber)

        // ✅ ALWAYS try immediate print first — browser print dialog works offline
        // (It only renders local HTML/CSS, no network needed)
        try {
            const result = await thermalPrinter.print(receipt)

            if (result.success) {
                console.log('✅ Print successful')
                // If online, no need to queue. If offline, receipt printed directly.
                return result
            } else {
                // Browser print was cancelled or failed
                if (!navigator.onLine) {
                    // Offline + cancelled: queue for when online
                    console.log('📴 Print cancelled offline - queuing')
                    await this.addToQueue(printId, receipt)
                    return {
                        success: true,
                        message: '📴 Print queued - will print when online',
                        orderNumber: receipt.orderNumber
                    }
                }
                // Online + cancelled/failed: queue for retry
                console.log('⚠️ Print failed - adding to retry queue')
                await this.addToQueue(printId, receipt)
                return {
                    success: true,
                    message: '⚠️ Print queued for retry',
                    orderNumber: receipt.orderNumber
                }
            }
        } catch (error: any) {
            console.error('❌ Print error:', error)

            // Queue for retry / when online
            await this.addToQueue(printId, receipt)

            return {
                success: true,
                message: navigator.onLine ? '⚠️ Print queued for retry' : '📴 Print queued for when online',
                orderNumber: receipt.orderNumber
            }
        }
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // QUEUE MANAGEMENT
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

    private async addToQueue(id: string, receipt: ReceiptData) {
        const queueItem: QueuedPrint = {
            id,
            receipt,
            attempts: 0,
            status: 'pending',
            created_at: new Date().toISOString()
        }

        this.queue.push(queueItem)
        await this.saveQueue()

        console.log(`📋 Added to queue (${this.queue.length} total)`)

        // Try to process immediately if online
        if (navigator.onLine && !this.isProcessing) {
            setTimeout(() => this.processQueue(), 100)
        }
    }

    private async processQueue() {
        if (this.isProcessing) {
            console.log('⏳ Queue already processing')
            return
        }

        if (!navigator.onLine) {
            console.log('📴 Offline - skipping queue processing')
            return
        }

        const pending = this.queue.filter(
            q => q.status === 'pending' || (q.status === 'failed' && q.attempts < MAX_RETRIES)
        )

        if (pending.length === 0) {
            console.log('✅ Queue empty')
            return
        }

        this.isProcessing = true
        console.log(`🔄 Processing ${pending.length} queued prints`)

        for (const item of pending) {
            await this.processQueueItem(item)

            // Small delay between prints
            await new Promise(resolve => setTimeout(resolve, 500))
        }

        this.isProcessing = false
        await this.saveQueue()

        // Clean up completed items older than 1 hour
        await this.cleanupQueue()
    }

    private async processQueueItem(item: QueuedPrint) {
        item.status = 'printing'
        item.attempts++
        item.last_attempt = new Date().toISOString()

        console.log(`🖨️ Printing ${item.receipt.orderNumber} (attempt ${item.attempts}/${MAX_RETRIES})`)

        try {
            const result = await thermalPrinter.print(item.receipt)

            if (result.success) {
                item.status = 'completed'
                console.log(`✅ Print successful: ${item.receipt.orderNumber}`)

                // Show success toast
                this.dispatchToast('success', `✅ Receipt printed: ${item.receipt.orderNumber}`)
            } else {
                throw new Error(result.error || 'Print failed')
            }
        } catch (error: any) {
            console.error(`❌ Print failed (attempt ${item.attempts}):`, error)

            item.error = error.message

            if (item.attempts >= MAX_RETRIES) {
                item.status = 'failed'
                console.log(`🚫 Max retries reached for ${item.receipt.orderNumber}`)

                // Show error toast
                this.dispatchToast('error', `❌ Print failed after ${MAX_RETRIES} attempts: ${item.receipt.orderNumber}`)
            } else {
                item.status = 'pending'
                console.log(`🔄 Will retry ${item.receipt.orderNumber}`)
            }
        }
    }

    private async saveQueue() {
        try {
            await db.put(STORES.SETTINGS, {
                key: 'print_queue',
                value: this.queue
            })
        } catch (error) {
            console.error('Failed to save print queue:', error)
        }
    }

    private async cleanupQueue() {
        const oneHourAgo = Date.now() - 60 * 60 * 1000

        this.queue = this.queue.filter(item => {
            // Keep pending and failed items
            if (item.status === 'pending' || item.status === 'failed') {
                return true
            }

            // Keep recent completed items
            const createdAt = new Date(item.created_at).getTime()
            return createdAt > oneHourAgo
        })

        await this.saveQueue()
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // TEST PRINT
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

    async testPrint(): Promise<PrintResponse> {
        const testReceipt: ReceiptData = {
            restaurantName: 'AT RESTAURANT',
            tagline: '🧪 TEST PRINT',
            address: 'Sooter Mills Rd, Lahore',
            orderNumber: 'TEST-' + Date.now().toString().slice(-6),
            date: new Date().toLocaleString('en-PK'),
            orderType: 'dine-in',
            tableNumber: 5,
            waiter: 'Test Waiter',
            items: [
                {
                    name: 'Test Item',
                    quantity: 1,
                    price: 100,
                    total: 100,
                    category: '🧪 Test'
                }
            ],
            subtotal: 100,
            tax: 5,
            total: 105,
            paymentMethod: 'cash'
        }

        return this.print(testReceipt)
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // STATUS & MANAGEMENT
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

    getQueueStatus() {
        const pending = this.queue.filter(q => q.status === 'pending').length
        const failed = this.queue.filter(q => q.status === 'failed').length
        const printing = this.queue.filter(q => q.status === 'printing').length

        return {
            current: printing,
            pending: pending,
            failed: failed,
            total: this.queue.length,
            isPrinting: this.isProcessing
        }
    }

    async retryFailed() {
        const failed = this.queue.filter(q => q.status === 'failed')

        for (const item of failed) {
            item.status = 'pending'
            item.attempts = 0
            item.error = undefined
        }

        await this.saveQueue()

        if (navigator.onLine) {
            this.processQueue()
        }

        return { retried: failed.length }
    }

    async clearCompleted() {
        const before = this.queue.length
        this.queue = this.queue.filter(q => q.status !== 'completed')
        await this.saveQueue()

        const cleared = before - this.queue.length
        console.log(`🗑️ Cleared ${cleared} completed prints`)

        return { cleared }
    }

    async clearQueue() {
        this.queue = []
        await this.saveQueue()
        console.log('🗑️ Queue cleared')
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // UTILITIES
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

    private dispatchToast(type: 'success' | 'error' | 'warning', message: string) {
        if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('toast-add', {
                detail: { type, message }
            }))
        }
    }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// SINGLETON INSTANCE
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

let printerInstance: ProductionPrinter | null = null

export const productionPrinter = (() => {
    if (typeof window === 'undefined') {
        return {
            print: async () => ({ success: false, error: 'SSR mode' }),
            testPrint: async () => ({ success: false, error: 'SSR mode' }),
            getQueueStatus: () => ({ current: 0, pending: 0, failed: 0, total: 0, isPrinting: false }),
            retryFailed: async () => ({ retried: 0 }),
            clearCompleted: async () => ({ cleared: 0 }),
            clearQueue: async () => {}
        } as any
    }

    if (!printerInstance) {
        printerInstance = new ProductionPrinter()
    }
    return printerInstance
})()