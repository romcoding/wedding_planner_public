/**
 * Separate Vite config for moodboard.
 * Konva is loaded from CDN and externalized - never bundled.
 * IIFE format + globals ensures the bundle uses window.Konva at runtime.
 */
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'moodboard-konva-cdn',
      apply: 'build',
      transformIndexHtml() {
        return {
          tags: [
            {
              tag: 'script',
              attrs: { src: 'https://unpkg.com/konva@9.3.6/konva.min.js' },
              injectTo: 'head-prepend',
            },
          ],
        }
      },
    },
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: false,
    rollupOptions: {
      input: path.resolve(__dirname, 'moodboard.html'),
      external: ['konva'],
      output: {
        format: 'iife',
        entryFileNames: 'assets/moodboard-[hash].js',
        chunkFileNames: 'assets/moodboard-[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash][extname]',
        inlineDynamicImports: true,
        globals: {
          konva: 'Konva',
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
