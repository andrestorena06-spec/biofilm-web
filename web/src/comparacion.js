import { resumenBlancos } from './blancos.js'
import { resumenGrupo } from './estadistica.js'
import { ESCALAS, paletaMuestras } from './utils.js'
import { seroDe, serotiposDe } from './serotipos.js'

// aclara un color hsl(h, s%, l%) (f de 0 a 1): los tonos de una familia, uno por placa
export const aclarar = (col, f) => {
  const m = /hsl\((\d+),\s*(\d+)%,\s*(\d+)%\)/.exec(col)
  if (!m) return col
  return `hsl(${m[1]}, ${m[2]}%, ${(Number(m[3]) + (88 - Number(m[3])) * f).toFixed(0)}%)`
}

export const ERR_TXT = { ic95: 'IC 95 %', sd: 'desviación estándar', sem: 'error estándar', ninguno: '' }

// Arma los datos de la comparación entre placas a partir de las opciones de «Comparar»:
//  modo 'placas'  → una columna por placa
//  modo 'medio'   → una columna por medio de cultivo. «Datos de cada medio» decide el nivel de TODO (media, error,
//                   dispersión, puntos y pruebas): todos los pocillos del medio, o un valor por placa (réplica biológica)
//  modo 'todas'   → una columna por cepa con todas las placas juntas (sin separar por medio), con las mismas opciones
//  modo 'pocillo' → una columna por pocillo
// agrupar 'serotipo' → cada grupo del eje X es un serotipo (sus cepas juntas) en vez de una cepa; «Datos del serotipo»
//                   decide los valores: uno por cepa (la media de sus placas), uno por placa de cada cepa, o los pocillos
// Los elementos que se dibujan (barras, cajas, puntos, errores, valores) los decide el gráfico con las mismas opciones.
export function armarComparacion(s) {
  const o = s.opts.comparar
  // serotipos presentes (sin blancos): con «Agrupar por serotipo» reemplazan a las cepas en el eje X
  const serosAll = serotiposDe(s.exp, s.muestras)
  const porSero = o.agrupar === 'serotipo' && serosAll.length > 0
  const modo0 = ['placas', 'medio', 'todas', 'pocillo'].includes(o.modo) ? o.modo : 'placas'
  const modo = porSero && modo0 === 'pocillo' ? 'placas' : modo0
  const verBlancos = o.blancos !== false
  const conAnalisis = s.placas.filter((p) => !p.oculta && s.analisisMap[p.id]?.resumen?.length)
  // se guardan las placas que se sacaron: una placa nueva entra sola en la comparación y en la estadística
  const fueraPl = new Set(o.placasFuera || [])
  // escalas relativas al ODc (botón «Escala» de Gráfico): cada valor se mide contra el ODc de su propia placa
  const escala = ESCALAS[s.opts.barras?.escala]?.f ? s.opts.barras.escala : 'od'
  const rel = escala !== 'od'
  const odcDe = (p) => s.analisisMap[p.id]?.odc?.odc
  const restaDe = (p) => s.analisisMap[p.id]?.odc?.resta || 0     // blanco restado (la razón usa la OD leída)
  const corregida = conAnalisis.some((p) => s.analisisMap[p.id]?.blanco?.restado)
  const sinOdc = rel ? conAnalisis.filter((p) => !fueraPl.has(p.id) && !(odcDe(p) > 0)) : []
  const sel0 = conAnalisis.filter((p) => !fueraPl.has(p.id) && !sinOdc.includes(p))
  const tv = rel ? (p, v) => ESCALAS[escala].f(v, odcDe(p), restaDe(p)) : (p, v) => v
  const V = (p, v) => (rel ? `${tv(p, v).toFixed(3)} (OD ${(v + restaDe(p)).toFixed(3)})` : v.toFixed(3))
  // las placas se ordenan por medio de cultivo (las del mismo medio quedan juntas)
  const ordenMedios = [...new Set(s.placas.map((p) => p.medio || ''))].filter(Boolean)
  const placasSel = [...sel0].sort((a, b) => (a.medio ? ordenMedios.indexOf(a.medio) : 999) - (b.medio ? ordenMedios.indexOf(b.medio) : 999))
  const mediosPres = [...new Set(placasSel.map((p) => p.medio).filter(Boolean))]
  const coloresMedio = paletaMuestras(mediosPres)
  const colorBase = paletaMuestras(s.placas.map((p) => p.id))
  // color de cada placa: familia de tonos del medio si lo tiene; si no, un color propio
  const colores = {}
  mediosPres.forEach((md) => {
    const ps = placasSel.filter((p) => p.medio === md)
    ps.forEach((p, i) => { colores[p.id] = aclarar(coloresMedio[md], ps.length > 1 ? (0.5 * i) / (ps.length - 1) : 0) })
  })
  placasSel.forEach((p) => { if (!colores[p.id]) colores[p.id] = colorBase[p.id] })

  const ocultos = new Set(o.ocultos || [])
  const clave = (id, m) => `${id}|${m}`
  const filasDe = (p) => [...s.analisisMap[p.id].resumen, ...(verBlancos ? resumenBlancos(s.analisisMap[p.id].estado) : [])]
  const nb = [...new Set(placasSel.flatMap((p) => s.analisisMap[p.id].resumen.map((r) => r.Muestra)))]
  const bl = verBlancos ? [...new Set(placasSel.flatMap((p) => resumenBlancos(s.analisisMap[p.id].estado).map((r) => r.Muestra)))].filter((m) => !nb.includes(m)) : []
  const muestras = [...s.muestras.filter((m) => nb.includes(m)), ...nb.filter((m) => !s.muestras.includes(m)), ...bl]
  const esBlanco = new Set(bl)
  const etiqueta = (m) => (esBlanco.has(m) ? `${m} (blanco)` : m)
  const tieneMuestra = (p, m) => filasDe(p).some((r) => r.Muestra === m)
  const pozos = (p, m) => s.analisisMap[p.id].estado.filter((e) => e.Muestra === m && e.Usado && Number.isFinite(tv(p, e.OD)))
  const errDe = (r) => (o.error === 'ic95' ? r.IC95 : o.error === 'sd' ? r.SD : o.error === 'sem' ? r.SEM : null)
  const errRg = (rg) => (o.error === 'ic95' ? rg.ic95 : o.error === 'sd' ? rg.sd : o.error === 'sem' ? rg.sem : null)
  const nombreP = (p) => p.nombre + (p.medio ? ` · ${p.medio}` : '')

  // una columna con varias placas juntas (las de un medio, o todas): «Datos» decide si cada placa aporta
  // todos sus pocillos o un solo valor (su media); la media, el error y los puntos salen de esos mismos datos
  const columnaJunta = (ps0, m, id, nombre, color, medio) => {
    const ps = ps0.filter((p) => !ocultos.has(clave(p.id, m)))
    const vp = ps.map((p) => ({ p, r: filasDe(p).find((x) => x.Muestra === m) })).filter((x) => x.r && Number.isFinite(tv(x.p, x.r.Media)))
    if (!vp.length) return []
    const porPlaca = o.puntosMedio === 'placas'
    const nPl = vp.length
    const detalle = porPlaca
      ? vp.map((x) => ({ v: tv(x.p, x.r.Media), color: colores[x.p.id], tip: `${x.p.nombre}: media ${V(x.p, x.r.Media)}` }))
      : vp.flatMap((x) => pozos(x.p, m).map((e) => ({ v: tv(x.p, e.OD), color: colores[x.p.id], tip: `${x.p.nombre} · ${e.Pocillo}: ${V(x.p, e.OD)}` })))
    const valores = detalle.map((d) => d.v)
    const rg = resumenGrupo(valores)
    const er = errRg(rg)
    const nTxt = porPlaca ? `n = ${nPl} ${nPl === 1 ? 'placa' : 'placas'}` : `n = ${valores.length} pocillos${nPl > 1 ? ` de ${nPl} placas` : ''}`
    return [{ id, medio, muestra: m, placa: `${nombre} (${nTxt})`, color,
      media: rg.media, err: Number.isFinite(er) ? er : null, pts: valores, detalle, vp: valores, nPlacas: nPl }]
  }

  const columnas = (m) => {
    if (modo === 'medio') return mediosPres.flatMap((md) => columnaJunta(placasSel.filter((p) => p.medio === md), m, md + '|' + m, md, coloresMedio[md], md))
    if (modo === 'todas') return columnaJunta(placasSel, m, 'todas|' + m, 'Todas las placas', '#6b8fb5', null)
    if (modo === 'pocillo') {
      return placasSel.flatMap((p) => {
        if (ocultos.has(clave(p.id, m))) return []
        return pozos(p, m).map((e) => ({
          id: `${p.id}|${m}|${e.Pocillo}`, placa: `${nombreP(p)} · ${e.Pocillo}`, color: colores[p.id], media: tv(p, e.OD), err: null, pts: [tv(p, e.OD)],
        }))
      })
    }
    return placasSel.flatMap((p) => {
      if (ocultos.has(clave(p.id, m))) return []
      const r = filasDe(p).find((x) => x.Muestra === m)
      if (!r || !Number.isFinite(tv(p, r.Media))) return []
      const pts = pozos(p, m).map((e) => tv(p, e.OD))
      // en las escalas relativas al ODc el error sale de los pocillos ya transformados
      const err = rel ? errRg(resumenGrupo(pts)) : errDe(r)
      return [{ id: p.id + '|' + m, placa: nombreP(p), color: colores[p.id], media: tv(p, r.Media), err: Number.isFinite(err) ? err : null, pts }]
    })
  }
  // ---- agrupado por serotipo: cada columna junta las cepas del serotipo ----
  const colorCepa = paletaMuestras(s.muestras)
  const datosSero = ['cepas', 'placas', 'pocillos'].includes(o.puntosSero) ? o.puntosSero : 'cepas'
  const columnaSero = (ps, cs, id, nombre, color, medio, unaPlaca) => {
    const pares = ps.flatMap((p) => cs.filter((c) => !ocultos.has(clave(p.id, c))).map((c) => ({ p, c, r: filasDe(p).find((x) => x.Muestra === c) })))
      .filter((x) => x.r && Number.isFinite(tv(x.p, x.r.Media)))
    if (!pares.length) return []
    const modoD = unaPlaca ? 'cepas' : datosSero
    let detalle
    if (modoD === 'pocillos') detalle = pares.flatMap((x) => pozos(x.p, x.c).map((e) => ({ v: tv(x.p, e.OD), color: colores[x.p.id], tip: `${x.c} · ${x.p.nombre} · ${e.Pocillo}: ${V(x.p, e.OD)}` })))
    else if (modoD === 'placas') detalle = pares.map((x) => ({ v: tv(x.p, x.r.Media), color: colores[x.p.id], tip: `${x.c} · ${x.p.nombre}: media ${V(x.p, x.r.Media)}` }))
    else detalle = [...new Set(pares.map((x) => x.c))].map((c) => {
      const vs = pares.filter((x) => x.c === c).map((x) => tv(x.p, x.r.Media))
      const v = vs.reduce((a, b) => a + b, 0) / vs.length
      return { v, color: colorCepa[c], tip: `${c}: ${v.toFixed(3)}${vs.length > 1 ? ` (media de ${vs.length} placas)` : ''}` }
    })
    const valores = detalle.map((d) => d.v)
    const rg = resumenGrupo(valores)
    const er = errRg(rg)
    const nC = new Set(pares.map((x) => x.c)).size
    const nTxt = modoD === 'cepas' ? `n = ${nC} ${nC === 1 ? 'cepa' : 'cepas'}` : modoD === 'placas' ? `n = ${valores.length} placas de ${nC} cepas` : `n = ${valores.length} pocillos`
    return [{ id, medio, muestra: nombre, placa: `${nombre} (${nTxt})`, color, media: rg.media, err: Number.isFinite(er) ? er : null, pts: valores, detalle, vp: valores, nPlacas: ps.length }]
  }
  const columnasSero = (sr) => {
    const cs = muestras.filter((m) => !esBlanco.has(m) && seroDe(s.exp, m) === sr)
    if (modo === 'medio') return mediosPres.flatMap((md) => columnaSero(placasSel.filter((p) => p.medio === md), cs, md + '|' + sr, md, coloresMedio[md], md))
    if (modo === 'todas') return columnaSero(placasSel, cs, 'todas|' + sr, 'Todas las placas', '#6b8fb5', null)
    return placasSel.flatMap((p) => columnaSero([p], cs, p.id + '|' + sr, nombreP(p), colores[p.id], p.medio, true))
  }
  const nCepasSero = (sr) => muestras.filter((m) => !esBlanco.has(m) && seroDe(s.exp, m) === sr).length
  const grupos = porSero
    ? serosAll.map((sr) => ({ muestra: sr, etiqueta: `${sr} (${nCepasSero(sr)} ${nCepasSero(sr) === 1 ? 'cepa' : 'cepas'})`, barras: columnasSero(sr) })).filter((g) => g.barras.length)
    : muestras.map((m) => ({ muestra: m, etiqueta: etiqueta(m), barras: columnas(m) })).filter((g) => g.barras.length)
  // orden del eje X: el de la lista, o por la media de todas las columnas del grupo (los blancos siempre al final)
  if (o.ordenGrupos === 'asc' || o.ordenGrupos === 'desc') {
    const prom = (g) => { const v = g.barras.map((b) => b.media).filter(Number.isFinite); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : -Infinity }
    const signo = o.ordenGrupos === 'asc' ? 1 : -1
    grupos.sort((a, b) => (esBlanco.has(a.muestra) - esBlanco.has(b.muestra)) || signo * (prom(a) - prom(b)))
  }
  const leyenda = modo === 'medio'
    ? mediosPres.filter((md) => grupos.some((g) => g.barras.some((b) => b.id.startsWith(md + '|')))).map((md) => ({ id: md, nombre: md, color: coloresMedio[md] }))
    : placasSel.map((p) => ({ id: p.id, nombre: nombreP(p), color: colores[p.id] }))
  const notaOD = modo === 'todas'
    ? (o.puntosMedio === 'placas'
      ? `Barra: promedio de todas las placas${ERR_TXT[o.error] ? `; error: ${ERR_TXT[o.error]} entre placas` : ''} · puntos: uno por placa, con el color de su placa`
      : `Barra: media de los pocillos de todas las placas${ERR_TXT[o.error] ? `; error: ${ERR_TXT[o.error]} entre pocillos` : ''} · puntos: pocillos, con el color de su placa`)
    : modo === 'medio'
    ? (o.puntosMedio === 'placas'
      ? `Barra: promedio de las placas de cada medio${ERR_TXT[o.error] ? `; error: ${ERR_TXT[o.error]} entre placas` : ''} · puntos: uno por placa`
      : `Barra: media de los pocillos del medio (todas sus placas)${ERR_TXT[o.error] ? `; error: ${ERR_TXT[o.error]} entre pocillos` : ''} · puntos: pocillos`)
    : modo === 'pocillo'
      ? 'Cada columna es un pocillo aceptado (OD)'
      : `Barra: OD media de las réplicas aceptadas de cada placa${ERR_TXT[o.error] ? `; error: ${ERR_TXT[o.error]} entre pocillos` : ''}`
  const notaSero = porSero ? ` · agrupado por serotipo: ${modo === 'placas' ? 'cada punto es una cepa en esa placa' : datosSero === 'cepas' ? 'cada punto es una cepa (la media de sus placas)' : datosSero === 'placas' ? 'cada punto es una placa de una cepa' : 'cada punto es un pocillo'}` : ''
  // agrupado por serotipo: la barra es la media del serotipo y el error se calcula entre sus cepas, placas o pocillos
  const unidadErr = modo === 'placas' || datosSero === 'cepas' ? 'cepas' : datosSero === 'placas' ? 'placas' : 'pocillos'
  const notaBase = porSero ? `Barra: media del serotipo${ERR_TXT[o.error] ? `; error: ${ERR_TXT[o.error]} entre ${unidadErr}` : ''}` : notaOD
  const nota0 = rel ? `${notaBase} · escala ${ESCALAS[escala].eje} con el ODc de cada placa` : corregida ? `${notaBase} · OD corregida = OD leída − blanco de cada placa` : notaBase
  const nota = nota0 + notaSero
  return {
    modo, verBlancos, conAnalisis, placasSel, mediosPres, coloresMedio, colorBase, colores, ocultos, clave, filasDe, muestras, esBlanco, etiqueta,
    tieneMuestra, grupos, leyenda, nota, sinMedio: placasSel.filter((p) => !p.medio), escala, rel, sinOdc, corregida, porSero, serotipos: serosAll, datosSero,
  }
}
