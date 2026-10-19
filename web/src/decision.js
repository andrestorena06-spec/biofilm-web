// ============================================================
// Pruebas de comparación con elección automática de la prueba:
//   normalidad de los residuos (Shapiro-Wilk) -> Kruskal-Wallis si no son normales
//   igualdad de varianzas (Levene, versión de Brown-Forsythe con la mediana) -> ANOVA de Welch si son distintas
//   en otro caso, ANOVA clásico
// Comparaciones de a pares con corrección de Holm: t con varianza común (ANOVA), t de Welch (Welch) o Dunn (Kruskal-Wallis).
// ============================================================
import { anovaTabla, desvio, holm, media, varianza, welch } from './estadistica.js'
import { fCdf, kruskal, pnorm, rangos, rssRango, shapiro, tSup2 } from './reproducibilidad.js'

const finito = Number.isFinite
const med = (v) => {
  const a = [...v].sort((x, y) => x - y)
  const n = a.length
  return n ? (n % 2 ? a[(n - 1) / 2] : (a[n / 2 - 1] + a[n / 2]) / 2) : NaN
}

// Prueba de Levene (Brown-Forsythe): ANOVA de una vía sobre |x − mediana del grupo|
// (con grupos de 2 datos las dos desviaciones respecto de la mediana son iguales y la prueba se degenera: se necesitan 3 o más por grupo)
export function levene(grupos) {
  const g = grupos.filter((v) => v.length >= 3)
  if (g.length < 2) return null
  const a = anovaTabla(g.map((v) => { const m = med(v); return v.map((x) => Math.abs(x - m)) }))
  return a ? { F: a.F, df1: a.df1, df2: a.df2, p: a.p, k: g.length, razonSD: razonSD(g) } : null
}
// cociente entre la mayor y la menor DE (regla práctica: ≤ 2)
export function razonSD(grupos) {
  const sd = grupos.filter((v) => v.length >= 2).map(desvio).filter((x) => finito(x))
  const mx = Math.max(...sd), mn = Math.min(...sd)
  return sd.length > 1 ? (mn > 0 ? mx / mn : Infinity) : NaN
}

// ANOVA de Welch (no asume varianzas iguales)
export function welchAnova(grupos) {
  const g = grupos.filter((v) => v.length >= 2)
  const k = g.length
  if (k < 2 || g.some((v) => !(varianza(v) > 0))) return null
  const n = g.map((v) => v.length), m = g.map(media), s2 = g.map(varianza)
  const w = n.map((ni, i) => ni / s2[i])
  const W = w.reduce((a, b) => a + b, 0)
  const mw = w.reduce((a, wi, i) => a + wi * m[i], 0) / W
  const A = w.reduce((a, wi, i) => a + wi * (m[i] - mw) ** 2, 0) / (k - 1)
  const lam = w.reduce((a, wi, i) => a + (1 - wi / W) ** 2 / (n[i] - 1), 0)
  const B = 1 + ((2 * (k - 2)) / (k * k - 1)) * lam
  const F = A / B
  const df1 = k - 1, df2 = (k * k - 1) / (3 * lam)
  return { F, df1, df2, p: 1 - fCdf(F, df1, df2) }
}

