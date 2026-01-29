/**
 * Separate Vite config for moodboard - builds as single self-contained bundle
 * to avoid "Cannot access before initialization" error from konva when
 * sharing chunks with main app.
 */
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: false, // Don't clear dist - main build runs first
    rollupOptions: {
      input: path.resolve(__dirname, 'moodboard.html'),
      output: {
        entryFileNames: 'assets/moodboard-[hash].js',
        chunkFileNames: 'assets/moodboard-[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash][extname]',
        inlineDynamicImports: true, // Single bundle - no code splitting
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
