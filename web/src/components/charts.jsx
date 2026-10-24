import { forwardRef, useEffect, useRef, useState } from 'react'
import { dBarra } from '../calculos.js'
import { calcularLayout, estiloTexto } from '../layout.js'
import { CLASES, COLOR_CLASE, ESCALAS, FUENTE, estiloEscala, ejeConRango, escalaValida, escalaY, fEscala, fmt, fmtTick, medir, tCuantil, ticksBonitos } from '../utils.js'

export function useAncho() {
  const ref = useRef(null)
  const [w, setW] = useState(900)
  useEffect(() => {
    if (!ref.current) return
    const ro = new ResizeObserver((es) => setW(Math.min(1000, Math.max(420, Math.floor(es[0].contentRect.width)))))
    ro.observe(ref.current)
    return () => ro.disconnect()
  }, [])
  return [ref, w]
}

// Texto con fondo blanco: ninguna línea del gráfico lo atraviesa
export function EtiquetaFondo({ x, y, texto, est, anchor = 'middle', pad = 3 }) {
  const lineas = String(texto).split('\n')
  const alto = est.size * 1.2
  const w = Math.max(...lineas.map((t) => medir(t, est.size, est.bold, est.italic)))
  const x0 = anchor === 'middle' ? x - w / 2 : anchor === 'end' ? x - w : x
  const h = alto * lineas.length
  return (
    <g>
      <rect x={x0 - pad} y={y - h + (alto - est.size) * 0.6 - pad} width={w + pad * 2} height={h + pad * 2}
        fill="#fff" fillOpacity="0.9" rx="3" />
      {lineas.map((t, i) => (
        <text key={i} x={x} y={y - (lineas.length - 1 - i) * alto} textAnchor={anchor} style={estiloTexto(est)}>{t}</text>
      ))}
    </g>
  )
}

export function EjeY({ ticks, paso, y, left, plotW, est, titulo }) {
  return (
    <g>
      {ticks.map((t) => (
        <g key={t}>
          <line x1={left} x2={left + plotW} y1={y(t)} y2={y(t)} stroke="#e6eaef" />
          <text x={left - 8} y={y(t)} textAnchor="end" dominantBaseline="central" style={estiloTexto(est.numerosY)}>
            {fmtTick(t, paso)}
          </text>
        </g>
      ))}
      <text transform={`translate(${14 + est.leyendaY.size * 0.6},${0}) rotate(-90)`} x={-(y(ticks[0]) + y(ticks[ticks.length - 1])) / 2}
        y={0} textAnchor="middle" dominantBaseline="hanging" style={estiloTexto(est.leyendaY)}>{titulo}</text>
    </g>
  )
}

export function EtiquetasX({ labels, cx, yBase, ang, est }) {
  return labels.map((l, i) => (
    <text key={l + i} transform={`translate(${cx(i)},${yBase + 10}) rotate(${-ang})`}
      textAnchor={ang > 0 ? 'end' : 'middle'} dominantBaseline={ang > 0 ? 'central' : 'hanging'}
      style={estiloTexto(est.nombresX)}>{l}</text>
  ))
}

// Error relativo de la fila de abajo: el mismo error que muestran las barras, en % de la media
export const ERROR_REL = {
  sd: { etq: 'DE %', nombre: 'Desviación estándar relativa (CV)', sigla: 'DE' },
  sem: { etq: 'EE %', nombre: 'Error estándar relativo', sigla: 'EE' },
  ic95: { etq: 'IC %', nombre: 'IC 95 % relativo (semiancho del intervalo)', sigla: 'IC 95 %' },
}
export const tipoRel = (e) => (ERROR_REL[e] ? e : 'sd')   // sin barras de error: DE %

// Fila con el error relativo (100 × error ÷ media) de cada columna, debajo de los nombres del eje X.
// Con DE, en naranja si supera el límite de CV de «Calidad». items: [{ x, v, tip, corto }]
export const ALTO_FILA_CV = 32
export function FilaCV({ L, items, lim, size = 12, tipo = 'sd' }) {
  const y = L.top + L.plotH + 10 + L.altoEtiquetas + 12 + L.altoLeyX + 16
  const R = ERROR_REL[tipo] || ERROR_REL.sd
  return (
    <g>
      <line x1={L.left} x2={L.left + L.plotW} y1={y - 15} y2={y - 15} stroke="#e5ddd0" />
      <text x={L.left - 8} y={y} textAnchor="end" style={{ fontSize: 11, fill: '#6b7785' }}
        data-tip={`${R.nombre} = 100 × ${R.sigla} ÷ media de cada columna (el mismo error que las barras)${tipo === 'sd' ? `\nEn naranja: más del ${lim} % (límite de CV de «Calidad»)` : ''}`}>{R.etq}</text>
      {items.map((it, i) => {
        const alto = tipo === 'sd' && Number.isFinite(it.v) && it.v > lim
        return (
          <text key={i} x={it.x} y={y} textAnchor="middle" data-tip={it.tip}
            style={{ fontSize: size, fill: alto ? '#c25e00' : '#5b6672', fontWeight: alto ? 700 : 400 }}>
            {Number.isFinite(it.v) ? (it.v > 999 ? (it.corto ? '>999' : '> 999 %') : it.corto ? it.v.toFixed(0) : `${it.v.toFixed(0)} %`) : '–'}
          </text>
        )
      })}
    </g>
  )
}

