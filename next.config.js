/** @type {import('next').NextConfig} */
const nextConfig = {
    reactStrictMode: true,

    // ✅ Image optimization - Turbopack compatible and secure
    images: {
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
