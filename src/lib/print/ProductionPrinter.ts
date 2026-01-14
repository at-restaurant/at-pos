// src/lib/print/ProductionPrinter.ts - NO TEST PRINT
// ✅ Direct browser print dialog using iframe

import { ReceiptData, PrintResponse } from '@/types'
import { thermalPrinter } from './ThermalPrinter'

interface PrinterConfig {
    name: string
    width: number
    enabled: boolean
    autoPrint: boolean
}

export class ProductionPrinter {
    private config: PrinterConfig

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

    async print(receipt: ReceiptData): Promise<PrintResponse> {
        console.log('🖨️ Browser print:', receipt.orderNumber)

        try {
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

    getQueueStatus() {
        return {
            current: 0,
            offline: 0,
            isPrinting: false
        }
    }

    clearQueue() {
        // No queue in browser mode
    }
}

let printerInstance: ProductionPrinter | null = null

export const productionPrinter = (() => {
    if (typeof window === 'undefined') {
        return {
            print: async () => ({ success: false, error: 'SSR mode' }),
            getQueueStatus: () => ({ current: 0, offline: 0, isPrinting: false }),
            clearQueue: () => {}
        } as any
    }

    if (!printerInstance) {
        printerInstance = new ProductionPrinter()
    }
    return printerInstance
})()