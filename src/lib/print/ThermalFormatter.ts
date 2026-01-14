// src/lib/print/ThermalFormatter.ts - ESC/POS COMMAND FREE
// ✅ Pure text formatting, no ESC/POS commands

import type { ReceiptData } from '@/types'

export class ThermalFormatter {
    private width: number

    constructor(width: number = 42) {
        this.width = width
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // MAIN FORMATTING METHOD - NO ESC/POS COMMANDS
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    format(data: ReceiptData): string {
        let receipt = ''

        // Header (minimal spacing)
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
        receipt += this.formatFooter(data.orderType)

        return receipt
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // HEADER
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    private formatHeader(data: ReceiptData): string {
        let text = ''

        text += this.center(data.restaurantName || 'AT RESTAURANT')
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

        return text
    }

    private formatOrderInfo(data: ReceiptData): string {
        let text = '\n'

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

        return text
    }

    private formatDeliveryDetails(data: ReceiptData): string {
        let text = '\nDELIVERY DETAILS\n'
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

        return text
    }

    private formatItems(data: ReceiptData): string {
        let text = '\nORDER ITEMS\n'
        text += this.line('-')

        const grouped = this.groupByCategory(data.items)

        Object.entries(grouped).forEach(([category, items]) => {
            if (category && category !== 'Other' && category !== 'Uncategorized') {
                text += category + '\n'
            }

            items.forEach(item => {
                const itemLine = `${item.quantity}x ${item.name}`
                const price = `PKR ${item.total.toFixed(2)}`
                text += this.leftRight(itemLine, price)
                text += `   @ PKR ${item.price.toFixed(2)} each\n`
            })
        })

        return text
    }

    private formatTotals(data: ReceiptData): string {
        let text = '\n' + this.line('=')

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

        return text
    }

    private formatPaymentMethod(method: string): string {
        const display = method === 'cash' ? 'CASH PAYMENT' :
            method === 'online' ? 'ONLINE PAYMENT' :
                method === 'card' ? 'CARD PAYMENT' :
                    method.toUpperCase()

        let text = '\n' + this.center(`Payment: ${display}`)

        return text
    }

    private formatNotes(notes: string): string {
        let text = '\n' + this.line('-')
        text += 'Special Instructions:\n'
        text += this.wrapText(notes, this.width)
        return text
    }

    private formatFooter(orderType?: 'dine-in' | 'delivery'): string {
        let text = '\n' + this.line('=')

        if (orderType === 'delivery') {
            text += this.center('Thank you for your order!')
            text += '\n'
            text += this.center('Order again soon!')
        } else {
            text += this.center('Thank you for dining with us!')
            text += '\n'
            text += this.center('Visit us again!')
        }

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

    private center(text: string): string {
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