// Comparaciones de a pares. grupos: [{ nombre, v }]; ctrl: nombre del control o null (todos los pares)
export function pares(grupos, tipo, ctrl) {
  const g = grupos.filter((x) => x.v.length > 0)
  const lista = []
  for (let i = 0; i < g.length; i++) for (let j = i + 1; j < g.length; j++) {
    if (ctrl && g[i].nombre !== ctrl && g[j].nombre !== ctrl) continue
    // con control, el control va siempre como B
    lista.push(ctrl && g[i].nombre === ctrl ? [g[j], g[i]] : [g[i], g[j]])
  }
  let mse = NaN, dfe = NaN, ranks = null
  if (tipo === 'anova') { const a = anovaTabla(g.map((x) => x.v)); if (a) { mse = a.msw; dfe = a.df2 } }
  if (tipo === 'kw') {
    const todos = g.flatMap((x) => x.v)
    const r = rangos(todos)
    let pos = 0
    ranks = {}
    g.forEach((x) => { ranks[x.nombre] = r.slice(pos, pos + x.v.length).reduce((a, b) => a + b, 0) / x.v.length; pos += x.v.length })
    ranks.N = todos.length
  }
  const filas = lista.map(([a, b]) => {
    const dif = media(a.v) - media(b.v)
    let est = NaN, df = NaN, p = NaN
    if (tipo === 'anova' && finito(mse) && mse > 0) {
      est = dif / Math.sqrt(mse * (1 / a.v.length + 1 / b.v.length)); df = dfe; p = tSup2(Math.abs(est), df)
    } else if (tipo === 'welch' || (tipo === 'anova' && !(mse > 0))) {
      const w = welch(a.v, b.v)
      if (w) { est = w.t; df = w.df; p = w.p }
    } else if (tipo === 'kw' && ranks) {
      est = (ranks[a.nombre] - ranks[b.nombre]) / Math.sqrt(((ranks.N * (ranks.N + 1)) / 12) * (1 / a.v.length + 1 / b.v.length))
      p = 2 * (1 - pnorm(Math.abs(est)))
    }
    return { a: a.nombre, b: b.nombre, ma: media(a.v), mb: media(b.v), dif, est, df, p }
  })
  // contra un control con ANOVA clásico: prueba de Dunnett (p ajustado exacto); en los demás casos, Holm
  const usaDunnett = !!ctrl && tipo === 'anova' && mse > 0 && finito(dfe) && lista.length > 0
  if (usaDunnett) {
    const lam = lista.map(([a, b]) => Math.sqrt(a.v.length / (a.v.length + b.v.length)))
    return filas.map((f) => ({ ...f, pa: finito(f.est) ? dunnettP(Math.abs(f.est), lam, dfe) : NaN, metodo: 'Dunnett' }))
  }
  const aj = holm(filas.map((f) => f.p))
  return filas.map((f, i) => ({ ...f, pa: aj[i], metodo: 'Holm' }))
}

// letras de significancia (grupos con la misma letra no difieren): insertar y absorber
export function letras(grupos, filas) {
  const nombres = [...grupos].sort((x, y) => media(y.v) - media(x.v)).map((x) => x.nombre)
  const sig = new Set(filas.filter((f) => finito(f.pa) && f.pa < 0.05).map((f) => [f.a, f.b].sort().join('||')))
  let conj = [new Set(nombres.map((_, i) => i))]
  for (let i = 0; i < nombres.length; i++) for (let j = i + 1; j < nombres.length; j++) {
    if (!sig.has([nombres[i], nombres[j]].sort().join('||'))) continue
    const nuevo = []
    conj.forEach((c) => {
      if (c.has(i) && c.has(j)) { const a = new Set(c); a.delete(j); const b = new Set(c); b.delete(i); nuevo.push(a, b) } else nuevo.push(c)
    })
    conj = nuevo.filter((c, x) => c.size && !nuevo.some((d, y) => y !== x && d.size >= c.size && [...c].every((e) => d.has(e)) && (d.size > c.size || y < x)))
  }
  conj.sort((a, b) => Math.min(...a) - Math.min(...b))
  const L = 'abcdefghijklmnopqrstuvwxyz'
  const out = {}
  nombres.forEach((n, i) => { out[n] = conj.map((c, k) => (c.has(i) ? L[k] : '')).join('') })
  return out
}

