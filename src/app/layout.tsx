// src/app/layout.tsx - UPDATED WITH SYNC INTEGRATION
import type { Metadata, Viewport } from "next"
import { Geist } from "next/font/google"
import "./globals.css"
import ThemeInitializer from "@/components/ThemeInitializer"
import ToastContainer from '@/components/ui/Toast'
import CommandPaletteWrapper from '@/components/CommandPaletteWrapper'
import InstallPrompt from '@/components/InstallPrompt'
import OfflineIndicator from '@/components/ui/OfflineIndicator'
import OfflineInitializer from '@/components/OfflineInitializer'
import SyncProgressIndicator from '@/components/ui/SyncProgressIndicator'
import { ErrorBoundary } from '@/components/ErrorBoundary'

// ✅ IMPORT REALTIME SYNC (Auto-starts background sync)
import '@/lib/db/realtimeSync'

const geist = Geist({ variable: "--font-geist", subsets: ["latin"] })

export const metadata: Metadata = {
    title: "RT Restaurant - Management System",
    description: "Professional restaurant management with offline support",
    appleWebApp: {
        capable: true,
        statusBarStyle: 'default',
        title: 'RT Restaurant'
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

            <script dangerouslySetInnerHTML={{
                __html: `
                    if('serviceWorker' in navigator) {
                        window.addEventListener('load', async function() {
                            try {
                                const reg = await navigator.serviceWorker.register('/sw.js');
                                console.log('✅ Service Worker registered');
                                
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
                                console.error('❌ Service Worker failed:', err);
                            }
                        });
                    }
                `
            }} />
        </head>
        <body className={`${geist.variable} antialiased`}>
        <ErrorBoundary>
            <ThemeInitializer />
            <OfflineInitializer />
            <ToastContainer />
            <OfflineIndicator />
            <SyncProgressIndicator />
            <CommandPaletteWrapper />
            <InstallPrompt />
            <main className="lg:ml-16 min-h-screen">{children}</main>
        </ErrorBoundary>
        </body>
        </html>
    )
}