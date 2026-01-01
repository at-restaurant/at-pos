// src/app/api/print/route.ts - FIXED
import { NextRequest, NextResponse } from 'next/server'

// ✅ FIX: Use correct environment variable name
const PRINTER_SERVICE_URL = process.env.NEXT_PUBLIC_PRINTER_SERVICE_URL || 'http://localhost:3001'

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

        console.log('🖨️ Forwarding to:', PRINTER_SERVICE_URL)

        // Forward to printer service
        const response = await fetch(`${PRINTER_SERVICE_URL}/api/print`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(body),
            signal: AbortSignal.timeout(15000)
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

        if (error.name === 'TimeoutError' || error.name === 'AbortError') {
            return NextResponse.json(
                { success: false, error: 'Printer timeout. Check Cloudflare tunnel.' },
                { status: 504 }
            )
        }

        if (error.code === 'ECONNREFUSED') {
            return NextResponse.json(
                {
                    success: false,
                    error: 'Printer offline. Start: RUN-TUNNEL.bat'
                },
                { status: 503 }
            )
        }

        return NextResponse.json(
            { success: false, error: error.message || 'Print failed' },
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