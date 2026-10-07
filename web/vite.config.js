import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Desarrollo: npm run dev (el proxy manda /api al motor de R en el puerto 8765)
export default defineConfig({
  plugins: [react()],
  base: './',
  server: { port: 5173, proxy: { '/api': 'http://127.0.0.1:8765' } },
  build: { outDir: 'dist', emptyOutDir: true }
})
