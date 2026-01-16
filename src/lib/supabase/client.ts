import { createBrowserClient } from '@supabase/ssr';

let cachedClient: ReturnType<typeof createBrowserClient> | null = null;

export function createClient() {
    // Return cached client if available
    if (cachedClient) {
        return cachedClient;
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

    // ✅ FIX: Better error handling
    if (!supabaseUrl || !supabaseKey) {
        console.error('❌ Missing Supabase environment variables')
        throw new Error('Missing Supabase credentials')
    }

    try {
        cachedClient = createBrowserClient(supabaseUrl, supabaseKey);
        return cachedClient;
    } catch (error) {
        console.error('❌ Failed to create Supabase client:', error)
        throw error;
    }
}

// ✅ NEW: Safe client creation (returns null on failure)
export function createClientSafe() {
    try {
        return createClient();
    } catch (error) {
        console.error('Safe client creation failed:', error);
        return null;
    }
}

// ✅ NEW: Check if client can be created
export function canCreateClient(): boolean {
    return !!(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}