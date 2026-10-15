import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  // Must match PORT in api_server/.env. Override in .env.local if it is not 5000.
  const apiTarget = env.VITE_API_TARGET || 'http://localhost:5000'

  return {
    plugins: [react(), tailwindcss()],
    server: {
      // The API server's CORS origin and the reset-email link assume this port.
      port: 5173,
      strictPort: true,
      // Same-origin /api calls in development, so the session cookie is
      // never sent cross-origin and CORS is not involved.
      proxy: {
        '/api': { target: apiTarget },
      },
    },
  }
})
