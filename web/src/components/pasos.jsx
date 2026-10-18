import { useState } from 'react'
import { Campo, Select } from './ui.jsx'
import { Nota } from './tip.jsx'
import { detectarCV, detectarGrubbs, detectarQ } from '../motor.js'
import { anovaTabla, holm, marcaSig, media, welch } from '../estadistica.js'
import { armarComparacion } from '../comparacion.js'
import { tCuantil } from '../utils.js'
import { estad } from '../calculos.js'

const f = (x, d = 4) => (Number.isFinite(x) ? x.toFixed(d) : x === Infinity ? '∞' : '–')
const pTxt = (p) => (!Number.isFinite(p) ? '–' : p < 0.0001 ? '< 0.0001' : p.toFixed(4))

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

  // 4. comparación entre placas
  const D = armarComparacion(s)
  const gruposComp = D.grupos
  const valores = gruposComp.map((g) => g.barras.map((b) => b.media))
  const an = gruposComp.length > 1 ? anovaTabla(valores) : null
  const o = s.opts.comparar
  const ctrl = gruposComp.some((g) => g.muestra === o.control) ? o.control : gruposComp[0]?.muestra
  const otros = gruposComp.filter((g) => g.muestra !== ctrl)
  const vc = (gruposComp.find((g) => g.muestra === ctrl)?.barras || []).map((b) => b.media)
  const ws = otros.map((g) => welch(g.barras.map((b) => b.media), vc))
  const pa = holm(ws.map((w) => (w ? w.p : NaN)))

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
          <Tabla cols={['Pocillo', 'Réplica', 'OD original', 'Se resta la media', 'Diferencia', 'Diferencia al cuadrado']}
            filas={reps.map((e) => [e.Pocillo, e.Replica, f(e.OD), f(es.m), f(e.OD - es.m), f((e.OD - es.m) ** 2, 6)])}
            pie={[['n (réplicas aceptadas)', es.n], ['Σ OD', f(reps.reduce((t, e) => t + e.OD, 0))], ['Media x̄ = Σ OD / n', f(es.m)], ['Σ diferencias²', f(es.ss, 6)],
              ['DE = √(Σ / (n − 1))', f(es.sd)], ['SEM = DE / √n', f(es.sem)], [`t(0.975; ${es.n - 1})`, f(es.t, 3)], ['IC 95 % = t × SEM', f(es.ic)],
              ['CV = 100 × DE / x̄ (%)', f(es.cv, 2)], ...(Number.isFinite(odc) ? [['OD / ODc', f(es.m / odc, 2)], [`Umbrales: ODc ${f(odc)} · 2×ODc ${f(2 * odc)} · 4×ODc ${f(4 * odc)}`, res.Clasificacion || '–']] : [])]} />

          <h3>3. Valores atípicos de «{muestra}» ({det.metodo === 'grubbs' ? 'test de Grubbs' : det.metodo === 'cv' ? 'coeficiente de variación' : 'test Q de Dixon'})</h3>
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

      <h3>4. Comparación entre placas</h3>
      {gruposComp.length > 0 ? (
        <>
          <Tabla cols={['Muestra', 'Placa', 'OD media de la placa (un valor por placa)']} filas={gruposComp.flatMap((g) => g.barras.map((b) => [g.etiqueta, b.placa, f(b.media)]))} />
          {an ? (
            <>
              <Tabla cols={['Muestra', 'n (placas)', 'Media del grupo', 'Media general', 'Diferencia', 'n × diferencia²']}
                filas={gruposComp.map((g, i) => [g.etiqueta, an.ns[i], f(an.medias[i]), f(an.gm), f(an.medias[i] - an.gm), f(an.ns[i] * (an.medias[i] - an.gm) ** 2, 6)])} />
              <Tabla cols={['ANOVA · fuente', 'Suma de cuadrados', 'gl', 'Cuadrado medio', 'F', 'p']}
                filas={[['Entre muestras', f(an.ssb, 6), an.df1, f(an.msb, 6), f(an.F, 3), pTxt(an.p)], ['Dentro (error)', f(an.ssw, 6), an.df2, f(an.msw, 6), '', ''], ['Total', f(an.sst, 6), an.df1 + an.df2, '', '', '']]} />
              <p className="ayuda">F = CM entre / CM dentro = {f(an.msb, 6)} / {f(an.msw, 6)} = {f(an.F, 3)}; p = {pTxt(an.p)} {marcaSig(an.p)}.</p>
            </>
          ) : <p className="ayuda">Para el ANOVA hacen falta al menos 2 muestras con 2 o más placas.</p>}
          {otros.length > 0 && vc.length > 0 && (
            <Tabla cols={[`Contra el control «${ctrl}»`, 'Media', 'Media del control', 'Diferencia', 'Error estándar de la diferencia', 't', 'gl', 'p', 'p ajustado (Holm)']}
              filas={otros.map((g, i) => {
                const v = g.barras.map((b) => b.media)
                const w = ws[i]
                const se = w ? Math.abs(w.dif / w.t) : NaN
                return [g.etiqueta, f(media(v)), f(media(vc)), w ? f(w.dif) : '–', f(se), w ? f(w.t, 3) : '–', w ? f(w.df, 2) : '–', w ? pTxt(w.p) : '–', pTxt(pa[i])]
              })} />
          )}
        </>
      ) : <p className="ayuda">Cargá y configurá al menos una placa para ver la comparación.</p>}
    </section>
  )
}
