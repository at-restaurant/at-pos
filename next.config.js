/** @type {import('next').NextConfig} */
const nextConfig = {
    reactStrictMode: true,

    // ✅ Web build (no static export)
    output: 'standalone',

    // ✅ Image optimization (Cloudinary)
    images: {
        remotePatterns: [
            {
                protocol: 'https',
                hostname: 'res.cloudinary.com',
                pathname: '/**',
            },
        ],
        formats: ['image/avif', 'image/webp'],
        minimumCacheTTL: 60,
    },

    // ✅ Experimental optimizations (Next 15 safe)
    // experimental: {
    //     optimizeCss: true,
    //     optimizePackageImports: [
    //         'lucide-react',
    //         'recharts',
    //         '@supabase/ssr',
    //     ],
    // },

    // ✅ Compiler options
    compiler: {
        removeConsole:
            process.env.NODE_ENV === 'production'
                ? { exclude: ['error', 'warn'] }
                : false,
    },

    // ✅ Headers (web only)
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
};

module.exports = nextConfig;
