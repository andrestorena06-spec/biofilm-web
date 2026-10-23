import { useState } from 'react'
import { Campo, Select } from './ui.jsx'
import { Nota } from './tip.jsx'
import { detectarCV, detectarGrubbs, detectarQ } from '../motor.js'
import { media } from '../estadistica.js'
import { estad } from '../calculos.js'
import { resumenBlancos } from '../blancos.js'
import { COLOR_CLASE, FUENTE, TXT_LOGODC, fmtTick, logOdc, ticksBonitos } from '../utils.js'

const f = (x, d = 4) => (Number.isFinite(x) ? x.toFixed(d) : x === Infinity ? '∞' : '–')

function Tabla({ cols, filas, pie }) {
  return (
    <div className="tabla-scroll chica">
      <table className="tabla paso-tabla">
        <thead><tr>{cols.map((c) => <th key={c}>{c}</th>)}</tr></thead>
        <tbody>{filas.map((r, i) => <tr key={i}>{r.map((v, j) => <td key={j}>{v}</td>)}</tr>)}</tbody>
        {pie && <tfoot>{pie.map((r, i) => <tr key={i}><th colSpan={cols.length - 1}>{r[0]}</th><td><b>{r[1]}</b></td></tr>)}</tfoot>}
      </table>
    </div>
  )
}

// ---------------------------------------------------------------
// Gráfico de la función 1 + log₂(OD ÷ ODc) con el ODc de la placa: cada muestra cae sobre la curva.
// Las franjas son las clases de Stepanović, que en esta escala quedan en 1, 2 y 3 para cualquier placa.
// ---------------------------------------------------------------
const FRANJAS = [['No productor', -Infinity, 1], ['Productor débil', 1, 2], ['Productor moderado', 2, 3], ['Productor fuerte', 3, Infinity]]
const GUIAS = [[1, 'ODc'], [2, '2 × ODc'], [4, '4 × ODc']]

