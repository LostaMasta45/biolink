import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,

  // Required for Capacitor - generates static HTML/JS/CSS
  output: 'export',

  // Disable image optimization for static export
  images: {
    unoptimized: true,
  },

  // Ensure trailing slashes for proper routing in mobile app
  trailingSlash: true,
};

export default nextConfig;
