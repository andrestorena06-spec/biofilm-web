// Datos de la estadística (uno por placa y uno por pocillo) y los resúmenes de pruebas que van en el informe:
// entre placas de cada medio, entre medios y entre las variantes de cada cepa (L100A1, L100A1 Rug, L100A1 SCV…).
import { armarComparacion } from './comparacion.js'
import { analizar } from './decision.js'
import { desvio, media } from './estadistica.js'

const finito = Number.isFinite
export const SIN_MEDIO = '(sin medio)'
export const UNIDAD = { od: 'OD', ln: 'ln(OD)', odc: 'OD ÷ ODc' }

// Valores de cada cepa en cada placa: uno por placa (la OD media de sus pocillos aceptados) y uno por pocillo
export function prepararDatos(s, D, variable) {
  const fx = (y, odc) => (variable === 'ln' ? (y > 0 ? Math.log(y) : NaN) : variable === 'odc' ? (odc > 0 ? y / odc : NaN) : y)
  const orden = [...new Set(s.placas.map((p) => p.medio).filter(Boolean))]
  const placas = [...D.conAnalisis].sort((a, b) => (a.medio ? orden.indexOf(a.medio) : 999) - (b.medio ? orden.indexOf(b.medio) : 999))
  const obsPlaca = [], obsPozo = [], fuera = []
  placas.forEach((p) => {
    const a = s.analisisMap[p.id], odc = a.odc?.odc, medio = p.medio || SIN_MEDIO
    a.resumen.forEach((r) => {
      const y = finito(r.Media) ? fx(r.Media, odc) : NaN
      if (finito(y)) obsPlaca.push({ cepa: r.Muestra, medio, placaId: p.id, placa: p.nombre, y, etq: p.nombre, clase: r.Clasificacion })
    })
    a.estado.forEach((e) => {
      if (e.EsBlanco) return
      if (!e.Usado) { fuera.push({ cepa: e.Muestra, placaId: p.id, etq: `${p.nombre} · ${e.Pocillo}`, od: e.OD, motivo: e.Manual ? 'excluido a mano' : 'valor atípico' }); return }
      const y = fx(e.OD, odc)
      if (finito(y)) obsPozo.push({ cepa: e.Muestra, medio, placaId: p.id, placa: p.nombre, y, etq: `${p.nombre} · ${e.Pocillo}` })
    })
  })
  const presentes = [...new Set(obsPlaca.map((x) => x.cepa))]
  const cepas = [...s.muestras.filter((m) => presentes.includes(m)), ...presentes.filter((m) => !s.muestras.includes(m))]
  const medios = orden.filter((m) => placas.some((p) => p.medio === m))
  // la escala relativa al ODc deja afuera las placas sin ODc
  const sinOdc = variable === 'odc' ? placas.filter((p) => !(s.analisisMap[p.id].odc?.odc > 0)) : []
  return { placas, obsPlaca, obsPozo, fuera, cepas, medios, sinOdc }
}

// familia de una cepa: el nombre hasta el primer espacio (L100A1 Rug y L100A1 SCV son variantes de L100A1)
export const familiaDe = (cepa) => String(cepa).trim().split(/\s+/)[0]

// Resúmenes para el informe, con las mismas opciones que la pestaña Estadística (variable, réplica, prueba y ajuste).
// Las placas sacadas de las pruebas en Estadística tampoco entran acá.
export function resumenesInforme(s) {
  const o = s.opts.comparar
  const D = armarComparacion(s)
  const variable = UNIDAD[o.variable] ? o.variable : 'od'
  const X = prepararDatos(s, D, variable)
  const fueraPl = new Set(o.ePlacasFuera || [])
  const placasUsadas = X.placas.filter((p) => !fueraPl.has(p.id))
  const usada = (x) => placasUsadas.some((p) => p.id === x.placaId)
  const nivel = o.nivel === 'pocillo' ? 'pocillo' : 'placa'
  const obsN = nivel === 'placa' ? X.obsPlaca : X.obsPozo
  const forzado = o.prueba || 'auto', ajuste = o.ajuste === 'lsd' ? 'lsd' : 'holm'
  const grupo = (nombre, obs) => { const v = obs.map((x) => x.y); return { nombre, v, m: v.length ? media(v) : NaN, de: v.length > 1 ? desvio(v) : NaN } }
  const correr = (gs) => { const c = gs.filter((g) => g.v.length); return c.length >= 2 ? analizar(c, forzado, null, ajuste) : null }

  // 1. entre las placas de cada medio, cepa por cepa (los pocillos son las réplicas)
  const placas = X.medios.map((md) => {
    const ps = placasUsadas.filter((p) => p.medio === md)
    if (ps.length < 2) return null
    const filas = X.cepas.map((c) => {
      const gs = ps.map((p) => grupo(p.nombre, X.obsPozo.filter((x) => x.cepa === c && x.placaId === p.id)))
      return { cepa: c, grupos: gs, r: correr(gs) }
    })
    return { medio: md, placas: ps, filas }
  }).filter(Boolean)

  // 2. entre medios, cepa por cepa
  const medios = X.medios.length >= 2
    ? X.cepas.map((c) => { const gs = X.medios.map((m) => grupo(m, obsN.filter((x) => x.cepa === c && x.medio === m && usada(x)))); return { cepa: c, grupos: gs, r: correr(gs) } })
    : []

  // 3. entre las variantes de cada cepa, medio por medio
  const familias = [...new Set(X.cepas.map(familiaDe))]
    .map((b) => ({ base: b, cepas: X.cepas.filter((c) => familiaDe(c) === b) }))
    .filter((fm) => fm.cepas.length >= 2)
    .map((fm) => ({
      ...fm,
      porMedio: (X.medios.length ? X.medios : [SIN_MEDIO]).map((md) => {
        const gs = fm.cepas.map((c) => grupo(c, obsN.filter((x) => x.cepa === c && (x.medio === md) && usada(x))))
        return { medio: md, grupos: gs, r: correr(gs) }
      }),
    }))

  return {
    variable, unidad: UNIDAD[variable], nivel, forzado, ajuste, mediosLista: X.medios, placas, medios, familias,
    fueraPl: X.placas.filter((p) => fueraPl.has(p.id)), sinOdc: X.sinOdc, sinMedio: X.placas.filter((p) => !p.medio),
  }
}
