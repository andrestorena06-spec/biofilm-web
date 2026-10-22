// ============================================================
// Experimento de biofilm: todo lo que se guarda (placas con los datos del Excel, configuración de pocillos,
// muestras, medios, exclusiones, ajustes, estilos y los datos del experimento).
// normalizarExp() abre cualquier sesión guardada por versiones anteriores del programa.
// ============================================================
import { normalizarEstilo } from './utils.js'

export const VERSION = 5
export const MUESTRAS_DEF = ['L100A1', 'L100A1 Rug', 'L100A1 SCV', 'L101B2', 'L101B2 Rug', 'L201', 'L201 Rug', 'BHI', 'TSBye']
export const MEDIOS_DEF = ['BHI', 'TSBye']
export const nuevoId = () => Math.random().toString(36).slice(2, 10)

export const optsDef = () => ({
  excluir: { puntos: true, medias: true, errores: false, error: 'sd', rotar: 45 },
  barras: {
    error: 'ic95', orden: 'lista', color: 'clase', puntos: true, medias: true, errores: true,
    lineas: true, valoresClase: false, rotar: 45, muestrasSel: null,
  },
  comparar: {
    error: 'sd', rotar: 45,
    placasSel: null, ocultos: [],   // ocultos: "idPlaca|muestra" que no se muestran
    modo: 'placas',                 // 'placas' (una columna por placa), 'medio' (placas del mismo medio juntas) o 'pocillo'
    barras: true, cajas: false, puntos: true, barrasError: true, valores: true, errores: false,
    puntosMedio: 'pocillos',        // por medio: puntos y cajas con todos los pocillos, o un valor por placa
    blancos: true,
  },
  archivo: { layoutBase: '', verOcultas: false },   // layoutBase: placa cuyo layout copian las nuevas
})
export const deteccionDef = () => ({ metodo: 'q', usar: false, conf: '95', cvMax: 20 })
// sesiones con métodos que ya no existen (Hampel, Dixon general) pasan al test Q
export const normDet = (d) => { const x = { ...deteccionDef(), ...d }; if (!['q', 'grubbs', 'cv'].includes(x.metodo)) x.metodo = 'q'; delete x.nsig; delete x.min; return x }

export const infoDef = () => ({ nombre: '', fecha: new Date().toISOString().slice(0, 10), organismo: '', responsable: '', equipo: '', temperatura: '', incubacion: '', tincion: 'Cristal violeta 0,1 %', notas: '' })
export const placaVacia = (nombre) => ({
  id: nuevoId(), nombre, archivo: null, placa: null, config: [], exclManual: [], exclForzado: [], blancosUsados: null, medio: '',
})

// pantallas: las sesiones de la versión 2 usaban otros nombres
const TAB_VIEJA = { archivo: 'placas', placa: 'pocillos', excluir: 'calidad', analisis: 'odc', comparar: 'grafico' }
export const PANTALLAS = ['resumen', 'placas', 'pocillos', 'calidad', 'odc', 'grafico', 'estadistica', 'datos', 'metodos']
const tabDe = (t) => { const x = TAB_VIEJA[t] || t; return PANTALLAS.includes(x) ? x : 'resumen' }

const optsDe = (x) => {
  const d = optsDef()
  const o = Object.fromEntries(Object.keys(d).map((k) => [k, { ...d[k], ...(x?.[k] || {}) }]))
  // la prueba que estaba dentro de «Comparar» (versión 2) ahora vive en la pestaña Estadística
  ;['test', 'control', 'testG', 'controlG', 'controlM'].forEach((k) => delete o.comparar[k])
  return o
}
const estilosDe = (x) => ({ barras: normalizarEstilo(x?.barras), excluir: normalizarEstilo(x?.excluir), comparar: normalizarEstilo(x?.comparar) })
const fechaCorta = (iso) => { try { return new Date(iso).toLocaleDateString('es') } catch { return '' } }

const normPlaca = (p) => ({
  exclManual: [], exclForzado: [], blancosUsados: null, config: [], medio: '', archivo: null, placa: null, ...p,
  id: p.id || nuevoId(), nombre: String(p.nombre || 'Placa'),
  config: (p.config || []).map((c) => ({ ...c, Replica: Number(c.Replica) || 1, EsBlanco: !!c.EsBlanco })),
})

// Experimento nuevo, vacío
export function expNuevo(nombre) {
  const hoy = new Date()
  return {
    id: nuevoId(), version: VERSION, info: { ...infoDef(), nombre: nombre || `Biofilm ${hoy.toLocaleDateString('es')}` },
    placas: [], muestras: [...MUESTRAS_DEF], medios: [...MEDIOS_DEF], deteccion: deteccionDef(), opts: optsDef(), estilos: estilosDe({}),
  }
}

