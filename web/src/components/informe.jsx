import { renderToStaticMarkup } from 'react-dom/server'
import { BarChart, ExcluirChart } from './charts.jsx'
import { CompararChart } from './compararchart.jsx'
import { armarComparacion } from '../comparacion.js'
import { fmt } from '../utils.js'
import { resumenBlancos } from '../blancos.js'

const esc = (t) => String(t ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))
const r4 = (x, d = 4) => (Number.isFinite(x) ? Number(x.toFixed(d)) : '')
const METODOS = { q: 'Test Q de Dixon', grubbs: 'Test de Grubbs', cv: 'Coeficiente de variación máximo' }

const tabla = (cols, filas) => `<table><thead><tr>${cols.map((c) => `<th>${esc(c.replace(/_/g, ' '))}</th>`).join('')}</tr></thead><tbody>${
  filas.map((f) => `<tr>${cols.map((c) => `<td>${esc(f[c])}</td>`).join('')}</tr>`).join('')}</tbody></table>`

// Informe en PDF de todo lo procesado: se arma una página con gráficos y tablas y se abre el cuadro de impresión
// (en Chrome: Destino › «Guardar como PDF»).
export function abrirInforme(s) {
  const conAn = s.placas.filter((p) => !p.oculta && s.analisisMap[p.id]?.resumen?.length)
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

  // comparación entre placas: la misma que se ve en «Comparar» (columnas por placa, por medio o por pocillo; barras, cajas y puntos)
  let comparacion = ''
  if (conAn.length > 1) {
    const oc = s.opts.comparar
    const D = armarComparacion(s)
    const el = {
      barras: oc.barras !== false, barrasError: oc.barrasError !== false, caja: oc.caja ?? !!oc.cajas, mediana: oc.mediana ?? !!oc.cajas, bigotes: oc.bigotes ?? !!oc.cajas, media: oc.media ?? !!oc.cajas, puntos: oc.puntos !== false,
      valores: oc.valores !== false, errores: !!oc.errores, rotar: oc.rotar ?? 45,
    }
    if (D.grupos.length && (el.barras || el.caja || el.mediana || el.bigotes || el.media || el.puntos)) {
      const fig = svgStr(<CompararChart grupos={D.grupos} leyenda={D.leyenda} o={el} est={s.estilos.comparar} eje={ejeDe(D.placasSel[0])} tam={{ w: 900, h: 560 }} nota={D.nota} />)
      const filasT = D.grupos.flatMap((g) => g.barras.map((b) => ({
        Muestra: g.etiqueta, [D.modo === 'medio' ? 'Medio' : D.modo === 'pocillo' ? 'Pocillo' : 'Placa']: b.placa,
        OD_media: r4(b.media), Error: b.err === null || b.err === undefined ? '' : r4(b.err), N: (b.vp || b.pts).length,
      })))
      comparacion = `<section class="placa salto"><h2>Comparación entre placas${D.modo === 'medio' ? ' por medio de cultivo' : D.modo === 'pocillo' ? ' (pocillo por pocillo)' : ''}</h2>
        <p class="meta">${D.placasSel.map((p) => `<b>${esc(p.nombre)}</b>${p.medio ? ' (' + esc(p.medio) + ')' : ''}`).join(' · ')}</p>
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

  // en el celular el cuadro de impresión no se abre desde un marco oculto: el informe se abre en otra pestaña
  // con un botón para imprimir o guardar como PDF (o compartirlo)
  if (/Android|iPhone|iPad/i.test(navigator.userAgent) || window.matchMedia('(pointer: coarse)').matches) {
    const barra = '<div class="no-imprimir" style="position:sticky;top:0;background:#4a2312;padding:10px;text-align:center;margin:-14mm -12mm 12px"><button onclick="window.print()" style="font-size:16px;padding:10px 18px;border-radius:10px;border:0;background:#f4a04c;color:#3b1c0a;font-weight:700">Imprimir o guardar como PDF</button></div>'
    const movil = html.replace('<body>', '<body>' + barra).replace('</style>', '@media print { .no-imprimir { display: none !important; } } body { max-width: 900px; margin: 0 auto; padding: 0 10px 20px; } </style>')
    // se escribe en una pestaña en blanco (no se navega a un Blob HTML: los antivirus del correo lo toman
    // por «HTML smuggling» y bloquean el archivo); si el navegador no deja abrir pestañas, se muestra encima
    const w = window.open('', '_blank')
    if (w) {
      w.document.open()
      w.document.write(movil)
      w.document.close()
      return true
    }
    const capa = document.createElement('iframe')
    capa.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;border:0;z-index:99999;background:#fff'
    document.body.appendChild(capa)
    const cerrar = '<button onclick="window.frameElement.remove()" style="font-size:16px;padding:10px 18px;border-radius:10px;border:0;background:#fff;color:#3b1c0a;font-weight:700;margin-left:8px">Cerrar</button>'
    capa.contentDocument.open()
    capa.contentDocument.write(movil.replace('Imprimir o guardar como PDF</button>', 'Imprimir o guardar como PDF</button>' + cerrar))
    capa.contentDocument.close()
    return true
  }

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
