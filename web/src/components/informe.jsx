import { renderToStaticMarkup } from 'react-dom/server'
import { BarChart, ExcluirChart, GroupedBarChart } from './charts.jsx'
import { DispersionChart } from './dispersion.jsx'
import { resumenGrupo as resumenG } from '../estadistica.js'
import { fmt, paletaMuestras } from '../utils.js'
import { resumenBlancos } from '../blancos.js'

const esc = (t) => String(t ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))
const r4 = (x, d = 4) => (Number.isFinite(x) ? Number(x.toFixed(d)) : '')
const METODOS = { q: 'Test Q de Dixon', grubbs: 'Test de Grubbs', cv: 'Coeficiente de variación máximo' }

const tabla = (cols, filas) => `<table><thead><tr>${cols.map((c) => `<th>${esc(c.replace(/_/g, ' '))}</th>`).join('')}</tr></thead><tbody>${
  filas.map((f) => `<tr>${cols.map((c) => `<td>${esc(f[c])}</td>`).join('')}</tr>`).join('')}</tbody></table>`

// Informe en PDF de todo lo procesado: se arma una página con gráficos y tablas y se abre el cuadro de impresión
// (en Chrome: Destino › «Guardar como PDF»).
export function abrirInforme(s) {
  const conAn = s.placas.filter((p) => s.analisisMap[p.id]?.resumen?.length)
  if (!conAn.length) return false
  const noop = () => {}
  const ejeDe = (p) => (Number.isFinite(p.placa?.onda) ? `DO a ${p.placa.onda} nm` : 'Densidad óptica (OD)')
  const svgStr = (el) => renderToStaticMarkup(el)
  const det = s.deteccion
  const fecha = new Date().toLocaleString('es', { dateStyle: 'long', timeStyle: 'short' })
  const secciones = conAn.map((p, i) => {
    const a = s.analisisMap[p.id]
    const eje = ejeDe(p)
    const ob = s.opts.barras
    let filas = [...a.resumen, ...(ob.blancos === false ? [] : resumenBlancos(a.estado))].filter((r) => Number.isFinite(r.Media))
    if (ob.orden === 'asc') filas = [...filas].sort((x, y) => x.Media - y.Media)
    if (ob.orden === 'desc') filas = [...filas].sort((x, y) => y.Media - x.Media)
    const puntos = a.estado.filter((e) => e.Usado && filas.some((f) => f.Muestra === e.Muestra))
    const orden = [...new Set(a.estado.map((e) => e.Muestra))]
    const muestras = a.resumen.map((m) => ({
      Muestra: m.Muestra, Pocillos: m.N_total, Aceptadas: m.N_aceptadas, Excluidas: m.N_excluidas, Media_OD: r4(m.Media), DE: r4(m.SD), SEM: r4(m.SEM),
      IC95_mas_menos: r4(m.IC95), CV_pct: r4(m.CV_pct, 2), OD_sobre_ODc: r4(m.Razon_ODc, 2), Clasificacion: m.Clasificacion || '',
    }))
    const pocillos = a.estado.map((e) => ({
      Pocillo: e.Pocillo, Muestra: e.Muestra, Replica: e.Replica, Blanco: e.EsBlanco ? 'Sí' : 'No', OD: r4(e.OD),
      Estado: e.Usado ? 'Aceptado' : 'Excluido', Sospechoso: e.Sospechoso ? 'Sí' : 'No', Motivo: e.Manual ? 'Excluido manualmente' : e.Motivo || '',
    }))
    const gBarras = filas.length ? svgStr(<BarChart filas={filas} puntos={puntos} odc={a.odc.odc} o={ob} est={s.estilos.barras} eje={eje} tam={{ w: 900, h: 520 }} />) : ''
    const gExcluir = svgStr(<ExcluirChart estado={a.estado} orden={orden} o={s.opts.excluir} est={s.estilos.excluir} eje={eje} onClickPunto={noop} tam={{ w: 900, h: 520 }} />)
    return `<section class="placa ${i ? 'salto' : ''}">
      <h2>${esc(p.nombre)}${p.medio ? ' <small>· ' + esc(p.medio) + '</small>' : ''}</h2>
      <p class="meta">Archivo: ${esc(p.archivo?.nombre || '–')}${p.archivo?.hoja && p.archivo.hoja !== 'csv' ? ' · hoja ' + esc(p.archivo.hoja) : ''}
        · ${Number.isFinite(p.placa?.onda) ? p.placa.onda + ' nm' : 'sin longitud de onda'}${p.placa?.fecha ? ' · lectura ' + esc(p.placa.fecha) : ''}
        · ${p.config.length} pocillos configurados</p>
      <p class="odc"><b>ODc = ${Number.isFinite(a.odc?.odc) ? fmt(a.odc.odc, 4) : 'sin calcular'}</b>${a.odc?.n ? ` (n = ${a.odc.n} blancos aceptados)` : ''}</p>
      <h3>Clasificación por muestra</h3>${gBarras ? `<div class="fig">${gBarras}</div>` : ''}
      ${tabla(Object.keys(muestras[0] || { Muestra: 1 }), muestras)}
      <h3 class="salto">Control de calidad de los pocillos</h3><div class="fig">${gExcluir}</div>
      ${tabla(Object.keys(pocillos[0] || { Pocillo: 1 }), pocillos)}
    </section>`
  })

  // comparaciÃ³n entre placas (la misma vista que en Â«CompararÂ»: una barra por placa o por medio de cultivo, o dispersiÃ³n)
  let comparacion = ''
  if (conAn.length > 1) {
    const oc = s.opts.comparar
    const verBl = oc.blancos !== false
    const modo = oc.modo === 'medio' ? 'medio' : 'placas'
    const vista = oc.vista === 'dispersion' ? 'dispersion' : 'barras'
    const sel0 = oc.placasSel ? conAn.filter((p) => oc.placasSel.includes(p.id)) : conAn
    const orden = [...new Set(s.placas.map((p) => p.medio || ''))].filter(Boolean)
    const sel = [...sel0].sort((x, y) => (x.medio ? orden.indexOf(x.medio) : 999) - (y.medio ? orden.indexOf(y.medio) : 999))
    const ocultos = new Set(oc.ocultos || [])
    const filasDe = (p) => [...s.analisisMap[p.id].resumen, ...(verBl ? resumenBlancos(s.analisisMap[p.id].estado) : [])]
    const nb = [...new Set(sel.flatMap((p) => s.analisisMap[p.id].resumen.map((r) => r.Muestra)))]
    const bl = verBl ? [...new Set(sel.flatMap((p) => resumenBlancos(s.analisisMap[p.id].estado).map((r) => r.Muestra)))].filter((m) => !nb.includes(m)) : []
    const muestras = [...nb, ...bl]
    const medios = [...new Set(sel.map((p) => p.medio).filter(Boolean))]
    const colMedio = paletaMuestras(medios)
    const colBase = paletaMuestras(s.placas.map((p) => p.id))
    const aclarar = (col, f) => { const m = /hsl\((\d+),\s*(\d+)%,\s*(\d+)%\)/.exec(col); return m ? `hsl(${m[1]}, ${m[2]}%, ${(Number(m[3]) + (88 - Number(m[3])) * f).toFixed(0)}%)` : col }
    const colP = {}
    medios.forEach((md) => { const ps = sel.filter((p) => p.medio === md); ps.forEach((p, i) => { colP[p.id] = aclarar(colMedio[md], ps.length > 1 ? (0.5 * i) / (ps.length - 1) : 0) }) })
    sel.forEach((p) => { if (!colP[p.id]) colP[p.id] = colBase[p.id] })
    const errDe = (rg) => (oc.error === 'ic95' ? rg.ic95 : oc.error === 'sd' ? rg.sd : oc.error === 'sem' ? rg.sem : null)
    const ptsDe = (p, m) => s.analisisMap[p.id].estado.filter((e) => e.Muestra === m && e.Usado).map((e) => e.OD)
    const porPlaca = (m) => sel.flatMap((p) => {
      if (ocultos.has(`${p.id}|${m}`)) return []
      const r = filasDe(p).find((x) => x.Muestra === m)
      if (!r || !Number.isFinite(r.Media)) return []
      const er = oc.error === 'ic95' ? r.IC95 : oc.error === 'sd' ? r.SD : oc.error === 'sem' ? r.SEM : null
      return [{ id: p.id + '|' + m, placa: p.nombre + (p.medio ? ' Â· ' + p.medio : ''), color: colP[p.id], media: r.Media, err: Number.isFinite(er) ? er : null, pts: ptsDe(p, m) }]
    })
    const porMedio = (m) => medios.flatMap((md) => {
      const vals = sel.filter((p) => p.medio === md && !ocultos.has(`${p.id}|${m}`)).map((p) => filasDe(p).find((r) => r.Muestra === m)).filter((r) => r && Number.isFinite(r.Media)).map((r) => r.Media)
      if (!vals.length) return []
      const rg = resumenG(vals)
      const er = errDe(rg)
      return [{ id: md + '|' + m, placa: `${md} (n = ${vals.length})`, color: colMedio[md], media: rg.media, err: Number.isFinite(er) ? er : null, pts: vals }]
    })
    const grupos = muestras.map((m) => ({
      muestra: m, etiqueta: bl.includes(m) ? `${m} (blanco)` : m,
      barras: vista === 'barras' && modo === 'medio' ? porMedio(m) : porPlaca(m),
    })).filter((g) => g.barras.length)
    const leyenda = vista === 'barras' && modo === 'medio'
      ? medios.map((md) => ({ id: md, nombre: md, color: colMedio[md] }))
      : sel.map((p) => ({ id: p.id, nombre: p.nombre + (p.medio ? ' Â· ' + p.medio : ''), color: colP[p.id] }))
    if (grupos.length) {
      const o4 = { valores: oc.valores, errores: oc.errores, puntos: oc.puntos, rotar: oc.rotar }
      const fig = vista === 'dispersion'
        ? svgStr(<DispersionChart grupos={grupos} leyenda={leyenda} o={o4} est={s.estilos.comparar} eje={ejeDe(sel[0])} tam={{ w: 900, h: 540 }} />)
        : svgStr(<GroupedBarChart grupos={grupos} placas={leyenda} o={o4} est={s.estilos.comparar} eje={ejeDe(sel[0])} tam={{ w: 900, h: 540 }}
          nota={modo === 'medio' ? 'Barras: promedio de las placas de cada medio; error entre placas' : 'Barras: OD media de las rÃ©plicas aceptadas de cada placa'} />)
      const filasT = grupos.flatMap((g) => g.barras.map((b) => ({ Muestra: g.etiqueta, [vista === 'barras' && modo === 'medio' ? 'Medio' : 'Placa']: b.placa, OD_media: r4(b.media), Error: b.err === null || b.err === undefined ? '' : r4(b.err), N: b.pts.length })))
      comparacion = `<section class="placa salto"><h2>ComparaciÃ³n entre placas${vista === 'dispersion' ? ' (dispersiÃ³n de los pocillos)' : modo === 'medio' ? ' por medio de cultivo' : ''}</h2>
        <p class="meta">${sel.map((p) => `<b>${esc(p.nombre)}</b>${p.medio ? ' (' + esc(p.medio) + ')' : ''}`).join(' Â· ')}</p>
        <div class="fig">${fig}</div>${tabla(Object.keys(filasT[0]), filasT)}</section>`
    }
  }
  const html = `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Informe de biofilm</title><style>
    @page { size: A4; margin: 14mm 12mm; }
    body { font-family: 'Segoe UI', Arial, sans-serif; color: #2b2118; font-size: 11px; line-height: 1.4; }
    h1 { font-size: 22px; margin: 0 0 4px; } h2 { font-size: 16px; margin: 0 0 4px; border-bottom: 2px solid #d9731f; padding-bottom: 3px; }
    h3 { font-size: 13px; margin: 14px 0 4px; color: #7a4a1c; }
    .meta { color: #6b5d4f; margin: 2px 0 6px; } .odc { font-size: 13px; margin: 2px 0 8px; }
    .fig { text-align: center; page-break-inside: avoid; } .fig svg { max-width: 100%; height: auto; }
    table { border-collapse: collapse; width: 100%; margin: 6px 0 10px; font-size: 9.5px; }
    th, td { border: 1px solid #d8cfc2; padding: 2px 5px; text-align: left; } th { background: #f6efe3; }
    tr { page-break-inside: avoid; } thead { display: table-header-group; }
    .salto { page-break-before: always; }
    .portada p { margin: 3px 0; }
  </style></head><body>
    <div class="portada"><h1>Informe de producción de biofilm</h1>
      <p class="meta">Generado el ${esc(fecha)} · ${conAn.length} ${conAn.length === 1 ? 'placa' : 'placas'}</p>
      <p><b>Cálculo.</b> Punto de corte ODc = media(blancos) + 3 × DE(blancos), con los blancos aceptados. Clasificación (Stepanović et al., 2000) con la media de las réplicas aceptadas: no productor (OD ≤ ODc), débil (≤ 2×ODc), moderado (≤ 4×ODc) y fuerte (&gt; 4×ODc).</p>
      <p><b>Valores atípicos.</b> Método: ${esc(METODOS[det.metodo] || det.metodo)}${det.metodo === 'cv' ? ` (CV máximo ${esc(det.cvMax)} %)` : ` (confianza ${esc(det.conf)} %)`}; ${det.usar ? 'los sospechosos se excluyeron automáticamente' : 'los sospechosos solo se marcaron'}. Las exclusiones manuales están reflejadas en las tablas.</p>
      <p><b>Errores.</b> DE = desviación estándar muestral (n − 1); SEM = DE/√n; IC 95 % = t(0,975; n − 1) × SEM. En las comparaciones cada placa es una réplica.</p>
    </div>
    ${secciones.join('')}${comparacion}
  </body></html>`

  // se imprime desde un marco oculto (en Chrome: Destino › Guardar como PDF)
  const marco = document.createElement('iframe')
  marco.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0'
  document.body.appendChild(marco)
  marco.contentDocument.open()
  marco.contentDocument.write(html)
  marco.contentDocument.close()
  setTimeout(() => {
    marco.contentWindow.focus()
    marco.contentWindow.print()
    setTimeout(() => marco.remove(), 60000)
  }, 400)
  return true
}
