// Piezas compartidas de la estadística: selección por objetivo, hipótesis, supuestos, comparaciones de a pares y diagnóstico global
import { Nota } from './tip.jsx'
import { levene } from '../decision.js'
import { shapiro, spearman } from '../reproducibilidad.js'
import { desvio, marcaSig, media } from '../estadistica.js'

const finito = Number.isFinite
export const f = (x, d = 3) => (finito(x) ? x.toFixed(d) : x === Infinity ? '∞' : '–')
export const pTxt = (p) => (!finito(p) ? '–' : p < 0.0001 ? '< 0.0001' : p.toFixed(4))
export const NOMBRE_TEST = { anova: 'ANOVA', welch: 'ANOVA de Welch', kw: 'Kruskal-Wallis' }

// ---------------------------------------------------------------
// Objetivos (qué se quiere evaluar)
// ---------------------------------------------------------------
// el objetivo por defecto es «entre medios»: la estadística siempre se muestra
// «Separar por medio» (o.juntar = false) compara dentro de cada medio; con o.juntar las placas o las cepas se comparan sin separar por medio
export const juntarDe = (o) => (o.juntar === undefined ? o.objetivo === 'placastodas' : !!o.juntar)
export const objetivoDe = (o) => {
  const b = o.objetivo === 'placastodas' ? 'placas' : ['libre', 'medios', 'placas', 'cepas', 'serotipos', 'concordancia'].includes(o.objetivo) ? o.objetivo : 'medios'
  if (b === 'placas' && juntarDe(o)) return 'placastodas'
  if (b === 'cepas' && juntarDe(o)) return 'cepastodas'
  return b
}
// selección hecha en la barra superior de Estadística (undefined = todas)
// cada filtro vale solo en el modo que lo muestra: las placas en todos, las cepas al comparar cepas y los medios al comparar medios
export const dentroDeSel = (o, x, obj = objetivoDe(o)) => !(o.ePlacasFuera || []).includes(x.placaId)
  && (!(obj === 'cepas' || obj === 'cepastodas') || !(o.eCepasFuera || []).includes(x.cepa))
  && (obj !== 'serotipos' || !(o.eCepasSeroFuera || []).includes(x.cepa))   // los serotipos tienen su propia selección de cepas
  && (obj !== 'medios' || !(o.eMediosFuera || []).includes(x.medio))
// objetivos que agrupan o separan por medio: las placas sin medio no pueden entrar
export const usaMedio = (obj) => obj === 'medios' || obj === 'cepas' || obj === 'placas'
// serotipos: dentro de un medio (como las cepas) o con todos los medios juntos

// Hipótesis en el contexto del biofilm: la OD (cristal violeta) es la medida de biomasa de biofilm producida
export function Hip({ items, titulo = 'Hipótesis' }) {
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
export function hipotesisGrupos(tipo, sujeto, factor, grupos, ctrl, dunnett) {
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

export function Chip({ tipo, children, tip }) {
  return <span className={`badge badge-${tipo}`} data-tip={tip}>{children}</span>
}

// ---------------------------------------------------------------
// piezas de resultados
// ---------------------------------------------------------------
export function Tabla({ cols, filas }) {
  return (
    <div className="tabla-scroll chica">
      <table className="tabla paso-tabla">
        <thead><tr>{cols.map((c) => <th key={c}>{c}</th>)}</tr></thead>
        <tbody>{filas.map((r, i) => <tr key={i}>{r.map((v, j) => <td key={j}>{v}</td>)}</tr>)}</tbody>
      </table>
    </div>
  )
}

// matriz de p ajustados entre grupos (colores según la significancia)
export function MatrizP({ r }) {
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

export function Indicadores({ r }) {
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

export function lecturaDe(r, ctrl) {
  if (!r.ok) return r.motivo
  const sig = r.pares.filter((p) => finito(p.pa) && p.pa < 0.05)
  if (r.global.p >= 0.05) return 'No hay diferencias claras entre los grupos (p ≥ 0,05). Con pocas réplicas el análisis solo detecta diferencias grandes.'
  if (!sig.length) return 'La prueba global da diferencias (p < 0,05), pero ningún par difiere al corregir por comparaciones múltiples.'
  const mayor = (p) => (p.dif > 0 ? `${p.a} > ${p.b}` : `${p.b} > ${p.a}`)
  return `Difieren: ${sig.map((p) => `${mayor(p)} (p = ${pTxt(p.pa)})`).join('; ')}.${ctrl ? ` Todas las comparaciones son contra «${ctrl}».` : ''}`
}

// Diagnóstico global de los supuestos: con todos los pocillos juntos hay muchos más datos que dentro de cada grupo.
// Residuos = cada pocillo menos la media de su celda (cepa × medio × placa). Shapiro-Wilk sobre todos los residuos juntos y
// Levene entre todas las celdas; además se mira si la DE crece con la media (en ese caso conviene el logaritmo).
export function diagnosticoGlobal(obsPozo) {
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

export function DiagnosticoGlobal({ d, unidad }) {
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

