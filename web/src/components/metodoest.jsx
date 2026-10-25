import { useMemo, useState } from 'react'
import { Campo, Select } from './ui.jsx'
import { Nota } from './tip.jsx'
import { dentroDeSel, juntarDe, objetivoDe, usaMedio } from './pruebas.jsx'
import { seroDe, serotiposDe, valoresSerotipo } from '../serotipos.js'
import { dentroDeGrupo, nombreGrupo, usaPlaca } from '../grupolibre.js'
import { armarComparacion } from '../comparacion.js'
import { unidadDe } from '../resumenes.js'
import { analizar, anidada, levene, parcelasDivididas, placaCepa, razonSD } from '../decision.js'
import { anovaTabla, desvio, holm, marcaSig, media, varianza } from '../estadistica.js'
import { chi2Sup, qnorm, rangos, shapiro } from '../reproducibilidad.js'

const finito = Number.isFinite
const f = (x, d = 4) => (finito(x) ? x.toFixed(d) : x === Infinity ? '∞' : '–')
const pTxt = (p) => (!finito(p) ? '–' : p < 0.0001 ? '< 0.0001' : p.toFixed(4))
const NOMBRE = { anova: 'ANOVA clásico', welch: 'ANOVA de Welch', kw: 'Kruskal-Wallis' }
const NOM_PARES = { anova: 't con varianza común', welch: 't de Welch', kw: 'Dunn' }

// Glosario: al pasar el mouse por el título de una columna se describe qué es; por un número, cómo se calcula
const DIC = {
  'Grupo': ['Cada grupo que se compara (una cepa, un medio o una placa).', ''],
  'n': ['Cantidad de datos del grupo.', 'Se cuentan los datos aceptados del grupo.'],
  'Datos': ['Valores de la variable elegida en ese grupo.', ''],
  'Media x̄': ['Promedio del grupo.', 'x̄ = Σ x / n'],
  'Media': ['Promedio del grupo.', 'x̄ = Σ x / n'],
  'Media del grupo': ['Promedio de los datos de ese grupo.', 'x̄ᵢ = Σ x / nᵢ'],
  'Media general': ['Promedio de todos los datos juntos.', 'x̄ = Σ todos los x / N'],
  'Varianza s²': ['Dispersión de los datos alrededor de su media.', 's² = Σ (x − x̄)² / (n − 1)'],
  'DE s': ['Desviación estándar: raíz de la varianza, en las unidades del dato.', 's = √s²'],
  'Dato': ['Valor observado.', ''],
  'Residuo = dato − media': ['Cuánto se aparta el dato de la media de su grupo; es la parte que el grupo no explica.', 'residuo = dato − media del grupo'],
  'Residuo²': ['Residuo al cuadrado; sumados dan la SC dentro.', 'residuo²'],
  'Cantidad': ['Resultado que se informa.', ''],
  'Valor': ['Valor calculado.', ''],
  'Mediana': ['Valor central del grupo, poco sensible a extremos.', 'n impar: dato central; n par: promedio de los dos centrales'],
  '|dato − mediana| de cada dato': ['Distancia de cada dato a la mediana de su grupo (z de Brown-Forsythe).', 'z = |x − mediana del grupo|'],
  'Media de esas distancias': ['Promedio de las distancias; mayor valor = grupo más variable.', 'z̄ = Σ z / n'],
  'Fuente': ['Origen de la variación.', ''],
  'Suma de cuadrados': ['Variación total atribuida a esa fuente.', 'SC = Σ (valor − media)²'],
  'gl': ['Grados de libertad: datos independientes disponibles para estimar esa variación.', 'entre: k − 1 · dentro: N − k'],
  'Cuadrado medio': ['Suma de cuadrados dividida por sus grados de libertad (una varianza).', 'CM = SC / gl'],
  'F': ['Razón entre la variación entre grupos y la de dentro. Si es grande, los grupos se separan.', 'F = CM entre / CM dentro'],
  'p': ['Probabilidad de ver un F tan grande o mayor si no hubiera diferencias reales.', 'p = P(F(gl₁; gl₂) ≥ F)'],
  'Regla': ['Condición que se evalúa en orden para elegir la prueba.', ''],
  'Lo que dan tus datos': ['Valor que toma esa condición con los datos analizados.', ''],
  '¿Se cumple?': ['Si se cumple, se aplica esa prueba y no se evalúan las siguientes.', 'p comparado con 0,05 y mínimos de datos'],
  'Prueba': ['Prueba global usada.', ''],
  'Estadístico': ['Valor que resume la diferencia entre grupos.', 'F, F* o H según la prueba'],
  'Conclusión (α = 0,05)': ['Decisión al nivel de significancia 0,05.', 'Se rechaza H₀ si p < 0,05'],
  'Rangos de sus datos': ['Posición de cada dato al ordenar todos juntos (empates: promedio de posiciones).', 'rango = posición de menor a mayor'],
  'Suma de rangos R': ['Suma de los rangos del grupo.', 'R = Σ rangos del grupo'],
  'R² / n': ['Aporte del grupo al estadístico H.', 'R² / n'],
  'Peso w = n / s²': ['Peso del grupo en Welch: los grupos más precisos pesan más.', 'w = n / s²'],
  'w × (media − media ponderada)²': ['Separación del grupo respecto de la media ponderada, con su peso.', 'w · (x̄ − x̄w)²'],
  '(1 − w/W)² / (n − 1)': ['Aporte del grupo a la corrección Λ de los grados de libertad.', '(1 − w/W)² / (n − 1)'],
  'Entre: n × (media − general)²': ['Aporte del grupo a la SC entre.', 'n · (x̄ᵢ − x̄)²'],
  'Dentro: Σ (dato − media del grupo)²': ['Aporte del grupo a la SC dentro.', 'Σ (x − x̄ᵢ)²'],
  'Par (A vs B)': ['Grupos que se comparan.', ''],
  'Media A': ['Promedio del primer grupo.', 'x̄ₐ = Σ x / nₐ'], 'Media B': ['Promedio del segundo grupo.', 'x̄ᵦ = Σ x / nᵦ'],
  'Diferencia A − B': ['Diferencia de medias.', 'x̄ₐ − x̄ᵦ'],
  't': ['Diferencia de medias medida en errores estándar.', 't = (x̄ₐ − x̄ᵦ) / EE'],
  'z de Dunn': ['Diferencia de rangos medios medida en errores estándar.', 'z = (R̄ₐ − R̄ᵦ) / √(N(N+1)/12 · (1/nₐ + 1/nᵦ))'],
  'p sin ajustar': ['Valor p de este par sin corregir por hacer varias comparaciones.', 'p = 2 · P(|T| ≥ |t|)'],
  'Orden i': ['Posición del p al ordenarlos de menor a mayor.', ''],
  'Multiplicador (m − i + 1)': ['Factor de Holm: cuántas comparaciones quedan por decidir.', 'm − i + 1'],
  'p × multiplicador': ['p corregido antes de impedir retrocesos.', 'p · (m − i + 1), máximo 1'],
  'p ajustado (sin retroceder)': ['p ajustado de Holm: nunca menor que el del paso anterior.', 'máx(p ajustado anterior; p · multiplicador)'],
  'Letra de significancia': ['Grupos con la misma letra no difieren (p ajustado ≥ 0,05).', ''],
  'Modelo': ['Modelo lineal ajustado; cada término nuevo explica una parte de la variación.', ''],
  'Rango (parámetros)': ['Cantidad de parámetros independientes del modelo.', 'rango de la matriz de diseño (QR)'],
  'RSS (suma de cuadrados residual)': ['Variación que el modelo no explica.', 'RSS = Σ (dato − ajustado)²'],
  'Cálculo de la SC': ['Cómo se obtiene la suma de cuadrados del término.', 'diferencia de RSS entre modelos anidados'],
  'SC': ['Suma de cuadrados del término.', 'diferencia de RSS'],
  'CM': ['Cuadrado medio.', 'SC / gl'],
  'Se prueba contra': ['Error con el que se compara el término (define el F correcto).', ''],
  'Situación': ['Condición de los datos.', ''],
  'Pares': ['Método de comparaciones de a pares asociado.', ''],
  'Por qué': ['Motivo de la elección.', ''],
  'Prueba global': ['Prueba que responde si hay alguna diferencia entre los grupos.', ''],
}
const PIE = [[/^SC entre/, 'Variación entre las medias de los grupos y la media general.'], [/^SC dentro/, 'Variación de los datos alrededor de la media de su grupo (error).'], [/^SC total/, 'Variación total de todos los datos.']]
function Tabla({ cols, filas, pie }) {
  return (
    <div className="tabla-scroll chica">
      <table className="tabla paso-tabla">
        <thead><tr>{cols.map((c) => <th key={c} data-tip={DIC[c] ? `${c}\n${DIC[c][0]}` : c}>{c}</th>)}</tr></thead>
        <tbody>{filas.map((r, i) => <tr key={i}>{r.map((v, j) => {
          const d = DIC[cols[j]]
          const tip = d && d[1] ? `${cols[j]}${j > 0 && typeof r[0] === 'string' ? ' · ' + r[0] : ''}\nCálculo: ${d[1]}` : undefined
          return <td key={j} data-tip={tip}>{v}</td>
        })}</tr>)}</tbody>
        {pie && <tfoot>{pie.map((r, i) => { const x = PIE.find(([re]) => re.test(r[0])); return <tr key={i}><th colSpan={cols.length - 1} data-tip={x ? `${r[0]}\n${x[1]}` : r[0]}>{r[0]}</th><td data-tip={`Cálculo: ${r[0]}`}><b>{r[1]}</b></td></tr> })}</tfoot>}
      </table>
    </div>
  )
}
// título con descripción al pasar el mouse
const TIP_H = [
  [/^A\./, 'Datos de cada grupo con su media, varianza y desviación estándar: la base de todos los cálculos.'],
  [/^B\./, 'Verifica si los residuos (dato − media del grupo) son compatibles con una distribución normal. En el gráfico Q–Q cada punto compara un residuo con el valor esperado bajo normalidad.'],
  [/^C\./, 'Verifica si los grupos tienen varianzas iguales: ANOVA sobre la distancia de cada dato a la mediana de su grupo.'],
  [/^D\./, 'Aplica en orden las reglas de decisión con los valores de estos datos y muestra qué prueba resulta.'],
  [/^E\./, 'Cálculo paso a paso de la prueba global: responde si hay alguna diferencia entre los grupos.'],
  [/^F\./, 'Compara los grupos de a pares, con el p corregido por la cantidad de comparaciones.'],
  [/^G\./, 'Efecto del medio probado contra la variación entre placas del mismo medio (la placa es la réplica).'],
  [/^Residuos/, 'Residuo = dato − media de su grupo.'], [/^Shapiro/, 'Prueba de normalidad de los residuos.'], [/^Levene/, 'Prueba de igualdad de varianzas (versión con mediana).'],
  [/^Diagn/, 'Revisión de supuestos con todos los pocillos juntos.'], [/^ANOVA/, 'Prueba global que compara medias.'], [/^Kruskal/, 'Prueba global basada en rangos.'],
  [/^Ajuste/, 'Corrección de los p por hacer varias comparaciones.'], [/^Letras/, 'Letras que resumen qué grupos no difieren.'],
]
function H4({ children }) {
  const txt = [].concat(children).join('')
  const t = TIP_H.find(([re]) => re.test(txt))
  return <h4 data-tip={t ? `${txt.replace(/^[A-G]\.\s*/, '')}\n${t[1]}` : txt}>{children}</h4>
}
const Formula = ({ children }) => <pre className="formula">{children}</pre>
const Sec = ({ id, n, t, children }) => <><h3 id={id} className="sec-est"><i>{n}</i> {t}</h3>{children}</>

