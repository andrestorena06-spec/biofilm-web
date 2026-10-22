import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import '@fontsource/ibm-plex-sans/latin-400.css'
import '@fontsource/ibm-plex-sans/latin-500.css'
import '@fontsource/ibm-plex-sans/latin-600.css'
import '@fontsource/ibm-plex-sans/latin-700.css'
import '@fontsource/ibm-plex-sans/greek-400.css'
import '@fontsource/ibm-plex-sans/greek-600.css'
import './styles.css'

// el tema se aplica antes de dibujar (sin destello claro al abrir en oscuro)
try { document.documentElement.dataset.tema = JSON.parse(localStorage.getItem('biofilm-v3-tema')) || 'claro' } catch { document.documentElement.dataset.tema = 'claro' }

createRoot(document.getElementById('root')).render(<App />)

// Aplicación instalable y disponible sin conexión (solo en la versión web; el archivo único se abre desde el disco)
if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
  window.addEventListener('load', () => { navigator.serviceWorker.register('./sw.js').catch(() => {}) })
}