export const Titulo = ({ W, est }) => est.titulo.texto ? (
  <text x={W / 2} y={14 + est.titulo.size} textAnchor="middle" style={estiloTexto(est.titulo)}>{est.titulo.texto}</text>
) : null

export const LeyendaX = ({ L, est }) => est.leyendaX.texto ? (
  <text x={L.left + L.plotW / 2} y={L.top + L.plotH + 10 + L.altoEtiquetas + 12 + est.leyendaX.size}
    textAnchor="middle" style={estiloTexto(est.leyendaX)}>{est.leyendaX.texto}</text>
) : null

// ---------------------------------------------------------------
// GRÁFICO DE BARRAS
// ---------------------------------------------------------------
// resta: blanco restado a la OD (Calidad › Restar blanco). Los umbrales de clase son de la OD leída,
// así que en OD corregida las líneas quedan en k × ODc − blanco.
export const BarChart = forwardRef(function BarChart({ filas, puntos, odc, o, est, eje, onContext, tam, nota, leyendaPuntos, escala, cvLim = 20, resta = 0 }, svgRef) {
  const [wrap, Wmed] = useAncho()
  const W = tam ? tam.w : Wmed
  // escala relativa al ODc de la placa: OD ÷ ODc, con las clases en 1, 2 y 4
  const esc = escalaValida(escala, odc)
  const rel = esc !== 'od'
  const tv = fEscala(esc, odc, resta)
  const tvB = (v) => (Number.isFinite(tv(v)) ? tv(v) : 0)
  const lineas = o.lineas && Number.isFinite(odc)
  const umbrales = rel ? ESCALAS[esc].umbrales.map((u) => u[0]) : [odc - resta, 2 * odc - resta, 4 * odc - resta]
  const errTxt = { ic95: 'IC 95 %', sd: 'desviación estándar', sem: 'error estándar', ninguno: '' }[o.error]
  const labels = filas.map((f) => (f.EsBlanco ? `${f.Muestra} (blanco)` : f.Muestra))
  const hayBlanco = filas.some((f) => f.EsBlanco)

  const errDe = (f) => (o.error === 'ic95' ? f.IC95 : o.error === 'sd' ? f.SD : o.error === 'sem' ? f.SEM : null)
  const topDe = filas.map((f) => {
    const e = errDe(f)
    const p = puntos.filter((q) => q.Muestra === f.Muestra).map((q) => tv(q.OD)).filter(Number.isFinite)
    return Math.max(...[tv(f.Media + (Number.isFinite(e) ? e : 0)), ...p].filter(Number.isFinite))
  })
  // con la OD corregida puede haber medias o réplicas por debajo de 0
  const lo = Math.min(0, ...[...filas.map((f) => tv(f.Media)), ...puntos.map((q) => tv(q.OD))].filter(Number.isFinite))
  // textos "media ± error"; si no caben al lado de los vecinos se apilan en dos líneas
  const textoValor = (f) => {
    const e = errDe(f)
    return { m: fmt(tv(f.Media), rel ? 2 : 3), e: o.errores && Number.isFinite(e) ? fmt(rel ? e / odc : e, rel ? 2 : 3) : null }
  }
  const wMaxTxt = Math.max(0, ...filas.map((f) => {
    const t = textoValor(f)
    return medir(t.e ? `${t.m} ± ${t.e}` : t.m, est.valores.size, est.valores.bold, est.valores.italic)
  }))
  const wDisponible = (W - (o.lineas && Number.isFinite(odc) ? 300 : 120)) / Math.max(filas.length, 1)
  const apilar = o.medias && wMaxTxt > wDisponible * 0.92
  let tope = Math.max(0, ...topDe)
  if (o.medias) tope *= 1 + (est.valores.size * (apilar ? 2.8 : 1.6)) / 340
  if (lineas) tope = Math.max(tope * 1.05, rel ? 4.9 : odc * 4.9 - resta)
  if (!(tope > 0)) tope = 1
  const eY = ejeConRango(ticksBonitos(lo, tope, 6), estiloEscala(est, esc))
  // las barras salen del 0
  const base = Math.min(Math.max(0, eY.min), eY.max)
  const yLabels = eY.ticks.map((t) => fmtTick(t, eY.paso))

  const [u1, u2, u3] = rel ? ESCALAS[esc].umbrales.map((u) => String(u[0])) : umbrales.map((u) => fmt(u))
  // posición de cada nombre de clase (a mitad de su franja; «No productor», entre 0 y la primera línea)
  const posC = (m) => (rel ? m : m * odc - resta)
  const clasesTxt = lineas
    ? [
        ['Productor fuerte', posC(4.45), o.valoresClase ? `Productor fuerte\n(> ${u3})` : 'Productor fuerte'],
        ['Productor moderado', posC(3), o.valoresClase ? `Productor moderado\n(${u2} – ${u3})` : 'Productor moderado'],
        ['Productor débil', posC(1.5), o.valoresClase ? `Productor débil\n(${u1} – ${u2})` : 'Productor débil'],
        ['No productor', rel ? 0.5 : (odc - resta) / 2, o.valoresClase ? `No productor\n(≤ ${u1})` : 'No productor'],
      ]
    : []
  const wClases = lineas
    ? Math.max(...clasesTxt.flatMap((c) => c[2].split('\n')).map((t) => medir(t, est.clases.size, est.clases.bold, est.clases.italic)))
    : 0
  const leyenda = o.color === 'clase' && Number.isFinite(odc)
  const L = calcularLayout({
    W, etiquetas: labels, ang: o.rotar, est, yLabels,
    derecha: lineas ? wClases + 28 : 16,
    titulo: !!est.titulo.texto, tituloX: !!est.leyendaX.texto, altoPlot: 280 + est.valores.size * 2,
    extraAbajo: (leyenda || hayBlanco ? 30 : 0) + (leyendaPuntos?.length ? 26 : 0) + 22 + (o.cv ? ALTO_FILA_CV : 0), fijoH: tam ? tam.h : 0,
    anchoTituloY: medir(est.leyendaY.texto || eje, est.leyendaY.size, est.leyendaY.bold, est.leyendaY.italic),
  })
  const y = escalaY(L, eY)
  const cx = (i) => L.left + L.band * (i + 0.5)
  const bw = Math.min(L.band * 0.62, 140)
  const COLOR_BLANCO = '#cfc8bc'

  // etiquetas de clasificación en el margen derecho, sin que se pisen
  const ys = clasesTxt.map((c) => y(c[1]))
  const hLin = est.clases.size * 1.2
  const alt = clasesTxt.map((c) => c[2].split('\n').length * hLin)
  const pos = ys.slice()
  for (let i = 1; i < pos.length; i++) {
    const minGap = (alt[i - 1] + alt[i]) / 2 + 3
    if (pos[i] - pos[i - 1] < minGap) pos[i] = pos[i - 1] + minGap
  }

  const colorBarra = (f) => (f.EsBlanco ? COLOR_BLANCO : o.color === 'clase' && Number.isFinite(odc) ? COLOR_CLASE[f.Clasificacion] : '#6b8fb5')
  const yLeyenda = L.top + L.plotH + L.altoEtiquetas + L.altoLeyX + 34 + (o.cv ? ALTO_FILA_CV : 0)

  return (
    <div ref={wrap} className="chart-wrap" onContextMenu={onContext}>
      <svg ref={svgRef} viewBox={`0 0 ${W} ${L.H}`} width={W} height={L.H} fontFamily={FUENTE}>
        <rect width={W} height={L.H} fill="#fff" />
        <Titulo W={W} est={est} />
        <EjeY ticks={eY.ticks} paso={eY.paso} y={y} left={L.left} plotW={L.plotW} est={est} titulo={est.leyendaY.texto || eje} />
        <line x1={L.left} x2={L.left + L.plotW} y1={y(eY.min)} y2={y(eY.min)} stroke="#444" />
        <line x1={L.left} x2={L.left} y1={L.top} y2={y(eY.min)} stroke="#444" />
        {eY.min < 0 && <line x1={L.left} x2={L.left + L.plotW} y1={y(0)} y2={y(0)} stroke="#888" strokeDasharray="3 3" />}

        {lineas && umbrales.map((u) => (
          <line key={u} x1={L.left} x2={L.left + L.plotW} y1={y(u)} y2={y(u)} stroke="#333" strokeDasharray="2 3" />
        ))}

        {filas.map((f, i) => {
          const e = errDe(f)
          const pts = puntos.filter((q) => q.Muestra === f.Muestra)
          return (
            <g key={f.Muestra}>
              <rect x={cx(i) - bw / 2} y={y(Math.max(tvB(f.Media), base))} width={bw} height={Math.max(Math.abs(y(base) - y(tvB(f.Media))), 0.5)}
                fill={colorBarra(f)} stroke="#333" strokeWidth="0.8" strokeDasharray={f.EsBlanco ? '4 2' : undefined}
                data-tip={(rel ? ESCALAS[esc].cuenta(f.Media, odc, resta) + '\n' : '') + dBarra(`${f.Muestra}${f.EsBlanco ? ' (blanco)' : ''} · ${resta ? 'OD corregida' : 'OD'} media = ${fmt(f.Media)}`, pts.map((q) => q.OD), o.error, f.EsBlanco ? NaN : odc, f.Clasificacion, resta)} />
              {Number.isFinite(e) && e > 0 && (
                <g stroke="#111" strokeWidth="1.3">
                  {(() => { const hi = y(tv(f.Media + e)), bajo = y(Math.max(tv(f.Media - e), eY.min)); return <>
                    <line x1={cx(i)} x2={cx(i)} y1={bajo} y2={hi} />
                    <line x1={cx(i) - bw * 0.18} x2={cx(i) + bw * 0.18} y1={hi} y2={hi} />
                    <line x1={cx(i) - bw * 0.18} x2={cx(i) + bw * 0.18} y1={bajo} y2={bajo} /></> })()}
                </g>
              )}
              {o.puntos && pts.map((q, k) => (
                <circle key={q.Pocillo} cx={cx(i) + (pts.length > 1 ? (k / (pts.length - 1) - 0.5) * bw * 0.45 : 0)} cy={y(Number.isFinite(tv(q.OD)) ? Math.max(tv(q.OD), eY.min) : eY.min)} r={q.color ? 4.4 : 3.3}
                  fill={q.color || '#1b1f23'} fillOpacity="0.9" stroke={q.color ? '#fff' : 'none'} strokeWidth="1" data-tip={`Pocillo ${q.Pocillo}\n${resta ? `OD corregida = ${fmt(q.OD, 4)} (leída ${fmt(q.OD + resta, 4)} − blanco ${fmt(resta, 4)})` : `OD = ${fmt(q.OD, 4)}`}${rel ? `\n${ESCALAS[esc].eje} = ${fmt(tv(q.OD), 3)}` : ''}`}>
                </circle>
              ))}
              {o.medias && (
                <EtiquetaFondo x={cx(i)} y={y(topDe[i]) - 7} est={est.valores}
                  texto={(() => { const t = textoValor(f); return t.e ? `${t.m}${apilar ? '\n' : ' '}± ${t.e}` : t.m })()} />
              )}
            </g>
          )
        })}

        {lineas && clasesTxt.map((c, i) => (
          <g key={c[0]}>
            <line x1={L.left + L.plotW} x2={L.left + L.plotW + 8} y1={ys[i]} y2={pos[i]} stroke="#999" />
            <EtiquetaFondo x={L.left + L.plotW + 12} y={pos[i] + (c[2].split('\n').length === 2 ? hLin * 0.1 : hLin * 0.35)}
              texto={c[2]} est={est.clases} anchor="start" pad={1} />
          </g>
        ))}

        <EtiquetasX labels={labels} cx={cx} yBase={y(eY.min)} ang={o.rotar} est={est} />
        <LeyendaX L={L} est={est} />
        {o.cv && (() => {
          const tr = tipoRel(o.error), R = ERROR_REL[tr]
          return <FilaCV L={L} lim={cvLim} tipo={tr} items={filas.map((f, i) => {
            const err = tr === 'sd' ? f.SD : tr === 'sem' ? f.SEM : f.IC95
            // con la OD corregida el blanco queda en 0 y no tiene % de la media
            const v = f.Media > 1e-6 && !(resta && f.EsBlanco) ? (100 * err) / f.Media : NaN
            return {
              x: cx(i), v,
              tip: Number.isFinite(v)
                ? `${R.nombre} de ${f.Muestra}\n= 100 × ${R.sigla} ÷ media = 100 × ${fmt(err, 4)} ÷ ${fmt(f.Media, 4)} = ${fmt(v, 1)} %\n(${f.N_aceptadas ?? '?'} réplicas aceptadas)${resta ? '\nCon la OD corregida (media menos el blanco)' : ''}${tr === 'sd' && v > cvLim ? `\nSupera el límite de ${cvLim} %` : ''}${tr !== 'sd' && Number.isFinite(f.CV_pct) ? `\nCV (DE %) = ${fmt(f.CV_pct, 1)} %` : ''}`
                : resta && f.EsBlanco ? `${f.Muestra}: con la OD corregida el blanco queda en 0, no hay % de la media`
                  : Number.isFinite(f.Media) && f.Media <= 0 ? `${f.Muestra}: la media corregida no es positiva, no hay % de la media` : `${f.Muestra}: hacen falta 2 o más réplicas`,
            }
          })} />
        })()}

        {(leyenda || hayBlanco) && (
          <g transform={`translate(${L.left + L.plotW / 2},${yLeyenda})`}>
            {(() => {
              const items = [...(leyenda ? CLASES.map((t) => [t, COLOR_CLASE[t]]) : []), ...(hayBlanco ? [['Blanco (medio sin inocular)', COLOR_BLANCO]] : [])]
              const w = items.map(([t]) => 22 + medir(t, 12) + 18)
              const tot = w.reduce((a, b) => a + b, 0)
              let x = -tot / 2
              return items.map(([t, col], i) => {
                const g = (
                  <g key={t} transform={`translate(${x},0)`}>
                    <rect width="14" height="14" y="-11" fill={col} stroke="#333" strokeWidth="0.6" strokeDasharray={col === COLOR_BLANCO ? '3 2' : undefined} />
                    <text x="20" style={{ fontSize: 12, fill: '#333' }}>{t}</text>
                  </g>
                )
                x += w[i]
                return g
              })
            })()}
          </g>
        )}
        {leyendaPuntos?.length > 0 && (
          <g transform={`translate(${L.left + L.plotW / 2},${yLeyenda + (leyenda || hayBlanco ? 26 : 0)})`}>
            {(() => {
              const w = leyendaPuntos.map((p) => 20 + medir(p.nombre, 12) + 18)
              let x = -w.reduce((a, b) => a + b, 0) / 2
              return leyendaPuntos.map((p, i) => {
                const gr = (
                  <g key={p.nombre} transform={`translate(${x},0)`}>
                    <circle cx="6" cy="-4" r="5" fill={p.color} stroke="#fff" strokeWidth="1" />
                    <text x="16" style={{ fontSize: 12, fill: '#333' }}>{p.nombre}</text>
                  </g>
                )
                x += w[i]
                return gr
              })
            })()}
          </g>
        )}
        <text x={L.left + L.plotW} y={L.H - 8} textAnchor="end" style={{ fontSize: 11, fill: '#6b7785' }}>
          {nota ?? `Barras: media de las réplicas aceptadas${errTxt ? `; error: ${errTxt}` : ''}${rel ? ` · escala ${ESCALAS[esc].eje}: ${ESCALAS[esc].nota}` : resta ? ` · OD corregida = OD leída − blanco (${fmt(resta, 3)})` : ''}`}
        </text>
      </svg>
    </div>
  )
})

