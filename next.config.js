/** @type {import('next').NextConfig} */
const nextConfig = {
    reactStrictMode: true,

    // ✅ NEW: Export as static for Electron
    output: process.env.BUILD_ELECTRON ? 'export' : undefined,

    // ✅ UPDATED: Image optimization
    images: {
        unoptimized: process.env.BUILD_ELECTRON === 'true', // ✅ NEW
        remotePatterns: [
            {
                protocol: 'https',
                hostname: 'res.cloudinary.com',
                port: '',
                pathname: '/**',
            },
        ],
        formats: ['image/avif', 'image/webp'],
        minimumCacheTTL: 60,
    },

    // ✅ NEW: Trailing slash for better Electron routing
    trailingSlash: process.env.BUILD_ELECTRON === 'true',

    // ✅ Experimental features
    experimental: {
        optimizeCss: true,
        optimizePackageImports: [
            'lucide-react',
            'recharts',
            '@supabase/ssr',
        ],
    },

    // ✅ Compiler options
    compiler: {
        removeConsole:
            process.env.NODE_ENV === 'production'
                ? { exclude: ['error', 'warn'] }
                : false,
    },

    // ✅ Headers for caching
    async headers() {
        return [
            {
                source: '/fonts/:path*',
                headers: [
                    {
                        key: 'Cache-Control',
                        value: 'public, max-age=31536000, immutable',
                    },
                ],
            },
            {
                source: '/_next/static/:path*',
                headers: [
                    {
                        key: 'Cache-Control',
                        value: 'public, max-age=31536000, immutable',
                    },
                ],
            },
        ];
    },

    // ✅ Turbopack config
    turbopack: {},
};

module.exports = nextConfig;