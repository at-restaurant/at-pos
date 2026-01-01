// src/lib/print/thermalPrinter.ts - UNIVERSAL PRINTING
import { ReceiptData, PrintResponse, PrinterStatus } from '@/types'
import { detectDevice, shouldUseServicePrint, getPrintServiceURL } from './deviceDetection'
import BrowserPrint from './browserPrint'

export class ThermalPrinter {
    private baseUrl: string

    constructor() {
        this.baseUrl = getPrintServiceURL()
    }

    /**
     * Universal print method - auto-detects device and uses best method
     */
    async print(receipt: ReceiptData): Promise<PrintResponse> {
        const device = detectDevice()

        console.log('🖨️ Print requested on:', device.type, 'using:', device.printMethod)

        // Windows: Use printer service via Cloudflare tunnel
        if (shouldUseServicePrint()) {
            try {
                const response = await fetch(`${this.baseUrl}/api/print`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(receipt),
                    signal: AbortSignal.timeout(10000)
                })

                if (!response.ok) {
                    console.warn('Printer service failed, falling back to browser print')
                    return this.browserPrintFallback(receipt)
                }

                const result = await response.json()
                return result

            } catch (error: any) {
                console.error('Printer service error:', error)
                console.log('📱 Falling back to browser print...')
                return this.browserPrintFallback(receipt)
            }
        }

        // All other devices: Use browser print
        return this.browserPrintFallback(receipt)
    }

    /**
     * Browser print fallback for all devices
     */
    private async browserPrintFallback(receipt: ReceiptData): Promise<PrintResponse> {
        try {
            const success = await BrowserPrint.print(receipt)

            return {
                success,
                message: success
                    ? 'Print dialog opened successfully'
                    : 'Failed to open print dialog',
                orderNumber: receipt.orderNumber
            }
        } catch (error: any) {
            return {
                success: false,
                error: error.message || 'Print failed'
            }
        }
    }

    /**
     * Check printer status
     */
    async checkStatus(): Promise<PrinterStatus> {
        const device = detectDevice()

        // Windows: Check service
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

        // Other devices: Always available via browser
        return {
            status: 'online',
            printer: 'configured',
            platform: device.type,
            timestamp: new Date().toISOString()
        }
    }

    /**
     * Test print
     */
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
                {
                    name: 'Test Item 1',
                    quantity: 2,
                    price: 100,
                    total: 200,
                    category: '🧪 Test Category'
                },
                {
                    name: 'Test Item 2',
                    quantity: 1,
                    price: 150,
                    total: 150,
                    category: '🧪 Test Category'
                }
            ],
            subtotal: 350,
            tax: 35,
            total: 385,
            paymentMethod: 'cash',
            notes: 'This is a test receipt'
        }

        return this.print(testReceipt)
    }

    /**
     * Get device info and print capabilities
     */
    getDeviceInfo() {
        return detectDevice()
    }
}

// Export singleton instance
export const thermalPrinter = new ThermalPrinter()

// Export class for custom instances
export default ThermalPrinter