'use client'

import { useRouter } from 'next/navigation'
import { Home } from 'lucide-react'

export default function NotFound() {
    const router = useRouter()

    return (
        <div className="min-h-screen flex items-center justify-center bg-[var(--bg)]">
            <div className="text-center p-8">
                <div className="text-6xl mb-4">🔍</div>
                <h1 className="text-2xl font-bold text-[var(--fg)] mb-2">
                    Page Not Found
                </h1>
                <p className="text-[var(--muted)] mb-6">
                    The page you're looking for doesn't exist or has been moved.
                </p>
                <button
                    onClick={() => router.push('/')}
                    className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 inline-flex items-center gap-2"
                >
                    <Home className="w-5 h-5" />
                    Go Home
                </button>
            </div>
        </div>
    )
}