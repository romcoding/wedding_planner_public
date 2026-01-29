/**
 * Separate Vite config for moodboard.
 * Konva is loaded via CDN script and aliased to a shim to bypass bundling -
 * fixes "Cannot access before initialization" error from konva's circular deps.
 */
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

const konvaShim = path.resolve(__dirname, 'src/konva-shim.js')

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
      { find: /^konva(\/.*)?$/, replacement: konvaShim },
      { find: '@', replacement: path.resolve(__dirname, './src') },
    ],
  },
  build: {
    outDir: 'dist',
    emptyOutDir: false,
    rollupOptions: {
      input: path.resolve(__dirname, 'moodboard.html'),
      output: {
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