// Elige la prueba y la ejecuta. forzado: 'auto' | 'anova' | 'welch' | 'kw'
export function analizar(grupos, forzado = 'auto', ctrl = null) {
  const g = grupos.filter((x) => x.v.length > 0)
  const vs = g.map((x) => x.v)
  const N = vs.reduce((a, v) => a + v.length, 0)
  if (g.length < 2 || N - g.length < 1) return { ok: false, grupos: g, motivo: g.length < 2 ? 'Hace falta más de un grupo con datos.' : 'Hacen falta más datos que grupos (al menos un grupo con 2 o más datos).' }
  const resid = vs.flatMap((v) => { const m = media(v); return v.map((x) => x - m) })
  // con menos de 8 datos Shapiro-Wilk casi no tiene poder: no se usa para decidir
  const sw = resid.length >= 3 && resid.some((x) => x !== 0) ? shapiro(resid) : null
  const swUtil = !!sw && resid.length >= 8
  const nMin = Math.min(...vs.map((v) => v.length))
  const lev = levene(vs)
  let tipo = forzado, razon = 'Elegida por vos.'
  const puedeWelch = vs.every((v) => v.length >= 2) && vs.every((v) => varianza(v) > 0)
  if (forzado === 'auto') {
    if (swUtil && sw.p < 0.05 && nMin >= 3) { tipo = 'kw'; razon = `Los residuos no son normales (Shapiro-Wilk p = ${sw.p.toFixed(3)}, con ${resid.length} datos): Kruskal-Wallis, que compara rangos y no asume normalidad.` }
    else if (lev && lev.p < 0.05) { tipo = 'welch'; razon = `Varianzas distintas (Levene p = ${lev.p.toFixed(3)}): ANOVA de Welch, que no asume varianzas iguales.` }
    else if (lev) { tipo = 'anova'; razon = `Varianzas parecidas (Levene p = ${lev.p.toFixed(3)}) y residuos sin evidencia de no normalidad: ANOVA clásico.` }
    else { tipo = 'welch'; razon = 'Con tan pocas réplicas (menos de 3 por grupo) no se pueden comparar las varianzas con Levene: se usa el ANOVA de Welch, que no asume varianzas iguales. Tomalo con cautela.' }
  }
  if (tipo === 'welch' && !puedeWelch) { tipo = 'anova'; razon += ' (Welch necesita 2 o más datos y variación en cada grupo: se usó el ANOVA clásico.)' }
  let global = null
  if (tipo === 'anova') { const a = anovaTabla(vs); global = a && { nombre: 'ANOVA de una vía', est: 'F', valor: a.F, df1: a.df1, df2: a.df2, p: a.p, tabla: a } }
  else if (tipo === 'welch') { const a = welchAnova(vs); global = a && { nombre: 'ANOVA de Welch', est: 'F', valor: a.F, df1: a.df1, df2: a.df2, p: a.p } }
  else { const a = kruskal(vs); global = a && { nombre: 'Kruskal-Wallis', est: 'H', valor: a.H, df1: a.df, df2: null, p: a.p } }
  if (!global) return { ok: false, grupos: g, motivo: 'No se pudo calcular la prueba con estos datos.' }
  const pr = pares(g, tipo, ctrl)
  return { ok: true, tipo, razon, sw, lev, global, grupos: g, pares: pr, letras: ctrl ? null : letras(g, pr), razonSD: razonSD(vs) }
}

