import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { viteSingleFile } from 'vite-plugin-singlefile'

// Desarrollo: npm run dev (el proxy manda /api al motor de R en el puerto 8765)
// Modos de compilación:
//   (por defecto)  interfaz que usa el motor de R            -> dist
//   web            todo en el navegador (GitHub Pages)       -> dist-web
//   single         un solo archivo .html que se abre con doble clic -> dist-single
export default defineConfig(({ mode }) => ({
  plugins: [react(), ...(mode === 'single' ? [viteSingleFile()] : [])],
  base: './',
  server: { port: 5173, proxy: { '/api': 'http://127.0.0.1:8765' } },
  build: { outDir: 'dist', emptyOutDir: true },
}))
