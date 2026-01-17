// src/app/layout.tsx - UPDATED WITH SCROLL TO TOP + BOTTOM PADDING FIX
import type { Metadata, Viewport } from "next"
import "./globals.css"
import ThemeInitializer from "@/components/ThemeInitializer"
import ToastContainer from '@/components/ui/Toast'
import CommandPaletteWrapper from '@/components/CommandPaletteWrapper'
import InstallPrompt from '@/components/InstallPrompt'
import OfflineIndicator from '@/components/ui/OfflineIndicator'
import OfflineInitializer from '@/components/OfflineInitializer'
import SyncProgressIndicator from '@/components/ui/SyncProgressIndicator'
import ScrollToTop from '@/components/ui/ScrollToTop'
import { ErrorBoundary } from '@/components/ErrorBoundary'

import '@/lib/db/realtimeSync'


export const metadata: Metadata = {
    title: "AT Restaurant - Management System",
    description: "Professional restaurant management with offline support",
    appleWebApp: {
        capable: true,
        statusBarStyle: 'default',
        title: 'AT Restaurant'
    }
}

export const viewport: Viewport = {
    width: 'device-width',
    initialScale: 1,
    maximumScale: 1,
    userScalable: false,
    themeColor: [
        { media: '(prefers-color-scheme: light)', color: '#3b82f6' },
        { media: '(prefers-color-scheme: dark)', color: '#0a0a0a' }
    ]
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
    return (
        <html lang="en" suppressHydrationWarning>
        <head>
            {/* Theme initialization BEFORE any render */}
            <script dangerouslySetInnerHTML={{
                __html: `
                (function() {
                    try {
                        const stored = localStorage.getItem('theme-storage');
                        if (stored) {
                            const parsed = JSON.parse(stored);
                            const theme = parsed.state?.theme || 'light';
                            document.documentElement.classList.add(theme);
                            document.documentElement.setAttribute('data-theme', theme);
                        } else {
                            document.documentElement.classList.add('light');
                            document.documentElement.setAttribute('data-theme', 'light');
                        }
                    } catch (e) {
                        document.documentElement.classList.add('light');
                        document.documentElement.setAttribute('data-theme', 'light');
                    }
                })();
                `
            }} />

            {/* Dynamic manifest based on route */}
            <script dangerouslySetInnerHTML={{
                __html: `
                (function() {
                    const isAdmin = window.location.pathname.startsWith('/admin');
                    const manifest = isAdmin ? '/manifest-admin.json' : '/manifest-public.json';
                    const link = document.createElement('link');
                    link.rel = 'manifest';
                    link.href = manifest;
                    document.head.appendChild(link);
                    window.__APP_CONTEXT__ = isAdmin ? 'admin' : 'public';
                })();
                `
            }} />

            <link rel="apple-touch-icon" href="/icons/icon-192.png" />
            <link rel="icon" type="image/png" sizes="16x16" href="/icons/icon-16.png" />
            <link rel="icon" type="image/png" sizes="32x32" href="/icons/icon-32.png" />
            <link rel="icon" type="image/png" sizes="48x48" href="/icons/icon-48.png" />
            <link rel="shortcut icon" href="/icons/favicon.ico" />
            <meta name="mobile-web-app-capable" content="yes" />
            <meta name="apple-mobile-web-app-capable" content="yes" />

            {/* Service Worker with retry logic */}
            <script dangerouslySetInnerHTML={{
                __html: `
                if('serviceWorker' in navigator) {
                    let retries = 0;
                    const maxRetries = 3;
                    
                    const registerWithRetry = async () => {
                        try {
                            const reg = await navigator.serviceWorker.register('/sw.js');
                            console.log('✅ Service Worker registered:', reg.scope);
                            
                            reg.addEventListener('updatefound', () => {
                                const newWorker = reg.installing;
                                if (newWorker) {
                                    newWorker.addEventListener('statechange', () => {
                                        if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                                            if (confirm('🔄 New version available! Update now?')) {
                                                newWorker.postMessage({ type: 'SKIP_WAITING' });
                                                window.location.reload();
                                            }
                                        }
                                    });
                                }
                            });
                        } catch (err) {
                            if (retries < maxRetries) {
                                retries++;
                                console.warn('⚠️ SW registration failed, retrying...', retries);
                                setTimeout(registerWithRetry, 2000 * retries);
                            } else {
                                console.error('❌ Service Worker failed after retries:', err);
                            }
                        }
                    };
                    
                    window.addEventListener('load', registerWithRetry);
                }
                `
            }} />
        </head>
        <body className="antialiased">
        <ErrorBoundary>
            <ThemeInitializer />
            <OfflineInitializer />
            <ToastContainer />
            <OfflineIndicator />
            <SyncProgressIndicator />
            <CommandPaletteWrapper />
            <InstallPrompt />

            {/* ✅ Main content with proper mobile padding */}
            <main className="lg:ml-16 min-h-screen pb-15 lg:pb-0">
                {children}
            </main>

            {/* ✅ Global Scroll to Top Button */}
            <ScrollToTop />
        </ErrorBoundary>
        </body>
        </html>
    )
}