// Abre una sesión de cualquier versión: { exp, tab, activaId, avisos }
export function normalizarExp(x) {
  if (!x || typeof x !== 'object') throw new Error('El archivo no es una sesión de Biofilm.')
  const avisos = []
  let placas
  if (Array.isArray(x.placas)) placas = x.placas.map(normPlaca)
  else if (Array.isArray(x.config)) {
    // versión 1: una sola placa y sin los datos del Excel
    placas = [{ ...placaVacia('Placa 1'), config: x.config, exclManual: x.exclManual || [], exclForzado: x.exclForzado || [], blancosUsados: x.blancosUsados ?? null }].map(normPlaca)
    avisos.push('Sesión de la primera versión: no traía los datos del Excel. Cargá el archivo de la placa en «Placas».')
  } else throw new Error('El archivo no es una sesión de Biofilm (no tiene placas).')
  // sin datos del experimento (versiones anteriores): la fecha es la del trabajo guardado
  const fechaGuardada = (() => { try { return new Date(x.guardado || x.fecha).toISOString().slice(0, 10) } catch { return '' } })()
  const info = { ...infoDef(), ...(x.info ? {} : { fecha: fechaGuardada }), ...(x.info || {}) }
  if (!info.nombre) info.nombre = x.fecha || x.guardado ? `Biofilm ${fechaCorta(x.guardado || x.fecha)}` : 'Experimento de biofilm'
  const muestras = Array.isArray(x.muestras) && x.muestras.length ? [...x.muestras] : [...MUESTRAS_DEF]
  // las muestras usadas en algún pocillo siempre están en la lista
  placas.forEach((p) => p.config.forEach((c) => { if (!muestras.includes(c.Muestra)) muestras.push(c.Muestra) }))
  const medios = Array.isArray(x.medios) && x.medios.length ? [...x.medios] : [...MEDIOS_DEF]
  placas.forEach((p) => { if (p.medio && !medios.includes(p.medio)) medios.push(p.medio) })
  const exp = {
    id: x.id || nuevoId(), version: VERSION, info, placas, muestras, medios,
    deteccion: normDet(x.deteccion || {}), opts: optsDe(x.opts), estilos: estilosDe(x.estilos),
  }
  const activaId = placas.some((p) => p.id === x.activaId) ? x.activaId : placas[0]?.id || null
  return { exp, tab: tabDe(x.tab), activaId, avisos }
}

// Lo que se descarga con «Guardar» (también lo leen las versiones anteriores: mismos campos que la versión 4)
export const aArchivo = (exp, tab, activaId) => ({ tipo: 'biofilm', ...exp, version: VERSION, guardado: new Date().toISOString(), tab, activaId })
export const nombreArchivo = (exp) => `${(exp.info.nombre || 'sesion_biofilm').replace(/[^\w\-áéíóúñÁÉÍÓÚÑ ]+/g, '_').trim() || 'sesion_biofilm'}.biofilm.json`

// Renombra una muestra en todo el experimento (lista, pocillos de todas las placas, selecciones de gráficos)
export function renombrarMuestra(exp, viejo, nuevo) {
  const cambia = (m) => (m === viejo ? nuevo : m)
  const o = exp.opts
  return {
    ...exp,
    muestras: exp.muestras.map(cambia),
    placas: exp.placas.map((p) => ({ ...p, config: p.config.map((c) => (c.Muestra === viejo ? { ...c, Muestra: nuevo } : c)), blancosUsados: p.blancosUsados ? p.blancosUsados.map(cambia) : p.blancosUsados })),
    opts: {
      ...o,
      barras: { ...o.barras, muestrasSel: o.barras.muestrasSel ? o.barras.muestrasSel.map(cambia) : null },
      comparar: {
        ...o.comparar,
        ocultos: (o.comparar.ocultos || []).map((k) => { const [id, m] = k.split('|'); return m === viejo ? `${id}|${nuevo}` : k }),
        eCepas: o.comparar.eCepas ? o.comparar.eCepas.map(cambia) : o.comparar.eCepas,
        ctrlCepa: o.comparar.ctrlCepa === viejo ? nuevo : o.comparar.ctrlCepa,
        libres: (o.comparar.libres || []).map((c) => ({ ...c, grupos: c.grupos.map((g) => (g.cepa === viejo ? { ...g, cepa: nuevo } : g)) })),
      },
    },
  }
}
// Renombra un medio de cultivo en todas las placas y en las selecciones de la estadística
export function renombrarMedio(exp, viejo, nuevo) {
  const cambia = (m) => (m === viejo ? nuevo : m)
  const c = exp.opts.comparar
  return {
    ...exp,
    medios: exp.medios.map(cambia),
    placas: exp.placas.map((p) => (p.medio === viejo ? { ...p, medio: nuevo } : p)),
    opts: { ...exp.opts, comparar: { ...c, eMedios: c.eMedios ? c.eMedios.map(cambia) : c.eMedios, ctrlMedio: c.ctrlMedio === viejo ? nuevo : c.ctrlMedio,
      libres: (c.libres || []).map((x) => ({ ...x, grupos: x.grupos.map((g) => (g.medio === viejo ? { ...g, medio: nuevo } : g)) })) } },
  }
}
export const usosMuestra = (exp, m) => exp.placas.reduce((a, p) => a + p.config.filter((c) => c.Muestra === m).length, 0)
export const usosMedio = (exp, m) => exp.placas.filter((p) => p.medio === m).length
