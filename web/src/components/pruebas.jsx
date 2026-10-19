import { Nota } from './tip.jsx'
import { anovaTabla, desvio, holm, marcaSig, media, welch } from '../estadistica.js'
import { anova2 } from '../reproducibilidad.js'

const finito = Number.isFinite
const f = (x, d = 4) => (finito(x) ? x.toFixed(d) : x === Infinity ? '∞' : '–')
const pTxt = (p) => (!finito(p) ? '–' : p < 0.0001 ? '< 0.0001' : p.toFixed(4))

export const PRUEBAS = [
  ['anova2', 'ANOVA cepa × medio', 'ANOVA de dos vías: efecto de la cepa, efecto del medio y si el efecto del medio depende de la cepa (interacción). Cada dato es la OD media de una cepa en una placa.'],
  ['cepaMedios', 'Cepa: entre medios', 'Para cada cepa: ANOVA de una vía entre los medios y comparación de los medios de a pares (t de Welch con corrección de Holm).'],
  ['medioCepas', 'Medio: entre cepas', 'Para cada medio: ANOVA de una vía entre las cepas y comparación de las cepas de a pares (t de Welch con corrección de Holm).'],
  ['placasCepa', 'Cepa: entre placas', 'Reproducibilidad: para cada cepa y medio, cuánto varía la OD media de una placa a otra (media, DE y coeficiente de variación).'],
]

// Lista de pruebas para elegir (cada una abre su tabla de resultados debajo del gráfico)
export function ListaPruebas({ o, setO }) {
  const sel = o.pruebas || []
  return (
    <div className="campo">
      <label>Pruebas estadísticas <Nota>Elegí las que quieras ver: cada una muestra su tabla debajo del gráfico. Cada placa cuenta como una réplica (el dato es la OD media de la cepa en esa placa). Con 2 o 3 placas por grupo solo se detectan diferencias grandes.</Nota></label>
      <div className="fila-chips">
        {PRUEBAS.map(([id, t, d]) => (
          <button key={id} type="button" className={`chip-op ${sel.includes(id) ? 'on' : ''}`} data-tip={`${t}\n${d}`}
            onClick={() => setO('pruebas', sel.includes(id) ? sel.filter((x) => x !== id) : [...sel, id])}>{t}</button>
        ))}
      </div>
    </div>
  )
}

function Tabla({ cols, filas }) {
  return (
    <div className="tabla-scroll chica">
      <table className="tabla paso-tabla">
        <thead><tr>{cols.map((c) => <th key={c}>{c}</th>)}</tr></thead>
        <tbody>{filas.map((r, i) => <tr key={i}>{r.map((v, j) => <td key={j}>{v}</td>)}</tr>)}</tbody>
      </table>
    </div>
  )
}

// ANOVA de una vía + comparaciones de a pares (Welch con Holm) entre los grupos dados
function unaVia(grupos) {
  const g = grupos.filter((x) => x.v.length > 0)
  const an = g.length > 1 ? anovaTabla(g.map((x) => x.v)) : null
  const pares = []
  for (let i = 0; i < g.length; i++) for (let j = i + 1; j < g.length; j++) pares.push({ a: g[i], b: g[j], w: welch(g[i].v, g[j].v) })
  const aj = holm(pares.map((p) => (p.w ? p.w.p : NaN)))
  return { g, an, pares: pares.map((p, i) => ({ ...p, pa: aj[i] })) }
}