// ANOVA de parcelas divididas (la placa como bloque aleatorio). Cada placa tiene un solo medio (se compara entre placas) y
// todas las cepas (se compara dentro de cada placa). obs: [{ cepa, medio, placa, y }] con un valor por cepa y placa.
//   medio: SC(medio) contra la variación entre placas del mismo medio
//   cepa y cepa × medio: contra la variación dentro de las placas
export function parcelasDivididas(obs) {
  const d = obs.filter((x) => finito(x.y))
  const placas = [...new Set(d.map((x) => x.placa))], medios = [...new Set(d.map((x) => x.medio))], cepas = [...new Set(d.map((x) => x.cepa))]
  if (placas.length < 3 || medios.length < 2 || cepas.length < 2) return null
  const y = d.map((x) => x.y)
  const dum = (lista, key) => (x) => lista.slice(1).map((v) => (x[key] === v ? 1 : 0))
  const dP = dum(placas, 'placa'), dM = dum(medios, 'medio'), dC = dum(cepas, 'cepa')
  const dCM = (x) => dC(x).flatMap((u) => dM(x).map((w) => u * w))
  const M = (fs) => d.map((x) => [1, ...fs.flatMap((f) => f(x))])
  const m0 = rssRango(M([]), y), mM = rssRango(M([dM]), y), mP = rssRango(M([dP]), y), mPC = rssRango(M([dP, dC]), y), mF = rssRango(M([dP, dC, dCM]), y)
  const dfRes = d.length - mF.rango
  const dfPl = mP.rango - mM.rango
  if (dfRes < 1) return null
  const msRes = mF.rss / dfRes
  const fila = (nombre, ss, df, msError, dfError, errorTxt) => {
    const ms = df > 0 ? ss / df : NaN
    const F = df > 0 && msError > 0 ? ms / msError : NaN
    return { nombre, ss, df, ms, F, p: finito(F) ? 1 - fCdf(F, df, dfError) : NaN, error: errorTxt }
  }
  const msPl = dfPl > 0 ? (mM.rss - mP.rss) / dfPl : NaN
  return {
    n: d.length, placas: placas.length, medios: medios.length, cepas: cepas.length,
    modelos: [
      { nombre: 'OD ~ 1 (solo la media general)', rss: m0.rss, rango: m0.rango },
      { nombre: 'OD ~ medio', rss: mM.rss, rango: mM.rango },
      { nombre: 'OD ~ placa (incluye al medio)', rss: mP.rss, rango: mP.rango },
      { nombre: 'OD ~ placa + cepa', rss: mPC.rss, rango: mPC.rango },
      { nombre: 'OD ~ placa + cepa + cepa × medio', rss: mF.rss, rango: mF.rango },
    ],
    filas: [
      fila('Medio', m0.rss - mM.rss, mM.rango - m0.rango, msPl, dfPl, 'placas dentro de cada medio'),
      { nombre: 'Placas dentro de cada medio (error entre placas)', ss: mM.rss - mP.rss, df: dfPl, ms: msPl, F: NaN, p: NaN, error: '' },
      fila('Cepa', mP.rss - mPC.rss, mPC.rango - mP.rango, msRes, dfRes, 'residual'),
      fila('Cepa × medio', mPC.rss - mF.rss, mF.rango - mPC.rango, msRes, dfRes, 'residual'),
      { nombre: 'Residual (cepa × placa)', ss: mF.rss, df: dfRes, ms: msRes, F: NaN, p: NaN, error: '' },
    ],
  }
}

