import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function createClient() {
    const cookieStore = await cookies()

    // ✅ ADD DEFAULT VALUES
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://wrofbpzrochttddtbxvj.supabase.co'
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Indyb2ZicHpyb2NodHRkZHRieHZqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY2NzgzNTYsImV4cCI6MjA4MjI1NDM1Nn0.LD1V4jXWtx8j6R2EjdPx8o9IfWdp7AHUwATZswUwfAQ'

    return createServerClient(
        supabaseUrl,
        supabaseKey,
        {
            cookies: {
                getAll: () => cookieStore.getAll(),
                setAll: (cookies) => {
                    try {
                        cookies.forEach(({ name, value, options }) =>
                            cookieStore.set(name, value, options)
                        )
                    } catch (error) {
                        // Ignore during build
                    }
                }
            }
        }
    )
}