function BloqueUnaVia({ titulo, r, factor }) {
  return (
    <div className="bloque-prueba">
      <h4>{titulo}</h4>
      {r.an ? (
        <>
          <Tabla cols={['Fuente', 'Suma de cuadrados', 'gl', 'Cuadrado medio', 'F', 'p', 'Resultado']}
            filas={[[`Entre ${factor}`, f(r.an.ssb, 6), r.an.df1, f(r.an.msb, 6), f(r.an.F, 3), pTxt(r.an.p), r.an.p < 0.05 ? `Hay diferencias (${marcaSig(r.an.p)})` : 'Sin diferencia clara'],
              ['Dentro (error)', f(r.an.ssw, 6), r.an.df2, f(r.an.msw, 6), '', '', ''], ['Total', f(r.an.sst, 6), r.an.df1 + r.an.df2, '', '', '', '']]} />
          <Tabla cols={['Grupo', 'n (placas)', 'Media', 'DE']} filas={r.g.map((x) => [x.nombre, x.v.length, f(media(x.v)), x.v.length > 1 ? f(desvio(x.v)) : '–'])} />
          {r.pares.length > 0 && (
            <Tabla cols={['Comparación', 'Media A', 'Media B', 'Diferencia (A − B)', 't', 'gl', 'p', 'p ajustado (Holm)', 'Resultado']}
              filas={r.pares.map((p) => [`${p.a.nombre} vs ${p.b.nombre}`, f(media(p.a.v)), f(media(p.b.v)), p.w ? f(p.w.dif) : '–', p.w ? f(p.w.t, 3) : '–', p.w ? f(p.w.df, 2) : '–', p.w ? pTxt(p.w.p) : '–', pTxt(p.pa),
                !p.w ? 'Hacen falta 2 o más placas en cada grupo' : p.pa < 0.05 ? `Distinto (${marcaSig(p.pa)})` : 'Sin diferencia clara'])} />
          )}
        </>
      ) : <p className="ayuda">No se puede calcular: hacen falta al menos 2 grupos y más datos que grupos.</p>}
    </div>
  )
}

