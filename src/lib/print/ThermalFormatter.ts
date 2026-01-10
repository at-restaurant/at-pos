// src/lib/print/ThermalFormatter.ts - COMPLETE FIX
// ✅ Perfect formatting with proper alignment and categorization

import type { ReceiptData } from '@/types'

export class ThermalFormatter {
    private width: number

    constructor(width: number = 42) {
        this.width = width
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // MAIN FORMATTING METHOD
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    format(data: ReceiptData): string {
        let receipt = ''

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

        return receipt
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // HEADER SECTION
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    private formatHeader(data: ReceiptData): string {
        let text = ''

        // Restaurant Name (Centered + Large)
        text += this.center(data.restaurantName || 'AT RESTAURANT', true)
        text += '\n'

        // Tagline (Centered)
        text += this.center(data.tagline || 'Delicious Food, Memorable Moments')
        text += '\n'

        // Line
        text += this.line('-')

        // Address (Centered)
        text += this.center(data.address || 'Sooter Mills Rd, Lahore')
        text += '\n'
        if (data.phone) {
            text += this.center(data.phone)
            text += '\n'
        }

        // Double line
        text += this.line('=')
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

        text += this.line('-')
        text += '\n'

        return text
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // DELIVERY DETAILS
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    private formatDeliveryDetails(data: ReceiptData): string {
        let text = 'DELIVERY DETAILS\n'
        text += this.line('-')

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

        text += this.line('-')
        text += '\n'

        return text
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // ITEMS SECTION (Grouped by Category)
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    private formatItems(data: ReceiptData): string {
        let text = 'ORDER ITEMS\n'
        text += this.line('-')

        // Group by category
        const grouped = this.groupByCategory(data.items)

        Object.entries(grouped).forEach(([category, items]) => {
            // Category header (only if category exists)
            if (category && category !== 'Other' && category !== 'Uncategorized') {
                text += '\n' + category + '\n'
            }

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
        let text = this.line('=')

        text += this.leftRight('Subtotal:', `PKR ${data.subtotal.toFixed(2)}`)
        text += this.leftRight('Tax:', `PKR ${data.tax.toFixed(2)}`)

        if (data.deliveryCharges && data.deliveryCharges > 0) {
            text += this.leftRight('Delivery:', `PKR ${data.deliveryCharges.toFixed(2)}`)
        }

        if (data.discount && data.discount > 0) {
            text += this.leftRight('Discount:', `-PKR ${data.discount.toFixed(2)}`)
        }

        text += this.line('-')

        // Total (Bold effect with uppercase)
        text += this.leftRight('TOTAL:', `PKR ${data.total.toFixed(2)}`)

        text += '\n'
        return text
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // PAYMENT METHOD
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    private formatPaymentMethod(method: string): string {
        const display = method === 'cash' ? 'CASH PAYMENT' :
            method === 'online' ? 'ONLINE PAYMENT' :
                method === 'card' ? 'CARD PAYMENT' :
                    method.toUpperCase()

        let text = this.center(`Payment: ${display}`)
        text += '\n'

        return text
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // NOTES SECTION
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    private formatNotes(notes: string): string {
        let text = this.line('-')
        text += 'Special Instructions:\n'
        text += this.wrapText(notes, this.width)
        text += '\n'
        return text
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // FOOTER SECTION
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    private formatFooter(): string {
        let text = this.line('=')
        text += this.center('Thank you for dining with us!')
        text += '\n'
        text += this.center('Please visit again')
        text += '\n\n'
        text += this.center('Powered by AT Restaurant POS')
        text += '\n'
        text += this.center(new Date().toLocaleDateString('en-PK'))
        text += '\n'

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
        const maxLeft = this.width - right.length - 1

        const truncatedLeft = left.length > maxLeft
            ? left.substring(0, maxLeft - 3) + '...'
            : left

        const spaces = this.width - truncatedLeft.length - right.length
        const padding = ' '.repeat(Math.max(1, spaces))

        return truncatedLeft + padding + right + '\n'
    }

    /**
     * Center text within width
     */
    private center(text: string, large: boolean = false): string {
        const pad = Math.max(0, Math.floor((this.width - text.length) / 2))
        return ' '.repeat(pad) + text
    }

    /**
     * Create line separator
     */
    private line(char: string): string {
        return char.repeat(this.width) + '\n'
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
     * Group items by category (clean version)
     */
    private groupByCategory(items: any[]): Record<string, any[]> {
        const grouped: Record<string, any[]> = {}

        items.forEach(item => {
            let category = 'Other'

            if (item.category) {
                // Clean category: remove emoji if exists
                category = item.category.replace(/[\u{1F300}-\u{1F9FF}]/gu, '').trim()
                // If empty after removing emoji, use original
                if (!category) {
                    category = item.category
                }
            }

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