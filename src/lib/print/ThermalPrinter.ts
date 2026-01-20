// src/lib/print/ThermalPrinter.ts
// ✅ BOLD Restaurant Name using CSS

import { ReceiptData, PrintResponse } from '@/types'
import ThermalFormatter from './ThermalFormatter'

interface PrinterConfig {
    width: number
}

export class ThermalPrinter {
    private config: PrinterConfig
    private formatter: ThermalFormatter
    private isPrinting: boolean = false

    constructor(config?: Partial<PrinterConfig>) {
        this.config = {
            width: 42,
            ...config
        }

        this.formatter = new ThermalFormatter(this.config.width)
        this.loadConfig()
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // MAIN PRINT METHOD
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    async print(receipt: ReceiptData): Promise<PrintResponse> {
        if (this.isPrinting) {
            return {
                success: false,
                error: 'Printer is busy',
                orderNumber: receipt.orderNumber
            }
        }

        console.log('🖨️ Printing:', receipt.orderNumber)

        try {
            this.isPrinting = true

            const formatted = this.formatter.formatForHTML(receipt)
            const success = await this.printViaWindow(formatted.header, formatted.body)

            if (success) {
                console.log('✅ Print completed')
                return {
                    success: true,
                    message: 'Receipt printed',
                    orderNumber: receipt.orderNumber
                }
            } else {
                throw new Error('Print cancelled or failed')
            }

        } catch (error: any) {
            console.error('❌ Print error:', error)
            return {
                success: false,
                error: error.message,
                orderNumber: receipt.orderNumber
            }
        } finally {
            this.isPrinting = false
        }
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // PRINT VIA IFRAME - WITH BOLD HEADER
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    private async printViaWindow(header: string, body: string): Promise<boolean> {
        return new Promise((resolve) => {
            try {
                const iframe = document.createElement('iframe')
                iframe.style.position = 'fixed'
                iframe.style.right = '0'
                iframe.style.bottom = '0'
                iframe.style.width = '0'
                iframe.style.height = '0'
                iframe.style.border = 'none'
                document.body.appendChild(iframe)

                const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document
                if (!iframeDoc) {
                    console.error('❌ Cannot access iframe document')
                    resolve(false)
                    return
                }

                iframeDoc.open()
                iframeDoc.write(this.generatePrintHTML(header, body))
                iframeDoc.close()

                setTimeout(() => {
                    try {
                        iframe.contentWindow?.focus()
                        iframe.contentWindow?.print()

                        setTimeout(() => {
                            document.body.removeChild(iframe)
                            resolve(true)
                        }, 500)

                    } catch (err) {
                        console.error('Print error:', err)
                        document.body.removeChild(iframe)
                        resolve(false)
                    }
                }, 50)

            } catch (error) {
                console.error('iframe error:', error)
                resolve(false)
            }
        })
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // HTML - WITH BOLD RESTAURANT NAME
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    private generatePrintHTML(header: string, body: string): string {
        const lineCount = body.split('\n').length + 5
        const approximateHeight = Math.ceil(lineCount * 4.5)

        return `<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Receipt</title>
    <style>
        @page {
            size: 80mm ${approximateHeight}mm;
            margin: 0mm;
        }
        
        @media print {
            html, body { 
                margin: 0 !important; 
                padding: 0 !important;
                height: ${approximateHeight}mm !important;
                overflow: hidden !important;
            }
            .no-print { display: none !important; }
        }
        
        * {
            margin: 0 !important;
            padding: 0 !important;
            box-sizing: border-box;
        }
        
        html {
            height: ${approximateHeight}mm;
            overflow: hidden;
        }
        
        body {
            font-family: 'Courier New', 'Consolas', monospace;
            font-size: 12px;
            line-height: 1.1;
            width: 80mm;
            height: ${approximateHeight}mm;
            background: white;
            color: black;
            overflow: hidden;
            text-align: center;
        }
        
        .restaurant-name {
            font-weight: bold;
            font-size: 20px;
            margin-top: 10px !important;
            margin-bottom: 10px !important;
            letter-spacing: 2px;
        }
        
        .separator {
            margin: 5px 0 !important;
        }
        
        pre {
            white-space: pre;
            font-family: inherit;
            font-size: inherit;
            line-height: inherit;
            display: block;
            text-align: left;
        }
    </style>
</head>
<body>
    <div class="restaurant-name">${header}</div>
    <pre>${body}</pre>
</body>
</html>`
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // TEST PRINT
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    async testPrint(): Promise<PrintResponse> {
        const testReceipt: ReceiptData = {
            restaurantName: 'AT RESTAURANT',
            tagline: '🖨️ TEST PRINT',
            address: 'Sooter Mills Rd, Lahore',
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
            paymentMethod: 'cash'
        }

        return this.print(testReceipt)
    }

    setConfig(config: Partial<PrinterConfig>) {
        this.config = { ...this.config, ...config }
        this.formatter.setWidth(this.config.width)
        this.saveConfig()
    }

    getConfig(): PrinterConfig {
        return { ...this.config }
    }

    private saveConfig() {
        if (typeof window !== 'undefined') {
            localStorage.setItem('thermal_printer_config', JSON.stringify(this.config))
        }
    }

    private loadConfig() {
        if (typeof window !== 'undefined') {
            const saved = localStorage.getItem('thermal_printer_config')
            if (saved) {
                try {
                    const config = JSON.parse(saved)
                    this.config = { ...this.config, ...config }
                    this.formatter.setWidth(this.config.width)
                } catch (error) {
                    console.error('Failed to load printer config:', error)
                }
            }
        }
    }

    isPrinterBusy(): boolean {
        return this.isPrinting
    }

    isAvailable(): boolean {
        return typeof window !== 'undefined' && !!window.print
    }
}

let printerInstance: ThermalPrinter | null = null

export const thermalPrinter = (() => {
    if (typeof window === 'undefined') {
        return {
            print: async () => ({ success: false, error: 'SSR mode' }),
            testPrint: async () => ({ success: false, error: 'SSR mode' }),
            setConfig: () => {},
            getConfig: () => ({ width: 42 }),
            isPrinterBusy: () => false,
            isAvailable: () => false
        } as any
    }

    if (!printerInstance) {
        printerInstance = new ThermalPrinter()
    }
    return printerInstance
})()

export default thermalPrinter