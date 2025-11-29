import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg'],
      manifest: {
        name: 'MediRecordatorio AI',
        short_name: 'MediRecordatorio',
        description: 'Asistente inteligente para medicamentos',
        theme_color: '#ffffff',
        background_color: '#ffffff',
        display: 'standalone',
        scope: '/',
        start_url: '/',
        orientation: 'portrait',
        icons: [
          {
            src: 'icon.svg',
            sizes: '192x192',
            type: 'image/svg+xml',
            purpose: 'any maskable'
          },
          {
            src: 'icon.svg',
            sizes: '512x512',
            type: 'image/svg+xml',
            purpose: 'any maskable'
          }
        ]
      }
    })
  ],
  // Eliminamos la definición manual de process.env para permitir que Vite maneje 
  // las variables de entorno de forma nativa mediante import.meta.env
  define: {
    // Solo definimos process.env.API_KEY si existe en el entorno de build (útil para pruebas locales)
    // De lo contrario, dejamos que el código use import.meta.env
    'process.env.API_KEY': JSON.stringify(process.env.API_KEY)
  }
})