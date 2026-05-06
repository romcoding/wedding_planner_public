import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  // Fail the build immediately if VITE_API_URL is not set in production.
  // This prevents silent misconfiguration where all API calls return 404.
  if (mode === 'production' && !env.VITE_API_URL) {
    throw new Error(
      'VITE_API_URL is not set for production build.\n' +
      'Create wedding-planner-frontend/.env.production with:\n' +
      '  VITE_API_URL=https://wedding-planner-api.<subdomain>.workers.dev/api\n' +
      'See DEPLOY.md for details.'
    )
  }

  return {
    plugins: [react()],
    test: {
      globals: true,
      environment: 'jsdom',
      setupFiles: ['./src/test/setup.js'],
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    build: {
      rollupOptions: {
        // Only main app - moodboard built separately with vite.moodboard.config.js
        input: path.resolve(__dirname, 'index.html'),
      },
    },
    server: {
      port: 5173,
      proxy: {
        '/api': {
          target: 'http://localhost:5000',
          changeOrigin: true,
        },
      },
    },
  }
})
