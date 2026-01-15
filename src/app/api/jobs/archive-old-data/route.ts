// src/app/api/jobs/archive-old-data/route.ts - COMPLETE VERSION
import { NextResponse } from 'next/server'
import { archiveOldData } from '@/lib/utils/dbOptimizer'

export const dynamic = 'force-dynamic'
export const revalidate = false

export async function POST() {
    try {
        const result = await archiveOldData(90) // Keep 90 days
        return NextResponse.json(result)
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}