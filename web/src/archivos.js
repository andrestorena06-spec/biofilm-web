// Archivo de la sesión abierta: «Guardar» escribe en el mismo archivo que se abrió (o en el último que se guardó).
// Usa la API de acceso a archivos de Chrome; el «manejador» de cada experimento se recuerda en IndexedDB para que
// también funcione al retomarlo desde «Recientes». En otros navegadores «Guardar» descarga el archivo.
const BD = 'biofilm-v3-archivos', ALMACEN = 'manejadores'
export const hayAccesoArchivos = () => typeof window !== 'undefined' && !!window.showOpenFilePicker && !!window.showSaveFilePicker
const TIPOS = [{ description: 'Sesión de Biofilm', accept: { 'application/json': ['.json'] } }]

function bd() {
  return new Promise((ok, mal) => {
    const r = indexedDB.open(BD, 1)
    r.onupgradeneeded = () => r.result.createObjectStore(ALMACEN)
    r.onsuccess = () => ok(r.result)
    r.onerror = () => mal(r.error)
  })
}
async function op(modo, f) {
  const db = await bd()
  return new Promise((ok, mal) => {
    const tx = db.transaction(ALMACEN, modo)
    const r = f(tx.objectStore(ALMACEN))
    tx.oncomplete = () => { ok(r?.result); db.close() }
    tx.onerror = () => { mal(tx.error); db.close() }
  })
}
export const recordarManejador = (id, h) => op('readwrite', (s) => s.put(h, id)).catch(() => {})
export const leerManejador = (id) => op('readonly', (s) => s.get(id)).catch(() => null)
export const olvidarManejador = (id) => op('readwrite', (s) => s.delete(id)).catch(() => {})

// Elegir una sesión con el cuadro del sistema: { file, handle } o null si se canceló
export async function elegirSesion() {
  try {
    const [h] = await window.showOpenFilePicker({ types: TIPOS, multiple: false })
    return { file: await h.getFile(), handle: h }
  } catch (e) {
    if (e?.name === 'AbortError') return null
    throw e
  }
}

// Escribe en un archivo ya elegido (pide permiso de escritura la primera vez)
export async function escribir(h, texto) {
  const p = await h.queryPermission?.({ mode: 'readwrite' })
  if (p !== 'granted' && (await h.requestPermission?.({ mode: 'readwrite' })) !== 'granted') throw new Error('Sin permiso para escribir en el archivo.')
  const w = await h.createWritable()
  await w.write(new Blob([texto], { type: 'application/json' }))
  await w.close()
}

// «Guardar como»: el usuario elige carpeta y nombre; devuelve el manejador o null si se canceló
export async function guardarComo(nombre, texto) {
  try {
    const h = await window.showSaveFilePicker({ suggestedName: nombre, types: TIPOS })
    await escribir(h, texto)
    return h
  } catch (e) {
    if (e?.name === 'AbortError') return null
    throw e
  }
}
