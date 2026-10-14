import { forwardRef } from 'react'
import { calcularLayout, estiloTexto } from '../layout.js'
import { FUENTE, fmt, fmtTick, medir, ticksBonitos } from '../utils.js'
import { useAncho } from './charts.jsx'

// ---------------------------------------------------------------
// DISPERSIÓN ENTRE PLACAS
// Para cada muestra, una columna por placa con los pocillos como puntos, la caja (cuartiles y mediana)
// y la media (rombo). Sin barras: la dispersión de cada placa se ve de un vistazo y se comparan entre sí.
// grupos: [{ muestra, etiqueta?, barras: [{ id, placa, color, media, pts: [OD...] }] }]
// leyenda: [{ id, nombre, color }]
// ---------------------------------------------------------------
const cuantil = (v, q) => {
  const a = [...v].sort((x, y) => x - y)
  if (!a.length) return NaN
  const pos = (a.length - 1) * q
  const i = Math.floor(pos)
  return a[i] + (a[Math.min(i + 1, a.length - 1)] - a[i]) * (pos - i)
}

export const DispersionChart = forwardRef(function DispersionChart({ grupos, leyenda, o, est, eje, onContext, tam, nota }, svgRef) {
  const [wrap, Wmed] = useAncho()
  const W = tam ? tam.w : Wmed
  const labels = grupos.map((g) => g.etiqueta || g.muestra)
  const nmax = Math.max(1, ...grupos.map((g) => g.barras.length))
  const todos = grupos.flatMap((g) => g.barras.flatMap((b) => b.pts))
  const lo = Math.min(0, ...todos)
  let hi = Math.max(...todos, 0.1)
  hi += (hi - lo) * 0.06
  const eY = ticksBonitos(lo, hi, 6)
  const yLabels = eY.ticks.map((t) => fmtTick(t, eY.paso))

  const itemsLey = leyenda.map((p) => ({ ...p, w: 26 + medir(p.nombre, 12) + 16 }))
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
  const y = (v) => L.top + L.plotH - ((v - eY.min) / (eY.max - eY.min)) * L.plotH
  const cx = (i) => L.left + L.band * (i + 0.5)
  const sw = Math.max(Math.min((L.band * 0.9) / nmax, 70), 12)
  const yLey = L.top + L.plotH + L.altoEtiquetas + L.altoLeyX + 34

  return (
    <div ref={wrap} className="chart-wrap" onContextMenu={onContext}>
      <svg ref={svgRef} viewBox={`0 0 ${W} ${L.H}`} width={W} height={L.H} fontFamily={FUENTE}>
        <rect width={W} height={L.H} fill="#fff" />
        {est.titulo.texto && <text x={W / 2} y={14 + est.titulo.size} textAnchor="middle" style={estiloTexto(est.titulo)}>{est.titulo.texto}</text>}
        {eY.ticks.map((t) => (
          <g key={t}>
            <line x1={L.left} x2={L.left + L.plotW} y1={y(t)} y2={y(t)} stroke="#eceff3" />
            <text x={L.left - 8} y={y(t)} textAnchor="end" dominantBaseline="central" style={estiloTexto(est.numerosY)}>{fmtTick(t, eY.paso)}</text>
          </g>
        ))}
        <text transform={`translate(${14 + est.leyendaY.size * 0.6},${L.top + L.plotH / 2}) rotate(-90)`} textAnchor="middle" dominantBaseline="hanging"
          style={estiloTexto(est.leyendaY)}>{est.leyendaY.texto || eje}</text>
        <line x1={L.left} x2={L.left + L.plotW} y1={y(eY.min)} y2={y(eY.min)} stroke="#444" />
        <line x1={L.left} x2={L.left} y1={L.top} y2={y(eY.min)} stroke="#444" />

        {grupos.map((g, gi) => {
          const x0 = cx(gi) - (g.barras.length * sw) / 2
          return (
            <g key={g.muestra}>
              {gi % 2 === 1 && <rect x={cx(gi) - L.band / 2} y={L.top} width={L.band} height={L.plotH} fill="#f7f3ec" fillOpacity="0.55" />}
              {g.barras.map((b, k) => {
                const mx = x0 + k * sw + sw / 2
                const pts = b.pts
                const q1 = cuantil(pts, 0.25), md = cuantil(pts, 0.5), q3 = cuantil(pts, 0.75)
                const caja = pts.length >= 3
                const mn = Math.min(...pts), mxv = Math.max(...pts)
                const bw = sw * 0.52
                return (
                  <g key={b.id}>
                    <title>{`${g.etiqueta || g.muestra} · ${b.placa}\nmedia = ${fmt(b.media)}${caja ? `\nmediana = ${fmt(md)}\nQ1–Q3 = ${fmt(q1)} – ${fmt(q3)}` : ''}\nmín–máx = ${fmt(mn)} – ${fmt(mxv)}\n${pts.length} pocillos`}</title>
                    {pts.length > 1 && <line x1={mx} x2={mx} y1={y(mn)} y2={y(mxv)} stroke={b.color} strokeWidth="1.2" strokeOpacity="0.8" />}
                    {caja && (
                      <>
                        <rect x={mx - bw / 2} y={y(q3)} width={bw} height={Math.max(y(q1) - y(q3), 1)} fill={b.color} fillOpacity="0.16" stroke={b.color} strokeWidth="1.2" rx="2" />
                        <line x1={mx - bw / 2} x2={mx + bw / 2} y1={y(md)} y2={y(md)} stroke={b.color} strokeWidth="2.2" />
                      </>
                    )}
                    {pts.map((v, j) => (
                      <circle key={j} cx={mx + (((j * 0.6180339) % 1) - 0.5) * sw * 0.72} cy={y(v)} r="3.3" fill={b.color} fillOpacity="0.85" stroke="#fff" strokeWidth="0.8" />
                    ))}
                    <path d={`M${mx - 5.5},${y(b.media)} L${mx},${y(b.media) - 5.5} L${mx + 5.5},${y(b.media)} L${mx},${y(b.media) + 5.5} Z`} fill="#1b1f23" stroke="#fff" strokeWidth="1" />
                  </g>
                )
              })}
            </g>
          )
        })}

        {labels.map((l, i) => (
          <text key={l + i} transform={`translate(${cx(i)},${y(eY.min) + 10}) rotate(${-o.rotar})`}
            textAnchor={o.rotar > 0 ? 'end' : 'middle'} dominantBaseline={o.rotar > 0 ? 'central' : 'hanging'} style={estiloTexto(est.nombresX)}>{l}</text>
        ))}
        {est.leyendaX.texto && (
          <text x={L.left + L.plotW / 2} y={L.top + L.plotH + 10 + L.altoEtiquetas + 12 + est.leyendaX.size} textAnchor="middle" style={estiloTexto(est.leyendaX)}>{est.leyendaX.texto}</text>
        )}

        {filasLey.map((f, r) => {
          const tot = f.reduce((a, it) => a + it.w, 0)
          let x = L.left + L.plotW / 2 - tot / 2
          return (
            <g key={r} transform={`translate(0,${yLey + r * 22})`}>
              {f.map((it) => {
                const gg = (
                  <g key={it.id} transform={`translate(${x},0)`}>
                    <circle cx="7" cy="-4" r="5" fill={it.color} stroke="#fff" strokeWidth="1" />
                    <text x="20" style={{ fontSize: 12, fill: '#333' }}>{it.nombre}</text>
                  </g>
                )
                x += it.w
                return gg
              })}
            </g>
          )
        })}
        <text x={L.left + L.plotW} y={L.H - 8} textAnchor="end" style={{ fontSize: 11, fill: '#6b7785' }}>
          {nota ?? 'Cada punto es un pocillo aceptado · caja: cuartiles y mediana · rombo negro: media'}
        </text>
      </svg>
    </div>
  )
})
