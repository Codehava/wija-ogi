const path = require('path');

/** @type {import('next').NextConfig} */
const nextConfig = {
    output: 'standalone',
    outputFileTracingRoot: path.resolve(__dirname),
    reactStrictMode: true,
    // Enforce type/lint checks during build for safer deploys.
    experimental: {
        workerThreads: false,
        cpus: 1
    },
    images: {
        remotePatterns: [
            {
                protocol: 'https',
                hostname: 'lh3.googleusercontent.com',
            },
            {
                protocol: 'http',
                hostname: 'localhost',
            },
            {
                protocol: 'http',
                hostname: 'minio',
            },
        ],
    },
    // M1 FIX: Security headers + CSP (allow Google OAuth + S3/MinIO)
    async headers() {
        const csp = [
            "default-src 'self'",
            "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
            "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
            "img-src 'self' data: blob: https://lh3.googleusercontent.com https://*.googleusercontent.com https://*.sslip.io",
            "font-src 'self' https://fonts.gstatic.com",
            "connect-src 'self' https://accounts.google.com https://oauth2.googleapis.com https://*.sslip.io",
            "frame-ancestors 'none'",
            "base-uri 'self'",
            "form-action 'self' https://accounts.google.com",
        ].join('; ');

        return [
            {
                source: '/(.*)',
                headers: [
                    { key: 'X-Frame-Options', value: 'DENY' },
                    { key: 'X-Content-Type-Options', value: 'nosniff' },
                    { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
                    { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
                    { key: 'X-DNS-Prefetch-Control', value: 'on' },
                    { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
                    { key: 'Content-Security-Policy', value: csp },
                ],
            },
        ];
    },
};

module.exports = nextConfig;
