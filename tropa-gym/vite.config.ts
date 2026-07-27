import path from "node:path"
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      workbox: {
        // Precache del app shell — incluye los chunks de las rutas lazy
        // (Dashboard/Egresos/Configuración) porque quedan en dist/assets
        // igual que el resto del JS, Workbox no distingue "lazy" de "eager".
        globPatterns: ['**/*.{js,css,html,woff2,png,svg,ico}'],
        runtimeCaching: [
          {
            // Datos de Supabase: siempre frescos primero, cache solo como
            // fallback offline — nunca CacheFirst (doc pwa-performance-supabase).
            urlPattern: /^https:\/\/.*\.supabase\.co\/rest\/.*/,
            handler: 'NetworkFirst',
            options: { cacheName: 'supabase-cache', networkTimeoutSeconds: 5 },
          },
        ],
      },
      manifest: {
        name: 'Tropa Gym',
        short_name: 'Tropa Gym',
        theme_color: '#0d160b',
        background_color: '#0d160b',
        display: 'standalone',
        start_url: '/',
        icons: [
          {
            src: '/web-app-manifest-192x192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: '/web-app-manifest-192x192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'maskable',
          },
          {
            src: '/web-app-manifest-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: '/web-app-manifest-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    rolldownOptions: {
      output: {
        // Vite 8 usa Rolldown (no Rollup) — el equivalente de manualChunks
        // acá es codeSplitting.groups. Separa vendors grandes del código de
        // la app: cambian mucho menos seguido, así el navegador los cachea
        // aparte y no hay que re-descargarlos en cada deploy.
        codeSplitting: {
          groups: [
            { name: 'vendor-react', test: /node_modules[\\/](react|react-dom|react-router|react-router-dom|scheduler)[\\/]/ },
            { name: 'vendor-supabase', test: /node_modules[\\/]@supabase[\\/]/ },
            { name: 'vendor-query', test: /node_modules[\\/]@tanstack[\\/]/ },
          ],
        },
      },
    },
  },
})
