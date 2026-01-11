// src/lib/print/ProductionPrinter.ts
// ✅ Uses local Node.js service for auto-cut support

import { ReceiptData, PrintResponse } from '@/types'

const PRINTER_SERVICE_URL = 'http://localhost:8000'

export class ProductionPrinter {
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // MAIN PRINT METHOD (Direct to Node service)
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    async print(receipt: ReceiptData): Promise<PrintResponse> {
        console.log('🖨️ Sending to printer service:', receipt.orderNumber)

        try {
            const response = await fetch(`${PRINTER_SERVICE_URL}/print`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(receipt)
            })

            const result = await response.json()

            if (result.success) {
                console.log('✅ Print successful:', receipt.orderNumber)
                return {
                    success: true,
                    message: 'Receipt printed successfully',
                    orderNumber: receipt.orderNumber
                }
            } else {
                throw new Error(result.error || 'Print failed')
            }

        } catch (error: any) {
            console.error('❌ Print error:', error)

            // Check if service is offline
            if (error.message.includes('fetch')) {
                return {
                    success: false,
                    error: 'Printer service offline. Please start: npm run printer',
                    orderNumber: receipt.orderNumber
                }
            }

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

        const testReceipt: ReceiptData = {
            restaurantName: 'AT RESTAURANT',
            tagline: '🖨️ TEST PRINT - Auto-Cut Enabled',
            address: 'Sooter Mills Rd, Lahore',
            phone: '+92-XXX-XXXXXXX',
            orderNumber: 'TEST-' + Date.now().toString().slice(-6),
            date: new Date().toLocaleString('en-PK'),
            orderType: 'dine-in',
            tableNumber: 5,
            waiter: 'Test Waiter',
            items: [
                {
                    name: 'Test Item 1',
                    quantity: 2,
                    price: 150,
                    total: 300,
                    category: '🍕 Main Course'
                },
                {
                    name: 'Test Beverage',
                    quantity: 1,
                    price: 100,
                    total: 100,
                    category: '🥤 Drinks'
                }
            ],
            subtotal: 400,
            tax: 20,
            total: 420,
            paymentMethod: 'cash',
            notes: 'Test print with auto-cut functionality'
        }

        return this.print(testReceipt)
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // CHECK SERVICE STATUS
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    async checkStatus(): Promise<boolean> {
        try {
            const response = await fetch(`${PRINTER_SERVICE_URL}/health`, {
                method: 'GET'
            })
            return response.ok
        } catch (error) {
            return false
        }
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // GET AVAILABLE PRINTERS
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    async getAvailablePrinters(): Promise<string[]> {
        try {
            const response = await fetch(`${PRINTER_SERVICE_URL}/printers`)
            const result = await response.json()
            return result.printers || []
        } catch (error) {
            console.error('Failed to get printers:', error)
            return []
        }
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
            checkStatus: async () => false,
            getAvailablePrinters: async () => []
        } as any
    }

    if (!printerInstance) {
        printerInstance = new ProductionPrinter()
    }
    return printerInstance
})()