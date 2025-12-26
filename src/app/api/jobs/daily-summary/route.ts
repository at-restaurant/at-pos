import { NextResponse } from 'next/server'
import { generateDailySummary } from '@/lib/utils/dbOptimizer'

export async function POST(request: Request) {
    try {
        const { date } = await request.json()
        const targetDate = date || new Date().toISOString().split('T')[0]

        const result = await generateDailySummary(targetDate)
        return NextResponse.json(result)
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}

// Auto-run daily summary for yesterday
export async function GET() {
    try {
        const yesterday = new Date()
        yesterday.setDate(yesterday.getDate() - 1)
        const date = yesterday.toISOString().split('T')[0]

        const result = await generateDailySummary(date)
        return NextResponse.json(result)
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}