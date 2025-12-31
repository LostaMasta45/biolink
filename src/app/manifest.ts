import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
    return {
        name: 'ILJ Hub - Info Loker Jombang',
        short_name: 'ILJ Hub',
        description: 'Platform info lowongan kerja terlengkap di Jombang. Cari kerja? Kami bantu!',
        start_url: '/login',
        display: 'standalone',
        display_override: ['standalone', 'minimal-ui'],
        background_color: '#0a0a0a',
        theme_color: '#0a0a0a',
        orientation: 'portrait',
        categories: ['business', 'productivity'],
        scope: '/',
        lang: 'id',
        dir: 'ltr',
        prefer_related_applications: false,
        icons: [
            {
                src: '/icons/icon-72.png',
                sizes: '72x72',
                type: 'image/png',
            },
            {
                src: '/icons/icon-96.png',
                sizes: '96x96',
                type: 'image/png',
            },
            {
                src: '/icons/icon-128.png',
                sizes: '128x128',
                type: 'image/png',
            },
            {
                src: '/icons/icon-144.png',
                sizes: '144x144',
                type: 'image/png',
            },
            {
                src: '/icons/icon-152.png',
                sizes: '152x152',
                type: 'image/png',
            },
            {
                src: '/icons/icon-192.png',
                sizes: '192x192',
                type: 'image/png',
                purpose: 'maskable',
            },
            {
                src: '/icons/icon-384.png',
                sizes: '384x384',
                type: 'image/png',
            },
            {
                src: '/icons/icon-512.png',
                sizes: '512x512',
                type: 'image/png',
                purpose: 'any',
            },
            {
                src: '/icons/apple-touch-icon.png',
                sizes: '180x180',
                type: 'image/png',
            },
        ],
    }
}

