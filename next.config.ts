import type { NextConfig } from "next";

// Check if building for Capacitor (mobile)
const isCapacitorBuild = process.env.CAPACITOR_BUILD === 'true';

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,

  // Only use static export for Capacitor builds (middleware doesn't work with static export)
  ...(isCapacitorBuild && {
    output: 'export',
    // Ensure trailing slashes for proper routing in mobile app
    trailingSlash: true,
  }),

  // Disable image optimization (required for static export, optional for normal builds)
  images: {
    unoptimized: true,
  },

  // PWA and security headers
  async headers() {
    return [
      {
        source: '/sw.js',
        headers: [
          { key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' },
          { key: 'Service-Worker-Allowed', value: '/' },
        ],
      },
      {
        source: '/(.*)',
        headers: [
          // Security headers
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-XSS-Protection', value: '1; mode=block' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        ],
      },
    ];
  },
};

export default nextConfig;
