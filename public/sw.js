// public/sw.js - COMPLETE OFFLINE SUPPORT
const VERSION = 'v3'
const CACHE_NAME = `rt-restaurant-${VERSION}`
const RUNTIME_CACHE = `rt-runtime-${VERSION}`
const IMAGE_CACHE = `rt-images-${VERSION}`
const DATA_CACHE = `rt-data-${VERSION}`

// ✅ Essential routes to cache
const STATIC_ASSETS = [
    '/',
    '/admin',
    '/admin/login',
    '/orders',
    '/tables',
    '/attendance',
    '/offline.html',
    '/icons/icon-192.png',
    '/icons/icon-512.png'
]

// ✅ Install - Cache static assets
self.addEventListener('install', (event) => {
    console.log('🔧 Installing Service Worker v3...')
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(STATIC_ASSETS).catch(err => {
                console.warn('⚠️ Some assets failed to cache:', err)
            })
        })
    )
    self.skipWaiting()
})

// ✅ Activate - Clean old caches
self.addEventListener('activate', (event) => {
    console.log('✅ Activating Service Worker v3...')
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (!cacheName.includes(VERSION)) {
                        console.log('🗑️ Deleting old cache:', cacheName)
                        return caches.delete(cacheName)
                    }
                })
            )
        })
    )
    self.clients.claim()
})

// ✅ Fetch Strategy
self.addEventListener('fetch', (event) => {
    const { request } = event
    const url = new URL(request.url)

    // Skip non-GET requests
    if (request.method !== 'GET') return

    // ✅ Admin routes (Cache First for offline)
    if (url.pathname.startsWith('/admin')) {
        event.respondWith(
            caches.match(request).then(cached => {
                if (cached) return cached

                return fetch(request).then(response => {
                    if (response.ok) {
                        const clone = response.clone()
                        caches.open(CACHE_NAME).then(cache => cache.put(request, clone))
                    }
                    return response
                }).catch(() => {
                    // Fallback to login page if offline
                    if (url.pathname !== '/admin/login') {
                        return caches.match('/admin/login')
                    }
                    return caches.match('/offline.html')
                })
            })
        )
        return
    }

    // ✅ Supabase API (Network First with Cache Fallback)
    if (url.origin.includes('supabase')) {
        event.respondWith(
            fetch(request)
                .then(response => {
                    // Cache essential data
                    if (url.pathname.includes('/menu_') ||
                        url.pathname.includes('/restaurant_tables') ||
                        url.pathname.includes('/waiters') ||
                        url.pathname.includes('/orders')) {
                        const clone = response.clone()
                        caches.open(DATA_CACHE).then(cache => cache.put(request, clone))
                    }
                    return response
                })
                .catch(() => {
                    return caches.match(request).then(cached => {
                        if (cached) {
                            console.log('📦 Serving from cache:', url.pathname)
                            return cached
                        }
                        // Return empty array for data requests
                        return new Response(JSON.stringify({ data: [], offline: true }), {
                            headers: { 'Content-Type': 'application/json' }
                        })
                    })
                })
        )
        return
    }

    // ✅ Images (Cache First)
    if (request.destination === 'image' ||
        url.hostname.includes('cloudinary') ||
        url.hostname.includes('res.cloudinary.com')) {
        event.respondWith(
            caches.open(IMAGE_CACHE).then(cache => {
                return cache.match(request).then(cached => {
                    if (cached) return cached

                    return fetch(request).then(response => {
                        if (response.ok) {
                            cache.put(request, response.clone())
                        }
                        return response
                    }).catch(() => {
                        // Return placeholder SVG
                        return new Response(
                            '<svg width="400" height="300" xmlns="http://www.w3.org/2000/svg"><rect width="400" height="300" fill="#f1f3f5"/><text x="50%" y="50%" text-anchor="middle" fill="#6b7280" font-size="16">Image Offline</text></svg>',
                            { headers: { 'Content-Type': 'image/svg+xml' } }
                        )
                    })
                })
            })
        )
        return
    }

    // ✅ Static assets (Cache First)
    event.respondWith(
        caches.match(request).then(cached => {
            if (cached) return cached

            return fetch(request).then(response => {
                if (request.destination === 'script' ||
                    request.destination === 'style' ||
                    request.destination === 'font') {
                    const clone = response.clone()
                    caches.open(CACHE_NAME).then(cache => cache.put(request, clone))
                }
                return response
            })
        }).catch(() => {
            if (request.destination === 'document') {
                return caches.match('/offline.html')
            }
        })
    )
})

// ✅ Message handler
self.addEventListener('message', (event) => {
    if (event.data?.type === 'SKIP_WAITING') {
        self.skipWaiting()
    }

    if (event.data?.type === 'CACHE_IMAGES') {
        const urls = event.data.urls || []
        caches.open(IMAGE_CACHE).then(cache => {
            urls.forEach(url => {
                fetch(url).then(res => {
                    if (res.ok) cache.put(url, res)
                }).catch(() => {})
            })
        })
    }

    if (event.data?.type === 'CLEAR_OLD_CACHE') {
        caches.keys().then(names => {
            names.forEach(name => {
                if (!name.includes(VERSION)) {
                    caches.delete(name)
                }
            })
        })
    }
})