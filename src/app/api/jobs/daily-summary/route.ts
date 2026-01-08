// src/app/api/jobs/daily-summary/route.ts
import { NextResponse } from 'next/server'
import { generateDailySummary } from '@/lib/utils/dbOptimizer'

// ✅ CRITICAL FIX: Required for static export compatibility
export const dynamic = 'force-static'
export const revalidate = false

// ✅ FIX: Only GET method works with static export
export async function GET() {
    // ⚠️ In Electron build, this route won't work anyway
    // Return static response for build compatibility
    if (process.env.BUILD_ELECTRON === 'true') {
        return NextResponse.json({
            message: 'API routes disabled in Electron build',
            electron: true
        })
    }

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