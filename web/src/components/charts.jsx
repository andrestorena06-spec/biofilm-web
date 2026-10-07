import { forwardRef, useEffect, useRef, useState } from 'react'
import { calcularLayout, estiloTexto } from '../layout.js'
import { CLASES, COLOR_CLASE, FUENTE, fmt, fmtTick, medir, tCuantil, ticksBonitos } from '../utils.js'

export function useAncho() {
  const ref = useRef(null)
  const [w, setW] = useState(900)
  useEffect(() => {
    if (!ref.current) return
    const ro = new ResizeObserver((es) => setW(Math.max(420, Math.floor(es[0].contentRect.width))))
    ro.observe(ref.current)
    return () => ro.disconnect()
  }, [])
  return [ref, w]
}

// Texto con fondo blanco: ninguna línea del gráfico lo atraviesa
function EtiquetaFondo({ x, y, texto, est, anchor = 'middle', pad = 3 }) {
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

function EjeY({ ticks, paso, y, left, plotW, est, titulo }) {
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

function EtiquetasX({ labels, cx, yBase, ang, est }) {
  return labels.map((l, i) => (
    <text key={l + i} transform={`translate(${cx(i)},${yBase + 10}) rotate(${-ang})`}
      textAnchor={ang > 0 ? 'end' : 'middle'} dominantBaseline={ang > 0 ? 'central' : 'hanging'}
      style={estiloTexto(est.nombresX)}>{l}</text>
  ))
}

const Titulo = ({ W, est }) => est.titulo.texto ? (
  <text x={W / 2} y={14 + est.titulo.size} textAnchor="middle" style={estiloTexto(est.titulo)}>{est.titulo.texto}</text>
) : null

const LeyendaX = ({ L, est }) => est.leyendaX.texto ? (
  <text x={L.left + L.plotW / 2} y={L.top + L.plotH + 10 + L.altoEtiquetas + 12 + est.leyendaX.size}
    textAnchor="middle" style={estiloTexto(est.leyendaX)}>{est.leyendaX.texto}</text>
) : null

// ---------------------------------------------------------------
// GRÁFICO DE BARRAS
// ---------------------------------------------------------------
export const BarChart = forwardRef(function BarChart({ filas, puntos, odc, o, est, eje, onContext, tam, nota, leyendaPuntos }, svgRef) {
  const [wrap, Wmed] = useAncho()
  const W = tam ? tam.w : Wmed
  const lineas = o.lineas && Number.isFinite(odc)
  const errTxt = { ic95: 'IC 95 %', sd: 'desviación estándar', sem: 'error estándar', ninguno: '' }[o.error]
  const labels = filas.map((f) => f.Muestra)

  const errDe = (f) => (o.error === 'ic95' ? f.IC95 : o.error === 'sd' ? f.SD : o.error === 'sem' ? f.SEM : null)
  const topDe = filas.map((f) => {
    const e = errDe(f)
    const p = puntos.filter((q) => q.Muestra === f.Muestra).map((q) => q.OD)
    return Math.max(f.Media + (Number.isFinite(e) ? e : 0), ...p)
  })
  // textos "media ± error"; si no caben al lado de los vecinos se apilan en dos líneas
  const textoValor = (f) => {
    const e = errDe(f)
    return { m: fmt(f.Media), e: o.errores && Number.isFinite(e) ? fmt(e) : null }
  }
  const wMaxTxt = Math.max(0, ...filas.map((f) => {
    const t = textoValor(f)
    return medir(t.e ? `${t.m} ± ${t.e}` : t.m, est.valores.size, est.valores.bold, est.valores.italic)
  }))
  const wDisponible = (W - (o.lineas && Number.isFinite(odc) ? 300 : 120)) / Math.max(filas.length, 1)
  const apilar = o.medias && wMaxTxt > wDisponible * 0.92
  let tope = Math.max(0, ...topDe)
  if (o.medias) tope *= 1 + (est.valores.size * (apilar ? 2.8 : 1.6)) / 340
  if (lineas) tope = Math.max(tope * 1.05, odc * 4.9)
  if (!(tope > 0)) tope = 1
  const eY = ticksBonitos(0, tope, 6)
  const yMax = eY.max
  const yLabels = eY.ticks.map((t) => fmtTick(t, eY.paso))

  const clasesTxt = lineas
    ? [
        ['Productor fuerte', 4.45, o.valoresClase ? `Productor fuerte\n(> ${fmt(4 * odc)})` : 'Productor fuerte'],
        ['Productor moderado', 3, o.valoresClase ? `Productor moderado\n(${fmt(2 * odc)} – ${fmt(4 * odc)})` : 'Productor moderado'],
        ['Productor débil', 1.5, o.valoresClase ? `Productor débil\n(${fmt(odc)} – ${fmt(2 * odc)})` : 'Productor débil'],
        ['No productor', 0.5, o.valoresClase ? `No productor\n(≤ ${fmt(odc)})` : 'No productor'],
      ]
    : []
  const wClases = lineas
    ? Math.max(...clasesTxt.flatMap((c) => c[2].split('\n')).map((t) => medir(t, est.clases.size, est.clases.bold, est.clases.italic)))
    : 0
  const leyenda = o.color === 'clase' && Number.isFinite(odc)
  const L = calcularLayout({
    W, etiquetas: labels, ang: o.rotar, est, yLabels,
    derecha: lineas ? wClases + 28 : 16,
    titulo: !!est.titulo.texto, tituloX: !!est.leyendaX.texto, altoPlot: 340 + est.valores.size * 2,
    extraAbajo: (leyenda ? 30 : 0) + (leyendaPuntos?.length ? 26 : 0) + 22, fijoH: tam ? tam.h : 0,
    anchoTituloY: medir(est.leyendaY.texto || eje, est.leyendaY.size, est.leyendaY.bold, est.leyendaY.italic),
  })
  const y = (v) => L.top + L.plotH - (v / yMax) * L.plotH
  const cx = (i) => L.left + L.band * (i + 0.5)
  const bw = Math.min(L.band * 0.62, 140)

  // etiquetas de clasificación en el margen derecho, sin que se pisen
  const ys = clasesTxt.map((c) => y(c[1] * odc))
  const hLin = est.clases.size * 1.2
  const alt = clasesTxt.map((c) => c[2].split('\n').length * hLin)
  const pos = ys.slice()
  for (let i = 1; i < pos.length; i++) {
    const minGap = (alt[i - 1] + alt[i]) / 2 + 3
    if (pos[i] - pos[i - 1] < minGap) pos[i] = pos[i - 1] + minGap
  }

  const colorBarra = (f) => (o.color === 'clase' && Number.isFinite(odc) ? COLOR_CLASE[f.Clasificacion] : '#6b8fb5')
  const yLeyenda = L.top + L.plotH + L.altoEtiquetas + L.altoLeyX + 34

  return (
    <div ref={wrap} className="chart-wrap" onContextMenu={onContext}>
      <svg ref={svgRef} viewBox={`0 0 ${W} ${L.H}`} width={W} height={L.H} fontFamily={FUENTE}>
        <rect width={W} height={L.H} fill="#fff" />
        <Titulo W={W} est={est} />
        <EjeY ticks={eY.ticks} paso={eY.paso} y={y} left={L.left} plotW={L.plotW} est={est} titulo={est.leyendaY.texto || eje} />
        <line x1={L.left} x2={L.left + L.plotW} y1={y(0)} y2={y(0)} stroke="#444" />
        <line x1={L.left} x2={L.left} y1={L.top} y2={y(0)} stroke="#444" />

        {lineas && [1, 2, 4].map((m) => (
          <line key={m} x1={L.left} x2={L.left + L.plotW} y1={y(m * odc)} y2={y(m * odc)} stroke="#333" strokeDasharray="2 3" />
        ))}

        {filas.map((f, i) => {
          const e = errDe(f)
          const pts = puntos.filter((q) => q.Muestra === f.Muestra)
          return (
            <g key={f.Muestra}>
              <rect x={cx(i) - bw / 2} y={y(f.Media)} width={bw} height={Math.max(y(0) - y(f.Media), 0)}
                fill={colorBarra(f)} stroke="#333" strokeWidth="0.8" />
              {Number.isFinite(e) && e > 0 && (
                <g stroke="#111" strokeWidth="1.3">
                  <line x1={cx(i)} x2={cx(i)} y1={y(Math.max(f.Media - e, 0))} y2={y(f.Media + e)} />
                  <line x1={cx(i) - bw * 0.18} x2={cx(i) + bw * 0.18} y1={y(f.Media + e)} y2={y(f.Media + e)} />
                  <line x1={cx(i) - bw * 0.18} x2={cx(i) + bw * 0.18} y1={y(Math.max(f.Media - e, 0))} y2={y(Math.max(f.Media - e, 0))} />
                </g>
              )}
              {o.puntos && pts.map((q, k) => (
                <circle key={q.Pocillo} cx={cx(i) + (pts.length > 1 ? (k / (pts.length - 1) - 0.5) * bw * 0.45 : 0)} cy={y(q.OD)} r={q.color ? 4.4 : 3.3}
                  fill={q.color || '#1b1f23'} fillOpacity="0.9" stroke={q.color ? '#fff' : 'none'} strokeWidth="1">
                  <title>{`${q.Pocillo}: ${fmt(q.OD)}`}</title>
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

        <EtiquetasX labels={labels} cx={cx} yBase={y(0)} ang={o.rotar} est={est} />
        <LeyendaX L={L} est={est} />

        {leyenda && (
          <g transform={`translate(${L.left + L.plotW / 2},${yLeyenda})`}>
            {(() => {
              const w = CLASES.map((t) => 22 + medir(t, 12) + 18)
              const tot = w.reduce((a, b) => a + b, 0)
              let x = -tot / 2
              return CLASES.map((t, i) => {
                const g = (
                  <g key={t} transform={`translate(${x},0)`}>
                    <rect width="14" height="14" y="-11" fill={COLOR_CLASE[t]} stroke="#333" strokeWidth="0.6" />
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
          <g transform={`translate(${L.left + L.plotW / 2},${yLeyenda + (leyenda ? 26 : 0)})`}>
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
          {nota ?? `Barras: media de las réplicas aceptadas${errTxt ? `; error: ${errTxt}` : ''}`}
        </text>
      </svg>
    </div>
  )
})

// ---------------------------------------------------------------
// GRÁFICO PARA EXCLUIR PUNTOS
// ---------------------------------------------------------------
const tCrit = (gl) => tCuantil(0.975, gl)

export function resumenGrupo(g, tipo) {
  const u = g.filter((e) => e.Usado).map((e) => e.OD)
  if (!u.length) return null
  const m = u.reduce((a, b) => a + b, 0) / u.length
  const sd = u.length > 1 ? Math.sqrt(u.reduce((a, b) => a + (b - m) ** 2, 0) / (u.length - 1)) : null
  const sem = sd === null ? null : sd / Math.sqrt(u.length)
  const err = tipo === 'sd' ? sd : tipo === 'sem' ? sem : tipo === 'ic95' && sem !== null ? tCrit(u.length - 1) * sem : null
  return { m, err, n: u.length }
}

export const ExcluirChart = forwardRef(function ExcluirChart({ estado, orden, o, est, eje, onClickPunto, onContext, tam }, svgRef) {
  const [wrap, Wmed] = useAncho()
  const W = tam ? tam.w : Wmed
  const labels = orden
  const idx = Object.fromEntries(orden.map((m, i) => [m, i]))
  const porMuestra = orden.map((m) => estado.filter((e) => e.Muestra === m))
  const res = porMuestra.map((g) => resumenGrupo(g, o.error))
  const textoValor = (r) => (o.errores && r.err !== null && Number.isFinite(r.err) ? `${fmt(r.m)}\n± ${fmt(r.err)}` : fmt(r.m))

  const valores = estado.flatMap((e) => [e.OD, ...(o.banda ? [e.Mediana + e.Limite, e.Mediana - e.Limite] : [])]).filter(Number.isFinite)
  res.forEach((r) => { if (r && Number.isFinite(r.err)) valores.push(r.m + r.err, r.m - r.err) })
  let lo = Math.min(0, ...valores)
  let hi = Math.max(...valores, 0.1)
  if (o.medias) hi += (hi - lo) * (est.valores.size * (o.errores ? 2.8 : 1.8)) / 340
  hi += (hi - lo) * 0.04
  const eY = ticksBonitos(lo, hi, 6)
  const yLabels = eY.ticks.map((t) => fmtTick(t, eY.paso))
  const L = calcularLayout({
    W, etiquetas: labels, ang: o.rotar, est, yLabels,
    titulo: !!est.titulo.texto, tituloX: !!est.leyendaX.texto,
    altoPlot: 340 + est.valores.size * 2, extraAbajo: 40, fijoH: tam ? tam.h : 0,
    anchoTituloY: medir(est.leyendaY.texto || eje, est.leyendaY.size, est.leyendaY.bold, est.leyendaY.italic),
  })
  const y = (v) => L.top + L.plotH - ((v - eY.min) / (eY.max - eY.min)) * L.plotH
  const cx = (i) => L.left + L.band * (i + 0.5)

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
        <line x1={L.left} x2={L.left + L.plotW} y1={y(0)} y2={y(0)} stroke="#444" />

        {o.banda && porMuestra.map((g, i) => {
          const b = g.find((e) => Number.isFinite(e.Mediana) && Number.isFinite(e.Limite))
          return b ? (
            <g key={i}>
              <rect x={cx(i) - L.band * 0.4} y={y(b.Mediana + b.Limite)} width={L.band * 0.8}
                height={Math.max(y(b.Mediana - b.Limite) - y(b.Mediana + b.Limite), 1)} fill="#9aa5b1" fillOpacity="0.28" />
              <line x1={cx(i) - L.band * 0.4} x2={cx(i) + L.band * 0.4} y1={y(b.Mediana)} y2={y(b.Mediana)} stroke="#52606d" />
            </g>
          ) : null
        })}

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
          <g key={e.Pocillo} onClick={() => onClickPunto(e.Pocillo)} style={{ cursor: 'pointer' }}>
            <circle cx={px(e)} cy={y(e.OD)} r="14" fill="transparent" />
            {e.Sospechoso && <circle cx={px(e)} cy={y(e.OD)} r="9" fill="none" stroke="#f0932b" strokeWidth="2.4" />}
            {e.Usado ? (
              <circle cx={px(e)} cy={y(e.OD)} r="5" fill="#2f5d8a" />
            ) : (
              <g stroke="#c0392b" strokeWidth="2.4">
                <line x1={px(e) - 5} x2={px(e) + 5} y1={y(e.OD) - 5} y2={y(e.OD) + 5} />
                <line x1={px(e) - 5} x2={px(e) + 5} y1={y(e.OD) + 5} y2={y(e.OD) - 5} />
              </g>
            )}
            <title>{`${e.Pocillo} · ${e.Muestra} R${e.Replica}\nOD = ${fmt(e.OD)}${e.Manual ? '\nExcluido manualmente' : e.Motivo ? '\n' + e.Motivo : ''}`}</title>
          </g>
        ))}

        {o.medias && res.map((r, i) => {
          if (!r) return null
          const g = porMuestra[i]
          const top = Math.max(...(o.puntos ? g.map((e) => e.OD) : [r.m]), r.m + (o.errores && Number.isFinite(r.err) ? r.err : 0),
            ...(o.banda ? g.map((e) => (Number.isFinite(e.Mediana) && Number.isFinite(e.Limite) ? e.Mediana + e.Limite : -Infinity)) : []))
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
  const labels = grupos.map((g) => g.muestra)
  const nmax = Math.max(1, ...grupos.map((g) => g.barras.length))
  const todas = grupos.flatMap((g) => g.barras)

  // ancho estimado de cada barra (antes de conocer los márgenes) para decidir si el valor va girado
  const bw0 = Math.min(((W - 140) / Math.max(grupos.length, 1)) * 0.86 / nmax, 60)
  const wValor = Math.max(0, ...todas.map((b) => medir(fmt(b.media), est.valores.size, est.valores.bold, est.valores.italic)))
  const girado = o.valores && wValor + 4 > bw0
  let tope = Math.max(0, ...todas.map((b) => Math.max(b.media + (Number.isFinite(b.err) ? b.err : 0), ...(o.puntos ? b.pts : []))))
  if (o.valores) tope *= 1 + ((girado ? wValor + 12 : est.valores.size * 1.5 + 6)) / 340
  if (!(tope > 0)) tope = 1
  const eY = ticksBonitos(0, tope, 6)
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
    titulo: !!est.titulo.texto, tituloX: !!est.leyendaX.texto, altoPlot: 340 + est.valores.size * 2,
    extraAbajo: filasLey.length * 22 + 28, fijoH: tam ? tam.h : 0,
    anchoTituloY: medir(est.leyendaY.texto || eje, est.leyendaY.size, est.leyendaY.bold, est.leyendaY.italic),
  })
  const y = (v) => L.top + L.plotH - (v / eY.max) * L.plotH
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
                      fill={b.color} stroke="#333" strokeWidth="0.7">
                      <title>{`${g.muestra} · ${b.placa}\nOD media = ${fmt(b.media)}${hasErr ? ` ± ${fmt(b.err)}` : ''}\n${b.pts.length} pocillos`}</title>
                    </rect>
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
                      <text transform={`translate(${mx + est.valores.size * 0.35},${yMax - 5}) rotate(-90)`} style={estiloTexto(est.valores)}>{fmt(b.media)}</text>
                    ) : (
                      <text x={mx} y={yMax - 5} textAnchor="middle" style={estiloTexto(est.valores)}>{fmt(b.media)}</text>
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
