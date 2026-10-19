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
  const aj = holm(filas.map((f) => f.p))
  return filas.map((f, i) => ({ ...f, pa: aj[i] }))
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
    filas: [
      fila('Medio', m0.rss - mM.rss, mM.rango - m0.rango, msPl, dfPl, 'placas dentro de cada medio'),
      { nombre: 'Placas dentro de cada medio (error entre placas)', ss: mM.rss - mP.rss, df: dfPl, ms: msPl, F: NaN, p: NaN, error: '' },
      fila('Cepa', mP.rss - mPC.rss, mPC.rango - mP.rango, msRes, dfRes, 'residual'),
      fila('Cepa × medio', mPC.rss - mF.rss, mF.rango - mPC.rango, msRes, dfRes, 'residual'),
      { nombre: 'Residual (cepa × placa)', ss: mF.rss, df: dfRes, ms: msRes, F: NaN, p: NaN, error: '' },
    ],
  }
}
