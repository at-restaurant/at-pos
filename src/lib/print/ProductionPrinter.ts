// src/lib/print/ProductionPrinter.ts - COMPLETE SSR FIXED
// ✅ Production-ready thermal printer with SSR support

import { ReceiptData, PrintResponse } from '@/types'

interface PrinterConfig {
    name: string
    width: number
    enabled: boolean
    autoPrint: boolean
}

interface PrintJob {
    receipt: ReceiptData
    timestamp: number
    retries: number
}

export class ProductionPrinter {
    private config: PrinterConfig
    private printQueue: ReceiptData[] = []
    private isPrinting: boolean = false

    constructor() {
        // ✅ FIX: Check if window exists (SSR safety)
        if (typeof window !== 'undefined') {
            const saved = localStorage.getItem('printer_config')
            this.config = saved ? JSON.parse(saved) : this.getDefaultConfig()
        } else {
            this.config = this.getDefaultConfig()
        }
    }

    // ✅ FIX: Default config method
    private getDefaultConfig(): PrinterConfig {
        return {
            name: 'Generic / Text Only',
            width: 42,
            enabled: true,
            autoPrint: true
        }
    }

    async print(receipt: ReceiptData): Promise<PrintResponse> {
        console.log('🖨️ Print job:', receipt.orderNumber)

        try {
            if (!this.isPrinterAvailable()) {
                return this.handleOfflinePrint(receipt)
            }

            this.printQueue.push(receipt)
            return await this.processQueue()

        } catch (error: any) {
            console.error('❌ Print failed:', error)
            return {
                success: false,
                error: error.message,
                orderNumber: receipt.orderNumber
            }
        }
    }

    private async processQueue(): Promise<PrintResponse> {
        if (this.isPrinting || this.printQueue.length === 0) {
            return { success: true, message: 'Queued' }
        }

        this.isPrinting = true
        const receipt = this.printQueue[0]

        try {
            const printContent = this.formatReceipt(receipt)

            const iframe = document.createElement('iframe')
            iframe.style.display = 'none'
            document.body.appendChild(iframe)

            const doc = iframe.contentWindow!.document
            doc.open()
            doc.write(this.getPrintHTML(printContent))
            doc.close()

            await new Promise<void>((resolve, reject) => {
                iframe.onload = () => {
                    try {
                        iframe.contentWindow!.focus()
                        iframe.contentWindow!.print()

                        setTimeout(() => {
                            document.body.removeChild(iframe)
                            resolve()
                        }, 500)
                    } catch (err) {
                        reject(err)
                    }
                }
            })

            this.printQueue.shift()
            this.isPrinting = false

            if (this.printQueue.length > 0) {
                setTimeout(() => this.processQueue(), 1000)
            }

            return {
                success: true,
                message: '✅ Printed',
                orderNumber: receipt.orderNumber
            }

        } catch (error: any) {
            this.isPrinting = false
            return {
                success: false,
                error: error.message,
                orderNumber: receipt.orderNumber
            }
        }
    }

    private async handleOfflinePrint(receipt: ReceiptData): Promise<PrintResponse> {
        console.warn('📴 Printer offline - queueing')

        // ✅ FIX: Check window before localStorage
        if (typeof window === 'undefined') {
            return {
                success: false,
                error: 'SSR mode - no storage',
                orderNumber: receipt.orderNumber
            }
        }

        const queue = this.getOfflineQueue()
        queue.push({
            receipt,
            timestamp: Date.now(),
            retries: 0
        })
        localStorage.setItem('print_queue', JSON.stringify(queue))

        this.showNotification('⚠️ Printer offline - will retry', 'warning')

        return {
            success: false,
            error: 'Queued for retry',
            orderNumber: receipt.orderNumber
        }
    }

    async retryFailedPrints(): Promise<{ success: number; failed: number }> {
        // ✅ FIX: SSR safety check
        if (typeof window === 'undefined') {
            return { success: 0, failed: 0 }
        }

        const queue = this.getOfflineQueue()
        let success = 0
        let failed = 0

        for (const job of queue) {
            if (job.retries >= 3) {
                failed++
                continue
            }

            const result = await this.print(job.receipt)
            if (result.success) {
                success++
                this.removeFromOfflineQueue(job.receipt.orderNumber)
            } else {
                job.retries++
                failed++
            }
        }

        const remaining = queue.filter(j => j.retries < 3)
        localStorage.setItem('print_queue', JSON.stringify(remaining))

        return { success, failed }
    }

