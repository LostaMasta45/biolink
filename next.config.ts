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
};

export default nextConfig;