function CurvaLogOdc({ odc, filas, elegida, reps, onElegir }) {
  const W = 760, H = 340, m = { l: 58, r: 132, t: 14, b: 48 }
  const conV = filas.filter((r) => r.Media > 0)
  const xs = [...conV.map((r) => r.Media), ...reps]
  const tx = ticksBonitos(0, Math.max(odc * 4.6, ...xs.map((v) => v * 1.1)), 7)
  const xMax = tx.max
  const yHi = Math.max(4, Math.ceil(logOdc(xMax, odc)))
  const yLo = Math.min(-1, Math.floor(Math.min(...xs.map((v) => logOdc(v, odc)).filter(Number.isFinite))))
  const X = (v) => m.l + (v / xMax) * (W - m.l - m.r)
  const Y = (v) => m.t + (1 - (Math.min(Math.max(v, yLo), yHi) - yLo) / (yHi - yLo)) * (H - m.t - m.b)
  // la curva arranca donde toca el piso del eje (con OD → 0 baja sin límite)
  const x0 = odc * 2 ** (yLo - 1)
  const curva = Array.from({ length: 241 }, (_, i) => { const x = x0 * (xMax / x0) ** (i / 240); return `${X(x).toFixed(1)},${Y(logOdc(x, odc)).toFixed(1)}` }).join(' ')
  const yTicks = Array.from({ length: yHi - yLo + 1 }, (_, i) => yLo + i)
  const cuenta = (od) => `OD = ${od.toFixed(4)}\nOD ÷ ODc = ${od.toFixed(4)} ÷ ${odc.toFixed(4)} = ${(od / odc).toFixed(3)}\nlog₂(${(od / odc).toFixed(3)}) = ${Math.log2(od / odc).toFixed(3)}\n${TXT_LOGODC} = ${logOdc(od, odc).toFixed(3)}`
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="curva-logodc" fontFamily={FUENTE} role="img" aria-label={`Función ${TXT_LOGODC} con ODc = ${odc.toFixed(3)}`}>
      <rect width={W} height={H} fill="#fff" />
      {FRANJAS.map(([c, a, b]) => {
        const y1 = Y(Math.min(b, yHi)), y2 = Y(Math.max(a, yLo))
        return (
          <g key={c} data-tip={`${c}: ${a === -Infinity ? `valor ≤ 1 (OD ≤ ${odc.toFixed(3)})` : b === Infinity ? `valor > 3 (OD > ${(4 * odc).toFixed(3)})` : `${a} – ${b} (OD ${(odc * 2 ** (a - 1)).toFixed(3)} – ${(odc * 2 ** (b - 1)).toFixed(3)})`}`}>
            <rect x={m.l} y={y1} width={W - m.l - m.r} height={y2 - y1} fill={COLOR_CLASE[c]} fillOpacity="0.14" />
            <text x={W - m.r + 8} y={(y1 + y2) / 2 + 4} style={{ fontSize: 11.5, fill: '#4a4036' }}>{c}</text>
          </g>
        )
      })}
      {tx.ticks.map((v) => (
        <g key={'x' + v}>
          <line x1={X(v)} x2={X(v)} y1={m.t} y2={H - m.b} stroke="#ece6dc" />
          <text x={X(v)} y={H - m.b + 16} textAnchor="middle" style={{ fontSize: 11, fill: '#6b7785' }}>{fmtTick(v, tx.paso)}</text>
        </g>
      ))}
      {yTicks.map((v) => <text key={'y' + v} x={m.l - 8} y={Y(v) + 4} textAnchor="end" style={{ fontSize: 11, fill: '#6b7785' }}>{v}</text>)}
      <line x1={m.l} x2={W - m.r} y1={H - m.b} y2={H - m.b} stroke="#444" />
      <line x1={m.l} x2={m.l} y1={m.t} y2={H - m.b} stroke="#444" />
      <text x={(m.l + W - m.r) / 2} y={H - 8} textAnchor="middle" style={{ fontSize: 12, fill: '#333' }}>OD</text>
      <text transform={`translate(16 ${(m.t + H - m.b) / 2}) rotate(-90)`} textAnchor="middle" style={{ fontSize: 12, fill: '#333' }}>{TXT_LOGODC}</text>
      {GUIAS.filter(([k]) => k * odc < xMax).map(([k, t]) => {
        const gx = X(k * odc), gy = Y(1 + Math.log2(k))
        return (
          <g key={t} data-tip={`${t} = ${(k * odc).toFixed(4)} de OD → ${1 + Math.log2(k)}`}>
            <polyline points={`${gx},${H - m.b} ${gx},${gy} ${m.l},${gy}`} fill="none" stroke="#6b5a45" strokeDasharray="3 3" strokeWidth="1" />
            <text x={gx + 4} y={H - m.b - 5} style={{ fontSize: 10.5, fill: '#6b5a45' }}>{t}</text>
          </g>
        )
      })}
      <polyline points={curva} fill="none" stroke="#2f5d8a" strokeWidth="2.4" strokeLinejoin="round" />
      {reps.map((od, i) => Number.isFinite(logOdc(od, odc)) && (
        <circle key={'r' + i} cx={X(od)} cy={Y(logOdc(od, odc))} r="3.6" fill="#fff" stroke="#1f2933" strokeWidth="1.2" data-tip={`Réplica de «${elegida}»\n${cuenta(od)}`} />
      ))}
      {conV.map((r) => {
        const v = logOdc(r.Media, odc), sel = r.Muestra === elegida
        return (
          <g key={r.Muestra} style={{ cursor: r.EsBlanco ? 'default' : 'pointer' }} onClick={() => !r.EsBlanco && onElegir(r.Muestra)}
            data-tip={`${r.Muestra}${r.EsBlanco ? ' (blanco)' : ''} · media\n${cuenta(r.Media)}${r.Clasificacion ? `\n${r.Clasificacion}` : ''}${r.EsBlanco ? '' : '\nClic para ver sus pasos'}`}>
            <circle cx={X(r.Media)} cy={Y(v)} r={sel ? 7.5 : 5.5} fill={r.EsBlanco ? COLOR_CLASE.Blanco : COLOR_CLASE[r.Clasificacion] || '#888'} stroke="#1f2933" strokeWidth={sel ? 2 : 1} />
            {sel && <text x={X(r.Media) + 10} y={Y(v) + 16} style={{ fontSize: 12, fontWeight: 600, fill: '#1f2933' }}>{r.Muestra} · {v.toFixed(2)}</text>}
          </g>
        )
      })}
    </svg>
  )
}

