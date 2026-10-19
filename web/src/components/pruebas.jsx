import { Campo, Select } from './ui.jsx'
import { Nota } from './tip.jsx'
import { analizar, levene, parcelasDivididas } from '../decision.js'
import { shapiro, spearman } from '../reproducibilidad.js'
import { desvio, marcaSig, media } from '../estadistica.js'
import { paletaMuestras } from '../utils.js'

const finito = Number.isFinite
const f = (x, d = 3) => (finito(x) ? x.toFixed(d) : x === Infinity ? '∞' : '–')
const pTxt = (p) => (!finito(p) ? '–' : p < 0.0001 ? '< 0.0001' : p.toFixed(4))
const NOMBRE_TEST = { anova: 'ANOVA', welch: 'ANOVA de Welch', kw: 'Kruskal-Wallis' }

// ---------------------------------------------------------------
// Objetivos (qué se quiere evaluar)
// ---------------------------------------------------------------
// el objetivo por defecto es «entre medios»: la estadística siempre se muestra
export const objetivoDe = (o) => (['medios', 'placas', 'cepas', 'concordancia'].includes(o.objetivo) ? o.objetivo : 'medios')
export const OBJETIVOS = [
  ['medios', 'Entre medios', '¿En qué medio hay más OD? Cada cepa se compara entre los medios.'],
  ['placas', 'Entre placas (réplicas)', '¿Una misma cepa da lo mismo en todas las placas? Reproducibilidad.'],
  ['cepas', 'Entre cepas', 'Dentro de cada medio, ¿qué cepas difieren?'],
  ['concordancia', 'Concordancia entre placas', '¿Las placas ordenan igual las cepas? ICC, correlaciones y CV.'],
]

// Hipótesis en el contexto del biofilm: la OD (cristal violeta) es la medida de biomasa de biofilm producida
function Hip({ items, titulo = 'Hipótesis' }) {
  return (
    <div className="hipotesis">
      <b>{titulo}</b>
      {items.map((h, i) => (
        <div key={i} className="hip-fila">
          {h.nombre && <span className="hip-nombre">{h.nombre}</span>}
          <span><b>H₀:</b> {h.h0}</span>
          <span><b>H₁:</b> {h.h1}</span>
        </div>
      ))}
    </div>
  )
}
const lista = (g) => g.map((x) => x.nombre).join(', ')
// hipótesis de una prueba entre grupos: sujeto = qué se compara (ej. «la producción de biofilm (OD) de L101B2»)
function hipotesisGrupos(tipo, sujeto, factor, grupos, ctrl, dunnett) {
  const n = lista(grupos)
  const base = ctrl ? `entre «${ctrl}» y cada uno de los otros grupos` : `entre ${factor}`
  if (tipo === 'kw') {
    return [{ nombre: 'Global (Kruskal-Wallis)', h0: `${sujeto} tiene la misma distribución en todos los grupos comparados (${n}).`, h1: `En al menos un grupo los valores tienden a ser mayores o menores que en otro.` },
      { nombre: 'Pares (Dunn, Holm)', h0: 'Dos grupos tienen la misma distribución de OD.', h1: 'Las distribuciones difieren (bilateral).' }]
  }
  return [{ nombre: tipo === 'welch' ? 'Global (ANOVA de Welch)' : 'Global (ANOVA)', h0: `La OD media (${sujeto}) es igual en todos los grupos comparados: μ(${grupos.map((x) => x.nombre).join(') = μ(')}).`, h1: `Al menos un grupo tiene una OD media distinta; es decir, hay diferencias ${base}.` },
    dunnett
      ? { nombre: `Contra «${ctrl}» (Dunnett)`, h0: `Cada grupo tiene la misma OD media que el control: μ(grupo) = μ(${ctrl}).`, h1: 'La OD media del grupo difiere de la del control: μ(grupo) ≠ μ(control) (bilateral).' }
      : { nombre: tipo === 'welch' ? 'Pares (t de Welch, Holm)' : 'Pares (t, Holm)', h0: 'Dos grupos tienen la misma OD media: μA = μB.', h1: 'Las OD medias difieren: μA ≠ μB (bilateral).' }]
}

function Chip({ tipo, children, tip }) {
  return <span className={`badge badge-${tipo}`} data-tip={tip}>{children}</span>
}