// ============================================================
// Prueba de Dunnett: cada grupo contra un control, con p ajustado exacto por la distribución t multivariada.
// Supone varianza común (ANOVA clásico). Con T_i = (media_i − media_control) / (s · √(1/n_i + 1/n_c)), las T_i se correlacionan
// por el control; condicionando en la desviación del control (z) y en s son independientes, y se integra numéricamente.
// ============================================================
const erfcFast = (z) => {   // erfc de Numerical Recipes (error relativo < 1.2e-7)
  const a = Math.abs(z), t = 1 / (1 + 0.5 * a)
  const r = t * Math.exp(-a * a - 1.26551223 + t * (1.00002368 + t * (0.37409196 + t * (0.09678418 + t * (-0.18628806 + t * (0.27886807 + t * (-1.13520398 + t * (1.48851587 + t * (-0.82215223 + t * 0.17087277)))))))))
  return z >= 0 ? r : 2 - r
}
const Phi = (x) => 0.5 * erfcFast(-x / Math.SQRT2)
const lgam = (z) => {
  const c = [0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313, -176.61502916214059, 12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7]
  if (z < 0.5) return Math.log(Math.PI / Math.sin(Math.PI * z)) - lgam(1 - z)
  z -= 1
  let x = c[0]
  for (let i = 1; i < 9; i++) x += c[i] / (z + i)
  const t = z + 7.5
  return 0.5 * Math.log(2 * Math.PI) + (z + 0.5) * Math.log(t) - t + Math.log(x)
}
// P(max_i |T_i| ≥ d) con λ_i = √(n_i / (n_i + n_c)) y df grados de libertad del error
const cacheDunnett = new Map()
export function dunnettP(d, lam, df) {
  const k = d.toFixed(6) + '|' + lam.map((x) => x.toFixed(5)).join(',') + '|' + df.toFixed(4)
  if (!cacheDunnett.has(k)) { if (cacheDunnett.size > 5000) cacheDunnett.clear(); cacheDunnett.set(k, dunnettCalc(d, lam, df)) }
  return cacheDunnett.get(k)
}
function dunnettCalc(d, lam, df) {
  if (!(d >= 0) || !lam.length) return NaN
  const a = lam.map((l) => Math.sqrt(Math.max(1 - l * l, 1e-12)))
  // nodos de s = χ/√ν (distribución de la desviación estándar relativa)
  const sNodos = []
  if (df > 2000) sNodos.push([1, 1])
  else {
    const sd = 1 / Math.sqrt(2 * df)
    const lo = Math.max(0.005, 1 - 8 * sd), hi = 1 + 9 * sd
    const N = 96, h = (hi - lo) / N
    const logC = Math.log(2) + (df / 2) * Math.log(df / 2) - lgam(df / 2)
    let tot = 0
    for (let i = 0; i <= N; i++) {
      const s = lo + i * h
      const w = (i === 0 || i === N ? 1 : i % 2 ? 4 : 2) * Math.exp(logC + (df - 1) * Math.log(s) - (df * s * s) / 2)
      sNodos.push([s, w]); tot += w
    }
    sNodos.forEach((x) => { x[1] /= tot })
  }
  const M = 80, zl = -7, zh = 7, hz = (zh - zl) / M
  let total = 0
  for (const [s, ws] of sNodos) {
    const c = d * s
    let acc = 0
    for (let j = 0; j <= M; j++) {
      const z = zl + j * hz
      let prod = 1
      for (let i = 0; i < lam.length; i++) {
        const u = (c + lam[i] * z) / a[i], v = (-c + lam[i] * z) / a[i]
        prod *= Phi(u) - Phi(v)
        if (prod < 1e-14) break
      }
      acc += (j === 0 || j === M ? 1 : j % 2 ? 4 : 2) * Math.exp(-z * z / 2) * prod
    }
    total += ws * acc * (hz / 3) / Math.sqrt(2 * Math.PI)
  }
  return Math.min(1, Math.max(0, 1 - total))
}

// ============================================================
// Placas con distinto medio (variante cruzada)
// ============================================================
const colDum = (lista, key) => (x) => lista.slice(1).map((v) => (x[key] === v ? 1 : 0))
const filaF = (nombre, ss, df, msError, dfError, errorTxt) => {
  const ms = df > 0 ? ss / df : NaN
  const F = df > 0 && msError > 0 ? ms / msError : NaN
  return { nombre, ss, df, ms, F, p: finito(F) && dfError > 0 ? 1 - fCdf(F, df, dfError) : NaN, error: errorTxt }
}

