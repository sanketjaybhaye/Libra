import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:4100',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: '../public',
    emptyOutDir: true,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            // Split React and scheduler core libraries
            if (id.includes('react') || id.includes('scheduler')) {
              return 'vendor-react';
            }
            // Split epubjs and pdfjs-dist engines
            if (id.includes('epubjs') || id.includes('pdfjs-dist')) {
              return 'vendor-readers';
            }
            // Split archive extraction libraries (JSZip, unrar)
            if (id.includes('jszip') || id.includes('node-unrar-js') || id.includes('unrar')) {
              return 'vendor-archives';
            }
            // Generic vendor libraries
            return 'vendor';
          }
        }
      }
    }
  },
})
