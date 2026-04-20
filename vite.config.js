import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:8081',
        changeOrigin: true
      },
      '/ws': {
        target: 'ws://localhost:8081',
        ws: true
      },
      '/uploads': {
        target: 'http://localhost:8081',
        changeOrigin: true
      }
    }
  }
})