// Una cepa, pocillos de todas las placas: medio y placa anidada en el medio (cada placa lleva un solo medio).
//   medio             → se prueba contra la variación entre placas del mismo medio
//   placa (en medio)  → se prueba contra la variación entre pocillos de la misma placa
export function anidada(obs) {
  const d = obs.filter((x) => finito(x.y))
  const placas = [...new Set(d.map((x) => x.placa))], medios = [...new Set(d.map((x) => x.medio))]
  if (placas.length < 3 || medios.length < 2) return null
  const y = d.map((x) => x.y)
  const dP = colDum(placas, 'placa'), dM = colDum(medios, 'medio')
  const M = (fs) => d.map((x) => [1, ...fs.flatMap((f) => f(x))])
  const m0 = rssRango(M([]), y), mM = rssRango(M([dM]), y), mP = rssRango(M([dP]), y)
  const dfRes = d.length - mP.rango, dfPl = mP.rango - mM.rango
  if (dfRes < 1 || dfPl < 1) return null
  const msRes = mP.rss / dfRes, msPl = (mM.rss - mP.rss) / dfPl
  return {
    n: d.length, placas: placas.length, medios: medios.length,
    modelos: [
      { nombre: 'OD ~ 1 (solo la media general)', rss: m0.rss, rango: m0.rango },
      { nombre: 'OD ~ medio', rss: mM.rss, rango: mM.rango },
      { nombre: 'OD ~ placa (cada placa dentro de su medio)', rss: mP.rss, rango: mP.rango },
    ],
    filas: [
      filaF('Medio', m0.rss - mM.rss, mM.rango - m0.rango, msPl, dfPl, 'placas dentro de cada medio'),
      filaF('Placas dentro de cada medio', mM.rss - mP.rss, dfPl, msRes, dfRes, 'pocillos dentro de la placa'),
      { nombre: 'Residual (pocillos dentro de la placa)', ss: mP.rss, df: dfRes, ms: msRes, F: NaN, p: NaN, error: '' },
    ],
  }
}

// Todas las cepas, pocillos de todas las placas: ¿difieren las placas?, ¿difieren las cepas?, ¿el orden de las cepas cambia entre placas?
//   placa → contra el residual (pocillos); cepa → contra cepa × placa (las placas son una muestra de las posibles); cepa × placa → contra el residual
export function placaCepa(obs) {
  const d = obs.filter((x) => finito(x.y))
  const placas = [...new Set(d.map((x) => x.placa))], cepas = [...new Set(d.map((x) => x.cepa))]
  if (placas.length < 2 || cepas.length < 2) return null
  const y = d.map((x) => x.y)
  const dP = colDum(placas, 'placa'), dC = colDum(cepas, 'cepa')
  const dPC = (x) => dP(x).flatMap((u) => dC(x).map((w) => u * w))
  const M = (fs) => d.map((x) => [1, ...fs.flatMap((f) => f(x))])
  const m0 = rssRango(M([]), y), mP = rssRango(M([dP]), y), mPC = rssRango(M([dP, dC]), y), mF = rssRango(M([dP, dC, dPC]), y)
  const dfRes = d.length - mF.rango
  if (dfRes < 1) return null
  const msRes = mF.rss / dfRes
  const dfInt = mF.rango - mPC.rango, ssInt = mPC.rss - mF.rss
  const msInt = dfInt > 0 ? ssInt / dfInt : NaN
  return {
    n: d.length, placas: placas.length, cepas: cepas.length,
    modelos: [
      { nombre: 'OD ~ 1 (solo la media general)', rss: m0.rss, rango: m0.rango },
      { nombre: 'OD ~ placa', rss: mP.rss, rango: mP.rango },
      { nombre: 'OD ~ placa + cepa', rss: mPC.rss, rango: mPC.rango },
      { nombre: 'OD ~ placa + cepa + cepa × placa', rss: mF.rss, rango: mF.rango },
    ],
    filas: [
      filaF('Placa', m0.rss - mP.rss, mP.rango - m0.rango, msRes, dfRes, 'residual (pocillos)'),
      filaF('Cepa', mP.rss - mPC.rss, mPC.rango - mP.rango, msInt, dfInt, 'cepa × placa'),
      filaF('Cepa × placa', ssInt, dfInt, msRes, dfRes, 'residual (pocillos)'),
      { nombre: 'Residual (pocillos)', ss: mF.rss, df: dfRes, ms: msRes, F: NaN, p: NaN, error: '' },
    ],
  }
}