// ===============================================================
// RESULTADOS de las pruebas elegidas, debajo del gráfico
// ===============================================================
export function ResultadosPruebas({ s, D, o }) {
  const sel = o.pruebas || []
  if (!sel.length) return null
  // un dato por cepa, medio y placa: la OD media de las réplicas aceptadas (cada placa es una réplica biológica)
  const obs = []
  D.placasSel.forEach((p) => {
    s.analisisMap[p.id].resumen.forEach((r) => {
      if (!finito(r.Media) || D.ocultos.has(D.clave(p.id, r.Muestra))) return
      obs.push({ cepa: r.Muestra, medio: p.medio || '(sin medio)', placa: p.nombre, y: r.Media })
    })
  })
  const cepas = [...new Set(obs.map((x) => x.cepa))]
  const medios = [...new Set(obs.map((x) => x.medio))]
  const cvBueno = finito(Number(o.reproCvBueno)) ? Number(o.reproCvBueno) : 20
  const cvMax = finito(Number(o.reproCvMax)) ? Number(o.reproCvMax) : 30
  const nota = (t) => <p className="ayuda">{t}</p>

  return (
    <div className="pruebas-resultados">
      {sel.includes('anova2') && (() => {
        const r = cepas.length > 1 && medios.length > 1 ? anova2(obs.map((x) => ({ y: x.y, a: x.cepa, b: x.medio }))) : null
        const nom = { A: 'Cepa', B: 'Medio', AB: 'Cepa × medio', Residual: 'Residual (error)' }
        return (
          <section className="resultado-test">
            <h2>ANOVA de dos vías: cepa × medio <Nota>Modelo: OD = cepa + medio + cepa × medio. Sumas de cuadrados tipo II (igual que car::Anova de R). F = CM del efecto / CM residual. La interacción dice si el efecto del medio es distinto según la cepa.</Nota></h2>
            {r ? (
              <>
                <Tabla cols={['Fuente', 'Suma de cuadrados', 'gl', 'Cuadrado medio', 'F', 'p', 'Resultado']}
                  filas={r.filas.map((x) => [nom[x.nombre], f(x.ss, 6), x.df, f(x.ms, 6), f(x.F, 3), pTxt(x.p), x.nombre === 'Residual' ? '' : x.p < 0.05 ? `Significativo (${marcaSig(x.p)})` : 'Sin diferencia clara'])} />
                {nota(`n = ${r.n} datos (cepa × medio × placa). ${r.filas[3].df < 3 ? 'Muy pocos grados de libertad residuales: hacen falta más placas por cepa y medio para confiar en estas pruebas.' : ''}`)}
                {nota(r.filas.slice(0, 3).filter((x) => x.p < 0.05).length
                  ? `Interpretación: ${r.filas.slice(0, 3).filter((x) => x.p < 0.05).map((x) => ({ A: 'la OD cambia según la cepa', B: 'la OD cambia según el medio', AB: 'el efecto del medio depende de la cepa' }[x.nombre])).join('; ')}.`
                  : 'Interpretación: no hay efectos significativos (p ≥ 0,05).')}
              </>
            ) : <p className="ayuda">Hacen falta al menos 2 cepas y 2 medios (cada placa tiene un medio, que se elige en la pestaña «Placa»), con datos en las combinaciones.</p>}
            <Tabla cols={['Cepa', 'Medio', 'Placa', 'OD media de la placa']} filas={obs.map((x) => [x.cepa, x.medio, x.placa, f(x.y)])} />
          </section>
        )
      })()}

      {sel.includes('cepaMedios') && (
        <section className="resultado-test">
          <h2>Cada cepa: comparación entre medios <Nota>Para cada cepa, un ANOVA de una vía con los medios como grupos (un dato por placa) y, debajo, todos los pares de medios con t de Welch y ajuste de Holm.</Nota></h2>
          {medios.length < 2 ? <p className="ayuda">Hacen falta placas de al menos 2 medios distintos.</p> : cepas.map((c) => (
            <BloqueUnaVia key={c} titulo={`Cepa «${c}»`} factor="medios" r={unaVia(medios.map((m) => ({ nombre: m, v: obs.filter((x) => x.cepa === c && x.medio === m).map((x) => x.y) })))} />
          ))}
        </section>
      )}

      {sel.includes('medioCepas') && (
        <section className="resultado-test">
          <h2>Cada medio: comparación entre cepas <Nota>Para cada medio, un ANOVA de una vía con las cepas como grupos (un dato por placa) y, debajo, todos los pares de cepas con t de Welch y ajuste de Holm.</Nota></h2>
          {cepas.length < 2 ? <p className="ayuda">Hacen falta al menos 2 cepas.</p> : medios.map((m) => (
            <BloqueUnaVia key={m} titulo={`Medio «${m}»`} factor="cepas" r={unaVia(cepas.map((c) => ({ nombre: c, v: obs.filter((x) => x.cepa === c && x.medio === m).map((x) => x.y) })))} />
          ))}
        </section>
      )}

      {sel.includes('placasCepa') && (
        <section className="resultado-test">
          <h2>Cada cepa entre placas: reproducibilidad <Nota>CV = 100 × DE / media, con un dato por placa. Hasta {cvBueno} %: buena; hasta {cvMax} %: aceptable; más: alta variabilidad. Para ICC, Kruskal-Wallis y correlaciones usá «Reproducibilidad entre experimentos».</Nota></h2>
          <Tabla cols={['Cepa', 'Medio', 'n (placas)', 'OD media de cada placa', 'Media', 'DE', 'CV (%)', 'Evaluación']}
            filas={cepas.flatMap((c) => medios.map((m) => {
              const v = obs.filter((x) => x.cepa === c && x.medio === m)
              if (!v.length) return null
              const y = v.map((x) => x.y)
              const mm = media(y), sd = y.length > 1 ? desvio(y) : NaN
              const cv = finito(sd) && mm !== 0 ? (100 * sd) / Math.abs(mm) : NaN
              return [c, m, y.length, v.map((x) => `${x.placa}: ${f(x.y, 3)}`).join(' · '), f(mm), f(sd), f(cv, 1), !finito(cv) ? 'Hace falta más de 1 placa' : cv <= cvBueno ? 'Buena' : cv <= cvMax ? 'Aceptable' : 'Alta variabilidad']
            }).filter(Boolean))} />
        </section>
      )}
    </div>
  )
}
