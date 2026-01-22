import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
    try {
        const supabase = await createClient()

        const today = new Date().toISOString().split('T')[0]
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
                    .eq('date', today)
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
                            date: today,
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
            date: today
        })

    } catch (error: any) {
        console.error('Daily reset error:', error)
        return NextResponse.json(
            { success: false, error: error.message },
            { status: 500 }
        )
    }
}
