import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    rollupOptions: {
      output: {
        // Bundle konva + react-konva + MoodboardPage together to avoid
        // "Cannot access before initialization" error from konva internals
        manualChunks: (id) => {
          if (id.includes('MoodboardPage')) return 'moodboard'
          if (id.includes('node_modules/konva') || id.includes('node_modules/react-konva')) {
            return 'moodboard'
          }
          return undefined
        },
      },
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
})

