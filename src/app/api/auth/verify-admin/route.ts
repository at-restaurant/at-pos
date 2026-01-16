// src/app/api/auth/verify-admin/route.ts - WITH DEBUG LOGS
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import bcrypt from 'bcryptjs'

export const dynamic = 'force-dynamic'
export const revalidate = false

export async function POST(request: Request) {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log('🚀 [VERIFY-ADMIN] API Route Called')
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

    try {
        // Step 1: Parse request body
        console.log('📥 Step 1: Parsing request body...')
        const body = await request.json()
        const { password } = body
        console.log('✅ Request parsed:', {
            hasPassword: !!password,
            passwordLength: password?.length || 0
        })

        if (!password) {
            console.log('❌ ERROR: No password provided')
            return NextResponse.json({ error: 'Password required' }, { status: 400 })
        }

        // Step 2: Create Supabase client
        console.log('\n📡 Step 2: Creating Supabase client...')
        console.log('Environment check:', {
            hasUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
            hasKey: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
            url: process.env.NEXT_PUBLIC_SUPABASE_URL?.substring(0, 30) + '...'
        })

        const supabase = await createClient()
        console.log('✅ Supabase client created successfully')

        // Step 3: Query database
        console.log('\n🔍 Step 3: Querying admin_config table...')
        const { data: config, error } = await supabase
            .from('admin_config')
            .select('password_hash, name, profile_pic')
            .eq('id', 1)
            .single()

        console.log('Database query result:', {
            hasData: !!config,
            hasError: !!error,
            errorMessage: error?.message,
            errorCode: error?.code,
            errorDetails: error?.details,
            configKeys: config ? Object.keys(config) : []
        })

        if (error) {
            console.error('❌ DATABASE ERROR:', JSON.stringify(error, null, 2))
            return NextResponse.json({
                error: 'Database query failed',
                details: error.message
            }, { status: 500 })
        }

        if (!config) {
            console.log('❌ ERROR: No admin config found in database')
            return NextResponse.json({ error: 'Admin not configured' }, { status: 500 })
        }

        if (!config.password_hash) {
            console.log('❌ ERROR: password_hash is null or empty')
            return NextResponse.json({ error: 'Admin password not set' }, { status: 500 })
        }

        console.log('✅ Admin config found:', {
            hasPasswordHash: !!config.password_hash,
            hashPrefix: config.password_hash.substring(0, 10) + '...',
            name: config.name
        })

        // Step 4: Compare passwords
        console.log('\n🔐 Step 4: Comparing password with hash...')
        console.log('Password details:', {
            inputPasswordLength: password.length,
            storedHashLength: config.password_hash.length,
            hashAlgorithm: config.password_hash.substring(0, 4)
        })

        let valid = false
        try {
            valid = await bcrypt.compare(password, config.password_hash)
            console.log('✅ Password comparison completed:', { valid })
        } catch (bcryptError: any) {
            console.error('❌ BCRYPT ERROR:', bcryptError)
            return NextResponse.json({
                error: 'Password verification failed',
                details: bcryptError.message
            }, { status: 500 })
        }

        if (!valid) {
            console.log('❌ ERROR: Invalid password (passwords do not match)')
            return NextResponse.json({ error: 'Invalid password' }, { status: 401 })
        }

        // Step 5: Success - return profile
        console.log('\n✅ Step 5: Authentication successful!')
        const response = {
            success: true,
            profile: {
                name: config.name || 'Admin User',
                profile_pic: config.profile_pic || null
            }
        }
        console.log('📤 Sending response:', response)
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

        return NextResponse.json(response)

    } catch (error: any) {
        console.error('\n💥 UNHANDLED ERROR:')
        console.error('Error name:', error.name)
        console.error('Error message:', error.message)
        console.error('Error stack:', error.stack)
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

        return NextResponse.json({
            error: 'Authentication failed',
            details: error.message
        }, { status: 500 })
    }
}