// public/sw.js - PRODUCTION FIXED VERSION
// ✅ Auto-versioning to prevent cache issues
const BUILD_ID = new Date().getTime()
const VERSION = `v${BUILD_ID}`
const CACHE_NAME = `rt-restaurant-${VERSION}`
const RUNTIME_CACHE = `rt-runtime-${VERSION}`
const IMAGE_CACHE = `rt-images-${VERSION}`
const DATA_CACHE = `rt-data-${VERSION}`

// ✅ FIXED: Expanded critical routes for offline
const STATIC_ASSETS = [
    '/',
    '/admin',
    '/admin/login',
    '/admin/dashboard',
    '/admin/menu',
    '/admin/inventory',
    '/admin/history',
    '/orders',
    '/tables',
    '/attendance',
    '/offline.html',
    '/icons/icon-16.png',
    '/icons/icon-32.png',
    '/icons/icon-48.png',
    '/icons/icon-192.png',
    '/icons/icon-512.png',
    '/icons/favicon.ico'
]

// ✅ Install - Cache static assets
self.addEventListener('install', (event) => {
    console.log(`🔧 Installing Service Worker ${VERSION}...`)
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(STATIC_ASSETS).catch(err => {
                console.warn('⚠️ Some assets failed to cache:', err)
                // Continue anyway - don't block installation
            })
        })
    )
    self.skipWaiting()
})

// ✅ Activate - Clean old caches
self.addEventListener('activate', (event) => {
    console.log(`✅ Activating Service Worker ${VERSION}...`)
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

// ✅ FIXED: Smart fetch strategy
self.addEventListener('fetch', (event) => {
    const { request } = event
    const url = new URL(request.url)

    // Skip non-GET requests
    if (request.method !== 'GET') return

    // ✅ FIXED: Admin routes (Network First with Cache Fallback)
    if (url.pathname.startsWith('/admin')) {
        event.respondWith(
            fetch(request)
                .then(response => {
                    // Cache successful responses for offline use
                    if (response.ok && response.status === 200) {
                        const clone = response.clone()
                        caches.open(CACHE_NAME).then(cache => {
                            cache.put(request, clone).catch(err => {
                                console.warn('Cache put failed:', err)
                            })
                        })
                    }
                    return response
                })
                .catch(() => {
                    // Network failed - try cache
                    return caches.match(request).then(cached => {
                        if (cached) {
                            console.log('📦 Serving cached admin page:', url.pathname)
                            return cached
                        }

                        // ✅ FIXED: Smart fallback logic
                        // Only redirect to login for the root /admin route
                        if (url.pathname === '/admin' || url.pathname === '/admin/') {
                            return caches.match('/admin/login').then(loginPage => {
                                return loginPage || caches.match('/offline.html')
                            })
                        }

                        // For specific admin pages, try to serve from cache or show offline
                        return caches.match('/offline.html')
                    })
                })
        )
        return
    }

    // ✅ Public routes (Network First with Cache Fallback)
    if (url.pathname === '/' ||
        url.pathname.startsWith('/orders') ||
        url.pathname.startsWith('/tables') ||
        url.pathname.startsWith('/attendance')) {
        event.respondWith(
            fetch(request)
                .then(response => {
                    if (response.ok && response.status === 200) {
                        const clone = response.clone()
                        caches.open(CACHE_NAME).then(cache => {
                            cache.put(request, clone).catch(err => {
                                console.warn('Cache put failed:', err)
                            })
                        })
                    }
                    return response
                })
                .catch(() => {
                    return caches.match(request).then(cached => {
                        if (cached) {
                            console.log('📦 Serving cached page:', url.pathname)
                            return cached
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
                    // Cache essential data endpoints
                    if (url.pathname.includes('/menu_') ||
                        url.pathname.includes('/restaurant_tables') ||
                        url.pathname.includes('/waiters') ||
                        url.pathname.includes('/orders')) {
                        const clone = response.clone()
                        caches.open(DATA_CACHE).then(cache => {
                            cache.put(request, clone).catch(err => {
                                console.warn('Data cache failed:', err)
                            })
                        })
                    }
                    return response
                })
                .catch(() => {
                    return caches.match(request).then(cached => {
                        if (cached) {
                            console.log('📦 Serving cached data:', url.pathname)
                            return cached
                        }
                        // Return empty offline response for data requests
                        return new Response(JSON.stringify({ data: [], offline: true }), {
                            headers: { 'Content-Type': 'application/json' }
                        })
                    })
                })
        )
        return
    }

    // ✅ Images (Cache First with Network Fallback)
    if (request.destination === 'image' ||
        url.hostname.includes('cloudinary') ||
        url.hostname.includes('res.cloudinary.com')) {
        event.respondWith(
            caches.open(IMAGE_CACHE).then(cache => {
                return cache.match(request).then(cached => {
                    if (cached) return cached

                    return fetch(request).then(response => {
                        if (response.ok) {
                            cache.put(request, response.clone()).catch(err => {
                                console.warn('Image cache failed:', err)
                            })
                        }
                        return response
                    }).catch(() => {
                        // Return placeholder SVG for offline images
                        return new Response(
                            '<svg width="400" height="300" xmlns="http://www.w3.org/2000/svg"><rect width="400" height="300" fill="#f1f3f5"/><text x="50%" y="50%" text-anchor="middle" fill="#6b7280" font-size="16" font-family="system-ui">Image Offline</text></svg>',
                            { headers: { 'Content-Type': 'image/svg+xml' } }
                        )
                    })
                })
            })
        )
        return
    }

    // ✅ Static assets (Cache First with Network Fallback)
    event.respondWith(
        caches.match(request).then(cached => {
            if (cached) return cached

            return fetch(request).then(response => {
                // Cache scripts, styles, and fonts
                if (response.ok && (
                    request.destination === 'script' ||
                    request.destination === 'style' ||
                    request.destination === 'font'
                )) {
                    const clone = response.clone()
                    caches.open(CACHE_NAME).then(cache => {
                        cache.put(request, clone).catch(err => {
                            console.warn('Static asset cache failed:', err)
                        })
                    })
                }
                return response
            }).catch(() => {
                // Fallback for document requests
                if (request.destination === 'document') {
                    return caches.match('/offline.html')
                }
            })
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
                fetch(url)
                    .then(res => {
                        if (res.ok) cache.put(url, res)
                    })
                    .catch(() => {
                        console.warn('Failed to cache image:', url)
                    })
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

    if (event.data?.type === 'GET_CACHE_STATUS') {
        caches.keys().then(names => {
            event.ports[0].postMessage({
                version: VERSION,
                caches: names,
                currentVersion: VERSION
            })
        })
    }
})