// ===============================================================
// PANEL de la izquierda: qué evaluar y con qué opciones (sin botones repetidos: cada prueba se elige una sola vez)
// ===============================================================
export function PanelPruebas({ o, setO, D }) {
  const obj = objetivoDe(o)
  const var_ = o.variable || 'od'
  const nivel = o.nivel || 'placa'
  const comp = o.comp || 'pares'
  return (
    <div className="panel-pruebas">
      <h3 className="sub-seccion">¿Qué querés evaluar? <Nota>El programa revisa los datos (normalidad y varianzas) y elige solo la prueba adecuada; los resultados aparecen debajo del gráfico. Cada placa cuenta como una réplica biológica.</Nota></h3>
      <div className="objetivos">
        {OBJETIVOS.map(([id, t, d]) => (
          <button key={id} type="button" className={`objetivo ${obj === id ? 'on' : ''}`} onClick={() => setO('objetivo', id)}>
            <b>{t}</b><span>{d}</span>
          </button>
        ))}
      </div>
      {obj !== 'concordancia' && (
        <>
          <Campo label="Datos">
            <div className="seg">
              {[['od', 'OD'], ['ln', 'ln(OD)'], ['odc', 'OD ÷ ODc']].map(([v, t]) => <button key={v} className={var_ === v ? 'on' : ''} onClick={() => setO('variable', v)}
                data-tip={{ od: 'OD tal cual', ln: 'Logaritmo natural de la OD: estabiliza la varianza cuando la DE crece con la media', odc: 'Cada OD dividida por el ODc de su placa: reduce la diferencia entre placas' }[v]}>{t}</button>)}
            </div>
          </Campo>
          {obj !== 'placas' && (
            <Campo label={<>Réplica<Nota>«Placa»: cada placa aporta un valor (la OD media de la cepa); es la réplica biológica y la opción correcta. «Pocillos»: cada pocillo cuenta como una réplica; da más datos pero los pocillos de una placa no son independientes (pseudo-replicación) y los p salen demasiado chicos.</Nota></>}>
              <div className="seg">
                <button className={nivel === 'placa' ? 'on' : ''} onClick={() => setO('nivel', 'placa')}>Placa</button>
                <button className={nivel === 'pocillo' ? 'on' : ''} onClick={() => setO('nivel', 'pocillo')}>Pocillos</button>
              </div>
            </Campo>
          )}
          <Campo label={<>Prueba<Nota>Automática: si hay 8 o más datos y los residuos no son normales (Shapiro-Wilk), con al menos 3 por grupo, usa Kruskal-Wallis (compara rangos; la variable puede ser continua como la OD); si las varianzas son distintas (Levene) usa el ANOVA de Welch; si no, el ANOVA clásico. Podés forzar una.</Nota></>}>
            <Select value={o.prueba || 'auto'} onChange={(v) => setO('prueba', v)}
              opciones={[['auto', 'Automática (Levene y Shapiro)'], ['anova', 'ANOVA clásico'], ['welch', 'ANOVA de Welch'], ['kw', 'Kruskal-Wallis']]} />
          </Campo>
          {obj !== 'placas' && (
            <>
              <Campo label={<>Comparaciones de a pares<Nota>Todos los pares: t con ajuste de Holm (Welch o Dunn según la prueba). Contra un control: con ANOVA clásico se usa la prueba de Dunnett (p ajustado exacto); con ANOVA de Welch, t de Welch con Holm; con Kruskal-Wallis, Dunn con Holm. Dunnett supone varianzas iguales, por eso la selección automática no lo usa si Levene las encuentra distintas.</Nota></>}>
                <div className="seg">
                  <button className={comp === 'pares' ? 'on' : ''} onClick={() => setO('comp', 'pares')}>Todos los pares</button>
                  <button className={comp === 'control' ? 'on' : ''} onClick={() => setO('comp', 'control')}>Contra un control</button>
                </div>
              </Campo>
              {comp === 'control' && obj === 'medios' && (
                <Campo label="Medio control"><Select value={D.mediosPres.includes(o.ctrlMedio) ? o.ctrlMedio : D.mediosPres[0] || ''} onChange={(v) => setO('ctrlMedio', v)} opciones={D.mediosPres.map((x) => [x, x])} /></Campo>
              )}
              {comp === 'control' && obj === 'cepas' && (
                <Campo label="Cepa control"><Select value={D.muestras.includes(o.ctrlCepa) ? o.ctrlCepa : D.muestras[0] || ''} onChange={(v) => setO('ctrlCepa', v)} opciones={D.muestras.map((x) => [x, x])} /></Campo>
              )}
            </>
          )}
        </>
      )}
    </div>
  )
}

// ---------------------------------------------------------------
// piezas de resultados
// ---------------------------------------------------------------
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

// barras de la media ± DE de cada grupo con sus letras (grupos con la misma letra no difieren)
function BarrasGrupo({ r, colorDe }) {
  const g = r.grupos
  const mx = Math.max(...g.map((x) => media(x.v) + (x.v.length > 1 ? desvio(x.v) : 0)), 1e-9)
  const H = g.length * 26 + 8
  const X0 = 150, W = 420
  return (
    <svg viewBox={`0 0 ${W + 60} ${H}`} className="barras-grupo" role="img" aria-label="Media y desviación estándar de cada grupo">
      {g.map((x, i) => {
        const m = media(x.v), sd = x.v.length > 1 ? desvio(x.v) : 0
        const y = 6 + i * 26
        const w = (m / mx) * (W - X0 - 10)
        return (
          <g key={x.nombre} data-tip={`${x.nombre}\nmedia = ${f(m, 4)}\nDE = ${x.v.length > 1 ? f(sd, 4) : '–'}\nn = ${x.v.length}`}>
            <text x={X0 - 8} y={y + 13} textAnchor="end" fontSize="11.5" fill="#3a2a1e">{x.nombre.length > 22 ? x.nombre.slice(0, 21) + '…' : x.nombre}</text>
            <rect x={X0} y={y} width={Math.max(w, 1)} height="18" rx="4" fill={colorDe(x.nombre)} fillOpacity=".85" />
            {sd > 0 && <g stroke="#222" strokeWidth="1.2"><line x1={X0 + w} x2={X0 + w + (sd / mx) * (W - X0 - 10)} y1={y + 9} y2={y + 9} /><line x1={X0 + w + (sd / mx) * (W - X0 - 10)} x2={X0 + w + (sd / mx) * (W - X0 - 10)} y1={y + 4} y2={y + 14} /></g>}
            {x.v.map((v, k) => <circle key={k} cx={X0 + (v / mx) * (W - X0 - 10)} cy={y + 9} r="2.6" fill="#fff" stroke="#3a2a1e" strokeWidth="1" />)}
            <text x={X0 + Math.max(w, 1) + (sd / mx) * (W - X0 - 10) + 8} y={y + 13} fontSize="12" fontWeight="700" fill="#7a3a0e">{r.letras?.[x.nombre] || ''}</text>
          </g>
        )
      })}
    </svg>
  )
}

