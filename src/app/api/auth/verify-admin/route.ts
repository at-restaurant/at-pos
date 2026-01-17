import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import bcrypt from 'bcryptjs'

export const dynamic = 'force-dynamic'
export const revalidate = false

export async function POST(request: Request) {
    try {
        const { password } = await request.json()

        if (!password) {
            return NextResponse.json({ error: 'Password required' }, { status: 400 })
        }

        // ✅ Check env vars first
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
        const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

        if (!supabaseUrl || !supabaseKey) {
            console.error('❌ Missing env vars')
            return NextResponse.json({
                error: 'Server configuration error'
            }, { status: 500 })
        }

        // ✅ Create client with proper key
        const supabase = createClient(supabaseUrl, supabaseKey)

        const { data: config, error } = await supabase
            .from('admin_config')
            .select('password_hash, name, profile_pic, bio')
            .eq('id', 1)
            .single()

        if (error) {
            console.error('DB Error:', error)
            return NextResponse.json({
                error: 'Database error: ' + error.message
            }, { status: 500 })
        }

        if (!config?.password_hash) {
            return NextResponse.json({
                error: 'Admin not configured'
            }, { status: 500 })
        }

        const valid = await bcrypt.compare(password, config.password_hash)

        if (!valid) {
            return NextResponse.json({
                error: 'Invalid password'
            }, { status: 401 })
        }

        return NextResponse.json({
            success: true,
            profile: {
                name: config.name || 'Admin User',
                bio: config.bio || null,
                profile_pic: config.profile_pic || null
            }
        })

    } catch (error: any) {
        console.error('💥 API Error:', error)
        return NextResponse.json({
            error: 'Server error: ' + error.message
        }, { status: 500 })
    }
}