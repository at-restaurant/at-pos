/** @type {import('next').NextConfig} */
const nextConfig = {
    reactStrictMode: true,

    // ✅ FIX: Conditional export - only for Electron
    output: process.env.BUILD_ELECTRON === 'true' ? 'export' : undefined,

    // ✅ Image optimization
    images: {
        unoptimized: process.env.BUILD_ELECTRON === 'true',
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

    // ✅ Trailing slash for Electron
    trailingSlash: process.env.BUILD_ELECTRON === 'true',

    // ✅ CRITICAL: Conditional experimental features
    experimental: process.env.BUILD_ELECTRON === 'true'
        ? {}  // Empty for Electron - no experimental features
        : {
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

    // ✅ Headers (only for web builds)
    async headers() {
        if (process.env.BUILD_ELECTRON === 'true') {
            return [];
        }

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

    // ✅ REMOVED: No turbopack config needed
};

module.exports = nextConfig;