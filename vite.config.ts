import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Cargar todas las variables de entorno del nivel actual
  const env = loadEnv(mode, (process as any).cwd(), '');

  return {
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
    define: {
      // EL PUENTE (TRADUCTOR):
      // Esto busca tu clave en las variables VITE_API_KEY, GEMINI_API_KEY o API_KEY
      // y la asigna a process.env.API_KEY para que la librería de Google la encuentre.
      'process.env.API_KEY': JSON.stringify(env.VITE_API_KEY || env.GEMINI_API_KEY || env.API_KEY || '')
    }
  }
})