// matriz de p ajustados entre grupos (colores según la significancia)
function MatrizP({ r }) {
  if (!r.pares.length || r.pares.length > 120) return null
  const nombres = r.grupos.map((x) => x.nombre)
  const busca = (a, b) => r.pares.find((p) => (p.a === a && p.b === b) || (p.a === b && p.b === a))
  const clase = (p) => (!finito(p) ? 'p-na' : p < 0.001 ? 'p-3' : p < 0.01 ? 'p-2' : p < 0.05 ? 'p-1' : 'p-0')
  return (
    <div className="tabla-scroll chica">
      <table className="matriz-p">
        <thead><tr><th />{nombres.map((n) => <th key={n}>{n}</th>)}</tr></thead>
        <tbody>
          {nombres.map((a) => (
            <tr key={a}>
              <th>{a}</th>
              {nombres.map((b) => {
                if (a === b) return <td key={b} className="p-diag" />
                const p = busca(a, b)
                return <td key={b} className={p ? clase(p.pa) : 'p-na'} data-tip={p ? `${a} vs ${b}\ndiferencia = ${f(a === p.a ? p.dif : -p.dif, 4)}\np ajustado (Holm) = ${pTxt(p.pa)}` : 'sin comparación'}>{p ? marcaSig(p.pa) : ''}</td>
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function Indicadores({ r }) {
  const lev = r.lev, sw = r.sw
  return (
    <div className="indicadores">
      <div className="ind" data-tip={sw ? `Normalidad de los residuos (Shapiro-Wilk)\nW = ${f(sw.W, 3)}, p = ${pTxt(sw.p)}\np < 0.05: los residuos se apartan de la normal` : 'Hacen falta al menos 3 datos con variación'}>
        <small>Normalidad</small>{sw ? <Chip tipo={sw.p < 0.05 ? 'alerta' : 'ok'}>{sw.p < 0.05 ? 'No normal' : 'Normal'} · p {pTxt(sw.p)}</Chip> : <Chip tipo="neutro">sin datos</Chip>}
      </div>
      <div className="ind" data-tip={lev ? `Igualdad de varianzas (Levene, Brown-Forsythe)\nF = ${f(lev.F, 3)} (${lev.df1}; ${lev.df2}), p = ${pTxt(lev.p)}\nmayor DE / menor DE = ${f(lev.razonSD, 2)} (regla práctica: hasta 2)\np < 0.05: varianzas distintas` : 'Hacen falta al menos 2 grupos con 2 o más datos'}>
        <small>Varianzas</small>{lev ? <Chip tipo={lev.p < 0.05 ? 'alerta' : 'ok'}>{lev.p < 0.05 ? 'Distintas' : 'Parecidas'} · p {pTxt(lev.p)}</Chip> : <Chip tipo="neutro">sin datos</Chip>}
      </div>
      <div className="ind" data-tip={r.razon}><small>Prueba usada</small><Chip tipo="prueba">{NOMBRE_TEST[r.tipo]}</Chip></div>
      <div className="ind" data-tip={`${r.global.nombre}\n${r.global.est} = ${f(r.global.valor, 3)}${r.global.df2 ? ` (${r.global.df1}; ${f(r.global.df2, 2)} gl)` : ` (${r.global.df1} gl)`}\np = ${pTxt(r.global.p)}`}>
        <small>¿Hay diferencias?</small><Chip tipo={r.global.p < 0.05 ? 'dif' : 'ok'}>{r.global.p < 0.05 ? 'Sí' : 'No'} · p {pTxt(r.global.p)} {marcaSig(r.global.p)}</Chip>
      </div>
    </div>
  )
}

function lecturaDe(r, ctrl) {
  if (!r.ok) return r.motivo
  const sig = r.pares.filter((p) => finito(p.pa) && p.pa < 0.05)
  if (r.global.p >= 0.05) return 'No hay diferencias claras entre los grupos (p ≥ 0,05). Con pocas réplicas el análisis solo detecta diferencias grandes.'
  if (!sig.length) return 'La prueba global da diferencias (p < 0,05), pero ningún par difiere al corregir por comparaciones múltiples.'
  const mayor = (p) => (p.dif > 0 ? `${p.a} > ${p.b}` : `${p.b} > ${p.a}`)
  return `Difieren: ${sig.map((p) => `${mayor(p)} (p = ${pTxt(p.pa)})`).join('; ')}.${ctrl ? ` Todas las comparaciones son contra «${ctrl}».` : ''}`
}

// un análisis completo (indicadores, barras, tablas y conclusión) plegable
function Bloque({ titulo, sub, r, colorDe, ctrl, abierto, sujeto, factor, color, medioTag }) {
  if (!r.ok) return <div className="bloque-res"><b>{titulo}</b> <span className="ayuda">{r.motivo}</span></div>
  return (
    <details className="bloque-res" open={abierto || r.global.p < 0.05} style={color ? { borderLeft: `6px solid ${color}` } : undefined}>
      <summary>
        {medioTag && <span className="medio-tag" style={{ background: color }}>{medioTag}</span>}
        <b>{titulo}</b> {sub && <small>{sub}</small>}
        <Chip tipo={r.global.p < 0.05 ? 'dif' : 'ok'}>{r.global.p < 0.05 ? 'Hay diferencias' : 'Sin diferencias'}</Chip>
        <Chip tipo="prueba">{NOMBRE_TEST[r.tipo]}</Chip>
      </summary>
      {sujeto && <Hip items={[...hipotesisGrupos(r.tipo, sujeto, factor, r.grupos, ctrl, r.pares[0]?.metodo === 'Dunnett'), { nombre: 'Supuestos', h0: 'Residuos normales (Shapiro-Wilk) y varianzas iguales entre grupos (Levene).', h1: 'Residuos no normales / varianzas distintas: se cambia a Kruskal-Wallis o ANOVA de Welch.' }]} />}
      <Indicadores r={r} />
      <p className="razon-test">{r.razon}{r.pares[0]?.metodo === 'Dunnett' && ` Contra el control se usó la prueba de Dunnett: cada grupo se compara con «${ctrl}» con la varianza común del ANOVA, y el p ya está ajustado por todas las comparaciones.`}</p>
      <div className="res-doble">
        <BarrasGrupo r={r} colorDe={colorDe} />
        <div>
          <Tabla cols={['Grupo', 'n', 'Media', 'DE', 'Letra']} filas={r.grupos.map((x) => [x.nombre, x.v.length, f(media(x.v), 4), x.v.length > 1 ? f(desvio(x.v), 4) : '–', r.letras?.[x.nombre] || '–'])} />
        </div>
      </div>
      <Tabla cols={['Prueba', 'Estadístico', 'gl', 'p', 'Resultado']}
        filas={[[r.global.nombre, `${r.global.est} = ${f(r.global.valor, 3)}`, r.global.df2 ? `${r.global.df1}; ${f(r.global.df2, 2)}` : r.global.df1, pTxt(r.global.p), r.global.p < 0.05 ? `Diferencias significativas (${marcaSig(r.global.p)})` : 'Sin diferencia clara']]} />
      {r.tipo === 'anova' && r.global.tabla && (
        <Tabla cols={['Fuente', 'Suma de cuadrados', 'gl', 'Cuadrado medio', 'F', 'p']}
          filas={[['Entre grupos', f(r.global.tabla.ssb, 6), r.global.tabla.df1, f(r.global.tabla.msb, 6), f(r.global.tabla.F, 3), pTxt(r.global.tabla.p)],
            ['Dentro (error)', f(r.global.tabla.ssw, 6), r.global.tabla.df2, f(r.global.tabla.msw, 6), '', ''], ['Total', f(r.global.tabla.sst, 6), r.global.tabla.df1 + r.global.tabla.df2, '', '', '']]} />
      )}
      {r.pares.length > 0 && (
        <>
          <Tabla cols={[ctrl ? `Contra «${ctrl}»` : 'Par', 'Media A', 'Media B', 'Diferencia (A − B)', r.tipo === 'kw' ? 'z (Dunn)' : 't', 'gl', 'p', `p ajustado (${r.pares[0]?.metodo || 'Holm'})`, 'Resultado']}
            filas={r.pares.map((p) => [`${p.a} vs ${p.b}`, f(p.ma, 4), f(p.mb, 4), f(p.dif, 4), f(p.est, 3), finito(p.df) ? f(p.df, 2) : '–', pTxt(p.p), pTxt(p.pa), !finito(p.p) ? 'Hacen falta 2 o más datos' : p.pa < 0.05 ? `Distinto (${marcaSig(p.pa)})` : 'Sin diferencia clara'])} />
          {!ctrl && <MatrizP r={r} />}
        </>
      )}
      <p className="conclusion"><b>Lectura:</b> {lecturaDe(r, ctrl)}</p>
    </details>
  )
}

// Diagnóstico global de los supuestos: con todos los pocillos juntos hay muchos más datos que dentro de cada grupo.
// Residuos = cada pocillo menos la media de su celda (cepa × medio × placa). Shapiro-Wilk sobre todos los residuos juntos y
// Levene entre todas las celdas; además se mira si la DE crece con la media (en ese caso conviene el logaritmo).
function diagnosticoGlobal(obsPozo) {
  const celdas = new Map()
  obsPozo.forEach((x) => { const k = `${x.cepa}|${x.medio}|${x.placa}`; if (!celdas.has(k)) celdas.set(k, []); celdas.get(k).push(x.y) })
  const cs = [...celdas.values()].filter((v) => v.length >= 2)
  const resid = cs.flatMap((v) => { const m = media(v); return v.map((y) => y - m) })
  const sw = resid.length >= 8 && resid.some((x) => x !== 0) ? shapiro(resid) : null
  const lev = levene(cs.filter((v) => v.length >= 3))
  const medias = cs.map((v) => media(v)), sds = cs.map((v) => desvio(v))
  const rho = cs.length >= 6 ? spearman(medias, sds) : null
  return { nResid: resid.length, nCeldas: cs.length, sw, lev, rho }
}

function DiagnosticoGlobal({ d, unidad }) {
  const { sw, lev, rho } = d
  const sdCrece = rho && rho.r > 0.5 && rho.p < 0.05
  const hayDiag = sw || lev
  if (!hayDiag) return null
  return (
    <div className="diag-global">
      <h4>Diagnóstico global de supuestos <Nota>Con todos los pocillos juntos hay muchos más datos que dentro de cada grupo (n = 4), así que estas pruebas son mucho más confiables. Residuo = cada pocillo menos la media de su cepa, medio y placa. Shapiro-Wilk evalúa si todos los residuos juntos son normales; Levene, si todas las celdas varían parecido.</Nota></h4>
      <div className="indicadores">
        <div className="ind" data-tip={sw ? `Normalidad de los ${d.nResid} residuos juntos (Shapiro-Wilk)\nW = ${f(sw.W, 3)}, p = ${pTxt(sw.p)}` : 'Hacen falta al menos 8 residuos'}>
          <small>Normalidad ({d.nResid} residuos)</small>{sw ? <Chip tipo={sw.p < 0.05 ? 'alerta' : 'ok'}>{sw.p < 0.05 ? 'No normal' : 'Normal'} · p {pTxt(sw.p)}</Chip> : <Chip tipo="neutro">sin datos</Chip>}
        </div>
        <div className="ind" data-tip={lev ? `Varianzas de las ${lev.k} celdas con 3 o más pocillos (Levene)\nF = ${f(lev.F, 3)}, p = ${pTxt(lev.p)}\nmayor DE / menor DE = ${f(lev.razonSD, 1)}` : 'Hacen falta celdas con 3 o más pocillos'}>
          <small>Varianzas ({lev ? lev.k : 0} celdas)</small>{lev ? <Chip tipo={lev.p < 0.05 ? 'alerta' : 'ok'}>{lev.p < 0.05 ? 'Distintas' : 'Parecidas'} · p {pTxt(lev.p)}</Chip> : <Chip tipo="neutro">sin datos</Chip>}
        </div>
        <div className="ind" data-tip={rho ? `Relación entre la media y la DE de cada celda (Spearman)\nρ = ${f(rho.r, 2)}, p = ${pTxt(rho.p)}\nSi la DE crece con la media, el logaritmo estabiliza las varianzas` : 'Hacen falta al menos 6 celdas'}>
          <small>DE vs media</small>{rho ? <Chip tipo={sdCrece ? 'alerta' : 'ok'}>{sdCrece ? 'La DE crece con la media' : 'Sin relación'} · ρ {f(rho.r, 2)}</Chip> : <Chip tipo="neutro">sin datos</Chip>}
        </div>
      </div>
      <p className="razon-test">
        {[
          sdCrece && unidad === 'OD' ? 'La dispersión aumenta con la media (típico de la OD): probá «ln(OD)» en «Datos» para estabilizar las varianzas.' : '',
          lev && lev.p < 0.05 && !(sdCrece && unidad === 'OD') ? 'Las varianzas son distintas entre celdas: el programa usa el ANOVA de Welch cuando corresponde.' : '',
          sw && sw.p < 0.05 ? 'Los residuos no son del todo normales. Con tantos datos Shapiro-Wilk detecta desvíos pequeños y el ANOVA tolera desvíos leves; revisá los valores extremos en «Excluir puntos». Con pocas réplicas por grupo, el ANOVA de Welch o Kruskal-Wallis son alternativas.' : '',
        ].filter(Boolean).join(' ') || 'Los residuos son compatibles con la normalidad y las varianzas son parecidas: el ANOVA clásico es adecuado.'}
      </p>
    </div>
  )
}

// datos del resumen: una fila por análisis, con su p
function infoDe(bloques, globales, etiquetaFila, colorMedios = {}) {
  const ok = bloques.filter((b) => b.r.ok)
  const sig = ok.filter((b) => b.r.global.p < 0.05)
  const filas = [...globales.map((g) => ({ ...g, tipo: 'ANOVA de parcelas divididas', global: true })),
    ...bloques.map((b) => ({ nombre: b.titulo, p: b.r.ok ? b.r.global.p : NaN, tipo: b.r.ok ? NOMBRE_TEST[b.r.tipo] : '', medio: b.medio, color: b.medio ? colorMedios[b.medio] : undefined }))]
  const frases = sig.slice(0, 6).map((b) => `${b.titulo}: ${lecturaDe(b.r, null)}`)
  globales.filter((g) => g.p < 0.05).forEach((g) => frases.unshift(`${g.nombre.replace('Global · ', 'Efecto global de ')}: significativo (p = ${pTxt(g.p)}).`))
  return {
    filas, etiquetaFila, frases,
    kpis: { n: bloques.length, dif: sig.length, welch: ok.filter((b) => b.r.tipo === 'welch').length, kw: ok.filter((b) => b.r.tipo === 'kw').length },
  }
}

// cabecera: resumen gráfico de los resultados (−log₁₀ p de cada análisis frente al umbral de 0,05)
function Infografia({ info, titulo }) {
  const filas = info.filas.filter((x) => finito(x.p))
  const MAXV = 5, X0 = 190, W = 330
  const v = (p) => Math.min(MAXV, -Math.log10(Math.max(p, 1e-5)))
  const x = (val) => X0 + (val / MAXV) * W
  const umbral = -Math.log10(0.05)
  // con medios de cultivo: las filas se agrupan por medio, cada uno con su fondo, su título y su color
  const conMedio = filas.some((r) => r.medio)
  const cuentaMedio = {}
  filas.forEach((r) => { if (r.medio) cuentaMedio[r.medio] = (cuentaMedio[r.medio] || 0) + 1 })
  const items = []
  let y = 22
  let medioAct = null
  filas.forEach((r) => {
    if (conMedio && r.medio && r.medio !== medioAct && cuentaMedio[r.medio] > 1) { medioAct = r.medio; items.push({ cab: r.medio, color: r.color, y }); y += 22 }
    else if (r.medio !== medioAct) medioAct = r.medio
    items.push({ fi: r, y }); y += 26
  })
  const H = y + 24
  // fondos por medio (de la primera a la última fila del mismo medio)
  const bandas = []
  items.forEach((it) => {
    const m = it.cab || it.fi?.medio
    if (!m || !conMedio) return
    const ult = bandas[bandas.length - 1]
    if (ult && ult.medio === m) ult.fin = it.y + (it.cab ? 22 : 26)
    else bandas.push({ medio: m, color: it.color || it.fi?.color, ini: it.y - 3, fin: it.y + (it.cab ? 22 : 26) })
  })
  return (
    <div className="infografia">
      <div className="info-kpis">
        <div className="kpi-info"><b>{info.kpis.n}</b><small>análisis</small></div>
        <div className={`kpi-info ${info.kpis.dif ? 'dif' : 'ok'}`}><b>{info.kpis.dif}</b><small>con diferencias (p &lt; 0,05)</small></div>
        <div className="kpi-info" data-tip="Análisis con ANOVA de Welch porque las varianzas son distintas (Levene)"><b>{info.kpis.welch}</b><small>ANOVA de Welch</small></div>
        <div className="kpi-info" data-tip="Análisis con Kruskal-Wallis porque los residuos no son normales (Shapiro-Wilk)"><b>{info.kpis.kw}</b><small>Kruskal-Wallis</small></div>
      </div>
      <div className="info-grafico">
        <h4>Resumen: ¿dónde hay diferencias? <Nota>Cada barra es un análisis. Cuanto más larga, más evidencia de diferencia (−log₁₀ de p). Si pasa la línea punteada (p = 0,05), la diferencia es significativa.{conMedio ? ' Cada medio de cultivo tiene su propio color y su fondo; la barra llena es significativa y la clara, no.' : ''}</Nota></h4>
        {filas.length > 0 ? (
          <svg viewBox={`0 0 ${X0 + W + 90} ${H}`} className="barras-grupo" role="img" aria-label="Resumen de los valores de p de cada análisis">
            {bandas.map((b, i) => <rect key={'b' + i} x="4" y={b.ini} width={X0 + W + 82} height={b.fin - b.ini} rx="8" fill={b.color} fillOpacity="0.10" />)}
            {[0, 1, 2, 3, 4, 5].map((t) => (
              <g key={t}><line x1={x(t)} x2={x(t)} y1="16" y2={H - 20} stroke="#ecdfcd" /><text x={x(t)} y={H - 6} textAnchor="middle" fontSize="10" fill="#8a7765">{t === 0 ? 'p = 1' : t === 1 ? '0,1' : t === 2 ? '0,01' : t === 3 ? '0,001' : t === 4 ? '1e-4' : '1e-5'}</text></g>
            ))}
            <line x1={x(umbral)} x2={x(umbral)} y1="10" y2={H - 20} stroke="#a2391a" strokeDasharray="4 3" strokeWidth="1.5" />
            <text x={x(umbral)} y="9" textAnchor="middle" fontSize="10" fill="#a2391a" fontWeight="700">p = 0,05</text>
            {items.map((it, i) => {
              if (it.cab) return <text key={'c' + i} x="12" y={it.y + 14} fontSize="12" fontWeight="800" fill="#3a2a1e">Medio {it.cab}</text>
              const fi = it.fi
              const val = v(fi.p)
              const sg = fi.p < 0.05
              const relleno = fi.color || (sg ? '#d9731f' : '#b9c9ae')
              return (
                <g key={fi.nombre + i} data-tip={`${fi.nombre}\n${fi.tipo}\np = ${pTxt(fi.p)} ${marcaSig(fi.p)}\n${sg ? 'Hay diferencias' : 'Sin diferencia clara'}`}>
                  <text x={X0 - 8} y={it.y + 13} textAnchor="end" fontSize="11.5" fill="#3a2a1e" fontWeight={fi.global ? 700 : 400}>{fi.nombre.length > 28 ? fi.nombre.slice(0, 27) + '…' : fi.nombre}</text>
                  <rect x={X0} y={it.y} width={Math.max((val / MAXV) * W, 2)} height="18" rx="4" fill={relleno} fillOpacity={fi.color ? (sg ? 0.95 : 0.35) : 1} stroke={fi.color && sg ? '#3a2a1e' : 'none'} strokeWidth="0.8" />
                  <text x={x(val) + 6} y={it.y + 13} fontSize="11" fontWeight="700" fill={sg ? '#a2391a' : '#6b7a62'}>{pTxt(fi.p)} {marcaSig(fi.p) === 'ns' ? '' : marcaSig(fi.p)}</text>
                </g>
              )
            })}
          </svg>
        ) : <p className="ayuda">Sin análisis para resumir.</p>}
      </div>
      <div className="info-frases">
        <h4>Conclusiones</h4>
        {info.frases.length ? <ul>{info.frases.map((t, i) => <li key={i}>{t}</li>)}</ul>
          : <p>Ningún análisis muestra diferencias claras (p ≥ 0,05). Con pocas réplicas el análisis solo detecta diferencias grandes: sumar placas aumenta el poder.</p>}
      </div>
    </div>
  )
}

// resumen de todos los análisis en una tabla
function Resumen({ titulo, bloques, etiquetas }) {
  const ok = bloques.filter((b) => b.r.ok)
  const conDif = ok.filter((b) => b.r.global.p < 0.05).length
  return (
    <>
      <div className="indicadores grandes" style={{ display: 'none' }}>
        <div className="ind"><small>Análisis</small><b>{bloques.length}</b></div>
        <div className="ind"><small>Con diferencias (p &lt; 0,05)</small><b className={conDif ? 'num-dif' : ''}>{conDif}</b></div>
        <div className="ind" data-tip="ANOVA de Welch porque las varianzas son distintas (Levene)"><small>Con ANOVA de Welch</small><b>{ok.filter((b) => b.r.tipo === 'welch').length}</b></div>
        <div className="ind" data-tip="Kruskal-Wallis porque los residuos no son normales (Shapiro-Wilk)"><small>Con Kruskal-Wallis</small><b>{ok.filter((b) => b.r.tipo === 'kw').length}</b></div>
      </div>
      <Tabla cols={[titulo, ...etiquetas, 'Varianzas (Levene p)', 'Prueba', 'Estadístico', 'p', 'Resultado']}
        filas={bloques.map((b) => [b.titulo, ...b.extra, b.r.ok ? (b.r.lev ? pTxt(b.r.lev.p) : '–') : '–', b.r.ok ? NOMBRE_TEST[b.r.tipo] : '–',
          b.r.ok ? `${b.r.global.est} = ${f(b.r.global.valor, 3)}` : '–', b.r.ok ? pTxt(b.r.global.p) : '–', b.r.ok ? (b.r.global.p < 0.05 ? `Hay diferencias ${marcaSig(b.r.global.p)}` : 'Sin diferencias') : b.r.motivo])} />
    </>
  )
}

// ===============================================================
// RESULTADOS debajo del gráfico
// ===============================================================
export function ResultadosPruebas({ s, D, o }) {
  const obj = objetivoDe(o)
  if (obj === 'concordancia') return null
  const variable = o.variable || 'od'
  const nivel = obj === 'placas' ? 'pocillo' : o.nivel || 'placa'
  const forzado = o.prueba || 'auto'
  const comp = o.comp || 'pares'
  const fx = (y, odc) => (variable === 'ln' ? (y > 0 ? Math.log(y) : NaN) : variable === 'odc' ? (odc > 0 ? y / odc : NaN) : y)
  const obsPlaca = [], obsPozo = []
  D.placasSel.forEach((p) => {
    const a = s.analisisMap[p.id]
    const odc = a.odc?.odc
    const medio = p.medio || '(sin medio)'
    a.resumen.forEach((r) => {
      if (D.ocultos.has(D.clave(p.id, r.Muestra))) return
      if (finito(r.Media)) obsPlaca.push({ cepa: r.Muestra, medio, placa: p.nombre, y: fx(r.Media, odc) })
    })
    a.estado.forEach((e) => {
      if (!e.Usado || e.EsBlanco || D.ocultos.has(D.clave(p.id, e.Muestra))) return
      obsPozo.push({ cepa: e.Muestra, medio, placa: p.nombre, y: fx(e.OD, odc) })
    })
  })
  const obs = (nivel === 'placa' ? obsPlaca : obsPozo).filter((x) => finito(x.y))
  const cepas = [...new Set(obs.map((x) => x.cepa))]
  const medios = [...new Set(obs.map((x) => x.medio))]
  const placas = [...new Set(obs.map((x) => x.placa))]
  const unidad = variable === 'ln' ? 'ln(OD)' : variable === 'odc' ? 'OD ÷ ODc' : 'OD'
  const vals = (c, m, pl) => obs.filter((x) => (c === null || x.cepa === c) && (m === null || x.medio === m) && (pl === null || x.placa === pl)).map((x) => x.y)
  const colorMedios = paletaMuestras(medios), colorCepas = paletaMuestras(cepas), colorPlacas = paletaMuestras(placas)
  const ctrlMedio = medios.includes(o.ctrlMedio) ? o.ctrlMedio : medios[0]
  const ctrlCepa = cepas.includes(o.ctrlCepa) ? o.ctrlCepa : cepas[0]
  const titulo = { medios: '¿Hay más OD en un medio que en otro?', placas: '¿Cada cepa da lo mismo en todas las placas?', cepas: '¿Difieren las cepas dentro de cada medio?' }[obj]
  let cuerpo = null
  let info = null

  if (obj === 'medios') {
    const bloques = cepas.map((c) => {
      const grupos = medios.map((m) => ({ nombre: m, v: vals(c, m, null) }))
      const r = analizar(grupos, forzado, comp === 'control' ? ctrlMedio : null)
      return { titulo: c, r, grupos, extra: [grupos.map((g) => `${g.nombre}: ${g.v.length ? f(media(g.v), 3) : '–'} (n ${g.v.length})`).join(' · ')] }
    })
    // efecto global (todas las cepas juntas) con la placa como bloque
    const sp = parcelasDivididas(obsPlaca.filter((x) => finito(x.y)))
    info = infoDe(bloques, sp ? sp.filas.filter((x) => finito(x.p)).map((x) => ({ nombre: `Global · ${x.nombre}`, p: x.p })) : [], 'cepa')
    cuerpo = medios.length < 2 ? <p className="ayuda">Hacen falta placas de al menos 2 medios distintos (el medio de cada placa se elige en la pestaña «Placa»).</p> : (
      <>
        {sp && (
          <div className="bloque-res global-sp">
            <h4>Efecto del medio con todas las cepas juntas (placa como bloque) <Nota>ANOVA de parcelas divididas: cada placa tiene un solo medio, así que el medio se prueba contra la variación entre placas del mismo medio; la cepa y la interacción cepa × medio se prueban contra la variación dentro de las placas. Equivale a un modelo mixto con la placa como efecto aleatorio.</Nota></h4>
            <Tabla cols={['Fuente', 'Suma de cuadrados', 'gl', 'Cuadrado medio', 'F', 'p', 'Se prueba contra', 'Resultado']}
              filas={sp.filas.map((x) => [x.nombre, f(x.ss, 5), x.df, f(x.ms, 5), f(x.F, 3), pTxt(x.p), x.error, finito(x.p) ? (x.p < 0.05 ? `Significativo (${marcaSig(x.p)})` : 'Sin diferencia clara') : ''])} />
            <p className="conclusion"><b>Lectura:</b> {sp.filas.filter((x) => finito(x.p) && x.p < 0.05).length
              ? sp.filas.filter((x) => finito(x.p) && x.p < 0.05).map((x) => ({ Medio: 'la OD cambia según el medio', Cepa: 'las cepas difieren entre sí', 'Cepa × medio': 'el efecto del medio depende de la cepa' }[x.nombre])).join('; ') + '.'
              : 'Ningún efecto es significativo (p ≥ 0,05).'}</p>
          </div>
        )}
        <h4 className="sub-res">Cada cepa entre medios</h4>
        <Resumen titulo="Cepa" bloques={bloques} etiquetas={['Media de OD por medio']} />
        {bloques.map((b) => <Bloque key={b.titulo} titulo={b.titulo} sub={`entre medios · ${unidad}`} sujeto={`la producción de biofilm de «${b.titulo}»`} factor="los medios de cultivo" r={b.r} colorDe={(n) => colorMedios[n]} ctrl={comp === 'control' ? ctrlMedio : null} />)}
      </>
    )
  } else if (obj === 'cepas') {
    const bloques = medios.map((m) => {
      const grupos = cepas.map((c) => ({ nombre: c, v: vals(c, m, null) }))
      const r = analizar(grupos, forzado, comp === 'control' ? ctrlCepa : null)
      return { titulo: m, medio: m, r, grupos, extra: [`${grupos.filter((g) => g.v.length).length} cepas · ${[...new Set(obs.filter((x) => x.medio === m).map((x) => x.placa))].length} placas`] }
    })
    info = infoDe(bloques, [], 'medio', colorMedios)
    cuerpo = cepas.length < 2 ? <p className="ayuda">Hacen falta al menos 2 cepas con datos.</p> : (
      <>
        <Resumen titulo="Medio" bloques={bloques} etiquetas={['Datos']} />
        {bloques.map((b) => <Bloque key={b.titulo} color={colorMedios[b.medio]} medioTag={b.medio} titulo={`Medio «${b.titulo}»`} sub={`entre cepas · ${unidad}`} sujeto={`la producción de biofilm en el medio «${b.titulo}»`} factor="las cepas" r={b.r} colorDe={(n) => colorCepas[n]} ctrl={comp === 'control' ? ctrlCepa : null} />)}
      </>
    )
  } else {
    // entre placas: para cada cepa y medio, las placas son los grupos y los pocillos las réplicas
    const bloques = []
    medios.forEach((m) => cepas.forEach((c) => {
      const pls = [...new Set(obs.filter((x) => x.cepa === c && x.medio === m).map((x) => x.placa))]
      if (pls.length < 2) return
      const grupos = pls.map((p) => ({ nombre: p, v: vals(c, m, p) }))
      const r = analizar(grupos, forzado, null)
      const mm = grupos.map((g) => media(g.v)), M = media(mm), sd = desvio(mm)
      const cv = finito(sd) && M !== 0 ? (100 * sd) / Math.abs(M) : NaN
      bloques.push({ titulo: `${c} · ${m}`, medio: m, r, grupos, extra: [pls.length, grupos.map((g) => f(media(g.v), 3)).join(' · '), f(cv, 1), !finito(cv) ? '–' : cv <= 20 ? 'Buena' : cv <= 30 ? 'Aceptable' : 'Alta variabilidad'] })
    }))
    info = infoDe(bloques, [], 'cepa · medio', colorMedios)
    cuerpo = !bloques.length ? <p className="ayuda">Hacen falta al menos 2 placas con la misma cepa y el mismo medio.</p> : (
      <>
        <Resumen titulo="Cepa · medio" bloques={bloques} etiquetas={['Placas', 'Media de cada placa', 'CV entre placas (%)', 'Reproducibilidad']} />
        {bloques.map((b) => <Bloque key={b.titulo} color={colorMedios[b.medio]} medioTag={b.medio} titulo={b.titulo} sub={`entre placas · ${unidad}`} sujeto={`la producción de biofilm de «${b.titulo}»`} factor="las placas (réplicas)" r={b.r} colorDe={() => colorMedios[b.medio]} ctrl={null} />)}
        <p className="ayuda">Los grupos son las placas y los datos de cada una son sus pocillos. Si p &lt; 0,05 la placa influye: la cepa no se repite igual. Para ICC y correlaciones entre experimentos usá el modo «Reproducibilidad entre experimentos».</p>
      </>
    )
  }

  return (
    <section className="pruebas-resultados">
      <div className="cabecera-res">
        <h2>{titulo}</h2>
        <div className="fila-chips">
          <Chip tipo="neutro">{unidad}</Chip>
          <Chip tipo="neutro">{obj === 'placas' ? 'pocillos por placa' : nivel === 'placa' ? 'un valor por placa' : 'pocillos'}</Chip>
          <Chip tipo="neutro">prueba {forzado === 'auto' ? 'automática' : NOMBRE_TEST[forzado]}</Chip>
          {obj !== 'placas' && <Chip tipo="neutro">{comp === 'control' ? 'contra un control' : 'todos los pares'}</Chip>}
        </div>
      </div>
      {info && <Infografia info={info} titulo={titulo} />}
      <DiagnosticoGlobal d={diagnosticoGlobal(obsPozo.filter((x) => finito(x.y)))} unidad={unidad} />
      <Hip titulo={`Hipótesis del objetivo · α = 0,05 · ${nivel === 'placa' ? 'cada placa es una réplica' : 'cada pocillo es una réplica'}`} items={{
        medios: [{ nombre: 'Cada cepa', h0: 'La producción de biofilm (OD de cristal violeta) de la cepa es la misma en todos los medios de cultivo.', h1: 'La producción de biofilm de la cepa cambia según el medio (al menos un medio difiere).' },
          { nombre: 'Medio (todas las cepas)', h0: 'El medio de cultivo no afecta la producción de biofilm (OD media de las cepas).', h1: 'Hay un efecto del medio sobre la producción de biofilm.' },
          { nombre: 'Cepa', h0: 'Todas las cepas producen la misma cantidad de biofilm (OD).', h1: 'Al menos una cepa produce más o menos que otra.' },
          { nombre: 'Cepa × medio', h0: 'El efecto del medio es el mismo para todas las cepas (sin interacción).', h1: 'El efecto del medio depende de la cepa: algunas crecen mejor en un medio y otras en otro.' }],
        placas: [{ nombre: 'Cada cepa y medio', h0: 'La OD media de la cepa es la misma en todas las placas: el resultado se reproduce entre réplicas.', h1: 'La OD media cambia entre placas (efecto placa): el resultado no se reproduce igual en cada placa.' }],
        cepas: [{ nombre: 'Cada medio', h0: 'Todas las cepas producen la misma cantidad de biofilm (OD) en el medio.', h1: 'Al menos una cepa produce más o menos biofilm que otra en ese medio.' }],
      }[obj]} />
      {nivel === 'pocillo' && obj !== 'placas' && <p className="aviso-sel">Cada pocillo cuenta como una réplica: los pocillos de una misma placa no son independientes y los p pueden salir demasiado chicos. Para conclusiones usá «Placa».</p>}
      {cuerpo}
    </section>
  )
}
