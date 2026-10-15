import { forwardRef } from 'react'
import { dBigotes, dCaja, dError, dMedia, dMediana } from '../calculos.js'
import { calcularLayout } from '../layout.js'
import { FUENTE, fmt, fmtTick, medir, ticksBonitos } from '../utils.js'
import { EjeY, EtiquetaFondo, EtiquetasX, LeyendaX, Titulo, useAncho } from './charts.jsx'

// ---------------------------------------------------------------
// GRÁFICO DE COMPARACIÓN: cada elemento se muestra u oculta por separado (barras, barras de error, caja de cuartiles,
// mediana, bigotes, media, puntos y etiquetas). Al pasar el mouse por cada elemento se explica qué es y cuánto vale.
// grupos: [{ muestra, etiqueta?, barras: [{ id, placa, color, media, err, pts: [OD], detalle?: [{ v, color, tip }] }] }]
// leyenda: [{ id, nombre, color }]
// o: { barras, barrasError, caja, mediana, bigotes, media, puntos, valores, errores, rotar, errorNombre }
// ---------------------------------------------------------------
const cuantil = (v, q) => {
  const a = [...v].sort((x, y) => x - y)
  if (!a.length) return NaN
  const pos = (a.length - 1) * q
  const i = Math.floor(pos)
  return a[i] + (a[Math.min(i + 1, a.length - 1)] - a[i]) * (pos - i)
}

