import { resumenBlancos } from './blancos.js'
import { resumenGrupo } from './estadistica.js'
import { ESCALAS, paletaMuestras } from './utils.js'

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
//  modo 'pocillo' → una columna por pocillo
// Los elementos que se dibujan (barras, cajas, puntos, errores, valores) los decide el gráfico con las mismas opciones.
export function armarComparacion(s) {
  const o = s.opts.comparar
  const modo = ['placas', 'medio', 'pocillo'].includes(o.modo) ? o.modo : 'placas'
  const verBlancos = o.blancos !== false
  const conAnalisis = s.placas.filter((p) => !p.oculta && s.analisisMap[p.id]?.resumen?.length)
  // se guardan las placas que se sacaron: una placa nueva entra sola en la comparación y en la estadística
  const fueraPl = new Set(o.placasFuera || [])
  // escalas relativas al ODc (botón «Escala» de Gráfico): cada valor se mide contra el ODc de su propia placa
  const escala = ESCALAS[s.opts.barras?.escala]?.f ? s.opts.barras.escala : 'od'
  const rel = escala !== 'od'
  const odcDe = (p) => s.analisisMap[p.id]?.odc?.odc
  const sinOdc = rel ? conAnalisis.filter((p) => !fueraPl.has(p.id) && !(odcDe(p) > 0)) : []
  const sel0 = conAnalisis.filter((p) => !fueraPl.has(p.id) && !sinOdc.includes(p))
  const tv = rel ? (p, v) => ESCALAS[escala].f(v, odcDe(p)) : (p, v) => v
  const V = (p, v) => (rel ? `${tv(p, v).toFixed(3)} (OD ${v.toFixed(3)})` : v.toFixed(3))
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

  const columnas = (m) => {
    if (modo === 'medio') {
      return mediosPres.flatMap((md) => {
        const ps = placasSel.filter((p) => p.medio === md && !ocultos.has(clave(p.id, m)))
        const vp = ps.map((p) => ({ p, r: filasDe(p).find((x) => x.Muestra === m) })).filter((x) => x.r && Number.isFinite(tv(x.p, x.r.Media)))
        if (!vp.length) return []
        const porPlaca = o.puntosMedio === 'placas'
        const nPl = vp.length
        // puntos y cajas: un punto por placa, o todos los pocillos del medio (con el color de su placa)
        const detalle = porPlaca
          ? vp.map((x) => ({ v: tv(x.p, x.r.Media), color: colores[x.p.id], tip: `${x.p.nombre}: media ${V(x.p, x.r.Media)}` }))
          : vp.flatMap((x) => pozos(x.p, m).map((e) => ({ v: tv(x.p, e.OD), color: colores[x.p.id], tip: `${x.p.nombre} · ${e.Pocillo}: ${V(x.p, e.OD)}` })))
        // media, error y pruebas con los mismos datos que se dibujan
        const valores = detalle.map((d) => d.v)
        const rg = resumenGrupo(valores)
        const er = errRg(rg)
        const nTxt = porPlaca ? `n = ${nPl} ${nPl === 1 ? 'placa' : 'placas'}` : `n = ${valores.length} pocillos${nPl > 1 ? ` de ${nPl} placas` : ''}`
        return [{ id: md + '|' + m, medio: md, muestra: m, placa: `${md} (${nTxt})`, color: coloresMedio[md],
          media: rg.media, err: Number.isFinite(er) ? er : null, pts: valores, detalle, vp: valores, nPlacas: nPl }]
      })
    }
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
  const grupos = muestras.map((m) => ({ muestra: m, etiqueta: etiqueta(m), barras: columnas(m) })).filter((g) => g.barras.length)
  const leyenda = modo === 'medio'
    ? mediosPres.filter((md) => grupos.some((g) => g.barras.some((b) => b.id.startsWith(md + '|')))).map((md) => ({ id: md, nombre: md, color: coloresMedio[md] }))
    : placasSel.map((p) => ({ id: p.id, nombre: nombreP(p), color: colores[p.id] }))
  const notaOD = modo === 'medio'
    ? (o.puntosMedio === 'placas'
      ? `Barra: promedio de las placas de cada medio${ERR_TXT[o.error] ? `; error: ${ERR_TXT[o.error]} entre placas` : ''} · puntos: uno por placa`
      : `Barra: media de los pocillos del medio (todas sus placas)${ERR_TXT[o.error] ? `; error: ${ERR_TXT[o.error]} entre pocillos` : ''} · puntos: pocillos`)
    : modo === 'pocillo'
      ? 'Cada columna es un pocillo aceptado (OD)'
      : `Barra: OD media de las réplicas aceptadas de cada placa${ERR_TXT[o.error] ? `; error: ${ERR_TXT[o.error]} entre pocillos` : ''}`
  const nota = rel ? `${notaOD} · escala ${ESCALAS[escala].eje} con el ODc de cada placa` : notaOD
  return {
    modo, verBlancos, conAnalisis, placasSel, mediosPres, coloresMedio, colorBase, colores, ocultos, clave, filasDe, muestras, esBlanco, etiqueta,
    tieneMuestra, grupos, leyenda, nota, sinMedio: placasSel.filter((p) => !p.medio), escala, rel, sinOdc,
  }
}