// ---------------------------------------------------------------
// Diagrama de decisión (cada caja resume una regla del programa)
// ---------------------------------------------------------------
function Flujo({ r }) {
  const on = (t) => (!r || r.tipo === t ? 1 : 0.35)
  return (
    <svg viewBox="0 0 640 330" className="flujo-decision" role="img" aria-label="Cómo elige el programa la prueba">
      <defs><marker id="fl" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0 0 L8 4 L0 8 Z" fill="#8a6a49" /></marker></defs>
      <g fontSize="12" fill="#3a2a1e">
        <rect x="20" y="10" width="200" height="40" rx="10" fill="#fff3dc" stroke="#e0c58f" /><text x="120" y="35" textAnchor="middle" fontWeight="700">Datos de un análisis</text>
        <path d="M120 50 V70" stroke="#8a6a49" markerEnd="url(#fl)" fill="none" />
        <rect data-tip={'Prueba de normalidad\nShapiro-Wilk sobre los residuos (dato − media del grupo). Solo decide con N ≥ 8.'} x="10" y="72" width="220" height="62" rx="12" fill="#f6f0fb" stroke="#d6c4ea" /><text x="120" y="94" textAnchor="middle" fontWeight="700">¿Normalidad rechazada?</text>
        <text x="120" y="110" textAnchor="middle" fontSize="11">8 o más datos, 3 o más por grupo</text><text x="120" y="124" textAnchor="middle" fontSize="11">y Shapiro-Wilk p &lt; 0,05</text>
        <path d="M230 103 H300" stroke="#8a6a49" markerEnd="url(#fl)" fill="none" /><text x="262" y="96" fontSize="11" fontWeight="700">sí</text>
        <g opacity={on('kw')}><rect data-tip={'Kruskal-Wallis\nCompara rangos: no exige normalidad. H = 12/(N(N+1)) · Σ R²/n − 3(N+1)'} x="302" y="78" width="200" height="50" rx="12" fill="#efe6f7" stroke="#b79bd6" strokeWidth="2" /><text x="402" y="100" textAnchor="middle" fontWeight="700">Kruskal-Wallis</text><text x="402" y="116" textAnchor="middle" fontSize="11">pares: Dunn + Holm</text></g>
        <path d="M120 134 V160" stroke="#8a6a49" markerEnd="url(#fl)" fill="none" /><text x="128" y="152" fontSize="11" fontWeight="700">no</text>
        <rect data-tip={'Prueba de varianzas\nLevene (Brown-Forsythe): ANOVA sobre |dato − mediana del grupo|'} x="10" y="162" width="220" height="62" rx="12" fill="#f6f0fb" stroke="#d6c4ea" /><text x="120" y="184" textAnchor="middle" fontWeight="700">¿Varianzas distintas?</text>
        <text x="120" y="200" textAnchor="middle" fontSize="11">Levene (3 o más por grupo)</text><text x="120" y="214" textAnchor="middle" fontSize="11">p &lt; 0,05</text>
        <path d="M230 193 H300" stroke="#8a6a49" markerEnd="url(#fl)" fill="none" /><text x="262" y="186" fontSize="11" fontWeight="700">sí</text>
        <g opacity={on('welch')}><rect data-tip={'ANOVA de Welch\nPondera cada grupo por n/s²; válido con varianzas desiguales. F* = A / B'} x="302" y="168" width="200" height="50" rx="12" fill="#efe6f7" stroke="#b79bd6" strokeWidth="2" /><text x="402" y="190" textAnchor="middle" fontWeight="700">ANOVA de Welch</text><text x="402" y="206" textAnchor="middle" fontSize="11">pares: t de Welch + Holm</text></g>
        <path d="M120 224 V250" stroke="#8a6a49" markerEnd="url(#fl)" fill="none" /><text x="128" y="243" fontSize="11" fontWeight="700">no</text>
        <g opacity={on('anova')}><rect data-tip={'ANOVA clásico\nSupone residuos normales y varianzas iguales. F = CM entre / CM dentro'} x="10" y="252" width="300" height="56" rx="12" fill="#efe6f7" stroke="#b79bd6" strokeWidth="2" /><text x="160" y="274" textAnchor="middle" fontWeight="700">ANOVA clásico</text><text x="160" y="291" textAnchor="middle" fontSize="11">pares: t común + Holm · contra control: Dunnett</text></g>
        <rect x="330" y="240" width="300" height="76" rx="10" fill="#fffaf0" stroke="#efdcba" />
        <text x="342" y="260" fontSize="11" fontWeight="700">Si Levene no se puede calcular</text>
        <text x="342" y="276" fontSize="11">(menos de 3 datos por grupo) se usa Welch,</text>
        <text x="342" y="292" fontSize="11">que no necesita varianzas iguales.</text>
        <text x="342" y="308" fontSize="11">Con «Prueba» forzada se salta todo esto.</text>
      </g>
    </svg>
  )
}

