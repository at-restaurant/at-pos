// src/lib/print/thermalPrinter.ts
import { ReceiptData, PrintResponse, PrinterStatus } from '@/types'
import { detectDevice, shouldUseServicePrint, getPrintServiceURL } from './deviceDetection'
import BrowserPrint from './browserPrint'

export class ThermalPrinter {
    private baseUrl: string

    constructor() {
        this.baseUrl = getPrintServiceURL()
    }

    async print(receipt: ReceiptData): Promise<PrintResponse> {
        const device = detectDevice()
        console.log('🖨️ Print on:', device.type, 'using:', device.printMethod)

        // Windows: Use printer service
        if (shouldUseServicePrint()) {
            try {
                const response = await fetch(`${this.baseUrl}/api/print`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(receipt),
                    signal: AbortSignal.timeout(10000)
                })

                if (!response.ok) {
                    console.warn('Printer service failed, fallback to browser')
                    return this.browserPrintFallback(receipt)
                }

                return await response.json()

            } catch (error: any) {
                console.error('Printer service error:', error)
                return this.browserPrintFallback(receipt)
            }
        }

        // All other devices: Browser print
        return this.browserPrintFallback(receipt)
    }

    private async browserPrintFallback(receipt: ReceiptData): Promise<PrintResponse> {
        try {
            const success = await BrowserPrint.print(receipt)
            return {
                success,
                message: success ? 'Print dialog opened' : 'Failed to open print dialog',
                orderNumber: receipt.orderNumber
            }
        } catch (error: any) {
            return {
                success: false,
                error: error.message || 'Print failed'
            }
        }
    }

    async checkStatus(): Promise<PrinterStatus> {
        const device = detectDevice()

        if (shouldUseServicePrint()) {
            try {
                const response = await fetch(`${this.baseUrl}/api/health`, {
                    signal: AbortSignal.timeout(5000)
                })
                if (!response.ok) throw new Error('Service offline')
                return await response.json()
            } catch {
                return {
                    status: 'offline',
                    printer: 'disconnected',
                    platform: device.type
                }
            }
        }

        return {
            status: 'online',
            printer: 'configured',
            platform: device.type,
            timestamp: new Date().toISOString()
        }
    }

    async testPrint(): Promise<PrintResponse> {
        const testReceipt: ReceiptData = {
            restaurantName: 'AT RESTAURANT',
            tagline: 'Test Print',
            address: 'Sooter Mills Rd, Lahore',
            phone: '+92-XXX-XXXXXXX',
            orderNumber: 'TEST-' + Date.now().toString().slice(-6),
            date: new Date().toLocaleString(),
            orderType: 'dine-in',
            tableNumber: 1,
            waiter: 'Test Waiter',
            items: [
                { name: 'Test Item 1', quantity: 2, price: 100, total: 200, category: '🧪 Test' },
                { name: 'Test Item 2', quantity: 1, price: 150, total: 150, category: '🧪 Test' }
            ],
            subtotal: 350,
            tax: 35,
            total: 385,
            paymentMethod: 'cash',
            notes: 'This is a test receipt'
        }
        return this.print(testReceipt)
    }

    getDeviceInfo() {
        return detectDevice()
    }
}

export const thermalPrinter = new ThermalPrinter()
export default ThermalPrinter