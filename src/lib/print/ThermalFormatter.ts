// src/lib/print/ThermalFormatter.ts
// ✅ Production-level receipt formatting with ESC/POS

import type { ReceiptData } from '@/types'
import * as cmd from './ESCPOSCommands'

export class ThermalFormatter {
    private width: number

    constructor(width: number = 42) {
        this.width = width
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // MAIN FORMATTING METHOD
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    format(data: ReceiptData): string {
        let receipt = cmd.INIT  // Initialize printer

        // Header
        receipt += this.formatHeader(data)

        // Order Info
        receipt += this.formatOrderInfo(data)

        // Delivery Details (if applicable)
        if (data.orderType === 'delivery' && (data.customerName || data.customerPhone)) {
            receipt += this.formatDeliveryDetails(data)
        }

        // Items
        receipt += this.formatItems(data)

        // Totals
        receipt += this.formatTotals(data)

        // Payment Method
        if (data.paymentMethod) {
            receipt += this.formatPaymentMethod(data.paymentMethod)
        }

        // Notes
        if (data.notes) {
            receipt += this.formatNotes(data.notes)
        }

        // Footer
        receipt += this.formatFooter()

        // Feed and Cut
        receipt += cmd.feedLines(5)  // Feed 5 lines before cut
        receipt += cmd.CUT_PARTIAL   // Partial cut (better than full)

        return receipt
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // HEADER SECTION
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    private formatHeader(data: ReceiptData): string {
        let text = cmd.ALIGN_CENTER

        // Restaurant Name (Large + Bold)
        text += cmd.SIZE_DOUBLE_HEIGHT + cmd.BOLD_ON
        text += data.restaurantName || 'AT RESTAURANT'
        text += '\n' + cmd.SIZE_NORMAL + cmd.BOLD_OFF

        // Tagline
        text += data.tagline || 'Delicious Food, Memorable Moments'
        text += '\n'

        // Line
        text += cmd.ALIGN_LEFT
        text += cmd.line(this.width, '-')

        // Address (Centered)
        text += cmd.ALIGN_CENTER
        text += data.address || 'Sooter Mills Rd, Lahore'
        text += '\n'
        if (data.phone) {
            text += data.phone + '\n'
        }

        // Double line
        text += cmd.ALIGN_LEFT
        text += cmd.doubleLine(this.width)
        text += '\n'

        return text
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // ORDER INFO SECTION
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    private formatOrderInfo(data: ReceiptData): string {
        let text = ''

        text += this.leftRight('Order #:', data.orderNumber)
        text += this.leftRight('Date:', data.date)
        text += this.leftRight('Type:', data.orderType === 'delivery' ? 'DELIVERY' : 'DINE-IN')

        if (data.tableNumber) {
            text += this.leftRight('Table:', `#${data.tableNumber}`)
        }

        if (data.waiter) {
            text += this.leftRight('Waiter:', data.waiter)
        }

        text += cmd.line(this.width, '-')
        text += '\n'

        return text
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // DELIVERY DETAILS
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    private formatDeliveryDetails(data: ReceiptData): string {
        let text = cmd.BOLD_ON
        text += 'DELIVERY DETAILS\n'
        text += cmd.BOLD_OFF
        text += cmd.line(this.width, '-')

        if (data.customerName) {
            text += this.leftRight('Name:', data.customerName)
        }
        if (data.customerPhone) {
            text += this.leftRight('Phone:', data.customerPhone)
        }
        if (data.deliveryAddress) {
            text += 'Address:\n'
            text += this.wrapText(data.deliveryAddress, this.width)
        }

        text += cmd.line(this.width, '-')
        text += '\n'

        return text
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // ITEMS SECTION (Grouped by Category)
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    private formatItems(data: ReceiptData): string {
        let text = cmd.BOLD_ON + 'ORDER ITEMS\n' + cmd.BOLD_OFF
        text += cmd.line(this.width, '-')

        // Group by category
        const grouped = this.groupByCategory(data.items)

        Object.entries(grouped).forEach(([category, items]) => {
            // Category header
            text += '\n' + cmd.BOLD_ON + category + '\n' + cmd.BOLD_OFF

            items.forEach(item => {
                // Item line: "2x Item Name           PKR 500"
                const itemLine = `${item.quantity}x ${item.name}`
                const price = `PKR ${item.total.toFixed(2)}`
                text += this.leftRight(itemLine, price)

                // Price per unit: "   @ PKR 250 each"
                text += `   @ PKR ${item.price.toFixed(2)} each\n`
            })
        })

        text += '\n'
        return text
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // TOTALS SECTION
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    private formatTotals(data: ReceiptData): string {
        let text = cmd.doubleLine(this.width)

        text += this.leftRight('Subtotal:', `PKR ${data.subtotal.toFixed(2)}`)
        text += this.leftRight('Tax:', `PKR ${data.tax.toFixed(2)}`)

        if (data.deliveryCharges && data.deliveryCharges > 0) {
            text += this.leftRight('Delivery:', `PKR ${data.deliveryCharges.toFixed(2)}`)
        }

        if (data.discount && data.discount > 0) {
            text += this.leftRight('Discount:', `-PKR ${data.discount.toFixed(2)}`)
        }

        text += cmd.line(this.width, '-')

        // Total (Bold)
        text += cmd.BOLD_ON
        text += this.leftRight('TOTAL:', `PKR ${data.total.toFixed(2)}`)
        text += cmd.BOLD_OFF

        text += '\n'
        return text
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // PAYMENT METHOD
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    private formatPaymentMethod(method: string): string {
        let text = cmd.ALIGN_CENTER + cmd.BOLD_ON

        const display = method === 'cash' ? 'CASH PAYMENT' :
            method === 'online' ? 'ONLINE PAYMENT' :
                method === 'card' ? 'CARD PAYMENT' :
                    method.toUpperCase()

        text += `Payment: ${display}\n`
        text += cmd.BOLD_OFF + cmd.ALIGN_LEFT + '\n'

        return text
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // NOTES SECTION
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    private formatNotes(notes: string): string {
        let text = cmd.line(this.width, '-')
        text += cmd.BOLD_ON + 'Special Instructions:\n' + cmd.BOLD_OFF
        text += this.wrapText(notes, this.width)
        text += '\n'
        return text
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // FOOTER SECTION
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    private formatFooter(): string {
        let text = cmd.doubleLine(this.width)
        text += cmd.ALIGN_CENTER

        text += cmd.BOLD_ON
        text += 'Thank you for dining with us!\n'
        text += cmd.BOLD_OFF

        text += 'Please visit again\n\n'

        text += cmd.SIZE_NORMAL
        text += 'Powered by AT Restaurant POS\n'
        text += new Date().toLocaleDateString('en-PK') + '\n'

        text += cmd.ALIGN_LEFT

        return text
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // UTILITY METHODS
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

    /**
     * Format left-right aligned text
     * Example: "Item Name              PKR 250"
     */
    private leftRight(left: string, right: string): string {
        // Calculate safe max length for left side
        const maxLeft = this.width - right.length - 1

        // Truncate left if too long
        const truncatedLeft = left.length > maxLeft
            ? left.substring(0, maxLeft - 3) + '...'
            : left

        // Calculate spaces needed
        const spaces = this.width - truncatedLeft.length - right.length

        // Ensure at least 1 space
        const padding = ' '.repeat(Math.max(1, spaces))

        return truncatedLeft + padding + right + '\n'
    }

    /**
     * Center text within width
     */
    private center(text: string): string {
        const pad = Math.max(0, Math.floor((this.width - text.length) / 2))
        return ' '.repeat(pad) + text + '\n'
    }

    /**
     * Wrap text to width
     */
    private wrapText(text: string, width: number): string {
        const words = text.split(' ')
        const lines: string[] = []
        let currentLine = ''

        words.forEach(word => {
            if ((currentLine + word).length <= width) {
                currentLine += (currentLine ? ' ' : '') + word
            } else {
                if (currentLine) lines.push(currentLine)
                currentLine = word
            }
        })
        if (currentLine) lines.push(currentLine)

        return lines.join('\n') + '\n'
    }

    /**
     * Group items by category
     */
    private groupByCategory(items: any[]): Record<string, any[]> {
        const grouped: Record<string, any[]> = {}

        items.forEach(item => {
            const category = item.category || '📋 Other'
            if (!grouped[category]) {
                grouped[category] = []
            }
            grouped[category].push(item)
        })

        return grouped
    }

    /**
     * Change printer width
     */
    setWidth(width: number) {
        this.width = width
    }

    /**
     * Get current width
     */
    getWidth(): number {
        return this.width
    }
}

export default ThermalFormatter