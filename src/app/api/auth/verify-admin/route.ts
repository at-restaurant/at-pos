import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import bcrypt from 'bcryptjs'

export async function POST(request: Request) {
    try {
        const { password } = await request.json()
        if (!password) return NextResponse.json({ error: 'Password required' }, { status: 400 })

        const supabase = await createClient()
        const { data: config, error } = await supabase
            .from('admin_config')
            .select('password_hash, name, profile_pic')
            .eq('id', 1)
            .single()

        if (error || !config?.password_hash) {
            return NextResponse.json({ error: 'Admin not configured' }, { status: 500 })
        }

        const valid = await bcrypt.compare(password, config.password_hash)
        if (!valid) return NextResponse.json({ error: 'Invalid password' }, { status: 401 })

        return NextResponse.json({
            success: true,
            profile: {
                name: config.name || 'Admin User',
                profile_pic: config.profile_pic || null
            }
        })
    } catch (error: any) {
        return NextResponse.json({ error: 'Authentication failed' }, { status: 500 })
    }
}