export const CompararChart = forwardRef(function CompararChart({ grupos, leyenda, o, est, eje, onContext, tam, nota }, svgRef) {
  const [wrap, Wmed] = useAncho()
  const W = tam ? tam.w : Wmed
  const labels = grupos.map((g) => g.etiqueta || g.muestra)
  const nmax = Math.max(1, ...grupos.map((g) => g.barras.length))
  const conErr = (b) => Number.isFinite(b.err) && b.err > 0
  const usaPts = o.caja || o.bigotes || o.puntos || o.mediana

  // extremos de cada columna (para la escala y para ubicar el valor escrito)
  const cima = (b) => Math.max(
    b.media,
    o.barras && o.barrasError && conErr(b) ? b.media + b.err : -Infinity,
    usaPts ? Math.max(...b.pts) : -Infinity,
  )
  const piso = (b) => Math.min(
    o.barras && o.barrasError && conErr(b) ? b.media - b.err : Infinity,
    usaPts ? Math.min(...b.pts) : Infinity,
  )
  const todasCimas = grupos.flatMap((g) => g.barras.map(cima)).filter(Number.isFinite)
  const todosPisos = grupos.flatMap((g) => g.barras.map(piso)).filter(Number.isFinite)
  const lo = Math.min(0, ...todosPisos)
  let hi = Math.max(0.1, ...todasCimas)
  hi += (hi - lo) * (o.valores ? (o.errores ? 0.2 : 0.13) : 0.05)
  const eY = ticksBonitos(lo, hi, 6)
  const yLabels = eY.ticks.map((t) => fmtTick(t, eY.paso))

  const itemsLey = leyenda.map((p) => ({ ...p, w: 26 + medir(p.nombre, 12) + 18 }))
  const filasLey = []
  let fila = [], ancho = 0
  itemsLey.forEach((it) => {
    if (ancho + it.w > W - 60 && fila.length) { filasLey.push(fila); fila = []; ancho = 0 }
    fila.push(it); ancho += it.w
  })
  if (fila.length) filasLey.push(fila)

  const L = calcularLayout({
    W, etiquetas: labels, ang: o.rotar, est, yLabels, derecha: 18,
    titulo: !!est.titulo.texto, tituloX: !!est.leyendaX.texto,
    altoPlot: Math.round(Math.min(Math.max(W * 0.42, 360), 540)) + est.valores.size * 2,
    extraAbajo: filasLey.length * 24 + 30, fijoH: tam ? tam.h : 0,
    anchoTituloY: medir(est.leyendaY.texto || eje, est.leyendaY.size, est.leyendaY.bold, est.leyendaY.italic),
  })
  const y = (v) => L.top + L.plotH - ((v - eY.min) / (eY.max - eY.min)) * L.plotH
  const cx = (i) => L.left + L.band * (i + 0.5)
  const sw = Math.max(Math.min((L.band * 0.84) / nmax, 78), 9)    // ancho de cada columna
  const bw = sw * 0.8
  const yLey = L.top + L.plotH + L.altoEtiquetas + L.altoLeyX + 36
  const errNom = o.errorNombre || 'error'

  return (
    <div ref={wrap} className="chart-wrap" onContextMenu={onContext}>
      <svg ref={svgRef} viewBox={`0 0 ${W} ${L.H}`} width={W} height={L.H} fontFamily={FUENTE}>
        <rect width={W} height={L.H} fill="#fff" />
        <Titulo W={W} est={est} />
        <EjeY ticks={eY.ticks} paso={eY.paso} y={y} left={L.left} plotW={L.plotW} est={est} titulo={est.leyendaY.texto || eje} />
        <line x1={L.left} x2={L.left + L.plotW} y1={y(eY.min)} y2={y(eY.min)} stroke="#444" />
        <line x1={L.left} x2={L.left} y1={L.top} y2={y(eY.min)} stroke="#444" />
        {eY.min < 0 && <line x1={L.left} x2={L.left + L.plotW} y1={y(0)} y2={y(0)} stroke="#888" strokeDasharray="3 3" />}

        {grupos.map((g, gi) => {
          const x0 = cx(gi) - (g.barras.length * sw) / 2
          const nom = g.etiqueta || g.muestra
          return (
            <g key={g.muestra}>
              {gi % 2 === 1 && <rect x={cx(gi) - L.band / 2} y={L.top} width={L.band} height={L.plotH} fill="#f6f1e8" fillOpacity="0.6" />}
              {g.barras.map((b, k) => {
                const mx = x0 + k * sw + sw / 2
                const n = b.pts.length
                const q1 = cuantil(b.pts, 0.25), md = cuantil(b.pts, 0.5), q3 = cuantil(b.pts, 0.75)
                const mn = Math.min(...b.pts), mxv = Math.max(...b.pts)
                const puntos = b.detalle && b.detalle.length ? b.detalle : b.pts.map((v) => ({ v, color: b.color }))
                const arriba = cima(b)
                const cab = `${nom} · ${b.placa}`
                const V = (x) => fmt(x)
                return (
                  <g key={b.id}>
                    {o.barras && (
                      <rect x={mx - bw / 2} y={y(Math.max(b.media, 0))} width={bw} height={Math.max(Math.abs(y(0) - y(b.media)), 0.5)} rx="2"
                        fill={b.color} fillOpacity={o.caja ? 0.3 : 0.92} stroke={b.color} strokeWidth="1"
                        data-tip={`${cab}\n${dMedia(b.vp || b.pts)}`} />
                    )}
                    {o.barras && o.barrasError && conErr(b) && (
                      <g stroke="#222" strokeWidth="1.4" data-tip={`${cab}\nBarra de error: ± ${V(b.err)} (${errNom})\n${o.errorTipo ? dError(o.errorTipo, b.vp || b.pts) : ''}\nva de ${V(b.media - b.err)} a ${V(b.media + b.err)}`}>
                        <line x1={mx} x2={mx} y1={y(Math.max(b.media - b.err, eY.min))} y2={y(b.media + b.err)} />
                        <line x1={mx - bw * 0.2} x2={mx + bw * 0.2} y1={y(b.media + b.err)} y2={y(b.media + b.err)} />
                        <line x1={mx - bw * 0.2} x2={mx + bw * 0.2} y1={y(Math.max(b.media - b.err, eY.min))} y2={y(Math.max(b.media - b.err, eY.min))} />
                      </g>
                    )}
                    {o.bigotes && n >= 5 && (
                      <g stroke="#444" strokeWidth="1.2" data-tip={`${cab}\n${dBigotes(b.pts)}`}>
                        <line x1={mx} x2={mx} y1={y(mn)} y2={y(mxv)} />
                        <line x1={mx - bw * 0.16} x2={mx + bw * 0.16} y1={y(mn)} y2={y(mn)} />
                        <line x1={mx - bw * 0.16} x2={mx + bw * 0.16} y1={y(mxv)} y2={y(mxv)} />
                      </g>
                    )}
                    {o.caja && n >= 5 && (
                      <rect x={mx - bw * 0.3} y={y(q3)} width={bw * 0.6} height={Math.max(y(q1) - y(q3), 1)} rx="2" fill="#fff" fillOpacity="0.8" stroke={b.color} strokeWidth="1.6"
                        data-tip={`${cab}\n${dCaja(b.pts)}`} />
                    )}
                    {o.mediana && n >= 3 && (
                      <line x1={mx - bw * 0.3} x2={mx + bw * 0.3} y1={y(md)} y2={y(md)} stroke="#222" strokeWidth="2.4"
                        data-tip={`${cab}\n${dMediana(b.pts)}`} />
                    )}
                    {o.media && (
                      <path d={`M${mx - 5},${y(b.media)} L${mx},${y(b.media) - 5} L${mx + 5},${y(b.media)} L${mx},${y(b.media) + 5} Z`} fill="#fff" stroke="#222" strokeWidth="1.2" data-tip={`${cab}\n${dMedia(b.vp || b.pts)}`} />
                    )}
                    {o.puntos && puntos.map((p, j) => (
                      <circle key={j} cx={mx + (puntos.length > 1 ? (((j * 0.6180339) % 1) - 0.5) * bw * 0.56 : 0)} cy={y(p.v)} r="3.6"
                        fill={p.color} fillOpacity="0.92" stroke="#fff" strokeWidth="1" data-tip={p.tip || `${b.placa}\nOD = ${V(p.v)}`} />
                    ))}
                    {o.valores && Number.isFinite(arriba) && (
                      <EtiquetaFondo x={mx} y={y(arriba) - 8} est={est.valores}
                        texto={o.errores && conErr(b) ? `${fmt(b.media)}\n± ${fmt(b.err)}` : fmt(b.media)} />
                    )}
                  </g>
                )
              })}
            </g>
          )
        })}

        <EtiquetasX labels={labels} cx={cx} yBase={y(eY.min)} ang={o.rotar} est={est} />
        <LeyendaX L={L} est={est} />

        {filasLey.map((f, r) => {
          const tot = f.reduce((a, it) => a + it.w, 0)
          let x = L.left + L.plotW / 2 - tot / 2
          return (
            <g key={r} transform={`translate(0,${yLey + r * 24})`}>
              {f.map((it) => {
                const gg = (
                  <g key={it.id} transform={`translate(${x},0)`}>
                    <rect width="14" height="14" y="-11" rx="3" fill={it.color} stroke="#333" strokeWidth="0.5" />
                    <text x="20" style={{ fontSize: 12, fill: '#333' }}>{it.nombre}</text>
                  </g>
                )
                x += it.w
                return gg
              })}
            </g>
          )
        })}
        <text x={L.left + L.plotW} y={L.H - 8} textAnchor="end" style={{ fontSize: 11, fill: '#6b7785' }}>{nota}</text>
      </svg>
    </div>
  )
})