// ===============================================================
// CÁLCULO PASO A PASO: una tabla por cada paso, con el valor original, lo que se resta o se divide y el resultado
// ===============================================================
export function PasoAPaso({ s }) {
  const a = s.analisis
  const muestras = a.resumen.map((m) => m.Muestra)
  const [m, setM] = useState('')
  const muestra = muestras.includes(m) ? m : muestras[0]
  const det = s.deteccion
  const odc = a.odc.odc

  // 1. punto de corte
  const bl = a.estado.filter((e) => e.EsBlanco && e.Usado)
  const eb = estad(bl.map((e) => e.OD))

  // 2. una muestra
  const reps = a.estado.filter((e) => e.Muestra === muestra && e.Usado && !e.EsBlanco)
  const es = estad(reps.map((e) => e.OD))
  const res = a.resumen.find((x) => x.Muestra === muestra)

  // 3. valores atípicos de la muestra (todas sus réplicas no excluidas a mano)
  const todas = a.estado.filter((e) => e.Muestra === muestra && !e.Manual)
  const x = todas.map((e) => e.OD)
  const d = det.metodo === 'grubbs' ? detectarGrubbs(x, det.conf) : det.metodo === 'cv' ? detectarCV(x, Number(det.cvMax)) : detectarQ(x, det.conf)
  const orden = x.map((v, i) => ({ v, e: todas[i] })).sort((p, q) => p.v - q.v)
  const rango = orden.length ? orden[orden.length - 1].v - orden[0].v : NaN

  // escala log ODc: todas las muestras y el blanco de la placa
  const filasLog = [...a.resumen, ...resumenBlancos(a.estado)].filter((r) => Number.isFinite(r.Media))

  return (
    <section className="tarjeta metodo">
      <div className="titulo-fila">
        <h2>Cálculo paso a paso con tus datos <Nota>Cada tabla muestra el valor original, lo que se resta o se divide y el resultado, con los datos de la placa activa. Elegí la muestra para ver sus pasos.</Nota></h2>
        {muestras.length > 0 && <Campo label="Muestra"><Select value={muestra} onChange={setM} opciones={muestras.map((x) => [x, x])} /></Campo>}
      </div>

      <h3>1. Punto de corte (ODc)</h3>
      {bl.length > 1 ? (
        <Tabla cols={['Pocillo blanco', 'OD original', 'Se resta la media', 'Diferencia', 'Diferencia al cuadrado']}
          filas={bl.map((e) => [e.Pocillo, f(e.OD), f(eb.m), f(e.OD - eb.m), f((e.OD - eb.m) ** 2, 6)])}
          pie={[['Σ diferencias² ', f(eb.ss, 6)], ['Media de blancos (x̄)', f(eb.m)], [`DE = √(Σ / (n − 1)) = √(${f(eb.ss, 6)} / ${eb.n - 1})`, f(eb.sd)], ['3 × DE', f(3 * eb.sd)], ['ODc = x̄ + 3 × DE', f(odc)]]} />
      ) : <p className="ayuda">Hacen falta al menos 2 blancos aceptados.</p>}

      <h3>2. Escala {TXT_LOGODC} con el ODc de esta placa <Nota>{`Cada OD se mide contra el ODc de la placa en escala logarítmica de base 2: el ODc vale 1, 2 × ODc vale 2 y 4 × ODc vale 3, así que las clases quedan en las mismas franjas en todas las placas.\nCada escalón de 1 es una OD del doble; con OD muy chicas la curva baja sin límite.\nClic en un punto para ver los pasos de esa muestra.`}</Nota></h3>
      {Number.isFinite(odc) && odc > 0 ? (
        <>
          <div className="figura figura-curva"><CurvaLogOdc odc={odc} filas={filasLog} elegida={muestra} reps={reps.map((e) => e.OD)} onElegir={setM} /></div>
          <Tabla cols={['Muestra', 'OD media', 'OD ÷ ODc', 'log₂(OD ÷ ODc)', TXT_LOGODC, 'Clase']}
            filas={filasLog.map((r) => [r.EsBlanco ? `${r.Muestra} (blanco)` : r.Muestra, f(r.Media), f(r.Media / odc, 3), f(Math.log2(r.Media / odc), 3), <b key="v">{f(logOdc(r.Media, odc), 3)}</b>, r.EsBlanco ? '–' : r.Clasificacion || '–'])} />
        </>
      ) : <p className="ayuda">Sin ODc no hay escala log ODc.</p>}

      {res && (
        <>
          <h3>3. Media y errores de «{muestra}»</h3>
          <Tabla cols={['Pocillo', 'Réplica', 'OD original', 'Se resta la media', 'Diferencia', 'Diferencia al cuadrado']}
            filas={reps.map((e) => [e.Pocillo, e.Replica, f(e.OD), f(es.m), f(e.OD - es.m), f((e.OD - es.m) ** 2, 6)])}
            pie={[['n (réplicas aceptadas)', es.n], ['Σ OD', f(reps.reduce((t, e) => t + e.OD, 0))], ['Media x̄ = Σ OD / n', f(es.m)], ['Σ diferencias²', f(es.ss, 6)],
              ['DE = √(Σ / (n − 1))', f(es.sd)], ['SEM = DE / √n', f(es.sem)], [`t(0.975; ${es.n - 1})`, f(es.t, 3)], ['IC 95 % = t × SEM', f(es.ic)],
              ['CV = 100 × DE / x̄ (%)', f(es.cv, 2)], ...(Number.isFinite(odc) ? [['OD / ODc', f(es.m / odc, 2)], [`Umbrales: ODc ${f(odc)} · 2×ODc ${f(2 * odc)} · 4×ODc ${f(4 * odc)}`, res.Clasificacion || '–']] : [])]} />

          <h3>4. Valores atípicos de «{muestra}» ({det.metodo === 'grubbs' ? 'test de Grubbs' : det.metodo === 'cv' ? 'coeficiente de variación' : 'test Q de Dixon'})</h3>
          {orden.length >= 3 ? (
            <>
              <Tabla cols={['Orden', 'Pocillo', 'OD', 'Distancia al siguiente', det.metodo === 'q' ? 'Distancia / rango' : '|OD − x̄|']}
                filas={orden.map((r, i) => [i + 1, r.e.Pocillo, f(r.v), i < orden.length - 1 ? f(orden[i + 1].v - r.v) : '–',
                  det.metodo === 'q' ? (i === 0 ? f((orden[1].v - r.v) / rango, 3) : i === orden.length - 1 ? f((r.v - orden[i - 1].v) / rango, 3) : '–') : f(Math.abs(r.v - media(x)))])}
                pie={det.metodo === 'q' ? [['Rango (máx − mín)', f(rango)]] : det.metodo === 'grubbs' ? [['Media x̄', f(media(x))], ['DE', f(estad(x).sd)]] : [['Media x̄', f(media(x))], ['DE', f(estad(x).sd)]]} />
              <Tabla cols={['Estadístico', 'Valor', 'Valor crítico', 'Decisión']}
                filas={[[det.metodo === 'q' ? 'Q (mayor distancia / rango)' : det.metodo === 'grubbs' ? 'G = máx |OD − x̄| / DE' : 'CV de la muestra (%)', f(d.stat, 3), f(d.crit, 3), d.idx !== null ? `Sospechoso: ${todas[d.idx]?.Pocillo} (extremo ${d.lado})` : 'Ningún valor atípico']]} />
            </>
          ) : <p className="ayuda">Hacen falta al menos 3 réplicas.</p>}
        </>
      )}

      <p className="ayuda">La comparación entre placas, medios y cepas (con cada prueba desarrollada paso a paso) está más abajo, en «Estadística: cálculos, razones y lógica de cada método».</p>
    </section>
  )
}
