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
    alias: [
      { find: '@', replacement: path.resolve(__dirname, './src') },
      // Specific paths FIRST - 'konva' alone would match konva/lib/Core.js too
      { find: 'konva/lib/Core.js', replacement: path.resolve(__dirname, './src/konva-shim.js') },
      { find: 'konva/lib/Global.js', replacement: path.resolve(__dirname, './src/konva-shim.js') },
      { find: 'konva', replacement: path.resolve(__dirname, './src/konva-shim.js') },
    ],
  },
  build: {
    outDir: 'dist',
    emptyOutDir: false,
    rollupOptions: {
      input: path.resolve(__dirname, 'moodboard.html'),
      output: {
        format: 'iife',
        entryFileNames: 'assets/moodboard-[hash].js',
        chunkFileNames: 'assets/moodboard-[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash][extname]',
        inlineDynamicImports: true,
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
