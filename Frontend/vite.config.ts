import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  optimizeDeps: {
    include: ['three'],
  },
  server: {
    port: 5173,
    proxy: {
      '/user': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        secure: false,
        bypass: (req) => {
          if (req.headers.accept?.includes('text/html')) {
            return '/index.html';
          }
        },
      },
      '/chat': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        secure: false,
        bypass: (req) => {
          if (req.headers.accept?.includes('text/html')) {
            return '/index.html';
          }
        },
      },
      '/msg': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        secure: false,
        bypass: (req) => {
          if (req.headers.accept?.includes('text/html')) {
            return '/index.html';
          }
        },
      },
    },
  },
})