// gráfico cuantil-cuantil de los residuos (puntos sobre la recta = normalidad)
function QQ({ resid }) {
  const e = [...resid].sort((a, b) => a - b)
  const N = e.length
  const z = e.map((_, i) => qnorm((i + 1 - 0.375) / (N + 0.25)))
  const sd = desvio(e)
  const W = 360, H = 240, m = 36
  const zx = Math.max(...z.map(Math.abs), 1), ey = Math.max(...e.map(Math.abs), 1e-9)
  const X = (v) => m + ((v + zx) / (2 * zx)) * (W - 2 * m)
  const Y = (v) => H - m - ((v + ey) / (2 * ey)) * (H - 2 * m)
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="qq" role="img" aria-label="Gráfico cuantil-cuantil de los residuos">
      <rect x={m} y={m / 2} width={W - 2 * m} height={H - m * 1.5} fill="#fffdf9" stroke="#ecdfcd" />
      <line data-tip={'Recta de normalidad perfecta\nPendiente = desviación estándar de los residuos'} x1={X(-zx)} y1={Y(-zx * sd)} x2={X(zx)} y2={Y(zx * sd)} stroke="#a2391a" strokeDasharray="5 3" strokeWidth="1.4" />
      {e.map((v, i) => <circle key={i} cx={X(z[i])} cy={Y(v)} r="3.2" fill="#2f5d8a" fillOpacity=".75" data-tip={`Residuo ${f(v, 4)}\ncuantil normal esperado ${f(z[i], 2)}`} />)}
      <text x={W / 2} y={H - 6} textAnchor="middle" fontSize="11" fill="#6b5440" data-tip={'Cuantil normal esperado\nValor que tendría el residuo ordenado i si fueran normales: z = Φ⁻¹((i − 0,375) / (N + 0,25))'}>cuantil normal esperado</text>
      <text x="10" y={H / 2} data-tip={'Residuo ordenado\nResiduos (dato − media del grupo) de menor a mayor'} fontSize="11" fill="#6b5440" transform={`rotate(-90 10 ${H / 2})`} textAnchor="middle">residuo ordenado</text>
    </svg>
  )
}

// ---------------------------------------------------------------
// Grupos del análisis que se desarrolla (los mismos de la pestaña Estadística)
// ---------------------------------------------------------------
function prepararBloques(s, D, o) {
  const obj0 = objetivoDe(o)
  const obj = obj0 === 'concordancia' ? 'placas' : obj0
  const variable = o.variable || 'od'
  const esPl = obj === 'placas' || obj === 'placastodas'
  const libres = obj === 'libre' ? (o.libres || []).filter((c) => c.grupos.length >= 2) : []
  const nivel = obj === 'serotipos' ? (['cepa', 'placa', 'pocillo'].includes(o.nivelSero) ? o.nivelSero : 'cepa')
    : esPl || libres.some((c) => c.grupos.some(usaPlaca)) ? 'pocillo' : o.nivel || 'placa'
  // resta: blanco restado (Calidad › Restar blanco); OD ÷ ODc se calcula con la OD leída
  const fx = (y, odc, resta = 0) => (variable === 'ln' ? (y > 0 ? Math.log(y) : NaN) : variable === 'odc' ? (odc > 0 ? (y + resta) / odc : NaN) : y)
  const obsPlaca0 = [], obsPozo0 = []
  D.conAnalisis.forEach((p) => {
    const a = s.analisisMap[p.id]
    const odc = a.odc?.odc, resta = a.odc?.resta || 0
    const medio = p.medio || '(sin medio)'
    a.resumen.forEach((r) => { if (finito(r.Media)) obsPlaca0.push({ cepa: r.Muestra, medio, placa: p.nombre, placaId: p.id, y: fx(r.Media, odc, resta) }) })
    a.estado.forEach((e) => { if (e.Usado && !e.EsBlanco) obsPozo0.push({ cepa: e.Muestra, medio, placa: p.nombre, placaId: p.id, y: fx(e.OD, odc, resta) }) })
  })
  const sel = (x) => (obj === 'libre' || dentroDeSel(o, x)) && !(usaMedio(obj) && x.medio === '(sin medio)')
  const obsPlaca = obsPlaca0.filter(sel), obsPozo = obsPozo0.filter(sel)
  const obs = (nivel === 'pocillo' ? obsPozo : obsPlaca).filter((x) => finito(x.y))
  const cepas = [...new Set(obs.map((x) => x.cepa))], medios = [...new Set(obs.map((x) => x.medio))]
  const vals = (c, m, p) => obs.filter((x) => (c === null || x.cepa === c) && (m === null || x.medio === m) && (p === null || x.placa === p)).map((x) => x.y)
  const comp = o.comp || 'pares'
  const ctrlMedio = medios.includes(o.ctrlMedio) ? o.ctrlMedio : medios[0]
  const ctrlCepa = cepas.includes(o.ctrlCepa) ? o.ctrlCepa : cepas[0]
  // comparaciones definidas a mano en la barra de Estadística: cada una es un ANOVA aparte
  const factorComp = obj === 'medios' ? 'medios' : obj === 'cepas' || obj === 'cepastodas' ? 'cepas' : 'placas'
  const placasIds = [...new Set(obs.map((x) => x.placaId))]
  const nivelesComp = factorComp === 'medios' ? medios : factorComp === 'cepas' ? cepas : placasIds
  const personal = null
  const conjuntos = personal ? personal.map((S) => S.filter((x) => nivelesComp.includes(x))).filter((S) => S.length >= 2) : [nivelesComp]
  const nomP = (id) => obs.find((x) => x.placaId === id)?.placa || id
  const sfx = (S) => (personal ? ' · ' + S.map((x) => (factorComp === 'placas' ? nomP(x) : x)).join(' vs ') : '')
  const ctrlEn = (S, c) => (comp === 'control' && S.includes(c) ? c : null)
  const nombreG = (g) => nombreGrupo(g, (id) => D.placasSel.find((p) => p.id === id)?.nombre || id)
  const valsG = (g) => obs.filter((x) => dentroDeGrupo(g, x, (c) => seroDe(s.exp, c))).map((x) => x.y)
  let bloques = []
  if (obj === 'libre') bloques = libres.map((c, i) => {
    const vistos = new Set()
    const grupos = c.grupos.filter((g) => { const k = nombreG(g); if (vistos.has(k)) return false; vistos.add(k); return true }).map((g) => ({ nombre: nombreG(g), v: valsG(g) }))
    return { titulo: `ANOVA ${i + 1}: ${grupos.map((g) => g.nombre).join(' vs ')}`, grupos, ctrl: comp === 'control' ? grupos[0].nombre : null }
  })
  else if (obj === 'serotipos') {
    // serotipos: dentro de cada medio o con todos juntos; cada valor según la réplica (cepa, placa o pocillo)
    const serosIn = serotiposDe(s.exp, cepas).filter((x) => !(o.eSeroFuera || []).includes(x))
    const ctrlS = comp === 'control' ? (serosIn.includes(o.ctrlSero) ? o.ctrlSero : serosIn[0]) : null
    const bloque = (m) => {
      const b = m ? obs.filter((x) => x.medio === m) : obs
      return { titulo: `${m ? `Medio ${m}` : 'Todos los medios'}: entre serotipos`, grupos: serosIn.map((sr) => ({ nombre: sr, v: valoresSerotipo(b, b, cepas.filter((c) => seroDe(s.exp, c) === sr), nivel).map((x) => x.y) })), ctrl: ctrlS }
    }
    if (serosIn.length >= 2) bloques = juntarDe(o) ? [bloque(null)] : medios.filter((m) => m !== '(sin medio)').map(bloque)
  }
  else if (obj === 'medios') bloques = conjuntos.flatMap((S) => cepas.map((c) => ({ titulo: `${c}${sfx(S)}: entre medios`, grupos: S.map((m) => ({ nombre: m, v: vals(c, m, null) })), ctrl: ctrlEn(S, ctrlMedio) })))
  else if (obj === 'cepastodas') bloques = conjuntos.map((S) => ({ titulo: `Todos los medios${sfx(S)}: entre cepas`, grupos: S.map((c) => ({ nombre: c, v: vals(c, null, null) })), ctrl: ctrlEn(S, ctrlCepa) }))
  else if (obj === 'cepas') bloques = conjuntos.flatMap((S) => medios.map((m) => ({ titulo: `Medio ${m}${sfx(S)}: entre cepas`, grupos: S.map((c) => ({ nombre: c, v: vals(c, m, null) })), ctrl: ctrlEn(S, ctrlCepa) })))
  else if (obj === 'placastodas') cepas.forEach((c) => conjuntos.forEach((S) => {
    const pls = [...new Set(obs.filter((x) => x.cepa === c && S.includes(x.placaId)).map((x) => x.placa))]
    if (pls.length >= 2) bloques.push({ titulo: `${c}${sfx(S)}: entre todas las placas`, grupos: pls.map((p) => ({ nombre: `${p} · ${obs.find((x) => x.placa === p).medio}`, v: vals(c, null, p) })), ctrl: null, cepa: c, placaIds: S })
  }))
  else medios.forEach((m) => cepas.forEach((c) => conjuntos.forEach((S) => {
    const pls = [...new Set(obs.filter((x) => x.cepa === c && x.medio === m && S.includes(x.placaId)).map((x) => x.placa))]
    if (pls.length >= 2) bloques.push({ titulo: `${c} · ${m}${sfx(S)}: entre placas`, grupos: pls.map((p) => ({ nombre: p, v: vals(c, m, p) })), ctrl: null })
  })))
  const cepaF = cepas.includes(o.selCepa) ? o.selCepa : cepas[0]
  const medioF = medios.includes(o.selMedio) ? o.selMedio : medios[0]
  const foco = { serotipos: juntarDe(o) ? 'Todos los medios: entre serotipos' : `Medio ${medioF}: entre serotipos`, medios: `${cepaF}: entre medios`, cepas: `Medio ${medioF}: entre cepas`, cepastodas: 'Todos los medios: entre cepas', placas: `${cepaF} · ${medioF}: entre placas`, placastodas: `${cepaF}: entre todas las placas`, libre: `ANOVA ${(o.selLibre || 0) + 1}:` }[obj]
  return { obj, foco, variable, nivel, forzado: o.prueba || 'auto', ajuste: ['holm', 'lsd', 'tukey'].includes(o.ajuste) ? o.ajuste : 'holm', bloques, obsPlaca, obsPozo, unidad: unidadDe(variable, D.corregida) }
}

