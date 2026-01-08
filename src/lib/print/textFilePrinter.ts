// src/lib/print/textFilePrinter.ts - PURE TEXT FILE PRINTING
import { ReceiptData, PrintResponse } from '@/types'

export class TextFilePrinter {
    private printerName = 'Generic / Text Only' // Default printer name

    // ===================================
    // MAIN PRINT METHOD
    // ===================================
    async print(receipt: ReceiptData): Promise<PrintResponse> {
        console.log('🖨️ Text file print started:', receipt.orderNumber)

        try {
            // Format receipt as plain text
            const receiptText = this.formatReceipt(receipt)

            // Create downloadable text file
            const success = await this.downloadAndPromptPrint(receiptText, receipt.orderNumber)

            if (success) {
                return {
                    success: true,
                    message: 'Receipt ready to print',
                    orderNumber: receipt.orderNumber
                }
            } else {
                return {
                    success: false,
                    error: 'Print cancelled',
                    orderNumber: receipt.orderNumber
                }
            }
        } catch (error: any) {
            console.error('Print error:', error)
            return {
                success: false,
                error: error.message,
                orderNumber: receipt.orderNumber
            }
        }
    }

    // ===================================
    // DOWNLOAD & AUTO-PRINT
    // ===================================
    private async downloadAndPromptPrint(text: string, orderNumber: string): Promise<boolean> {
        return new Promise((resolve) => {
            try {
                // Create text blob
                const blob = new Blob([text], { type: 'text/plain;charset=utf-8' })
                const url = URL.createObjectURL(blob)

                // Create download link
                const link = document.createElement('a')
                link.href = url
                link.download = `receipt-${orderNumber}.txt`

                // Trigger download
                document.body.appendChild(link)
                link.click()
                document.body.removeChild(link)

                // Clean up
                setTimeout(() => URL.revokeObjectURL(url), 100)

                // Show instructions
                this.showPrintInstructions(orderNumber)

                resolve(true)
            } catch (error) {
                console.error('Download failed:', error)
                resolve(false)
            }
        })
    }

    // ===================================
    // PRINT INSTRUCTIONS MODAL
    // ===================================
    private showPrintInstructions(orderNumber: string) {
        // Create modal
        const modal = document.createElement('div')
        modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0, 0, 0, 0.8);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 99999;
            backdrop-filter: blur(4px);
        `

        const content = document.createElement('div')
        content.style.cssText = `
            background: white;
            border-radius: 16px;
            padding: 32px;
            max-width: 500px;
            box-shadow: 0 20px 60px rgba(0,0,0,0.3);
            text-align: center;
        `

        content.innerHTML = `
            <div style="font-size: 64px; margin-bottom: 16px;">🖨️</div>
            <h2 style="font-size: 24px; font-weight: bold; color: #1f2937; margin-bottom: 12px;">
                Receipt Downloaded
            </h2>
            <p style="font-size: 14px; color: #6b7280; margin-bottom: 24px;">
                File: <strong>receipt-${orderNumber}.txt</strong>
            </p>
            
            <div style="background: #f3f4f6; border-radius: 12px; padding: 20px; margin-bottom: 24px; text-align: left;">
                <h3 style="font-size: 16px; font-weight: 600; color: #1f2937; margin-bottom: 12px;">
                    📋 How to Print:
                </h3>
                <ol style="font-size: 14px; color: #4b5563; line-height: 1.8; padding-left: 20px; margin: 0;">
                    <li>Open the downloaded <strong>receipt-${orderNumber}.txt</strong> file</li>
                    <li>Right-click on the file</li>
                    <li>Select <strong>"Print"</strong> or press <strong>Ctrl+P</strong></li>
                    <li>Choose <strong>"Generic / Text Only"</strong> printer</li>
                    <li>Click <strong>"Print"</strong></li>
                </ol>
            </div>

            <div style="background: #dbeafe; border: 2px solid #3b82f6; border-radius: 8px; padding: 12px; margin-bottom: 24px;">
                <p style="font-size: 13px; color: #1e40af; margin: 0;">
                    💡 <strong>Quick Tip:</strong> Use <kbd style="background: white; padding: 2px 6px; border-radius: 4px; font-family: monospace;">Ctrl+P</kbd> to print directly from the file
                </p>
            </div>

            <button id="closeBtn" style="
                width: 100%;
                padding: 14px;
                background: #3b82f6;
                color: white;
                border: none;
                border-radius: 10px;
                font-size: 16px;
                font-weight: 600;
                cursor: pointer;
                transition: all 0.2s;
            ">
                Got it!
            </button>
        `

        modal.appendChild(content)
        document.body.appendChild(modal)

        // Close button
        const closeBtn = content.querySelector('#closeBtn')
        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                document.body.removeChild(modal)
            })

            closeBtn.addEventListener('mouseenter', (e) => {
                (e.target as HTMLElement).style.background = '#2563eb'
            })

            closeBtn.addEventListener('mouseleave', (e) => {
                (e.target as HTMLElement).style.background = '#3b82f6'
            })
        }

        // Click outside to close
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                document.body.removeChild(modal)
            }
        })
    }

    // ===================================
    // RECEIPT FORMATTING
    // ===================================
    private formatReceipt(data: ReceiptData): string {
        const W = 42 // Width for standard text
        const line = '-'.repeat(W)
        const doubleLine = '='.repeat(W)

        let receipt = '\n'

        // Header
        receipt += this.center(data.restaurantName || 'AT RESTAURANT', W) + '\n'
        receipt += this.center(data.tagline || 'Delicious Food, Memorable Moments', W) + '\n'
        receipt += line + '\n'
        receipt += this.center(data.address || 'Sooter Mills Rd, Lahore', W) + '\n'
        if (data.phone) receipt += this.center(data.phone, W) + '\n'
        receipt += doubleLine + '\n\n'

        // Order Info
        receipt += `Order #: ${data.orderNumber}\n`
        receipt += `Date: ${data.date}\n`
        receipt += `Type: ${data.orderType === 'delivery' ? 'DELIVERY' : 'DINE-IN'}\n`
        if (data.tableNumber) receipt += `Table: #${data.tableNumber}\n`
        if (data.waiter) receipt += `Waiter: ${data.waiter}\n`
        receipt += line + '\n\n'