    private formatReceipt(data: ReceiptData): string {
        const W = this.config.width
        const line = '-'.repeat(W)
        const doubleLine = '='.repeat(W)

        let receipt = '\n'

        receipt += this.center(data.restaurantName || 'AT RESTAURANT', W) + '\n'
        receipt += this.center(data.tagline || 'Delicious Food, Memorable Moments', W) + '\n'
        receipt += line + '\n'
        receipt += this.center(data.address || 'Sooter Mills Rd, Lahore', W) + '\n'
        receipt += doubleLine + '\n\n'

        receipt += `Order #: ${data.orderNumber}\n`
        receipt += `Date: ${data.date}\n`
        receipt += `Type: ${data.orderType === 'delivery' ? 'DELIVERY' : 'DINE-IN'}\n`
        if (data.tableNumber) receipt += `Table: #${data.tableNumber}\n`
        if (data.waiter) receipt += `Waiter: ${data.waiter}\n`
        receipt += line + '\n\n'

        if (data.orderType === 'delivery' && (data.customerName || data.customerPhone)) {
            receipt += 'DELIVERY DETAILS\n' + line + '\n'
            if (data.customerName) receipt += `Name: ${data.customerName}\n`
            if (data.customerPhone) receipt += `Phone: ${data.customerPhone}\n`
            if (data.deliveryAddress) receipt += `Address: ${data.deliveryAddress}\n`
            receipt += line + '\n\n'
        }

        receipt += 'ORDER ITEMS\n' + line + '\n'
        const grouped = this.groupByCategory(data.items)

        Object.entries(grouped).forEach(([category, items]) => {
            receipt += `\n${category}\n`
            items.forEach(item => {
                const itemLine = `${item.quantity}x ${item.name}`
                const price = `PKR ${item.total.toFixed(2)}`
                receipt += this.leftRight(itemLine, price, W) + '\n'
                receipt += `   @ PKR ${item.price.toFixed(2)} each\n`
            })
        })

        receipt += '\n' + doubleLine + '\n'
        receipt += this.leftRight('Subtotal:', `PKR ${data.subtotal.toFixed(2)}`, W) + '\n'
        receipt += this.leftRight('Tax:', `PKR ${data.tax.toFixed(2)}`, W) + '\n'
        if (data.deliveryCharges && data.deliveryCharges > 0) {
            receipt += this.leftRight('Delivery:', `PKR ${data.deliveryCharges.toFixed(2)}`, W) + '\n'
        }
        receipt += line + '\n'
        receipt += this.leftRight('TOTAL:', `PKR ${data.total.toFixed(2)}`, W) + '\n'

        if (data.paymentMethod) {
            receipt += '\n' + this.center(`Payment: ${data.paymentMethod.toUpperCase()}`, W) + '\n'
        }

        if (data.notes) {
            receipt += '\n' + line + '\n'
            receipt += 'Special Instructions:\n'
            receipt += this.wrapText(data.notes, W) + '\n'
        }

        receipt += '\n' + doubleLine + '\n'
        receipt += this.center('Thank you for dining with us!', W) + '\n'
        receipt += this.center('Please visit again', W) + '\n\n'
        receipt += this.center('Powered by AT Restaurant POS', W) + '\n\n\n'

        return receipt
    }

