import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

/** Compute the business date given the end_of_day_time setting. */
function getBusinessDate(endOfDayTime: string = '00:00'): string {
    const [endHour, endMin] = endOfDayTime.split(':').map(Number)
    const now = new Date()

    if (endHour === 0 && endMin === 0) {
        return now.toISOString().split('T')[0]
    }

    const currentTotalMin = now.getHours() * 60 + now.getMinutes()
    const endTotalMin = endHour * 60 + endMin

    if (currentTotalMin < endTotalMin) {
        // Still in previous business day
        const prev = new Date(now)
        prev.setDate(prev.getDate() - 1)
        return prev.toISOString().split('T')[0]
    }

    return now.toISOString().split('T')[0]
}

export async function POST(request: Request) {
    try {
        const supabase = await createClient()

        // Accept optional end_of_day_time from client
        let end_of_day_time = '00:00'
        try {
            const body = await request.json()
            if (body?.end_of_day_time) end_of_day_time = body.end_of_day_time
        } catch { /* ignore if no body */ }

        // Use business date (not necessarily today's calendar date)
        const businessDate = getBusinessDate(end_of_day_time)
        const currentTime = new Date().toTimeString().split(' ')[0].slice(0, 5)

        const { data: onDutyWaiters, error: fetchError } = await supabase
            .from('waiters')
            .select('id, name')
            .eq('is_on_duty', true)
            .eq('is_active', true)

        if (fetchError) throw fetchError

        if (onDutyWaiters && onDutyWaiters.length > 0) {
            for (const waiter of onDutyWaiters) {
                const { data: existing } = await supabase
                    .from('attendance')
                    .select('*')
                    .eq('waiter_id', waiter.id)
                    .eq('date', businessDate)
                    .single()

                if (existing) {
                    if (existing.check_in && !existing.check_out) {
                        const checkIn = new Date(`2000-01-01T${existing.check_in}`)
                        const checkOut = new Date(`2000-01-01T${currentTime}`)
                        const hours = (checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60)

                        await supabase
                            .from('attendance')
                            .update({
                                check_out: currentTime,
                                total_hours: Math.max(0, hours),
                                status: 'present'
                            })
                            .eq('id', existing.id)
                    }
                } else {
                    await supabase
                        .from('attendance')
                        .insert({
                            waiter_id: waiter.id,
                            date: businessDate,
                            check_in: '00:00',
                            check_out: currentTime,
                            status: 'present',
                            total_hours: 0
                        })
                }
            }

            const { error: resetError } = await supabase
                .from('waiters')
                .update({ is_on_duty: false })
                .eq('is_active', true)

            if (resetError) throw resetError
        }

        return NextResponse.json({
            success: true,
            message: `Daily reset completed. Processed ${onDutyWaiters?.length || 0} waiters.`,
            business_date: businessDate,
            end_of_day_time
        })

    } catch (error: any) {
        console.error('Daily reset error:', error)
        return NextResponse.json(
            { success: false, error: error.message },
            { status: 500 }
        )
    }
}