        // Delivery Details
        if (data.orderType === 'delivery' && (data.customerName || data.customerPhone)) {
            receipt += 'DELIVERY DETAILS\n' + line + '\n'
            if (data.customerName) receipt += `Name: ${data.customerName}\n`
            if (data.customerPhone) receipt += `Phone: ${data.customerPhone}\n`
            if (data.deliveryAddress) receipt += `Address: ${data.deliveryAddress}\n`
            receipt += line + '\n\n'
        }

        // Items (Grouped by Category)
        receipt += 'ORDER ITEMS\n' + line + '\n'
        const grouped: Record<string, typeof data.items> = {}
        data.items.forEach(item => {
            const cat = item.category || 'Other'
            if (!grouped[cat]) grouped[cat] = []
            grouped[cat].push(item)
        })

        Object.entries(grouped).forEach(([category, items]) => {
            receipt += `\n${category}\n`
            items.forEach(item => {
                const itemLine = `${item.quantity}x ${item.name}`
                const price = `PKR ${item.total.toFixed(2)}`
                receipt += this.leftRight(itemLine, price, W) + '\n'
                receipt += `   @ PKR ${item.price.toFixed(2)} each\n`
            })
        })

        // Totals
        receipt += '\n' + doubleLine + '\n'
        receipt += this.leftRight('Subtotal:', `PKR ${data.subtotal.toFixed(2)}`, W) + '\n'
        receipt += this.leftRight('Tax:', `PKR ${data.tax.toFixed(2)}`, W) + '\n'
        if (data.deliveryCharges && data.deliveryCharges > 0) {
            receipt += this.leftRight('Delivery:', `PKR ${data.deliveryCharges.toFixed(2)}`, W) + '\n'
        }
        receipt += line + '\n'
        receipt += this.leftRight('TOTAL:', `PKR ${data.total.toFixed(2)}`, W) + '\n'

        // Payment Method
        if (data.paymentMethod) {
            receipt += '\n' + this.center(`Payment: ${data.paymentMethod.toUpperCase()}`, W) + '\n'
        }

        // Special Notes
        if (data.notes) {
            receipt += '\n' + line + '\n'
            receipt += 'Special Instructions:\n'
            receipt += this.wrapText(data.notes, W) + '\n'
        }

        // Footer
        receipt += '\n' + doubleLine + '\n'
        receipt += this.center('Thank you for dining with us!', W) + '\n'
        receipt += this.center('Please visit again', W) + '\n\n'
        receipt += this.center('Powered by AT Restaurant POS', W) + '\n'
        receipt += this.center(new Date().toLocaleDateString('en-PK'), W) + '\n\n\n'

        return receipt
    }

    // ===================================
    // FORMATTING HELPERS
    // ===================================
    private center(text: string, width: number = 42): string {
        const pad = Math.max(0, Math.floor((width - text.length) / 2))
        return ' '.repeat(pad) + text
    }

    private leftRight(left: string, right: string, width: number = 42): string {
        const spaces = width - left.length - right.length
        return left + ' '.repeat(Math.max(1, spaces)) + right
    }

    private wrapText(text: string, width: number = 42): string {
        const words = text.split(' ')
        let lines: string[] = []
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

    // ===================================
    // UTILITY METHODS
    // ===================================
    setPrinterName(name: string) {
        this.printerName = name
    }

    getPrinterName(): string {
        return this.printerName
    }

    // Mock methods for compatibility
    isConnected(): boolean {
        return true // Always "connected" since it's file-based
    }

    async getPrinters(): Promise<any[]> {
        return [
            {
                id: 'text-printer',
                name: this.printerName,
                type: 'text',
                connected: true,
                status: 'Ready'
            }
        ]
    }

    async testPrint(): Promise<PrintResponse> {
        const testReceipt: ReceiptData = {
            restaurantName: 'AT RESTAURANT',
            tagline: 'Test Print',
            address: 'Sooter Mills Rd, Lahore',
            orderNumber: 'TEST-' + Date.now(),
            date: new Date().toLocaleString('en-PK'),
            orderType: 'dine-in',
            items: [
                { name: 'Test Item', quantity: 1, price: 100, total: 100, category: 'Test' }
            ],
            subtotal: 100,
            tax: 0,
            total: 100
        }

        return this.print(testReceipt)
    }
}

// ===================================
// SINGLETON EXPORT
// ===================================
export const textFilePrinter = new TextFilePrinter()
export default textFilePrinter