// ---------------------------------------------------------------
// GRÁFICO PARA EXCLUIR PUNTOS
// ---------------------------------------------------------------
const tCrit = (gl) => tCuantil(0.975, gl)

export function resumenGrupo(g, tipo, tv = (v) => v) {
  const u = g.filter((e) => e.Usado).map((e) => tv(e.OD)).filter(Number.isFinite)
  if (!u.length) return null
  const m = u.reduce((a, b) => a + b, 0) / u.length
  const sd = u.length > 1 ? Math.sqrt(u.reduce((a, b) => a + (b - m) ** 2, 0) / (u.length - 1)) : null
  const sem = sd === null ? null : sd / Math.sqrt(u.length)
  const err = tipo === 'sd' ? sd : tipo === 'sem' ? sem : tipo === 'ic95' && sem !== null ? tCrit(u.length - 1) * sem : null
  return { m, err, n: u.length }
}

export const ExcluirChart = forwardRef(function ExcluirChart({ estado, orden, o, est, eje, onClickPunto, onContext, tam, odc, escala, resta = 0 }, svgRef) {
  const [wrap, Wmed] = useAncho()
  const W = tam ? tam.w : Wmed
  // escalas relativas al ODc: solo cambia cómo se dibuja; los valores atípicos se buscan siempre sobre la OD leída
  const esc = escalaValida(escala, odc)
  const rel = esc !== 'od'
  const tv = fEscala(esc, odc, resta)
  const labels = orden
  const idx = Object.fromEntries(orden.map((m, i) => [m, i]))
  const porMuestra = orden.map((m) => estado.filter((e) => e.Muestra === m))
  const res = porMuestra.map((g) => resumenGrupo(g, o.error, tv))
  const textoValor = (r) => (o.errores && r.err !== null && Number.isFinite(r.err) ? `${fmt(r.m)}\n± ${fmt(r.err)}` : fmt(r.m))

  const valores = estado.map((e) => tv(e.OD)).filter(Number.isFinite)
  res.forEach((r) => { if (r && Number.isFinite(r.err)) valores.push(r.m + r.err, r.m - r.err) })
  let lo = Math.min(0, ...valores)
  let hi = Math.max(...valores, 0.1)
  if (o.medias) hi += (hi - lo) * (est.valores.size * (o.errores ? 2.8 : 1.8)) / 340
  hi += (hi - lo) * 0.04
  const eY = ejeConRango(ticksBonitos(lo, hi, 6), estiloEscala(est, esc))
  const yLabels = eY.ticks.map((t) => fmtTick(t, eY.paso))
  const L = calcularLayout({
    W, etiquetas: labels, ang: o.rotar, est, yLabels,
    titulo: !!est.titulo.texto, tituloX: !!est.leyendaX.texto,
    altoPlot: 280 + est.valores.size * 2, extraAbajo: 40, fijoH: tam ? tam.h : 0, derecha: rel ? 62 : undefined,
    anchoTituloY: medir(est.leyendaY.texto || eje, est.leyendaY.size, est.leyendaY.bold, est.leyendaY.italic),
  })
  const y = escalaY(L, eY)
  const cx = (i) => L.left + L.band * (i + 0.5)
  const vy = (e) => { const v = tv(e.OD); return y(Number.isFinite(v) ? Math.max(v, eY.min) : eY.min) }

  const px = (e) => {
    const g = porMuestra[idx[e.Muestra]]
    const k = g.indexOf(e)
    const n = g.length
    return cx(idx[e.Muestra]) + (n > 1 ? (k - (n - 1) / 2) * Math.min(L.band * 0.12, 22) : 0)
  }

  return (
    <div ref={wrap} className="chart-wrap" onContextMenu={onContext}>
      <svg ref={svgRef} viewBox={`0 0 ${W} ${L.H}`} width={W} height={L.H} fontFamily={FUENTE}>
        <rect width={W} height={L.H} fill="#fff" />
        <Titulo W={W} est={est} />
        <EjeY ticks={eY.ticks} paso={eY.paso} y={y} left={L.left} plotW={L.plotW} est={est} titulo={est.leyendaY.texto || eje} />
        <line x1={L.left} x2={L.left + L.plotW} y1={y(Math.max(0, eY.min))} y2={y(Math.max(0, eY.min))} stroke="#444" />
        {rel && ESCALAS[esc].umbrales.filter(([u]) => u > eY.min && u < eY.max).map(([u, t, k]) => (
          <g key={u} data-tip={`${u} = ${t} de esta placa (${fmt(k * odc, 3)} de OD)\nlímite de clase`}>
            <line x1={L.left} x2={L.left + L.plotW} y1={y(u)} y2={y(u)} stroke="#999" strokeDasharray="3 3" />
            <text x={L.left + L.plotW + 6} y={y(u) + 4} style={{ fontSize: 11, fill: '#6b7785' }}>{t}</text>
          </g>
        ))}

        {res.map((r, i) => r && (o.errores || o.medias) ? (
          <g key={'m' + i} stroke="#111" strokeWidth="1.4">
            <line x1={cx(i) - L.band * 0.28} x2={cx(i) + L.band * 0.28} y1={y(r.m)} y2={y(r.m)} />
            {o.errores && r.err !== null && Number.isFinite(r.err) && (
              <>
                <line x1={cx(i)} x2={cx(i)} y1={y(r.m - r.err)} y2={y(r.m + r.err)} />
                <line x1={cx(i) - L.band * 0.1} x2={cx(i) + L.band * 0.1} y1={y(r.m + r.err)} y2={y(r.m + r.err)} />
                <line x1={cx(i) - L.band * 0.1} x2={cx(i) + L.band * 0.1} y1={y(r.m - r.err)} y2={y(r.m - r.err)} />
              </>
            )}
          </g>
        ) : null)}

        {o.puntos && estado.map((e) => (
          <g key={e.Pocillo} onClick={() => onClickPunto(e.Pocillo)} style={{ cursor: 'pointer' }}
            data-tip={`${e.Pocillo} · ${e.Muestra} R${e.Replica}\n${resta ? `OD corregida = ${fmt(e.OD, 4)} (leída ${fmt(e.OD + resta, 4)} − blanco ${fmt(resta, 4)})` : `OD = ${fmt(e.OD, 4)}`}${rel ? `\n${ESCALAS[esc].eje} = ${fmt(tv(e.OD), 3)}` : ''}\n${e.Manual ? 'Excluido manualmente' : e.Motivo || (e.Usado ? 'Aceptado' : 'Excluido')}\nClic: ${e.Usado ? 'excluir' : 'reincorporar'}`}>
            <circle cx={px(e)} cy={vy(e)} r="14" fill="transparent" />
            {e.Sospechoso && <circle cx={px(e)} cy={vy(e)} r="9" fill="none" stroke="#f0932b" strokeWidth="2.4" />}
            {e.Usado ? (
              <circle cx={px(e)} cy={vy(e)} r="5" fill="#2f5d8a" />
            ) : (
              <g stroke="#c0392b" strokeWidth="2.4">
                <line x1={px(e) - 5} x2={px(e) + 5} y1={vy(e) - 5} y2={vy(e) + 5} />
                <line x1={px(e) - 5} x2={px(e) + 5} y1={vy(e) + 5} y2={vy(e) - 5} />
              </g>
            )}
          </g>
        ))}

        {o.medias && res.map((r, i) => {
          if (!r) return null
          const g = porMuestra[i]
          const top = Math.max(...(o.puntos ? g.map((e) => tv(e.OD)).filter(Number.isFinite) : [r.m]), r.m + (o.errores && Number.isFinite(r.err) ? r.err : 0))
          return <EtiquetaFondo key={i} x={cx(i)} y={y(top) - 14} est={est.valores} texto={textoValor(r)} />
        })}

        <EtiquetasX labels={labels} cx={cx} yBase={y(eY.min)} ang={o.rotar} est={est} />
        <LeyendaX L={L} est={est} />

        <g transform={`translate(${L.left + L.plotW / 2},${L.H - 14})`} style={{ fontSize: 12, fill: '#333' }}>
          <circle cx="-120" cy="-4" r="5" fill="#2f5d8a" /><text x="-110">Aceptado</text>
          <g stroke="#c0392b" strokeWidth="2.2"><line x1="-20" x2="-10" y1="-9" y2="1" /><line x1="-20" x2="-10" y1="1" y2="-9" /></g>
          <text x="-4">Excluido</text>
          <circle cx="75" cy="-4" r="7" fill="none" stroke="#f0932b" strokeWidth="2.2" /><text x="87">Sospechoso</text>
        </g>
      </svg>
    </div>
  )
})

