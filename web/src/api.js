// Dos modos:
//  - Con R (por defecto): la interfaz consulta el motor de R en /api (abrir_biofilm_web.bat).
//  - Solo web (VITE_SOLO_WEB=1): todo se calcula en el navegador con motor.js, sin servidor.
const SOLO_WEB = import.meta.env.VITE_SOLO_WEB === '1'
export const MODO = SOLO_WEB ? 'web' : 'r'

// Error de red (no se pudo hablar con R) frente a error de cálculo (R respondió con un problema)
export class ErrorRed extends Error {}

async function pedir(url, opciones) {
  let r
  try {
    r = await fetch(url, opciones)
  } catch (e) {
    if (e.name === 'AbortError') throw e
    throw new ErrorRed('No se pudo conectar con el motor de cálculo (R).')
  }
  return r
}

async function manejar(r) {
  let j = null
  try {
    j = await r.json()
  } catch {
    /* sin cuerpo */
  }
  if (!r.ok) throw new Error((j && j.error) || `Error ${r.status} del motor de R`)
  return j
}

export async function hojasDe(file) {
  if (SOLO_WEB) return (await import('./motor.js')).hojasDe(file)
  const r = await pedir(`/api/hojas?nombre=${encodeURIComponent(file.name)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/octet-stream' },
    body: await file.arrayBuffer(),
  })
  return manejar(r)
}

export async function leerPlaca(file, hoja) {
  if (SOLO_WEB) return (await import('./motor.js')).leerPlaca(file, hoja)
  const r = await pedir(`/api/leer?nombre=${encodeURIComponent(file.name)}&hoja=${encodeURIComponent(hoja || '')}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/octet-stream' },
    body: await file.arrayBuffer(),
  })
  return manejar(r)
}

export async function analizar(payload, signal) {
  if (SOLO_WEB) return (await import('./motor.js')).analizarLocal(payload)
  const r = await pedir('/api/analizar', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    signal,
  })
  return manejar(r)
}

// Genera un Excel. hojas: [{nombre, columnas, filas}] con filas como objetos
export async function excelDe(hojas) {
  const conv = hojas.map((h) => ({ nombre: h.nombre, columnas: h.columnas, filas: h.filas.map((f) => h.columnas.map((c) => f[c] ?? null)) }))
  if (SOLO_WEB) return (await import('./motor.js')).excelLocal(conv)
  const r = await pedir('/api/excel', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ hojas: conv }),
  })
  if (!r.ok) throw new Error('No se pudo generar el Excel')
  return r.blob()
}

export async function ping() {
  if (SOLO_WEB) return true
  try {
    const r = await fetch('/api/ping')
    return r.ok
  } catch {
    return false
  }
}
