// src/lib/print/ThermalFormatter.ts
// ✅ PROFESSIONAL: Clean, minimal, business-like receipt

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

        // Items Table
        receipt += this.formatItemsTable(data)

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

    // ✅ Format for HTML (returns header and body separately)
    formatForHTML(data: ReceiptData): { header: string; body: string } {
        return {
            header: 'AT RESTAURANT',
            body: this.format(data)
        }
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // HEADER - Minimal
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    private formatHeader(data: ReceiptData): string {
        let text = '\n'
        text += this.centerText('Quality Food & Service', this.width)
        text += '\n\n'
        return text
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // ORDER INFO - Compact single block
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    private formatOrderInfo(data: ReceiptData): string {
        let text = ''

        // Order number and date
        const orderNum = data.orderNumber.length > 6
            ? data.orderNumber.substring(0, 6)
            : data.orderNumber
        const date = this.formatDate(data.date)
        text += this.leftRight(`Order #${orderNum}`, date)

        // Type and table/customer
        if (data.orderType === 'dine-in') {
            const tableInfo = data.tableNumber ? `Table ${data.tableNumber}` : ''
            text += this.leftRight('Dine-In', tableInfo)
            if (data.waiter) {
                text += this.leftRight('Server:', data.waiter)
            }
        } else if (data.orderType === 'delivery') {
            text += `Delivery Order\n`
        } else {
            text += `Takeaway Order\n`
        }

        text += '\n'
        return text
    }

    private formatDeliveryDetails(data: ReceiptData): string {
        let text = ''

        if (data.customerName) {
            text += `${data.customerName}\n`
        }
        if (data.customerPhone) {
            text += `${data.customerPhone}\n`
        }
        if (data.deliveryAddress) {
            text += `${this.wrapText(data.deliveryAddress, this.width)}\n`
        }

        text += '\n'
        return text
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // ITEMS TABLE - Clean table format
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    private formatItemsTable(data: ReceiptData): string {
        let text = ''

        // Table Header
        text += this.formatTableRow('Item', 'Qty', 'Price', 'Total')
        text += this.line('-')

        // Items (no category grouping)
        data.items.forEach(item => {
            const maxNameLen = 20
            const itemName = item.name.length > maxNameLen
                ? item.name.substring(0, maxNameLen - 2) + '..'
                : item.name

            text += this.formatTableRow(
                itemName,
                item.quantity.toString(),
                item.price.toFixed(0),
                item.total.toFixed(0)
            )
        })

        return text
    }

    private formatTableRow(
        item: string,
        qty: string,
        price: string,
        total: string
    ): string {
        // Column widths: Item(20) Qty(4) Price(7) Total(7)
        const itemCol = this.padRight(item, 20)
        const qtyCol = this.padLeft(qty, 4)
        const priceCol = this.padLeft(price, 7)
        const totalCol = this.padLeft(total, 7)

        return `${itemCol} ${qtyCol} ${priceCol} ${totalCol}\n`
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // TOTALS - Minimal with right-aligned dash
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    private formatTotals(data: ReceiptData): string {
        let text = this.line('-')

        // Show subtotal and tax only if tax > 0
        if (data.tax > 0) {
            text += this.formatTotalLine('Subtotal', data.subtotal)
            text += this.formatTotalLine('Tax', data.tax)
        }

        // Delivery charges
        if (data.deliveryCharges && data.deliveryCharges > 0) {
            text += this.formatTotalLine('Delivery', data.deliveryCharges)
        }

        // Discount
        if (data.discount && data.discount > 0) {
            text += this.formatTotalLine('Discount', -data.discount)
        }

        // Separator line before total (right-aligned)
        if (data.tax > 0 || (data.deliveryCharges && data.deliveryCharges > 0)) {
            text += ' '.repeat(this.width - 9) + '---------\n'
        }

        // TOTAL
        text += this.formatTotalLine('TOTAL', data.total)

        return text
    }

    private formatTotalLine(label: string, amount: number): string {
        const value = `PKR ${amount.toFixed(0)}`
        const spaces = this.width - label.length - value.length
        return label + ' '.repeat(Math.max(1, spaces)) + value + '\n'
    }

    private formatPaymentMethod(method: string): string {
        const display = method === 'cash' ? 'Cash' :
            method === 'online' ? 'Online' :
                method === 'card' ? 'Card' : method

        return `\nPayment: ${display}\n`
    }

    private formatNotes(notes: string): string {
        return `\nNote: ${this.wrapText(notes, this.width - 6)}\n`
    }

    private formatFooter(): string {
        return `\nThank you - Visit again!\n\n`
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // UTILITIES
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    private formatDate(dateStr: string): string {
        // Convert "21/1/2026, 3:30:45 pm" to "21/1/26 3:30PM"
        try {
            const parts = dateStr.split(',')
            if (parts.length === 2) {
                const datePart = parts[0].trim()
                const timePart = parts[1].trim()

                // Shorten year
                const dateSegments = datePart.split('/')
                if (dateSegments.length === 3) {
                    const shortYear = dateSegments[2].slice(-2)
                    const shortDate = `${dateSegments[0]}/${dateSegments[1]}/${shortYear}`

                    // Shorten time
                    const timeSegments = timePart.split(':')
                    if (timeSegments.length >= 2) {
                        const hour = timeSegments[0]
                        const minute = timeSegments[1]
                        const period = timePart.toLowerCase().includes('pm') ? 'PM' : 'AM'
                        return `${shortDate} ${hour}:${minute}${period}`
                    }
                }
            }
        } catch (e) {
            // Fallback
        }
        return dateStr
    }

    private leftRight(left: string, right: string): string {
        const maxLeft = this.width - right.length - 1
        const truncatedLeft = left.length > maxLeft
            ? left.substring(0, maxLeft - 2) + '..'
            : left
        const spaces = this.width - truncatedLeft.length - right.length
        return truncatedLeft + ' '.repeat(Math.max(1, spaces)) + right + '\n'
    }

    private centerText(text: string, width: number): string {
        const pad = Math.max(0, Math.floor((width - text.length) / 2))
        return ' '.repeat(pad) + text
    }

    private padRight(text: string, width: number): string {
        return text.length >= width
            ? text.substring(0, width)
            : text + ' '.repeat(width - text.length)
    }

    private padLeft(text: string, width: number): string {
        return text.length >= width
            ? text.substring(0, width)
            : ' '.repeat(width - text.length) + text
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

        return lines.join('\n')
    }

    setWidth(width: number) {
        this.width = width
    }

    getWidth(): number {
        return this.width
    }
}

export default ThermalFormatter