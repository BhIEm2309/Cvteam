import { ServerResponse } from 'node:http'
import path from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    // El navegador llama a /api en el mismo origen y Vite lo reenvía a la API: no hace falta CORS.
    // En Docker el destino es http://api:3000 (docker-compose.yml); fuera de Docker, localhost:3000.
    proxy: {
      '/api': {
        target: process.env.API_PROXY_TARGET ?? 'http://localhost:3000',
        changeOrigin: true,
        // Si la API está apagada, Vite responde 500 por defecto, igual que un error real de la API.
        // Se responde 503 con el encabezado X-Api-No-Disponible para que el frontend sepa que la API
        // no responde (y en modo "auto" use datos de ejemplo). Ver src/shared/lib/http.ts.
        configure: (proxy) => {
          proxy.on('error', (_error, _request, response) => {
            if (response instanceof ServerResponse && !response.headersSent) {
              response.writeHead(503, { 'Content-Type': 'application/json', 'X-Api-No-Disponible': '1' })
              response.end(JSON.stringify({ message: 'La API no responde.' }))
            }
          })
        },
      },
    },
    // Docker en Windows/macOS no avisa los cambios de archivos: se revisan periódicamente.
    watch: process.env.VITE_USE_POLLING === 'true' ? { usePolling: true, interval: 300 } : undefined,
  },
})
