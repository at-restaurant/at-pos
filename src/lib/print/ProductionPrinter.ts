// src/lib/print/ProductionPrinter.ts - SIMPLE BROWSER PRINT
// ✅ Direct browser print dialog (no WebUSB, no queue)

import { ReceiptData, PrintResponse } from '@/types'
import { thermalPrinter } from './ThermalPrinter'

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
        if (typeof window !== 'undefined') {
            const saved = localStorage.getItem('printer_config')
            this.config = saved ? JSON.parse(saved) : this.getDefaultConfig()
        } else {
            this.config = this.getDefaultConfig()
        }
    }

    private getDefaultConfig(): PrinterConfig {
        return {
            name: 'Generic / Text Only',
            width: 42,
            enabled: true,
            autoPrint: true
        }
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // MAIN PRINT METHOD (Direct browser print)
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    async print(receipt: ReceiptData): Promise<PrintResponse> {
        console.log('🖨️ Browser print:', receipt.orderNumber)

        try {
            // Direct print via browser dialog
            const result = await thermalPrinter.print(receipt)

            if (result.success) {
                console.log('✅ Print successful:', receipt.orderNumber)
            }

            return result

        } catch (error: any) {
            console.error('❌ Print error:', error)
            return {
                success: false,
                error: error.message,
                orderNumber: receipt.orderNumber
            }
        }
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // TEST PRINT
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    async testPrint(): Promise<PrintResponse> {
        console.log('🧪 Running test print...')
        return thermalPrinter.testPrint()
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // UTILITY METHODS
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    private isPrinterAvailable(): boolean {
        return typeof window !== 'undefined' &&
            !!window.print &&
            this.config.enabled &&
            navigator.onLine
    }

    getQueueStatus() {
        return {
            current: this.printQueue.length,
            offline: 0,
            isPrinting: this.isPrinting
        }
    }

    clearQueue() {
        this.printQueue = []
    }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// SINGLETON EXPORT
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
let printerInstance: ProductionPrinter | null = null

export const productionPrinter = (() => {
    if (typeof window === 'undefined') {
        return {
            print: async () => ({ success: false, error: 'SSR mode' }),
            testPrint: async () => ({ success: false, error: 'SSR mode' }),
            setConfig: () => {},
            getConfig: () => ({ name: '', width: 42, enabled: false, autoPrint: false }),
            getQueueStatus: () => ({ current: 0, offline: 0, isPrinting: false }),
            clearQueue: () => {}
        } as any
    }

    if (!printerInstance) {
        printerInstance = new ProductionPrinter()
    }
    return printerInstance
})()