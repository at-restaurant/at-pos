import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import bcrypt from 'bcryptjs'

export async function POST(request: Request) {
    try {
        const { currentPassword, newPassword } = await request.json()

        if (!currentPassword || !newPassword) {
            return NextResponse.json({ error: 'Both passwords required' }, { status: 400 })
        }

        if (newPassword.length < 8) {
            return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 })
        }

        const supabase = await createClient()
        const { data: config } = await supabase
            .from('admin_config')
            .select('password_hash')
            .single()

        if (!config) {
            return NextResponse.json({ error: 'Admin not configured' }, { status: 500 })
        }

        const valid = await bcrypt.compare(currentPassword, config.password_hash)
        if (!valid) {
            return NextResponse.json({ error: 'Current password is incorrect' }, { status: 401 })
        }

        const newHash = await bcrypt.hash(newPassword, 10)
        const { error } = await supabase
            .from('admin_config')
            .update({ password_hash: newHash, updated_at: new Date().toISOString() })
            .eq('id', 1)

        if (error) throw error

        return NextResponse.json({ success: true, message: 'Password updated successfully' })
    } catch (error: any) {
        console.error('Reset error:', error)
        return NextResponse.json({ error: error.message || 'Failed to reset password' }, { status: 500 })
    }
}