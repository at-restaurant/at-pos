// src/lib/print/ThermalFormatter.ts - FIXED: No extra spacing
// ✅ Minimal top space, NO bottom space wastage

import type { ReceiptData } from '@/types'

export class ThermalFormatter {
    private width: number

    constructor(width: number = 42) {
        this.width = width
    }

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

        // Footer (NO EXTRA NEWLINES)
        receipt += this.formatFooter()

        return receipt
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // HEADER - Minimal top space
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    private formatHeader(data: ReceiptData): string {
        let text = ''

        text += this.center(data.restaurantName || 'AT RESTAURANT', true)
        text += '\n'
        text += this.center(data.tagline || 'Delicious Food, Memorable Moments')
        text += '\n'
        text += this.line('-')
        text += this.center(data.address || 'Sooter Mills Rd, Lahore')
        text += '\n'
        if (data.phone) {
            text += this.center(data.phone)
            text += '\n'
        }
        text += this.line('=')
        text += '\n'

        return text
    }

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

    private formatItems(data: ReceiptData): string {
        let text = 'ORDER ITEMS\n'
        text += this.line('-')

        const grouped = this.groupByCategory(data.items)

        Object.entries(grouped).forEach(([category, items]) => {
            if (category && category !== 'Other' && category !== 'Uncategorized') {
                text += '\n' + category + '\n'
            }

            items.forEach(item => {
                const itemLine = `${item.quantity}x ${item.name}`
                const price = `PKR ${item.total.toFixed(2)}`
                text += this.leftRight(itemLine, price)
                text += `   @ PKR ${item.price.toFixed(2)} each\n`
            })
        })

        text += '\n'
        return text
    }

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
        text += this.leftRight('TOTAL:', `PKR ${data.total.toFixed(2)}`)
        text += '\n'
        return text
    }

    private formatPaymentMethod(method: string): string {
        const display = method === 'cash' ? 'CASH PAYMENT' :
            method === 'online' ? 'ONLINE PAYMENT' :
                method === 'card' ? 'CARD PAYMENT' :
                    method.toUpperCase()

        let text = this.center(`Payment: ${display}`)
        text += '\n'
        return text
    }

    private formatNotes(notes: string): string {
        let text = this.line('-')
        text += 'Special Instructions:\n'
        text += this.wrapText(notes, this.width)
        text += '\n'
        return text
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // FOOTER - NO EXTRA NEWLINES (Fixed!)
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    private formatFooter(): string {
        let text = this.line('=')
        text += this.center('Thank you for dining with us!')
        text += '\n'
        text += this.center('Please visit again')
        text += '\n'
        text += this.center('Powered by AT Restaurant POS')
        // ✅ NO EXTRA \n\n HERE - Just one newline for cut command
        text += '\n'

        return text
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // UTILITY METHODS
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    private leftRight(left: string, right: string): string {
        const maxLeft = this.width - right.length - 1
        const truncatedLeft = left.length > maxLeft
            ? left.substring(0, maxLeft - 3) + '...'
            : left
        const spaces = this.width - truncatedLeft.length - right.length
        const padding = ' '.repeat(Math.max(1, spaces))
        return truncatedLeft + padding + right + '\n'
    }

    private center(text: string, large: boolean = false): string {
        const pad = Math.max(0, Math.floor((this.width - text.length) / 2))
        return ' '.repeat(pad) + text
    }

    private line(char: string): string {
        return char.repeat(this.width) + '\n'
    }

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

    private groupByCategory(items: any[]): Record<string, any[]> {
        const grouped: Record<string, any[]> = {}

        items.forEach(item => {
            let category = 'Other'

            if (item.category) {
                category = item.category.replace(/[\u{1F300}-\u{1F9FF}]/gu, '').trim()
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

    setWidth(width: number) {
        this.width = width
    }

    getWidth(): number {
        return this.width
    }
}

export default ThermalFormatter