// ---------------------------------------------------------------
// BARRAS AGRUPADAS: para cada muestra, una barra por placa (color = placa)
// grupos: [{ muestra, barras: [{ id, placa, color, media, err, pts: [OD...] }] }]
// ---------------------------------------------------------------
export const GroupedBarChart = forwardRef(function GroupedBarChart({ grupos, placas, o, est, eje, onContext, tam, nota }, svgRef) {
  const [wrap, Wmed] = useAncho()
  const W = tam ? tam.w : Wmed
  const labels = grupos.map((g) => g.etiqueta || g.muestra)
  const nmax = Math.max(1, ...grupos.map((g) => g.barras.length))
  const todas = grupos.flatMap((g) => g.barras)

  // ancho estimado de cada barra (antes de conocer los márgenes) para decidir si el valor va girado
  const bw0 = Math.min(((W - 140) / Math.max(grupos.length, 1)) * 0.86 / nmax, 60)
  const conErr = (b) => o.errores && Number.isFinite(b.err) && b.err > 0
  const txtRot = (b) => (conErr(b) ? `${fmt(b.media)} ± ${fmt(b.err)}` : fmt(b.media))
  const wValor = Math.max(0, ...todas.map((b) => medir(txtRot(b), est.valores.size, est.valores.bold, est.valores.italic)))
  const girado = o.valores && wValor + 4 > bw0
  let tope = Math.max(0, ...todas.map((b) => Math.max(b.media + (Number.isFinite(b.err) ? b.err : 0), ...(o.puntos ? b.pts : []))))
  if (o.valores) tope *= 1 + ((girado ? wValor + 12 : est.valores.size * (o.errores ? 2.7 : 1.5) + 6)) / 340
  if (!(tope > 0)) tope = 1
  const eY = ejeConRango(ticksBonitos(0, tope, 6), est)
  const yLabels = eY.ticks.map((t) => fmtTick(t, eY.paso))

  // leyenda de placas (color), en varias filas si no cabe
  const itemsLey = placas.map((p) => ({ ...p, w: 26 + medir(p.nombre, 12) + 16 }))
  const filasLey = []
  let fila = [], ancho = 0
  itemsLey.forEach((it) => {
    if (ancho + it.w > W - 60 && fila.length) { filasLey.push(fila); fila = []; ancho = 0 }
    fila.push(it); ancho += it.w
  })
  if (fila.length) filasLey.push(fila)

  const L = calcularLayout({
    W, etiquetas: labels, ang: o.rotar, est, yLabels, derecha: 16,
    titulo: !!est.titulo.texto, tituloX: !!est.leyendaX.texto, altoPlot: 280 + est.valores.size * 2,
    extraAbajo: filasLey.length * 22 + 28, fijoH: tam ? tam.h : 0,
    anchoTituloY: medir(est.leyendaY.texto || eje, est.leyendaY.size, est.leyendaY.bold, est.leyendaY.italic),
  })
  const y = escalaY(L, eY)
  const cx = (i) => L.left + L.band * (i + 0.5)
  const bw = Math.max(Math.min((L.band * 0.86) / nmax, 60), 4)
  const yLey = L.top + L.plotH + L.altoEtiquetas + L.altoLeyX + 34

  return (
    <div ref={wrap} className="chart-wrap" onContextMenu={onContext}>
      <svg ref={svgRef} viewBox={`0 0 ${W} ${L.H}`} width={W} height={L.H} fontFamily={FUENTE}>
        <rect width={W} height={L.H} fill="#fff" />
        <Titulo W={W} est={est} />
        <EjeY ticks={eY.ticks} paso={eY.paso} y={y} left={L.left} plotW={L.plotW} est={est} titulo={est.leyendaY.texto || eje} />
        <line x1={L.left} x2={L.left + L.plotW} y1={y(0)} y2={y(0)} stroke="#444" />
        <line x1={L.left} x2={L.left} y1={L.top} y2={y(0)} stroke="#444" />

        {grupos.map((g, gi) => {
          const x0 = cx(gi) - (g.barras.length * bw) / 2
          return (
            <g key={g.muestra}>
              {g.barras.map((b, k) => {
                const bx = x0 + k * bw
                const mx = bx + bw / 2
                const hasErr = Number.isFinite(b.err) && b.err > 0
                const yTop = y(hasErr ? b.media + b.err : b.media)
                const yMax = o.puntos && b.pts.length ? Math.min(yTop, y(Math.max(...b.pts))) : yTop
                return (
                  <g key={b.id}>
                    <rect x={bx + 1} y={y(b.media)} width={Math.max(bw - 2, 1)} height={Math.max(y(0) - y(b.media), 0)}
                      fill={b.color} stroke="#333" strokeWidth="0.7" data-tip={`${g.muestra} · ${b.placa}\nOD media = ${fmt(b.media)}${hasErr ? ` ± ${fmt(b.err)}` : ''}\n${b.pts.length} pocillos`} />
                    {hasErr && (
                      <g stroke="#111" strokeWidth="1.2">
                        <line x1={mx} x2={mx} y1={y(Math.max(b.media - b.err, 0))} y2={y(b.media + b.err)} />
                        <line x1={mx - bw * 0.18} x2={mx + bw * 0.18} y1={y(b.media + b.err)} y2={y(b.media + b.err)} />
                        <line x1={mx - bw * 0.18} x2={mx + bw * 0.18} y1={y(Math.max(b.media - b.err, 0))} y2={y(Math.max(b.media - b.err, 0))} />
                      </g>
                    )}
                    {o.puntos && b.pts.map((v, j) => (
                      <circle key={j} cx={mx + (b.pts.length > 1 ? (j / (b.pts.length - 1) - 0.5) * bw * 0.5 : 0)} cy={y(v)} r="2.6"
                        fill="#1b1f23" fillOpacity="0.8" />
                    ))}
                    {o.valores && (girado ? (
                      <text transform={`translate(${mx + est.valores.size * 0.35},${yMax - 5}) rotate(-90)`} style={estiloTexto(est.valores)}>{txtRot(b)}</text>
                    ) : (
                      <>
                        {conErr(b) && <text x={mx} y={yMax - 5} textAnchor="middle" style={estiloTexto(est.valores)}>{'± ' + fmt(b.err)}</text>}
                        <text x={mx} y={yMax - 5 - (conErr(b) ? est.valores.size * 1.25 : 0)} textAnchor="middle" style={estiloTexto(est.valores)}>{fmt(b.media)}</text>
                      </>
                    ))}
                  </g>
                )
              })}
            </g>
          )
        })}

        <EtiquetasX labels={labels} cx={cx} yBase={y(0)} ang={o.rotar} est={est} />
        <LeyendaX L={L} est={est} />

        {filasLey.map((f, r) => {
          const tot = f.reduce((a, it) => a + it.w, 0)
          let x = L.left + L.plotW / 2 - tot / 2
          return (
            <g key={r} transform={`translate(0,${yLey + r * 22})`}>
              {f.map((it) => {
                const g = (
                  <g key={it.id} transform={`translate(${x},0)`}>
                    <rect width="14" height="14" y="-11" rx="2" fill={it.color} stroke="#333" strokeWidth="0.6" />
                    <text x="20" style={{ fontSize: 12, fill: '#333' }}>{it.nombre}</text>
                  </g>
                )
                x += it.w
                return g
              })}
            </g>
          )
        })}
        <text x={L.left + L.plotW} y={L.H - 8} textAnchor="end" style={{ fontSize: 11, fill: '#6b7785' }}>{nota}</text>
      </svg>
    </div>
  )
})
