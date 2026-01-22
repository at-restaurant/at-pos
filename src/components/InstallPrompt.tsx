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
        // ✅ FIXED: Check if already installed
        const isInstalled = window.matchMedia('(display-mode: standalone)').matches ||
            localStorage.getItem('app_installed') === 'true'

        if (isInstalled) return

        // ✅ Check if prompt was dismissed recently (24 hours)
        const dismissedAt = localStorage.getItem('install_prompt_dismissed')
        if (dismissedAt) {
            const hoursPassed = (Date.now() - parseInt(dismissedAt)) / (1000 * 60 * 60)
            if (hoursPassed < 24) return
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

        try {
            // ✅ Download data first for offline capability
            const result = await offlineManager.downloadAllData(true)

            if (result.success) {
                setDownloaded(true)

                // Wait a moment to show success state
                await new Promise(resolve => setTimeout(resolve, 500))

                // ✅ Show native install prompt
                deferredPrompt.prompt()
                const { outcome } = await deferredPrompt.userChoice

                if (outcome === 'accepted') {
                    localStorage.setItem('app_installed', 'true')
                    setShowPrompt(false)

                    // Show success message
                    if (typeof window !== 'undefined') {
                        window.dispatchEvent(new CustomEvent('toast-add', {
                            detail: {
                                type: 'success',
                                message: '✅ App installed successfully! Ready for offline use.'
                            }
                        }))
                    }
                } else {
                    // User cancelled installation
                    setDownloaded(false)
                }
            } else {
                // Download failed
                if (typeof window !== 'undefined') {
                    window.dispatchEvent(new CustomEvent('toast-add', {
                        detail: {
                            type: 'error',
                            message: '❌ Failed to download offline data. Please try again.'
                        }
                    }))
                }
            }
        } catch (error) {
            console.error('Installation error:', error)
            if (typeof window !== 'undefined') {
                window.dispatchEvent(new CustomEvent('toast-add', {
                    detail: {
                        type: 'error',
                        message: '❌ Installation failed. Please try again.'
                    }
                }))
            }
        } finally {
            setDeferredPrompt(null)
            setDownloading(false)
        }
    }

    const handleDismiss = () => {
        localStorage.setItem('install_prompt_dismissed', Date.now().toString())
        setShowPrompt(false)
    }

    // Don't show on login page
    const isLoginPage = pathname === '/admin/login'
    if (isLoginPage || !showPrompt || !deferredPrompt) return null

    return (
        <div className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-4 sm:max-w-sm z-[60] animate-in slide-in-from-bottom-4">
            <div className="bg-[var(--card)] border-2 border-blue-600 rounded-xl p-4 shadow-2xl">
                <div className="flex items-start gap-3">
                    <div className="w-12 h-12 bg-blue-600 rounded-lg flex items-center justify-center flex-shrink-0">
                        {downloaded ? (
                            <CheckCircle className="w-6 h-6 text-white" />
                        ) : (
                            <Download className="w-6 h-6 text-white" />
                        )}
                    </div>

                    <div className="flex-1 min-w-0">
                        <h3 className="font-bold text-[var(--fg)] mb-1">
                            {downloading ? '📥 Downloading...' :
                                downloaded ? '✅ Ready to Install!' :
                                    isAdmin ? '🛡️ AT Admin Panel' : '🍽️ AT Restaurant POS'}
                        </h3>
                        <p className="text-sm text-[var(--muted)] mb-3">
                            {downloading ? 'Caching data for offline use...' :
                                downloaded ? 'All data ready! Install now for offline access' :
                                    'Works offline • Fast • Professional'}
                        </p>

                        {!downloading && (
                            <div className="flex gap-2">
                                <button
                                    onClick={handleInstall}
                                    disabled={downloading}
                                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg font-medium text-sm hover:bg-blue-700 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {downloaded ? 'Install App' : 'Download & Install'}
                                </button>
                                <button
                                    onClick={handleDismiss}
                                    className="px-3 py-2 bg-[var(--bg)] border border-[var(--border)] rounded-lg hover:bg-[var(--card)] transition-colors"
                                >
                                    <X className="w-5 h-5 text-[var(--muted)]" />
                                </button>
                            </div>
                        )}

                        {downloading && (
                            <div className="w-full h-2 bg-[var(--bg)] rounded-full overflow-hidden">
                                <div className="h-full bg-blue-600 rounded-full animate-pulse" style={{ width: '100%' }} />
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}