    private getPrintHTML(content: string): string {
        return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Receipt</title>
  <style>
    @page { size: 80mm auto; margin: 0; }
    @media print { body { margin: 0; padding: 0; } }
    body {
      font-family: 'Courier New', monospace;
      font-size: 12px;
      line-height: 1.4;
      padding: 10px;
      margin: 0;
      width: 80mm;
      color: #000;
      background: #fff;
    }
    pre { margin: 0; white-space: pre-wrap; word-wrap: break-word; }
  </style>
</head>
<body>
  <pre>${content}</pre>
  <script>window.onload = () => window.print();</script>
</body>
</html>
    `
    }

    async testPrint(): Promise<PrintResponse> {
        const testReceipt: ReceiptData = {
            restaurantName: 'AT RESTAURANT',
            tagline: '🖨️ Test Print',
            address: 'Sooter Mills Rd, Lahore',
            orderNumber: 'TEST-' + Date.now(),
            date: new Date().toLocaleString('en-PK'),
            orderType: 'dine-in',
            items: [
                { name: 'Test Item 1', quantity: 2, price: 150, total: 300, category: '🍕 Test' },
                { name: 'Test Item 2', quantity: 1, price: 200, total: 200, category: '🍕 Test' }
            ],
            subtotal: 500,
            tax: 25,
            total: 525,
            paymentMethod: 'cash'
        }

        return this.print(testReceipt)
    }

    setConfig(config: Partial<PrinterConfig>) {
        this.config = { ...this.config, ...config }

        // ✅ FIX: Check window before localStorage
        if (typeof window !== 'undefined') {
            localStorage.setItem('printer_config', JSON.stringify(this.config))
        }
    }

    getConfig(): PrinterConfig {
        return { ...this.config }
    }

    private isPrinterAvailable(): boolean {
        return typeof window !== 'undefined' &&
            !!window.print &&
            this.config.enabled &&
            navigator.onLine
    }

    private center(text: string, width: number): string {
        const pad = Math.max(0, Math.floor((width - text.length) / 2))
        return ' '.repeat(pad) + text
    }

    private leftRight(left: string, right: string, width: number): string {
        const spaces = width - left.length - right.length
        return left + ' '.repeat(Math.max(1, spaces)) + right
    }

    private wrapText(text: string, width: number): string {
        const words = text.split(' ')
        const lines: string[] = []
        let currentLine = ''

        words.forEach(word => {
            if ((currentLine + word).length <= width) {
                currentLine += (currentLine ? ' ' : '') + word
            } else {
                lines.push(currentLine)
                currentLine = word
            }
        })
        if (currentLine) lines.push(currentLine)

        return lines.join('\n')
    }

    private groupByCategory(items: any[]): Record<string, any[]> {
        const grouped: Record<string, any[]> = {}
        items.forEach(item => {
            const cat = item.category || '📋 Other'
            if (!grouped[cat]) grouped[cat] = []
            grouped[cat].push(item)
        })
        return grouped
    }

    private getOfflineQueue(): PrintJob[] {
        // ✅ FIX: SSR safety check
        if (typeof window === 'undefined') return []

        const queue = localStorage.getItem('print_queue')
        return queue ? JSON.parse(queue) : []
    }

    private removeFromOfflineQueue(orderNumber: string) {
        // ✅ FIX: SSR safety check
        if (typeof window === 'undefined') return

        const queue = this.getOfflineQueue()
        const filtered = queue.filter(j => j.receipt.orderNumber !== orderNumber)
        localStorage.setItem('print_queue', JSON.stringify(filtered))
    }

    private showNotification(message: string, type: 'success' | 'warning' | 'error') {
        if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('printer-notification', {
                detail: { message, type }
            }))
        }
    }

    getQueueStatus() {
        return {
            current: this.printQueue.length,
            offline: this.getOfflineQueue().length,
            isPrinting: this.isPrinting
        }
    }

    clearQueue() {
        this.printQueue = []

        // ✅ FIX: SSR safety check
        if (typeof window !== 'undefined') {
            localStorage.removeItem('print_queue')
        }
    }
}

// ✅ FIX: Singleton with SSR safety
let printerInstance: ProductionPrinter | null = null

export const productionPrinter = (() => {
    if (typeof window === 'undefined') {
        // Server-side: return dummy instance
        return {
            print: async () => ({ success: false, error: 'SSR mode' }),
            testPrint: async () => ({ success: false, error: 'SSR mode' }),
            setConfig: () => {},
            getConfig: () => ({ name: '', width: 42, enabled: false, autoPrint: false }),
            getQueueStatus: () => ({ current: 0, offline: 0, isPrinting: false }),
            clearQueue: () => {},
            retryFailedPrints: async () => ({ success: 0, failed: 0 })
        } as any
    }

    // Client-side: return real instance
    if (!printerInstance) {
        printerInstance = new ProductionPrinter()
    }
    return printerInstance
})()

// ✅ FIX: Auto-retry only on client
if (typeof window !== 'undefined') {
    window.addEventListener('load', () => {
        setTimeout(() => productionPrinter.retryFailedPrints(), 2000)
    })

    setInterval(() => productionPrinter.retryFailedPrints(), 5 * 60 * 1000)
}