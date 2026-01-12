// src/lib/print/ThermalPrinter.ts - ESC/POS COMMAND FREE
// ✅ Pure text printing, printer handles all formatting internally

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

            const receiptText = this.formatter.format(receipt)
            const success = await this.printViaWindow(receiptText)

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
    // PRINT VIA IFRAME - Pure text, no ESC/POS
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    private async printViaWindow(receiptText: string): Promise<boolean> {
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

                // Write pure HTML to iframe
                iframeDoc.open()
                iframeDoc.write(this.generatePrintHTML(receiptText))
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
    // HTML - Clean layout for 80mm thermal paper
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    private generatePrintHTML(receiptText: string): string {
        const lineCount = receiptText.split('\n').length
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
        }
        
        pre {
            white-space: pre;
            font-family: inherit;
            font-size: inherit;
            line-height: inherit;
            display: block;
        }
    </style>
</head>
<body><pre>${receiptText}</pre></body>
</html>`
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