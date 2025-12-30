// ============================================
// FILE: src/app/api/print/route.ts
// Next.js API Route (Proxy to printer service)
// ============================================

import { NextRequest, NextResponse } from 'next/server'

const PRINTER_SERVICE_URL = process.env.PRINTER_SERVICE_URL || 'http://localhost:3001'

export async function POST(request: NextRequest) {
    try {
        const body = await request.json()

        // Validate receipt data
        if (!body.orderNumber || !body.items) {
            return NextResponse.json(
                { success: false, error: 'Invalid receipt data' },
                { status: 400 }
            )
        }

        // Forward to printer service
        const response = await fetch(`${PRINTER_SERVICE_URL}/api/print`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(body),
            // Timeout after 10 seconds
            signal: AbortSignal.timeout(10000)
        })

        const result = await response.json()

        if (!response.ok) {
            return NextResponse.json(
                { success: false, error: result.error || 'Print failed' },
                { status: response.status }
            )
        }

        return NextResponse.json(result)

    } catch (error: any) {
        console.error('Print API error:', error)

        // Handle timeout
        if (error.name === 'TimeoutError' || error.name === 'AbortError') {
            return NextResponse.json(
                { success: false, error: 'Printer service timeout' },
                { status: 504 }
            )
        }

        // Handle connection refused
        if (error.code === 'ECONNREFUSED') {
            return NextResponse.json(
                {
                    success: false,
                    error: 'Printer service offline. Please start the printer server.'
                },
                { status: 503 }
            )
        }

        return NextResponse.json(
            { success: false, error: 'Print request failed' },
            { status: 500 }
        )
    }
}

// Health check
export async function GET() {
    try {
        const response = await fetch(`${PRINTER_SERVICE_URL}/api/health`, {
            signal: AbortSignal.timeout(5000)
        })
        const data = await response.json()
        return NextResponse.json(data)
    } catch {
        return NextResponse.json(
            { status: 'offline', printer: 'disconnected' },
            { status: 503 }
        )
    }
}