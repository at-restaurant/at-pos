'use client'

import { useState, useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { Download, X, CheckCircle } from 'lucide-react'
import { offlineManager } from '@/lib/db/offlineManager'

export default function InstallPrompt() {
    const [deferredPrompt, setDeferredPrompt] = useState<any>(null)
    const [showPrompt, setShowPrompt] = useState(false)
    const [downloading, setDownloading] = useState(false)
    const [downloaded, setDownloaded] = useState(false)
    const pathname = usePathname()
    const isAdmin = pathname.startsWith('/admin')

    useEffect(() => {
        // ✅ Check if already installed
        const isInstalled = window.matchMedia('(display-mode: standalone)').matches ||
            localStorage.removeItem('install_prompt_dismissed')
        localStorage.removeItem('app_installed')
        if (isInstalled) return

        // ✅ Check if prompt was dismissed recently (24h)
        const dismissedAt = localStorage.getItem('install_prompt_dismissed')
        if (dismissedAt) {
            const daysPassed = (Date.now() - parseInt(dismissedAt)) / (1000 * 60 * 60 * 24)
            if (daysPassed < 1) return
        }

        const handler = (e: Event) => {
            e.preventDefault()
            setDeferredPrompt(e)

            // ✅ Show after 5 seconds on second visit
            const visitCount = parseInt(localStorage.getItem('visit_count') || '0')
            localStorage.setItem('visit_count', String(visitCount + 1))

            if (visitCount >= 1) {
                setTimeout(() => setShowPrompt(true), 5000)
            }
        }

        window.addEventListener('beforeinstallprompt', handler)
        return () => window.removeEventListener('beforeinstallprompt', handler)
    }, [])

    const handleInstall = async () => {
        if (!deferredPrompt) return

        setDownloading(true)

        // ✅ Download essential data first
        const result = await offlineManager.downloadEssentialData(true)

        if (result.success) {
            setDownloaded(true)

            // ✅ Show install prompt
            deferredPrompt.prompt()
            const { outcome } = await deferredPrompt.userChoice

            if (outcome === 'accepted') {
                localStorage.setItem('app_installed', 'true')
                setShowPrompt(false)
            }
        }

        setDeferredPrompt(null)
        setDownloading(false)
    }

    const handleDismiss = () => {
        localStorage.setItem('install_prompt_dismissed', Date.now().toString())
        setShowPrompt(false)
    }

    if (!showPrompt || !deferredPrompt) return null

    const isLoginPage = pathname === '/admin/login'
    if (isLoginPage) return null

    if (!showPrompt || !deferredPrompt) return null

    return (
        <div className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-4 sm:max-w-sm z-[60] animate-in slide-in-from-bottom-4">
            <div className="bg-[var(--card)] border-2 border-blue-600 rounded-xl p-4 shadow-2xl">
                <div className="flex items-start gap-3">
                    <div className="w-12 h-12 bg-blue-600 rounded-lg flex items-center justify-center flex-shrink-0">
                        {downloaded ? <CheckCircle className="w-6 h-6 text-white" /> : <Download className="w-6 h-6 text-white" />}
                    </div>


                    <div className="flex-1 min-w-0">
                        <h3 className="font-bold text-[var(--fg)] mb-1">
                            {downloading ? '📥 Downloading...' :
                                downloaded ? '✅ Ready to Install!' :
                                    isAdmin ? '🛡️ RT Admin Panel' : '🍽️ RT Restaurant Management'}
                        </h3>
                        <p className="text-sm text-[var(--muted)] mb-3">
                            {downloading ? 'Caching data for offline use...' :
                                downloaded ? 'All data ready! Install now' :
                                    'Works offline • Fast • Professional'}
                        </p>

                        {!downloading && (
                            <div className="flex gap-2">
                                <button
                                    onClick={handleInstall}
                                    disabled={downloading}
                                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg font-medium text-sm hover:bg-blue-700 active:scale-95 disabled:opacity-50"
                                >
                                    {downloaded ? 'Install App' : 'Download & Install'}
                                </button>
                                <button
                                    onClick={handleDismiss}
                                    className="px-3 py-2 bg-[var(--bg)] border border-[var(--border)] rounded-lg hover:bg-[var(--card)]"
                                >
                                    <X className="w-5 h-5 text-[var(--muted)]" />
                                </button>
                            </div>
                        )}

                        {downloading && (
                            <div className="w-full h-2 bg-[var(--bg)] rounded-full overflow-hidden">
                                <div className="h-full bg-blue-600 animate-pulse" style={{ width: '100%' }} />
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}