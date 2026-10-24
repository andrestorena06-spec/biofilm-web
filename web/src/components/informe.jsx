import { renderToStaticMarkup } from 'react-dom/server'
import { BarChart, ExcluirChart } from './charts.jsx'
import { CompararChart } from './compararchart.jsx'
import { armarComparacion } from '../comparacion.js'
import { ESCALAS, escalaValida, fmt } from '../utils.js'
import { resumenBlancos } from '../blancos.js'
import { resumenesInforme } from '../resumenes.js'
import { marcaSig, media } from '../estadistica.js'

const esc = (t) => String(t ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))
const r4 = (x, d = 4) => (Number.isFinite(x) ? Number(x.toFixed(d)) : '')
const METODOS = { q: 'Test Q de Dixon', grubbs: 'Test de Grubbs', cv: 'Coeficiente de variación máximo' }

// ---- resúmenes de las pruebas (entre placas, entre medios y entre variantes de cada cepa) ----
const NOMBRE_TEST = { anova: 'ANOVA', welch: 'ANOVA de Welch', kw: 'Kruskal-Wallis' }
const pT = (p) => (!Number.isFinite(p) ? '–' : p < 0.0001 ? '&lt; 0.0001' : p.toFixed(4))
const n3 = (x) => (Number.isFinite(x) ? x.toFixed(3) : '–')
const glTxt = (g) => (g.df2 === null || g.df2 === undefined ? `${g.df1}` : `${g.df1}; ${Number.isInteger(g.df2) ? g.df2 : g.df2.toFixed(1)}`)
// celdas de una fila de resultados: prueba, p y conclusión (o el motivo por el que no se pudo hacer)
function celdasPrueba(r, extra) {
  if (!r) return `<td colspan="${extra ? 4 : 3}" class="tenue">menos de dos grupos con datos</td>`
  if (!r.ok) return `<td colspan="${extra ? 4 : 3}" class="tenue">${esc(r.motivo)}</td>`
  const p = r.global.p, sig = p < 0.05
  const orden = [...r.grupos].sort((a, z) => media(z.v) - media(a.v))
  const concl = !sig ? 'sin diferencias' : orden.length === 2 ? `${esc(orden[0].nombre)} &gt; ${esc(orden[1].nombre)}` : 'difieren'
  const pares = extra ? r.pares.filter((x) => Number.isFinite(x.pa) && x.pa < 0.05) : []
  return `<td>${NOMBRE_TEST[r.tipo]}<br><small>${r.global.est}(${glTxt(r.global)}) = ${r.global.valor.toFixed(2)}</small></td>
    <td class="num">${pT(p)} ${sig ? marcaSig(p) : ''}</td><td class="${sig ? 'sig' : ''}">${concl}</td>${extra ? `<td>${pares.length ? pares.map((x) => `${esc(x.a)} vs ${esc(x.b)} <small>(p ${pT(x.pa)})</small>`).join('<br>') : r.grupos.length > 2 ? 'ninguno' : '–'}</td>` : ''}`
}
// celda de un grupo: media ± DE (n) y la letra de la comparación
const celdaGrupo = (g, r, conDE) => (g && g.v.length
  ? `<td class="num">${n3(g.m)}${conDE && Number.isFinite(g.de) ? ` ± ${n3(g.de)}` : ''} <small>(${g.v.length})</small>${r?.ok && r.letras?.[g.nombre] ? ` <b class="letra">${r.letras[g.nombre]}</b>` : ''}</td>`
  : '<td class="tenue">–</td>')

