// Service worker de Biofilm: deja la aplicación disponible sin conexión.
// Al instalarse guarda la página, los scripts y estilos (incluido el lector de .xls/.ods); después responde desde la memoria
// y se actualiza sola cuando hay una versión nueva.
const VERSION = 'biofilm-v1'
const BASE = self.registration.scope

async function precargar() {
  const cache = await caches.open(VERSION)
  const urls = new Set(['./', 'index.html', 'manifest.webmanifest', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-maskable-512.png', 'icons/apple-touch-icon.png'])
  try {
    const html = await (await fetch('index.html', { cache: 'no-store' })).text()
    for (const m of html.matchAll(/(?:src|href)="\.?\/?(assets\/[^"]+)"/g)) urls.add(m[1])
    // los módulos cargados bajo demanda (por ejemplo el lector de .xls/.ods) se nombran dentro del script principal
    for (const u of [...urls].filter((x) => x.endsWith('.js'))) {
      const js = await (await fetch(u)).text()
      for (const m of js.matchAll(/assets\/[A-Za-z0-9_.-]+\.(?:js|css)/g)) urls.add(m[0])
      for (const m of js.matchAll(/["'`]\.\/([A-Za-z0-9_.-]+\.(?:js|css))["'`]/g)) urls.add('assets/' + m[1])
    }
  } catch { /* sin conexión durante la instalación: se completa al navegar */ }
  await Promise.all([...urls].map((u) => cache.add(new Request(u, { cache: 'reload' })).catch(() => null)))
  // se descartan los archivos de versiones anteriores (los nombres de assets/ cambian en cada compilación)
  const vigentes = new Set([...urls].map((u) => new URL(u, BASE).href))
  for (const req of await cache.keys()) if (req.url.includes('/assets/') && !vigentes.has(req.url)) await cache.delete(req)
}

self.addEventListener('install', (e) => { e.waitUntil(precargar().then(() => self.skipWaiting())) })
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim()))
})
self.addEventListener('fetch', (e) => {
  const req = e.request
  if (req.method !== 'GET' || !req.url.startsWith(BASE)) return
  if (req.mode === 'navigate') {
    // la página: red primero (para tomar versiones nuevas) y, sin conexión, la guardada
    e.respondWith(fetch(req).then((r) => { const c = r.clone(); caches.open(VERSION).then((ca) => ca.put('index.html', c)); return r })
      .catch(() => caches.match('index.html').then((r) => r || caches.match('./'))))
    return
  }
  // el resto: lo guardado al instante y se refresca en segundo plano
  e.respondWith(caches.match(req).then((hit) => {
    const red = fetch(req).then((r) => { if (r && r.ok) { const c = r.clone(); caches.open(VERSION).then((ca) => ca.put(req, c)) } return r }).catch(() => hit)
    return hit || red
  }))
})
