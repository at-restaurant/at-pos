import { NextResponse } from 'next/server'
import { archiveOldData } from '@/lib/utils/dbOptimizer'

export async function POST() {
    try {
        const result = await archiveOldData(90) // Keep 90 days
        return NextResponse.json(result)
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}