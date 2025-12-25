import type { CapacitorConfig } from '@capacitor/cli';

// Set your production URL here
const PRODUCTION_URL = 'https://infolokerjombang.net'; // Change this to your actual production URL

const config: CapacitorConfig = {
  appId: 'com.infolokerjombang.hub',
  appName: 'ILJ Hub',
  webDir: 'out',

  // Load from web URL instead of bundled assets
  // This enables auto-update UI without reinstalling APK
  server: {
    url: PRODUCTION_URL,
    cleartext: true, // Allow HTTP for development (remove in production if using HTTPS)
  },

  // Android specific settings
  android: {
    // Allow loading from web URL
    allowMixedContent: true,
  }
};

export default config;

