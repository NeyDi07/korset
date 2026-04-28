import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// ЛОКАЛЬНЫЙ DEV С API:
// `npm run dev` — только Vite (5173). Серверные функции /api/* не работают → в UI будут ошибки на AI/импорт/etc.
// `npm run dev:api` — запускает `vercel dev`, который поднимает настоящие api/*.js и проксирует vite внутри.
//
// Раньше здесь был localApiPlugin — дублирующий /api/ai с service-key без auth/rate-limit.
// Удалён в Этапе 1 hardening (дыра безопасности + drift от prod-версии api/ai.js).

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      srcDir: 'src',
      filename: 'sw.js',
      strategies: 'injectManifest',
      injectManifest: {
        swSrc: 'src/sw.js',
        swDest: 'dist/sw.js',
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2,webp,jpg,jpeg}'],
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024, // 3MB for banner images
      },
      manifest: {
        name: 'Körset',
        short_name: 'Körset',
        start_url: '/',
        display: 'standalone',
        background_color: '#070712',
        theme_color: '#7C3AED',
        icons: [
          { src: '/favicon.png', sizes: '192x192', type: 'image/png' },
          { src: '/logo.png', sizes: '512x512', type: 'image/png' },
        ],
      },
      workbox: {
        // Runtime caching options (precache manifest is built by injectManifest above)
      },
    }),
  ],
  base: '/',
  build: {
    chunkSizeWarningLimit: 1500,
  },
})
