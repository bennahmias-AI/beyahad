import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      workbox: {
        // מגדילים את מגבלת גודל הקובץ ל-precache (ברירת המחדל 2MB)
        // — קובץ ה-JS הראשי גדול מ-2MB ואחרת הבנייה נכשלת.
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,  // 5MB
      },
      manifest: {
        name: 'ביחד — מערכת נגד בדידות',
        short_name: 'ביחד',
        lang: 'he',
        dir: 'rtl',
        start_url: '/',
        display: 'standalone',
        orientation: 'portrait',
        theme_color: '#F2E7CB',
        background_color: '#E5D9BD',
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
        ],
      },
    }),
  ],
  server: {
    host: true,
    port: 5173,
    proxy: {
      '/token': 'http://localhost:8080',
    },
  },
})
