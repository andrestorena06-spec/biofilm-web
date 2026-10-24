import { useState } from 'react'
import { Campo, Select } from './ui.jsx'
import { Nota } from './tip.jsx'
import { detectarCV, detectarGrubbs, detectarQ } from '../motor.js'
import { media } from '../estadistica.js'
import { estad } from '../calculos.js'

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
  const resta = a.odc.resta || 0          // blanco restado (Calidad › Restar blanco)
  const leida = (e) => (Number.isFinite(e.ODleida) ? e.ODleida : e.OD)

  // 1. punto de corte (siempre con la OD leída)
  const bl = (s.analisisLeido || a).estado.filter((e) => e.EsBlanco && e.Usado)
  const eb = estad(bl.map((e) => e.OD))

  // 2. una muestra
  const reps = a.estado.filter((e) => e.Muestra === muestra && e.Usado && !e.EsBlanco)
  const es = estad(reps.map((e) => e.OD))
  const res = a.resumen.find((x) => x.Muestra === muestra)

  // 3. valores atípicos de la muestra (todas sus réplicas no excluidas a mano)
  const todas = a.estado.filter((e) => e.Muestra === muestra && !e.Manual)
  const x = todas.map(leida)   // los tests de atípicos usan la OD leída
  const d = det.metodo === 'grubbs' ? detectarGrubbs(x, det.conf) : det.metodo === 'cv' ? detectarCV(x, Number(det.cvMax)) : detectarQ(x, det.conf)
  const orden = x.map((v, i) => ({ v, e: todas[i] })).sort((p, q) => p.v - q.v)
  const rango = orden.length ? orden[orden.length - 1].v - orden[0].v : NaN

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

      {res && (
        <>
          <h3>2. Media y errores de «{muestra}»</h3>
          {resta ? <p className="ayuda">Con «Restar blanco» (Calidad): OD corregida = OD leída − {f(resta)} (media de los blancos aceptados).</p> : null}
          <Tabla cols={[...(resta ? ['Pocillo', 'Réplica', 'OD leída', 'OD corregida'] : ['Pocillo', 'Réplica', 'OD original']), 'Se resta la media', 'Diferencia', 'Diferencia al cuadrado']}
            filas={reps.map((e) => [e.Pocillo, e.Replica, ...(resta ? [f(leida(e))] : []), f(e.OD), f(es.m), f(e.OD - es.m), f((e.OD - es.m) ** 2, 6)])}
            pie={[['n (réplicas aceptadas)', es.n], ['Σ OD', f(reps.reduce((t, e) => t + e.OD, 0))], ['Media x̄ = Σ OD / n', f(es.m)], ['Σ diferencias²', f(es.ss, 6)],
              ['DE = √(Σ / (n − 1))', f(es.sd)], ['SEM = DE / √n', f(es.sem)], [`t(0.975; ${es.n - 1})`, f(es.t, 3)], ['IC 95 % = t × SEM', f(es.ic)],
              ['CV = 100 × DE / x̄ (%)', f(es.cv, 2)], ...(Number.isFinite(odc) ? [[resta ? `OD / ODc = (x̄ + ${f(resta)}) / ODc (con la OD leída)` : 'OD / ODc', f((es.m + resta) / odc, 2)], [`Umbrales (OD leída): ODc ${f(odc)} · 2×ODc ${f(2 * odc)} · 4×ODc ${f(4 * odc)}`, res.Clasificacion || '–']] : [])]} />

          <h3>3. Valores atípicos de «{muestra}» ({det.metodo === 'grubbs' ? 'test de Grubbs' : det.metodo === 'cv' ? 'coeficiente de variación' : 'test Q de Dixon'}{resta ? ', con la OD leída' : ''})</h3>
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