// ---------------------------------------------------------------
// Ejemplo desarrollado con los datos reales
// ---------------------------------------------------------------
function Ejemplo({ s }) {
  const o = s.opts.comparar
  const D = useMemo(() => armarComparacion(s), [s.placas, s.analisisMap, s.muestras, o]) // eslint-disable-line react-hooks/exhaustive-deps
  const P = useMemo(() => (D.conAnalisis.length ? prepararBloques(s, D, o) : null), [D, o, s.analisisMap]) // eslint-disable-line react-hooks/exhaustive-deps
  const [sel, setSel] = useState('')
  if (!P || !P.bloques.length) return <p className="ayuda">Para ver el desarrollo con tus datos hacen falta al menos 2 placas con análisis (y, según el objetivo, 2 medios o 2 cepas). Se usa lo que esté elegido en la pestaña «Estadística».</p>
  const b = P.bloques.find((x) => x.titulo === sel) || P.bloques.find((x) => x.titulo === P.foco) || P.bloques.find((x) => P.foco && x.titulo.startsWith(P.foco)) || P.bloques[0]
  const g = b.grupos.filter((x) => x.v.length > 0)
  const vs = g.map((x) => x.v)
  const N = vs.reduce((a, v) => a + v.length, 0), k = g.length
  const r = analizar(b.grupos, P.forzado, b.ctrl, P.ajuste)
  if (!r.ok) return <p className="ayuda">{b.titulo}: {r.motivo}</p>
  const gm = media(vs.flat())
  const resid = g.flatMap((x) => { const m = media(x.v); return x.v.map((y) => ({ g: x.nombre, y, m, e: y - m })) })
  const nMin = Math.min(...vs.map((v) => v.length))
  const sw = r.sw
  const swUtil = !!sw && N >= 8
  const levGr = g.filter((x) => x.v.length >= 3)

  // Levene paso a paso
  const medianaDe = (v) => { const a = [...v].sort((x, y) => x - y), n = a.length; return n % 2 ? a[(n - 1) / 2] : (a[n / 2 - 1] + a[n / 2]) / 2 }
  const levTabla = levGr.map((x) => { const md = medianaDe(x.v); const z = x.v.map((y) => Math.abs(y - md)); return { n: x.nombre, md, z, mz: media(z) } })
  const levA = levTabla.length > 1 ? anovaTabla(levTabla.map((x) => x.z)) : null

  // desarrollo de la prueba elegida
  let desarrollo = null
  if (r.tipo === 'anova') {
    const a = r.global.tabla
    desarrollo = (
      <>
        <Tabla cols={['Grupo', 'n', 'Media del grupo', 'Media general', 'Entre: n × (media − general)²', 'Dentro: Σ (dato − media del grupo)²']}
          filas={g.map((x) => { const m = media(x.v); return [x.nombre, x.v.length, f(m), f(gm), f(x.v.length * (m - gm) ** 2, 6), f(x.v.reduce((acc, y) => acc + (y - m) ** 2, 0), 6)] })}
          pie={[['SC entre (suma de la columna «Entre»)', f(a.ssb, 6)], ['SC dentro (suma de la columna «Dentro»)', f(a.ssw, 6)], ['SC total = entre + dentro', f(a.sst, 6)],
            [`CM entre = SC entre / (k − 1) = ${f(a.ssb, 6)} / ${a.df1}`, f(a.msb, 6)], [`CM dentro = SC dentro / (N − k) = ${f(a.ssw, 6)} / ${a.df2}`, f(a.msw, 6)],
            ['F = CM entre / CM dentro', f(a.F, 4)], [`p = P(F(${a.df1}; ${a.df2}) ≥ F)`, pTxt(a.p)]]} />
      </>
    )
  } else if (r.tipo === 'welch') {
    const ok = g.filter((x) => x.v.length >= 2)
    const n = ok.map((x) => x.v.length), m = ok.map((x) => media(x.v)), s2 = ok.map((x) => varianza(x.v))
    const w = n.map((ni, i) => ni / s2[i]), W = w.reduce((a, b2) => a + b2, 0), mw = w.reduce((a, wi, i) => a + wi * m[i], 0) / W
    const termino = w.map((wi, i) => (1 - wi / W) ** 2 / (n[i] - 1)), lam = termino.reduce((a, b2) => a + b2, 0), kk = ok.length
    const A = w.reduce((a, wi, i) => a + wi * (m[i] - mw) ** 2, 0) / (kk - 1), B = 1 + ((2 * (kk - 2)) / (kk * kk - 1)) * lam
    desarrollo = (
      <Tabla cols={['Grupo', 'n', 'Media', 'Varianza s²', 'Peso w = n / s²', 'w × (media − media ponderada)²', '(1 − w/W)² / (n − 1)']}
        filas={ok.map((x, i) => [x.nombre, n[i], f(m[i]), f(s2[i], 6), f(w[i], 2), f(w[i] * (m[i] - mw) ** 2, 4), f(termino[i], 6)])}
        pie={[['W = Σ w', f(W, 3)], ['Media ponderada = Σ w·media / W', f(mw)], [`A = Σ w (media − media ponderada)² / (k − 1)`, f(A, 4)], ['Λ = Σ (1 − w/W)² / (n − 1)', f(lam, 6)],
          [`B = 1 + 2 (k − 2) / (k² − 1) · Λ`, f(B, 4)], ['F* = A / B', f(A / B, 4)], ['gl₁ = k − 1', kk - 1], ['gl₂ = (k² − 1) / (3 Λ)', f((kk * kk - 1) / (3 * lam), 2)], ['p = P(F(gl₁; gl₂) ≥ F*)', pTxt(r.global.p)]]} />
    )
  } else {
    const todos = g.flatMap((x) => x.v.map((y) => ({ g: x.nombre, y })))
    const rk = rangos(todos.map((t) => t.y))
    const por = g.map((x) => ({ nombre: x.nombre, n: x.v.length, R: todos.reduce((a, t, i) => (t.g === x.nombre ? a + rk[i] : a), 0) }))
    const cuenta = {}
    todos.forEach((t) => { cuenta[t.y] = (cuenta[t.y] || 0) + 1 })
    const sumT = Object.values(cuenta).reduce((a, t) => a + t ** 3 - t, 0)
    const C = 1 - sumT / (N ** 3 - N)
    const Hraw = (12 / (N * (N + 1))) * por.reduce((a, x) => a + (x.R * x.R) / x.n, 0) - 3 * (N + 1)
    desarrollo = (
      <>
        <Tabla cols={['Grupo', 'n', 'Rangos de sus datos', 'Suma de rangos R', 'R² / n']}
          filas={por.map((x) => [x.nombre, x.n, todos.map((t, i) => (t.g === x.nombre ? f(rk[i], 1) : null)).filter(Boolean).join(', '), f(x.R, 1), f((x.R * x.R) / x.n, 3)])}
          pie={[['N (total de datos)', N], ['H = 12 / (N (N + 1)) · Σ R²/n − 3 (N + 1)', f(Hraw, 4)], [`Corrección por empates C = 1 − Σ(t³ − t) / (N³ − N) = 1 − ${f(sumT, 0)} / ${N ** 3 - N}`, f(C, 4)],
            ['H corregido = H / C', f(Hraw / C, 4)], ['gl = k − 1', k - 1], ['p = P(χ²(gl) ≥ H)', pTxt(chi2Sup(Hraw / C, k - 1))]]} />
        <p className="ayuda">Todos los datos se ordenan juntos de menor a mayor y se reemplazan por su posición (rango; si hay empates se usa el promedio de las posiciones). Si los grupos fueran iguales, la suma de rangos de cada uno sería proporcional a su tamaño.</p>
      </>
    )
  }

  // comparaciones de a pares
  const par = r.pares
  const metodoPares = par[0]?.metodo || 'Holm'
  const pOrden = par.map((p, i) => ({ i, p: p.p })).filter((x) => finito(x.p)).sort((a, b2) => a.p - b2.p)
  const m = pOrden.length
  let corrida = 0
  const holmPasos = pOrden.map((x, j) => { const mult = m - j; const bruto = Math.min(1, x.p * mult); corrida = Math.max(corrida, bruto); return { ...x, mult, bruto, ajustado: corrida } })

  return (
    <div className="ejemplo-vivo">
      <div className="fila-ctrl" style={{ alignItems: 'flex-end' }}>
        <Campo label={`Análisis a desarrollar (${P.bloques.length})`}>
          <Select value={b.titulo} onChange={setSel} opciones={P.bloques.map((x) => [x.titulo, x.titulo])} />
        </Campo>
        <p className="ayuda" style={{ margin: 0, maxWidth: 520 }}>Variable: <b>{P.unidad}</b> · réplica: <b>{P.obj === 'placas' || P.obj === 'placastodas' ? 'pocillo (los grupos son las placas)' : P.nivel === 'cepa' ? 'cepa (la media de sus placas; los grupos son los serotipos)' : P.nivel === 'placa' ? 'placa (un valor por placa)' : 'pocillo'}</b> · prueba: <b>{P.forzado === 'auto' ? 'automática' : NOMBRE[P.forzado]}</b>. Cambian con lo que elijas en la pestaña «Estadística».{(['cepas', 'cepastodas', 'libre'].includes(P.obj) && o.nivel !== 'placa' && o.nivel !== 'pocillo') || (P.obj === 'serotipos' && o.nivelSero === 'bloque') ? ' Si en Estadística se usa la placa como bloque, acá se desarrolla la versión de una vía; la tabla del modelo en bloques está en Estadística › «Tabla de la prueba global» (sección 4b).' : ''}</p>
      </div>

      <H4>A. Los datos de cada grupo</H4>
      <Tabla cols={['Grupo', 'n', 'Datos', 'Media x̄', 'Varianza s²', 'DE s']}
        filas={g.map((x) => [x.nombre, x.v.length, x.v.map((y) => f(y, 3)).join(' · '), f(media(x.v)), x.v.length > 1 ? f(varianza(x.v), 6) : '–', x.v.length > 1 ? f(desvio(x.v)) : '–'])}
        pie={[['k (grupos) · N (datos)', `${k} · ${N}`], ['Media general', f(gm)], ['Mayor DE / menor DE', f(razonSD(vs), 2)]]} />

      <H4>B. Normalidad: residuos y Shapiro-Wilk</H4>
      <p className="ayuda">Residuo = dato − media de su grupo. La suma de los residuos de cada grupo es 0 por construcción.</p>
      <Tabla cols={['Grupo', 'Dato', 'Media del grupo', 'Residuo = dato − media', 'Residuo²']} filas={resid.slice(0, 60).map((x) => [x.g, f(x.y), f(x.m), f(x.e), f(x.e * x.e, 6)])}
        pie={[[`Σ residuo² (= SC dentro)${resid.length > 60 ? ' · se muestran 60 de ' + resid.length : ''}`, f(resid.reduce((a, x) => a + x.e * x.e, 0), 6)]]} />
      <div className="res-doble">
        <QQ resid={resid.map((x) => x.e)} />
        <div>
          <Tabla cols={['Cantidad', 'Valor']} filas={[['N de residuos', N], ['W de Shapiro-Wilk', sw ? f(sw.W, 4) : '–'], ['p de Shapiro-Wilk', sw ? pTxt(sw.p) : '–'], ['¿Se usa para decidir? (N ≥ 8)', swUtil ? 'Sí' : 'No: con menos de 8 datos tiene muy poco poder']]} />
          <p className="ayuda">Si los puntos del gráfico siguen la recta discontinua, los residuos son compatibles con la normalidad. Colas que se despegan indican valores extremos o asimetría.</p>
        </div>
      </div>

      <H4>C. Varianzas: prueba de Levene (Brown-Forsythe)</H4>
      {levTabla.length > 1 ? (
        <>
          <Tabla cols={['Grupo', 'Mediana', '|dato − mediana| de cada dato', 'Media de esas distancias']} filas={levTabla.map((x) => [x.n, f(x.md), x.z.map((y) => f(y, 4)).join(' · '), f(x.mz, 5)])} />
          <Tabla cols={['Fuente', 'Suma de cuadrados', 'gl', 'Cuadrado medio', 'F', 'p']}
            filas={[['Entre grupos (de las distancias)', f(levA.ssb, 6), levA.df1, f(levA.msb, 6), f(levA.F, 3), pTxt(levA.p)], ['Dentro', f(levA.ssw, 6), levA.df2, f(levA.msw, 6), '', '']]} />
          <p className="ayuda">Es un ANOVA sobre las distancias a la mediana: si un grupo es más variable, sus distancias son mayores y F crece. p &lt; 0,05: las varianzas no son iguales.{levGr.length < g.length ? ` Se excluyeron ${g.length - levGr.length} grupo(s) con menos de 3 datos.` : ''}</p>
        </>
      ) : <p className="ayuda">No se puede calcular: hacen falta al menos 2 grupos con 3 o más datos (con 2 datos las dos distancias a la mediana son iguales y la prueba se anula).</p>}

      <H4>D. Cómo se decidió la prueba</H4>
      <Tabla cols={['Regla', 'Lo que dan tus datos', '¿Se cumple?']}
        filas={[
          ['1. N ≥ 8, al menos 3 datos en cada grupo y Shapiro p < 0,05 → Kruskal-Wallis', `N = ${N}; mínimo por grupo = ${nMin}; Shapiro p = ${sw ? pTxt(sw.p) : '–'}`, swUtil && sw.p < 0.05 && nMin >= 3 ? 'Sí' : 'No'],
          ['2. Levene p < 0,05 → ANOVA de Welch', levA ? `Levene p = ${pTxt(levA.p)}` : 'Levene no calculable (menos de 3 datos por grupo)', levA ? (levA.p < 0.05 ? 'Sí' : 'No') : 'Sin dato: se usa Welch'],
          ['3. Si no, ANOVA clásico', '', ''],
          ['Resultado', P.forzado === 'auto' ? NOMBRE[r.tipo] : `${NOMBRE[r.tipo]} (elegida por vos)`, ''],
        ]} />
      <Flujo r={r} />
      <p className="razon-test">{r.razon}</p>

      <H4>E. Desarrollo de la prueba global: {NOMBRE[r.tipo]}</H4>
      {desarrollo}
      <Tabla cols={['Prueba', 'Estadístico', 'gl', 'p', 'Conclusión (α = 0,05)']}
        filas={[[r.global.nombre, `${r.global.est} = ${f(r.global.valor, 4)}`, r.global.df2 ? `${r.global.df1}; ${f(r.global.df2, 2)}` : r.global.df1, pTxt(r.global.p), r.global.p < 0.05 ? `Se rechaza H₀: hay diferencias (${marcaSig(r.global.p)})` : 'No se rechaza H₀: sin diferencia clara']]} />

      <H4>F. Comparaciones de a pares ({b.ctrl ? `contra «${b.ctrl}»` : 'todos los pares'}): {metodoPares === 'Dunnett' ? 'prueba de Dunnett' : `${NOM_PARES[r.tipo]} con ajuste de Holm`}</H4>
      {par.length > 0 ? (
        <>
          <Tabla cols={['Par (A vs B)', 'Media A', 'Media B', 'Diferencia A − B', r.tipo === 'kw' ? 'z de Dunn' : 't', 'gl', 'p sin ajustar', `p ajustado (${metodoPares})`]}
            filas={par.map((p) => [`${p.a} vs ${p.b}`, f(p.ma), f(p.mb), f(p.dif), f(p.est, 3), finito(p.df) ? f(p.df, 2) : '–', pTxt(p.p), pTxt(p.pa)])} />
          {metodoPares === 'Holm' && m > 0 && (
            <>
              <p className="ayuda">Ajuste de Holm paso a paso: los p se ordenan de menor a mayor; el i-ésimo se multiplica por (m − i + 1) (m = {m} comparaciones); luego se impide que un p ajustado quede por debajo del anterior y se limita a 1.</p>
              <Tabla cols={['Orden i', 'Par', 'p sin ajustar', 'Multiplicador (m − i + 1)', 'p × multiplicador', 'p ajustado (sin retroceder)']}
                filas={holmPasos.map((x, j) => [j + 1, `${par[x.i].a} vs ${par[x.i].b}`, pTxt(x.p), x.mult, f(x.bruto, 4), pTxt(x.ajustado)])} />
            </>
          )}
          {metodoPares === 'Dunnett' && <p className="ayuda">Dunnett no usa Holm: el p ya es el de la distribución del máximo de las {par.length} estadísticas t contra el control (ver sección 8), y por eso es algo menor que el de Bonferroni o Holm.</p>}
        </>
      ) : <p className="ayuda">No hay comparaciones de a pares.</p>}
      {r.letras && <Tabla cols={['Grupo', 'Media', 'Letra de significancia']} filas={[...g].sort((x, y) => media(y.v) - media(x.v)).map((x) => [x.nombre, f(media(x.v)), r.letras[x.nombre]])} />}

      {P.obj === 'placastodas' && (() => {
        const filasT = (sp) => sp.filas.map((x) => [x.nombre, f(x.ss, 6), x.df, f(x.ms, 6), f(x.F, 3), pTxt(x.p), x.error])
        const colsT = ['Fuente', 'Suma de cuadrados', 'gl', 'Cuadrado medio', 'F', 'p', 'Se prueba contra']
        const an = anidada(P.obsPozo.filter((x) => x.cepa === b.cepa && (!b.placaIds || b.placaIds.includes(x.placaId)) && finito(x.y)))
        const pc = placaCepa(P.obsPozo.filter((x) => finito(x.y)))
        return (
          <>
            {an && (
              <>
                <H4>G. {b.cepa}: medio y placa dentro del medio (variante cruzada)</H4>
                <p className="ayuda">Cada placa lleva un solo medio, de modo que la placa está anidada en el medio. El medio se prueba contra la variación entre placas del mismo medio (F = CM medio / CM placas dentro de medio, con {an.filas[0].df} y {an.filas[1].df} gl); las placas dentro del medio, contra los pocillos.</p>
                <Tabla cols={['Modelo', 'Rango (parámetros)', 'RSS (suma de cuadrados residual)']} filas={an.modelos.map((x) => [x.nombre, x.rango, f(x.rss, 6)])} />
                <Tabla cols={colsT} filas={filasT(an)} />
              </>
            )}
            {pc && (
              <>
                <H4>H. Todas las cepas: placa, cepa y cepa × placa</H4>
                <Tabla cols={['Modelo', 'Rango (parámetros)', 'RSS (suma de cuadrados residual)']} filas={pc.modelos.map((x) => [x.nombre, x.rango, f(x.rss, 6)])} />
                <Tabla cols={colsT} filas={filasT(pc)} />
              </>
            )}
          </>
        )
      })()}
      {P.obj === 'medios' && (() => {
        const sp = parcelasDivididas(P.obsPlaca)
        if (!sp) return null
        return (
          <>
            <H4>G. Efecto global: ANOVA de parcelas divididas (la placa como bloque)</H4>
            <p className="ayuda">Se ajusta una secuencia de modelos y se toma lo que explica cada término nuevo como la diferencia de sus sumas de cuadrados residuales (RSS).</p>
            <Tabla cols={['Modelo', 'Rango (parámetros)', 'RSS (suma de cuadrados residual)']} filas={sp.modelos.map((x) => [x.nombre, x.rango, f(x.rss, 6)])} />
            <Tabla cols={['Fuente', 'Cálculo de la SC', 'SC', 'gl', 'CM', 'F', 'p', 'Se prueba contra']}
              filas={sp.filas.map((x, i) => [x.nombre, ['RSS(~1) − RSS(~medio)', 'RSS(~medio) − RSS(~placa)', 'RSS(~placa) − RSS(~placa+cepa)', 'RSS(~placa+cepa) − RSS(completo)', 'RSS(completo)'][i], f(x.ss, 6), x.df, f(x.ms, 6), f(x.F, 3), pTxt(x.p), x.error])} />
          </>
        )
      })()}
    </div>
  )
}

