import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: Request) {
    try {
        const { name, bio, profile_pic } = await request.json()

        if (!name || name.trim().length < 2) {
            return NextResponse.json({ error: 'Name must be at least 2 characters' }, { status: 400 })
        }

        const supabase = await createClient()
        const { error } = await supabase
            .from('admin_config')
            .update({
                name: name.trim(),
                bio: bio?.trim() || null,
                profile_pic: profile_pic || null,
                updated_at: new Date().toISOString()
            })
            .eq('id', 1)

        if (error) throw error

        return NextResponse.json({
            success: true,
            profile: {
                name: name.trim(),
                bio: bio?.trim() || null,
                profile_pic: profile_pic || null
            }
        })
    } catch (error: any) {
        return NextResponse.json({ error: error.message || 'Update failed' }, { status: 500 })
    }
}