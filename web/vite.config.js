import fs from 'fs'
import path from 'path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { viteSingleFile } from 'vite-plugin-singlefile'

// En el archivo único el ícono va adentro (data URI): Biofilm.html se abre con doble clic y no tiene la carpeta
// icons al lado. El manifiesto tampoco sirve fuera de un servidor, así que se quita.
const iconoAdentro = () => ({
  name: 'icono-adentro',
  transformIndexHtml(html) {
    const datos = (f) => 'data:image/png;base64,' + fs.readFileSync(path.resolve('public/icons', f)).toString('base64')
    return html
      .replace('href="./icons/icon-192.png"', () => `href="${datos('icon-192.png')}"`)
      .replace('href="./icons/apple-touch-icon.png"', () => `href="${datos('apple-touch-icon.png')}"`)
      .replace(/\s*<link rel="manifest"[^>]*>/, '')
  },
})

// Desarrollo: npm run dev (el proxy manda /api al motor de R en el puerto 8765)
// Modos de compilación:
//   (por defecto)  interfaz que usa el motor de R            -> dist
//   web            todo en el navegador (GitHub Pages)       -> dist-web
//   single         un solo archivo .html que se abre con doble clic -> dist-single
export default defineConfig(({ mode }) => ({
  plugins: [react(), ...(mode === 'single' ? [viteSingleFile(), iconoAdentro()] : [])],
  base: './',
  server: { port: 5173, proxy: { '/api': 'http://127.0.0.1:8765' } },
  build: { outDir: 'dist', emptyOutDir: true },
}))
