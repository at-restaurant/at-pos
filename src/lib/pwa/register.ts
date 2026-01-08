'use client'

export function registerServiceWorker() {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return

    window.addEventListener('load', async () => {
        try {
            const registration = await navigator.serviceWorker.register('/sw.js')

            console.log('✅ Service Worker registered:', registration.scope)

            // Auto-update when new version available
            registration.addEventListener('updatefound', () => {
                const newWorker = registration.installing
                if (!newWorker) return

                newWorker.addEventListener('statechange', () => {
                    if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                        // New version available
                        if (confirm('🔄 New version available! Update now?')) {
                            newWorker.postMessage({ type: 'SKIP_WAITING' })
                            window.location.reload()
                        }
                    }
                })
            })

            // Pre-cache menu data when online
            if (navigator.onLine) {
                preCacheMenuData()
            }
        } catch (error) {
            console.error('❌ Service Worker registration failed:', error)
        }
    })
}

async function preCacheMenuData() {
    try {
        // Fetch menu & images to cache
        const response = await fetch('/api/cache-menu')
        const { urls } = await response.json()

        if (urls?.length && navigator.serviceWorker.controller) {
            navigator.serviceWorker.controller.postMessage({
                type: 'CACHE_MENU',
                urls
            })
        }
    } catch (error) {
        console.log('Menu pre-cache skipped:', error)
    }
}