function estadisticaHTML(R) {
  const unidadTxt = esc(R.unidad)
  const prueba = R.forzado === 'auto' ? 'automática (ANOVA clásico, ANOVA de Welch o Kruskal-Wallis según la normalidad de los residuos y la igualdad de varianzas)' : NOMBRE_TEST[R.forzado]
  const nPl = R.nivel === 'placa' ? 'placas' : 'pocillos'
  // método de los pares que se usó de verdad (LSD solo se aplica con el ANOVA clásico; con Welch o Kruskal-Wallis va Holm)
  const todos = [...R.placas.flatMap((b) => b.filas.map((f) => f.r)), ...R.medios.map((f) => f.r), ...R.familias.flatMap((fm) => fm.porMedio.map((f) => f.r))]
  const metodos = new Set(todos.filter((r) => r?.ok && r.pares[0]).map((r) => r.pares[0].metodo))
  const metodoTxt = metodos.has('LSD') && metodos.has('Holm') ? 'LSD de Fisher con el ANOVA clásico y Holm con Welch o Kruskal-Wallis' : metodos.has('LSD') ? 'LSD de Fisher' : 'Holm'
  const ajTxt = metodos.has('LSD') && metodos.has('Holm') ? 'por LSD o Holm' : metodos.has('LSD') ? 'por LSD' : 'por Holm'
  const avisos = [
    R.fueraPl.length ? `Placas sacadas de las pruebas en «Estadística»: ${R.fueraPl.map((p) => esc(p.nombre)).join(', ')}.` : '',
    R.sinOdc.length ? `Sin ODc (no entran con OD ÷ ODc): ${R.sinOdc.map((p) => esc(p.nombre)).join(', ')}.` : '',
    R.sinMedio.length ? `Sin medio indicado (no entran en las comparaciones por medio): ${R.sinMedio.map((p) => esc(p.nombre)).join(', ')}.` : '',
  ].filter(Boolean)
  let h = `<section class="placa salto est"><h2>Estadística</h2>
    <p class="meta">Variable: <b>${unidadTxt}</b> · réplica para comparar medios y cepas: <b>${R.nivel === 'placa' ? 'la placa (un valor por placa: la media de sus pocillos aceptados)' : 'el pocillo'}</b> · prueba: ${prueba} · comparaciones de a pares: ${metodoTxt}.</p>
    ${avisos.length ? `<p class="meta">${avisos.join(' ')}</p>` : ''}`

  // 1. entre placas
  h += `<h3>1. Entre las placas de cada medio</h3><p class="meta">Para cada cepa se comparan las placas del mismo medio con sus pocillos aceptados como réplicas: muestra si la cepa da lo mismo en los distintos experimentos. Cada celda: media ± DE (n pocillos) y letra.</p>`
  if (!R.placas.length) h += '<p class="tenue">Hace falta un medio con dos o más placas.</p>'
  R.placas.forEach((b) => {
    h += `<h4>${esc(b.medio)} · ${b.placas.length} placas</h4><table><thead><tr><th>Cepa</th>${b.placas.map((p) => `<th>${esc(p.nombre)}</th>`).join('')}<th>Prueba</th><th>p</th><th>Resultado</th></tr></thead><tbody>
      ${b.filas.map((f) => `<tr><td><b>${esc(f.cepa)}</b></td>${f.grupos.map((g) => celdaGrupo(g, f.r, true)).join('')}${celdasPrueba(f.r)}</tr>`).join('')}</tbody></table>`
  })

  // 2. entre medios
  h += `<h3>2. Entre medios de cultivo</h3><p class="meta">Para cada cepa se compara su producción en cada medio. Cada celda: media ± DE (n ${nPl}) y letra.</p>`
  if (!R.medios.length) h += '<p class="tenue">Hacen falta placas de dos o más medios.</p>'
  else h += `<table><thead><tr><th>Cepa</th>${R.mediosLista.map((m) => `<th>${esc(m)}</th>`).join('')}<th>Prueba</th><th>p</th><th>Resultado</th></tr></thead><tbody>
    ${R.medios.map((f) => `<tr><td><b>${esc(f.cepa)}</b></td>${f.grupos.map((g) => celdaGrupo(g, f.r, true)).join('')}${celdasPrueba(f.r)}</tr>`).join('')}</tbody></table>`

  // 3. variantes de cada cepa
  h += `<h3>3. Variantes de cada cepa</h3><p class="meta">Se comparan las cepas que comparten el nombre base (por ejemplo L100A1, L100A1 Rug y L100A1 SCV), en cada medio por separado. Cada celda: media ± DE (n ${nPl}) y letra.</p>`
  if (!R.familias.length) h += '<p class="tenue">No hay cepas con variantes (nombres que compartan la primera palabra).</p>'
  R.familias.forEach((fm) => {
    h += `<h4>${fm.cepas.map(esc).join(' · ')}</h4><table><thead><tr><th>Medio</th>${fm.cepas.map((c) => `<th>${esc(c)}</th>`).join('')}<th>Prueba</th><th>p</th><th>Resultado</th><th>Pares que difieren</th></tr></thead><tbody>
      ${fm.porMedio.map((f) => `<tr><td><b>${esc(f.medio)}</b></td>${f.grupos.map((g) => celdaGrupo(g, f.r, true)).join('')}${celdasPrueba(f.r, true)}</tr>`).join('')}</tbody></table>`
  })
  h += `<p class="meta">Letras: dentro de cada fila, los grupos que comparten una letra no difieren (p ajustado ${ajTxt} ≥ 0.05). * p &lt; 0.05 · ** p &lt; 0.01 · *** p &lt; 0.001. Con pocas réplicas solo se detectan diferencias grandes: un p alto no prueba que los grupos sean iguales.</p></section>`
  return h
}

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
    const escB = escalaValida(s.opts.barras.escala, a.odc.odc)
    const gBarras = filas.length ? svgStr(<BarChart filas={filas} puntos={puntos} odc={a.odc.odc} o={ob} est={s.estilos.barras} eje={escB === 'od' ? eje : ESCALAS[escB].eje} escala={escB} tam={{ w: 900, h: 520 }} />) : ''
    const escE = escalaValida(s.opts.excluir.escala, a.odc.odc)
    const gExcluir = svgStr(<ExcluirChart estado={a.estado} orden={orden} o={s.opts.excluir} est={s.estilos.excluir} eje={escE === 'od' ? eje : ESCALAS[escE].eje} odc={a.odc.odc} escala={escE} onClickPunto={noop} tam={{ w: 900, h: 520 }} />)
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
      const fig = svgStr(<CompararChart grupos={D.grupos} leyenda={D.leyenda} o={{ ...el, valoresClase: !!s.opts.comparar.valoresClase }} est={s.estilos.comparar} eje={D.rel ? ESCALAS[D.escala].eje : ejeDe(D.placasSel[0])} tam={{ w: 900, h: 560 }} nota={D.nota} clases={D.rel && s.opts.comparar.lineas !== false} escala={D.escala} unidad={D.rel ? ESCALAS[D.escala].corto : 'OD'} />)
      const filasT = D.grupos.flatMap((g) => g.barras.map((b) => ({
        Muestra: g.etiqueta, [D.modo === 'medio' ? 'Medio' : D.modo === 'pocillo' ? 'Pocillo' : 'Placa']: b.placa,
        OD_media: r4(b.media), Error: b.err === null || b.err === undefined ? '' : r4(b.err), N: (b.vp || b.pts).length,
      })))
      comparacion = `<section class="placa salto"><h2>Comparación entre placas${D.modo === 'medio' ? ' por medio de cultivo' : D.modo === 'pocillo' ? ' (pocillo por pocillo)' : ''}</h2>
        <p class="meta">${D.placasSel.map((p) => `<b>${esc(p.nombre)}</b>${p.medio ? ' (' + esc(p.medio) + ')' : ''}`).join(' · ')}</p>
        <div class="fig">${fig}</div>${tabla(Object.keys(filasT[0]), filasT)}</section>`
    }
  }
  // resúmenes de las pruebas, con las opciones de la pestaña Estadística
  let estadistica = ''
  if (conAn.length > 1) { try { estadistica = estadisticaHTML(resumenesInforme(s)) } catch (e) { estadistica = `<section class="placa salto"><h2>Estadística</h2><p>No se pudieron calcular los resúmenes: ${esc(e.message)}</p></section>` } }
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
    h4 { font-size: 12px; margin: 10px 0 2px; color: #3b2a1a; }
    .est td.num { white-space: nowrap; } .est td small { color: #6b5d4f; } .est .letra { color: #993c1d; }
    .est td.sig { font-weight: 700; color: #7a2e0e; } .tenue { color: #8a7d70; }
  </style></head><body>
    <div class="portada"><h1>Informe de producción de biofilm</h1>
      <p class="meta">Generado el ${esc(fecha)} · ${conAn.length} ${conAn.length === 1 ? 'placa' : 'placas'}</p>
      <p><b>Cálculo.</b> Punto de corte ODc = media(blancos) + 3 × DE(blancos), con los blancos aceptados. Clasificación (Stepanović et al., 2000) con la media de las réplicas aceptadas: no productor (OD ≤ ODc), débil (≤ 2×ODc), moderado (≤ 4×ODc) y fuerte (&gt; 4×ODc).</p>
      <p><b>Valores atípicos.</b> Método: ${esc(METODOS[det.metodo] || det.metodo)}${det.metodo === 'cv' ? ` (CV máximo ${esc(det.cvMax)} %)` : ` (confianza ${esc(det.conf)} %)`}; ${det.usar ? 'los sospechosos se excluyeron automáticamente' : 'los sospechosos solo se marcaron'}. Las exclusiones manuales están reflejadas en las tablas.</p>
      <p><b>Errores.</b> DE = desviación estándar muestral (n − 1); SEM = DE/√n; IC 95 % = t(0,975; n − 1) × SEM. En las comparaciones cada placa es una réplica.</p>
    </div>
    ${secciones.join('')}${comparacion}${estadistica}
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