// ===============================================================
// ESTADÍSTICA EXTENSIVA (pestaña Datos)
// ===============================================================
export function MetodoEstadistico({ s }) {
  return (
    <section className="tarjeta metodo metodo-est">
      <h2>Estadística: cálculos, razones y lógica de cada método</h2>
      <p className="ayuda">Todo lo que hace la pestaña «Estadística», con las fórmulas, el motivo de cada elección y un ejemplo desarrollado con tus datos. Los cálculos se hacen en el navegador.</p>
      <nav className="indice-est">
        {[['e1', '1 Diseño'], ['e2', '2 Datos'], ['e3', '3 Supuestos'], ['e4', '4 Decisión'], ['e4b', '4b Bloques y sensibilidad'], ['e5', '5 Con tus datos'], ['e6', '6 Pruebas globales'], ['e7', '7 Pares'], ['e8', '8 Dunnett'], ['e9', '9 Medio y placa'], ['e10', '10 Reproducibilidad'], ['e11', '11 Cómo leerlo']].map(([id, t]) => <a key={id} href={`#${id}`} onClick={(e) => { e.preventDefault(); document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' }) }}>{t}</a>)}
      </nav>

      <Sec id="e1" n="1" t="Qué se compara y cuál es la réplica">
        <p>La OD (cristal violeta extraído con etanol) es una medida indirecta de la <b>biomasa de biofilm</b>. En una placa de 96 cada pocillo es una <b>réplica técnica</b>: sirve para estimar el error de pipeteo y de la tinción dentro de esa placa. La <b>réplica biológica</b> es la placa (el cultivo y el día del experimento): es lo que permite decir si un resultado se repite.</p>
        <ul>
          <li><b>Entre medios:</b> cada placa se hace en un solo medio (BHI o TSBye), así que el medio varía <i>entre placas</i>. Para una cepa se compara su OD entre medios con un valor por placa.</li>
          <li><b>Entre cepas:</b> todas las cepas están en cada placa, así que se comparan <i>dentro de la placa</i> (más precisión, porque el efecto de la placa se cancela).</li>
          <li><b>Entre placas (réplicas):</b> para una misma cepa y medio, los grupos son las placas y los datos son sus pocillos: pregunta si el resultado se reproduce.</li>
          <li><b>Entre placas (todos los medios):</b> para una misma cepa, los grupos son todas las placas sin separar por medio. Como la placa y el medio van juntos, esa diferencia mezcla ambos efectos; por eso se acompaña con el modelo de medio y placa anidada (sección 9) y con el modelo placa, cepa y cepa × placa.</li>
        </ul>
        <p>Usar cada pocillo como réplica para comparar medios sería <b>pseudo-replicación</b>: los pocillos de una misma placa se parecen entre sí más que a los de otra, y los p saldrían demasiado chicos. Por eso la opción por defecto es «Placa».</p>
      </Sec>

      <Sec id="e2" n="2" t="Los datos: qué entra y cómo se transforman">
        <ul>
          <li><b>Entran</b> los pocillos aceptados de las placas visibles: se excluyen los blancos, los pocillos excluidos a mano o por el criterio de valores atípicos (Q de Dixon, Grubbs o CV), las placas ocultas y las muestras ocultas.</li>
          <li><b>OD tal cual:</b> la medida original.</li>
          <li><b>ln(OD):</b> logaritmo natural de cada OD. En la OD de biofilm la desviación estándar suele crecer con la media (coeficiente de variación casi constante). El logaritmo convierte ese error proporcional en uno de tamaño parecido y estabiliza las varianzas, que es el supuesto del ANOVA. Con ln, las diferencias son <b>razones</b> (veces), no restas.</li>
          <li><b>OD ÷ ODc:</b> cada OD dividida por el punto de corte de su placa (ODc = media de los blancos + 3 DE de los blancos). Reduce las diferencias de nivel entre placas.</li>
          <li><b>Media por placa</b> (réplica «Placa»): promedio de los pocillos aceptados de la cepa en esa placa; si se elige una escala transformada (ln u OD ÷ ODc), se transforma esa media.</li>
        </ul>
      </Sec>

      <Sec id="e3" n="3" t="Los supuestos del ANOVA y cómo se comprueban">
        <p>El ANOVA clásico supone: (1) datos <b>independientes</b> (por eso la réplica es la placa); (2) <b>residuos normales</b>; (3) <b>varianzas iguales</b> entre grupos (homocedasticidad). Si (2) o (3) fallan, los p pueden ser poco confiables.</p>
        <H4>Residuos</H4>
        <Formula>residuo = dato − media de su grupo</Formula>
        <p>La normalidad se evalúa sobre los residuos (no sobre los datos crudos) porque así se juntan todos los grupos en una sola muestra, con mucho más poder que probar cada grupo de 4 datos por separado.</p>
        <H4>Shapiro-Wilk (normalidad)</H4>
        <Formula>{`W = ( Σ aᵢ · x₍ᵢ₎ )² / Σ (xᵢ − x̄)²      x₍ᵢ₎ = residuos ordenados; aᵢ = coeficientes de Shapiro-Wilk
H₀: los residuos siguen una distribución normal.   p < 0,05 → se rechaza H₀.`}</Formula>
        <p>Los coeficientes y el p se calculan con la aproximación de Royston (1995, algoritmo AS R94, igual que <code>shapiro.test</code> de R). Con menos de 8 datos casi no detecta nada, por eso solo decide la prueba con N ≥ 8. Con cientos de datos detecta desvíos mínimos: conviene mirar el gráfico cuantil-cuantil.</p>
        <H4>Levene, versión Brown-Forsythe (varianzas)</H4>
        <Formula>{`zᵢⱼ = | xᵢⱼ − mediana del grupo i |
ANOVA de una vía sobre los zᵢⱼ:  F = CM entre / CM dentro
H₀: las varianzas de todos los grupos son iguales.   p < 0,05 → varianzas distintas.`}</Formula>
        <p>Usa la mediana (no la media) porque es robusta a valores extremos. Necesita 3 o más datos por grupo: con 2 datos las dos distancias a la mediana son idénticas. Regla práctica adicional: si la mayor DE es más de 2 veces la menor, las varianzas son sospechosas.</p>
        <H4>Diagnóstico global (pestaña Estadística)</H4>
        <p>Con todos los pocillos juntos hay muchos más datos que dentro de un grupo. El programa calcula los residuos de cada pocillo respecto de la media de su celda (cepa × medio × placa), aplica Shapiro-Wilk a todos juntos, Levene entre todas las celdas y la correlación de Spearman entre la media y la DE de las celdas. Si la DE crece con la media (ρ &gt; 0,5), recomienda ln(OD).</p>
      </Sec>

      <Sec id="e4" n="4" t="La lógica de la selección automática">
        <p>Cada análisis (una cepa entre medios, un medio entre cepas, una cepa y medio entre placas) se evalúa por separado:</p>
        <Tabla cols={['Situación', 'Prueba global', 'Pares', 'Por qué']} filas={[
          ['N ≥ 8, ≥ 3 datos por grupo y residuos no normales (Shapiro p < 0,05)', 'Kruskal-Wallis', 'Dunn + Holm', 'Compara rangos: no necesita normalidad. Con menos datos casi no tiene poder (con 2 datos por grupo el p mínimo posible es ≈ 0,33).'],
          ['Si no, varianzas distintas (Levene p < 0,05)', 'ANOVA de Welch', 't de Welch + Holm', 'Pondera cada grupo por su varianza y ajusta los grados de libertad: válido con varianzas desiguales.'],
          ['Si no, varianzas parecidas', 'ANOVA clásico', 't con varianza común + Holm · contra control: Dunnett', 'Es la prueba más potente cuando se cumplen los supuestos.'],
          ['Levene no se puede calcular (< 3 datos por grupo)', 'ANOVA de Welch', 't de Welch + Holm', 'Es la opción prudente cuando no se pueden verificar las varianzas.'],
        ]} />
        <Flujo r={null} />
        <p>Los umbrales (N ≥ 8, 3 datos por grupo, α = 0,05) evitan decidir con pruebas de diagnóstico sin poder. Si elegís una prueba en «Prueba», se usa esa sin decidir nada. Welch exige 2 o más datos y variación en cada grupo; si no, se usa el ANOVA clásico.</p>
      </Sec>

      <Sec id="e4b" n="4b" t="La placa como bloque, la escala sugerida y la sensibilidad">
        <H4>La placa como bloque</H4>
        <p>Cuando cada placa mide todos los grupos que se comparan (todas las cepas, o todos los serotipos), la placa funciona como un <b>bloque</b>: si un día la tinción salió más fuerte, sube a todos los grupos de esa placa. El ANOVA en bloques separa esa variación y la saca del error, así que las diferencias entre grupos se ven con más claridad. Es la opción por defecto al comparar cepas, siempre que haya 3 o más placas con todos los grupos (las placas a las que les falta algún grupo quedan afuera).</p>
        <Formula>{`y(grupo, placa) = media general + efecto del grupo + efecto de la placa + error
SC total = SC grupos + SC placas + SC error      gl error = (k − 1)(b − 1)
F = CM grupos / CM error      (k grupos, b placas)`}</Formula>
        <p>Si los residuos de ese modelo no son normales se usa <b>Friedman</b>: dentro de cada placa se ordenan los grupos (rangos) y se compara la suma de rangos de cada grupo. Pares: con el ANOVA en bloques, t con el error del modelo (Holm), Tukey o Dunnett; con Friedman, diferencia de rangos medios con Holm o Nemenyi. Verificado contra R (<code>aov(y ~ grupo + placa)</code>, <code>TukeyHSD</code>, <code>friedman.test</code>).</p>
        <H4>Escala sugerida</H4>
        <p>Se mira cómo crece la DE con la media entre los grupos: la pendiente de log(DE) contra log(media). Si es cercana a 1 (la DE crece en proporción a la media, es decir, un CV casi constante), el logaritmo iguala las varianzas y se sugiere ln(OD); si es cercana a 0, la OD tal cual. La sugerencia sale de los datos, no del resultado de la prueba, y no cambia la escala sola.</p>
        <H4>Sensibilidad</H4>
        <p>Al final de Estadística se repite la misma comparación con todas las combinaciones razonables de escala, réplica, prueba y ajuste. No sirve para elegir la que da significativo (si se elige por el p, el p deja de valer): sirve para saber si la conclusión es firme. Si todas las combinaciones que cumplen sus supuestos coinciden, la conclusión es robusta; si no, hay que informarla con cautela.</p>
      </Sec>

      <Sec id="e5" n="5" t="Desarrollo completo con tus datos">
        <Ejemplo s={s} />
      </Sec>

      <Sec id="e6" n="6" t="Pruebas globales: fórmulas">
        <H4>ANOVA de una vía</H4>
        <Formula>{`SC entre = Σ nᵢ (x̄ᵢ − x̄)²          SC dentro = Σ Σ (xᵢⱼ − x̄ᵢ)²
CM entre = SC entre / (k − 1)        CM dentro = SC dentro / (N − k)
F = CM entre / CM dentro      p = P( F(k − 1; N − k) ≥ F )
H₀: μ₁ = μ₂ = … = μₖ      H₁: al menos una media difiere`}</Formula>
        <p>El p se obtiene de la distribución F con la función beta incompleta. F grande: los grupos se separan más de lo que varían internamente.</p>
        <H4>ANOVA de Welch</H4>
        <Formula>{`wᵢ = nᵢ / sᵢ²    W = Σ wᵢ    x̄w = Σ wᵢ x̄ᵢ / W
A = Σ wᵢ (x̄ᵢ − x̄w)² / (k − 1)     Λ = Σ (1 − wᵢ/W)² / (nᵢ − 1)
B = 1 + 2 (k − 2) / (k² − 1) · Λ    F* = A / B
gl₁ = k − 1     gl₂ = (k² − 1) / (3 Λ)      p = P( F(gl₁; gl₂) ≥ F* )`}</Formula>
        <p>Con 2 grupos equivale a la t de Welch (F* = t²). Verificado contra <code>oneway.test(var.equal = FALSE)</code> de R.</p>
        <H4>Kruskal-Wallis</H4>
        <Formula>{`R = suma de rangos de cada grupo (rangos sobre todos los datos juntos)
H = 12 / (N (N + 1)) · Σ Rᵢ² / nᵢ − 3 (N + 1)
C = 1 − Σ (t³ − t) / (N³ − N)      (t = tamaño de cada grupo de empates)
H* = H / C      p = P( χ²(k − 1) ≥ H* )
H₀: los grupos tienen la misma distribución      H₁: alguno tiende a dar valores mayores o menores`}</Formula>
      </Sec>

      <Sec id="e7" n="7" t="Comparaciones de a pares y ajuste por comparaciones múltiples">
        <p>Con k grupos hay k (k − 1) / 2 pares. Si cada uno se prueba con α = 0,05, la probabilidad de algún falso positivo crece mucho; por eso se ajustan los p.</p>
        <Formula>{`t con varianza común (ANOVA):  t = (x̄ᵢ − x̄ⱼ) / √( CM dentro · (1/nᵢ + 1/nⱼ) ),   gl = N − k
t de Welch:  t = (x̄ᵢ − x̄ⱼ) / √( sᵢ²/nᵢ + sⱼ²/nⱼ ),
             gl = ( sᵢ²/nᵢ + sⱼ²/nⱼ )² / [ (sᵢ²/nᵢ)²/(nᵢ − 1) + (sⱼ²/nⱼ)²/(nⱼ − 1) ]   (Welch-Satterthwaite)
Dunn (Kruskal-Wallis):  z = (R̄ᵢ − R̄ⱼ) / √( N (N + 1) / 12 · (1/nᵢ + 1/nⱼ) ),   R̄ = rango medio
p bilateral = 2 · P( |T| ≥ |t| )  (T de Student) o 2 · P( Z ≥ |z| ) (normal)`}</Formula>
        <H4>Ajuste de Holm (Holm-Bonferroni)</H4>
        <Formula>{`1. Ordenar los p de menor a mayor: p₍₁₎ ≤ p₍₂₎ ≤ … ≤ p₍ₘ₎
2. p ajustado₍ᵢ₎ = máx( p ajustado₍ᵢ₋₁₎ ; (m − i + 1) · p₍ᵢ₎ ),  limitado a 1`}</Formula>
        <p>Controla la probabilidad de cometer al menos un falso positivo en todo el conjunto (error por familia) y es siempre igual o más potente que Bonferroni. Cada análisis (cada cepa o cada medio) se ajusta por separado.</p>
        <H4>Letras de significancia</H4>
        <p>Los grupos se ordenan por media y se les asignan letras de modo que dos grupos comparten una letra si y solo si su p ajustado es ≥ 0,05 (algoritmo de «insertar y absorber»). Grupos con la misma letra no difieren.</p>
      </Sec>

      <Sec id="e8" n="8" t="Prueba de Dunnett (cada grupo contra un control)">
        <p>Cuando todo lo que importa es la comparación con una referencia (la cepa salvaje, el medio estándar), hay solo k − 1 comparaciones. Dunnett aprovecha que las estadísticas t contra el mismo control <b>no son independientes</b> (comparten la media del control).</p>
        <Formula>{`tᵢ = (x̄ᵢ − x̄control) / √( CM dentro · (1/nᵢ + 1/nc) ),   gl = N − k
correlación entre tᵢ y tⱼ = λᵢ λⱼ,   λᵢ = √( nᵢ / (nᵢ + nc) )
p ajustado de la comparación i = P( máx |Tⱼ| ≥ |tᵢ| )  (t multivariada, H₀ verdadera para todas)
= 1 − ∫ f(s) ∫ φ(z) Πⱼ [ Φ((d s + λⱼ z)/aⱼ) − Φ((−d s + λⱼ z)/aⱼ) ] dz ds,   aⱼ = √(1 − λⱼ²)`}</Formula>
        <p>La doble integral (sobre la desviación estándar relativa s y sobre la desviación del control z) se resuelve numéricamente. Verificado con la tabla de valores críticos de Dunnett (p. ej. 3 comparaciones y 20 gl: valor crítico 2,54 ↔ p = 0,050). Supone varianzas iguales, por eso solo se usa con el ANOVA clásico; con Welch o Kruskal-Wallis, los pares usan Welch + Holm o Dunn + Holm.</p>
      </Sec>

      <Sec id="e9" n="9" t="Efecto global del medio: ANOVA de parcelas divididas (modelo mixto con la placa aleatoria)">
        <p>Cada placa tiene un solo medio y todas las cepas. Eso es un diseño de <b>parcelas divididas</b>: la «parcela grande» es la placa (lleva el medio) y la «subparcela» es cada cepa dentro de la placa. Hay dos errores distintos:</p>
        <Formula>{`Medio:        F = CM(medio) / CM(placas dentro de cada medio)      ← variación entre placas del mismo medio
Cepa:         F = CM(cepa) / CM(residual)                           ← variación dentro de la placa
Cepa × medio: F = CM(cepa × medio) / CM(residual)`}</Formula>
        <p>Las sumas de cuadrados se obtienen ajustando modelos anidados por mínimos cuadrados (QR de Householder) y restando sus RSS: medio = RSS(~1) − RSS(~medio); placas dentro de medio = RSS(~medio) − RSS(~placa); cepa = RSS(~placa) − RSS(~placa + cepa); interacción = RSS(~placa + cepa) − RSS(completo). Con datos balanceados equivale al modelo mixto con la placa como efecto aleatorio. Usa un valor por cepa y placa (réplica biológica) y exige al menos 3 placas, 2 medios y 2 cepas.</p>
        <p>Por qué importa: si el medio se probara contra el error de los pocillos, la significancia del medio estaría inflada, porque las placas de un medio difieren entre sí más de lo que difieren los pocillos de una placa.</p>
      </Sec>

      <Sec id="e9b" n="9b" t="Placas de distinto medio: modelo anidado y modelo placa × cepa">
        <p>Para una cepa con pocillos de placas en distintos medios se ajusta una jerarquía: medio → placa dentro del medio → pocillo.</p>
        <Formula>{`Medio:                F = CM(medio) / CM(placas dentro de medio)     gl: (m − 1; P − m)
Placas en el medio:   F = CM(placas dentro de medio) / CM(residual)   gl: (P − m; N − P)
m = medios, P = placas, N = pocillos.   SC medio = RSS(~1) − RSS(~medio);  SC placas = RSS(~medio) − RSS(~placa)`}</Formula>
        <p>Con todas las cepas se ajusta además <b>placa + cepa + cepa × placa</b> sobre los pocillos: la placa se prueba contra los pocillos; la cepa, contra cepa × placa (porque las placas son una muestra de las posibles); y cepa × placa, contra los pocillos. Un cepa × placa significativo indica que las cepas no conservan su orden o su magnitud entre placas.</p>
        <Formula>{`Cepa:         F = CM(cepa) / CM(cepa × placa)
Cepa × placa: F = CM(cepa × placa) / CM(residual)
SC cepa × placa = RSS(~placa + cepa) − RSS(~placa + cepa + cepa × placa)`}</Formula>
      </Sec>

      <Sec id="e10" n="10" t="Entre placas y concordancia (reproducibilidad)">
        <Formula>{`CV (%) = 100 · DE / media      (de las medias de cada placa)
Buena ≤ 20 %,  aceptable ≤ 30 %,  alta variabilidad > 30 %`}</Formula>
        <p>«Entre placas» prueba, para cada cepa y medio, si las placas difieren (grupos = placas, datos = pocillos). Un p &lt; 0,05 significa que la placa influye y el resultado no se repite igual.</p>
        <p>«Concordancia entre placas» usa el <b>ICC</b> (coeficiente de correlación intraclase, Shrout y Fleiss 1979; IC 95 % de McGraw y Wong 1996) sobre una matriz cepas × placas, con dos formas: ICC(3,1), consistencia (¿las placas ordenan igual a las cepas?) e ICC(2,1), acuerdo absoluto (además exige valores similares). Se calcula con los cuadrados medios de cepas (filas), de placas (columnas) y del error de un ANOVA de dos vías sin repetición:</p>
        <Formula>{`ICC(3,1) = (CMf − CMe) / (CMf + (k − 1) CMe)
ICC(2,1) = (CMf − CMe) / (CMf + (k − 1) CMe + k (CMc − CMe) / n)
< 0,5 pobre · 0,5–0,75 moderada · 0,75–0,9 buena · > 0,9 excelente`}</Formula>
        <p>También informa correlaciones de Pearson o Spearman entre pares de placas (Spearman si la normalidad falla).</p>
      </Sec>

      <Sec id="e11" n="11" t="Cómo leer los resultados con criterio">
        <ul>
          <li><b>El p no es la probabilidad de que H₀ sea cierta.</b> Es la probabilidad de ver una diferencia tan grande o mayor si H₀ fuera cierta. p &lt; 0,05: la diferencia es difícil de explicar por azar.</li>
          <li><b>Que no sea significativo no demuestra igualdad.</b> Con 2 o 3 placas por grupo el análisis solo detecta diferencias grandes (poco poder). Sumar placas ayuda más que sumar pocillos.</li>
          <li><b>Significativo no es lo mismo que importante.</b> Mirá las medias y la razón entre grupos (con ln, la diferencia es una razón).</li>
          <li>Si hay varias comparaciones, usá el p ajustado, no el p sin ajustar.</li>
          <li>Los supuestos se verifican, no se asumen: revisá Shapiro, Levene y el gráfico cuantil-cuantil; los pocillos extremos pueden dominar.</li>
        </ul>
        <p className="ayuda">Referencias: Shapiro y Wilk (1965); Royston (1995); Brown y Forsythe (1974); Welch (1951); Kruskal y Wallis (1952); Dunn (1964); Holm (1979); Dunnett (1955); Shrout y Fleiss (1979); McGraw y Wong (1996); Stepanović et al. (2000) para el ODc.</p>
      </Sec>
    </section>
  )
}
