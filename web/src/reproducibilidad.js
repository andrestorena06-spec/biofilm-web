// ============================================================
// Reproducibilidad entre experimentos (cada placa es una repetición independiente del experimento).
//   1. Variabilidad: media, DE y CV % de cada cepa entre experimentos (un valor por placa).
//   2. ¿Difieren los experimentos? ANOVA de una vía por cepa (factor: experimento, datos: pocillos), con
//      Shapiro-Wilk de los residuos y Kruskal-Wallis como alternativa; ANOVA de dos vías cepa × experimento (tipo II).
//   3. Correlación entre pares de experimentos (Pearson y Spearman) con la media de cada cepa.
//   4. Concordancia global: ICC(2,1) de acuerdo absoluto e ICC(3,1) de consistencia (Shrout y Fleiss), IC 95 %.
// Equivalentes: aov / car::Anova(type = 2), shapiro.test, kruskal.test, cor.test, psych::ICC / pingouin.
// ============================================================
import { betaInc } from './utils.js'
import { anova1, desvio, media } from './estadistica.js'

const finito = Number.isFinite

// ---------- distribuciones ----------
function lgamma(z) {
  const c = [0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313, -176.61502916214059, 12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7]
  if (z < 0.5) return Math.log(Math.PI / Math.sin(Math.PI * z)) - lgamma(1 - z)
  z -= 1
  let x = c[0]
  for (let i = 1; i < 9; i++) x += c[i] / (z + i)
  const t = z + 7.5
  return 0.5 * Math.log(2 * Math.PI) + (z + 0.5) * Math.log(t) - t + Math.log(x)
}
// gamma incompleta regularizada P(a, x)
function gammaP(a, x) {
  if (x <= 0) return 0
  if (x < a + 1) {
    let sum = 1 / a, term = sum, n = a
    for (let i = 0; i < 2000; i++) { n++; term *= x / n; sum += term; if (Math.abs(term) < Math.abs(sum) * 1e-16) break }
    return sum * Math.exp(-x + a * Math.log(x) - lgamma(a))
  }
  let b = x + 1 - a, c = 1e300, d = 1 / b, h = d
  for (let i = 1; i < 2000; i++) {
    const an = -i * (i - a)
    b += 2; d = an * d + b; if (Math.abs(d) < 1e-300) d = 1e-300
    c = b + an / c; if (Math.abs(c) < 1e-300) c = 1e-300
    d = 1 / d
    const del = d * c
    h *= del
    if (Math.abs(del - 1) < 1e-16) break
  }
  return 1 - Math.exp(-x + a * Math.log(x) - lgamma(a)) * h
}
export const chi2Sup = (x, df) => (x <= 0 ? 1 : 1 - gammaP(df / 2, x / 2))
// normal estándar: P(Z <= z) a partir de la gamma incompleta (precisión de máquina)
export const pnorm = (z) => (z >= 0 ? 0.5 + 0.5 * gammaP(0.5, (z * z) / 2) : 0.5 - 0.5 * gammaP(0.5, (z * z) / 2))
// cuantil de la normal estándar (Wichura, AS 241)
export function qnorm(p) {
  const q = p - 0.5
  if (Math.abs(q) <= 0.425) {
    const r = 0.180625 - q * q
    return q * (((((((r * 2509.0809287301226727 + 33430.575583588128105) * r + 67265.770927008700853) * r + 45921.953931549871457) * r + 13731.693765509461125) * r + 1971.5909503065514427) * r + 133.14166789178437745) * r + 3.387132872796366608)
      / (((((((r * 5226.495278852545925 + 28729.085735721942674) * r + 39307.89580009271061) * r + 21213.794301586595867) * r + 5394.1960214247511077) * r + 687.1870074920579083) * r + 42.313330701600911252) * r + 1)
  }
  let r = q < 0 ? p : 1 - p
  r = Math.sqrt(-Math.log(r))
  let v
  if (r <= 5) {
    r -= 1.6
    v = (((((((r * 7.7454501427834140764e-4 + 0.0227238449892691845833) * r + 0.24178072517745061177) * r + 1.27045825245236838258) * r + 3.64784832476320460504) * r + 5.7694972214606914055) * r + 4.6303378461565452959) * r + 1.42343711074968357734)
      / (((((((r * 1.05075007164441684324e-9 + 5.475938084995344946e-4) * r + 0.0151986665636164571966) * r + 0.14810397642748007459) * r + 0.68976733498510000455) * r + 1.6763848301838038494) * r + 2.05319162663775882187) * r + 1)
  } else {
    r -= 5
    v = (((((((r * 2.01033439929228813265e-7 + 2.71155556874348757815e-5) * r + 0.0012426609473880784386) * r + 0.026532189526576123093) * r + 0.29656057182850489123) * r + 1.7848265399172913358) * r + 5.4637849111641143699) * r + 6.6579046435011037772)
      / (((((((r * 2.04426310338993978564e-15 + 1.4215117583164458887e-7) * r + 1.8463183175100546818e-5) * r + 7.868691311456132591e-4) * r + 0.0148753612908506148525) * r + 0.13692988092273580531) * r + 0.59983220655588793769) * r + 1)
  }
  return q < 0 ? -v : v
}
export const fCdf = (F, d1, d2) => (F <= 0 ? 0 : betaInc((d1 * F) / (d1 * F + d2), d1 / 2, d2 / 2))
export const tSup2 = (t, df) => betaInc(df / (df + t * t), df / 2, 0.5)   // p bilateral de la t de Student
export function fCuantil(p, d1, d2) {
  let lo = 0, hi = 1
  while (fCdf(hi, d1, d2) < p && hi < 1e12) hi *= 2
  for (let i = 0; i < 200; i++) { const m = (lo + hi) / 2; if (fCdf(m, d1, d2) < p) lo = m; else hi = m }
  return (lo + hi) / 2
}

// ---------- rangos (empates: rango medio) ----------
export function rangos(v) {
  const o = v.map((x, i) => [x, i]).sort((a, b) => a[0] - b[0])
  const r = new Array(v.length)
  for (let i = 0; i < o.length;) {
    let j = i
    while (j + 1 < o.length && o[j + 1][0] === o[i][0]) j++
    for (let k = i; k <= j; k++) r[o[k][1]] = (i + j) / 2 + 1
    i = j + 1
  }
  return r
}

// ---------- Shapiro-Wilk (Royston 1995, algoritmo AS R94; igual que shapiro.test de R) ----------
const poly = (cc, x) => { let p = 0; for (let j = cc.length - 1; j >= 1; j--) p = (p + cc[j]) * x; return cc[0] + p }
export function shapiro(xIn) {
  const x = xIn.filter(finito).sort((a, b) => a - b)
  const n = x.length
  if (n < 3 || n > 5000) return null
  if (x[n - 1] - x[0] < 1e-12) return null
  const n2 = Math.floor(n / 2)
  const a = new Array(n2)
  if (n === 3) a[0] = Math.SQRT1_2
  else {
    const an25 = n + 0.25
    const m = []
    let summ2 = 0
    for (let i = 1; i <= n2; i++) { m.push(qnorm((i - 0.375) / an25)); summ2 += m[i - 1] ** 2 }
    summ2 *= 2
    const ssumm2 = Math.sqrt(summ2), rsn = 1 / Math.sqrt(n)
    const a1 = poly([0, 0.221157, -0.147981, -2.07119, 4.434685, -2.706056], rsn) - m[0] / ssumm2
    let i1, fac
    if (n > 5) {
      i1 = 3
      const a2 = -m[1] / ssumm2 + poly([0, 0.042981, -0.293762, -1.752461, 5.682633, -3.582633], rsn)
      fac = Math.sqrt((summ2 - 2 * m[0] ** 2 - 2 * m[1] ** 2) / (1 - 2 * a1 ** 2 - 2 * a2 ** 2))
      a[1] = a2
    } else {
      i1 = 2
      fac = Math.sqrt((summ2 - 2 * m[0] ** 2) / (1 - 2 * a1 ** 2))
    }
    a[0] = a1
    for (let i = i1; i <= n2; i++) a[i - 1] = -m[i - 1] / fac
  }
  // a[i] es negativo para la mitad inferior: W = (Σ a_i (x_(n+1-i) − x_(i)))² / Σ (x − x̄)²
  const mx = media(x)
  const ssq = x.reduce((s, v) => s + (v - mx) ** 2, 0)
  let num = 0
  for (let i = 0; i < n2; i++) num += Math.abs(a[i]) * (x[n - 1 - i] - x[i])
  let W = (num * num) / ssq
  if (W > 1) W = 1
  let p
  if (n === 3) {
    p = Math.max(0, 1.90985931710274 * (Math.asin(Math.sqrt(W)) - 1.04719755119660))
  } else {
    const w1 = Math.log(1 - W)
    if (n <= 11) {
      const gamma = poly([-2.273, 0.459], n)
      if (w1 >= gamma) p = 1e-99
      else {
        const y = -Math.log(gamma - w1)
        const mu = poly([0.544, -0.39978, 0.025054, -6.714e-4], n), sd = Math.exp(poly([1.3822, -0.77857, 0.062767, -0.0020322], n))
        p = 1 - pnorm((y - mu) / sd)
      }
    } else {
      const ln = Math.log(n)
      const mu = poly([-1.5861, -0.31082, -0.083751, 0.0038915], ln), sd = Math.exp(poly([-0.4803, -0.082676, 0.0030302], ln))
      p = 1 - pnorm((w1 - mu) / sd)
    }
  }
  return { W, p, n }
}

// ---------- Kruskal-Wallis (con corrección por empates; igual que kruskal.test) ----------
export function kruskal(grupos) {
  const g = grupos.map((v) => v.filter(finito)).filter((v) => v.length)
  const k = g.length
  if (k < 2) return null
  const todos = g.flat()
  const N = todos.length
  if (N <= k) return null
  const r = rangos(todos)
  let pos = 0, H = 0
  g.forEach((v) => { const R = r.slice(pos, pos + v.length).reduce((s, x) => s + x, 0); H += (R * R) / v.length; pos += v.length })
  H = (12 / (N * (N + 1))) * H - 3 * (N + 1)
  const cuenta = {}
  todos.forEach((x) => { cuenta[x] = (cuenta[x] || 0) + 1 })
  const corr = 1 - Object.values(cuenta).reduce((s, t) => s + t ** 3 - t, 0) / (N ** 3 - N)
  if (corr <= 0) return null
  H /= corr
  return { H, df: k - 1, p: chi2Sup(H, k - 1) }
}

// ---------- correlación ----------
export function pearson(x, y) {
  const n = x.length
  if (n < 3) return null
  const mx = media(x), my = media(y)
  let sxy = 0, sxx = 0, syy = 0
  for (let i = 0; i < n; i++) { sxy += (x[i] - mx) * (y[i] - my); sxx += (x[i] - mx) ** 2; syy += (y[i] - my) ** 2 }
  if (sxx === 0 || syy === 0) return null
  const r = Math.max(-1, Math.min(1, sxy / Math.sqrt(sxx * syy)))
  const df = n - 2
  const p = Math.abs(r) >= 1 ? 0 : df > 0 ? tSup2(r * Math.sqrt(df / (1 - r * r)), df) : NaN
  return { r, p, n }
}
// Spearman: Pearson sobre los rangos, p con la aproximación t (como scipy y cor.test con exact = FALSE)
export const spearman = (x, y) => pearson(rangos(x), rangos(y))

// ---------- ICC (Shrout y Fleiss 1979; IC 95 % de McGraw y Wong 1996) ----------
// Y: matriz de n filas (cepas) × k columnas (experimentos), sin huecos
export function icc(Y) {
  const n = Y.length, k = n ? Y[0].length : 0
  if (n < 2 || k < 2) return null
  const gm = media(Y.flat())
  const fm = Y.map((f) => media(f))
  const cm = Array.from({ length: k }, (_, j) => media(Y.map((f) => f[j])))
  const ssr = k * fm.reduce((s, v) => s + (v - gm) ** 2, 0)
  const ssc = n * cm.reduce((s, v) => s + (v - gm) ** 2, 0)
  const sst = Y.flat().reduce((s, v) => s + (v - gm) ** 2, 0)
  const sse = sst - ssr - ssc
  const dfr = n - 1, dfc = k - 1, dfe = (n - 1) * (k - 1)
  const msr = ssr / dfr, msc = ssc / dfc, mse = sse / dfe
  if (!(mse > 0)) return null
  const F = msr / mse
  const pF = 1 - fCdf(F, dfr, dfe)
  // ICC(3,1): consistencia
  const icc3 = (msr - mse) / (msr + (k - 1) * mse)
  const fl3 = F / fCuantil(0.975, dfr, dfe), fu3 = F * fCuantil(0.975, dfe, dfr)
  // ICC(2,1): acuerdo absoluto
  const icc2 = (msr - mse) / (msr + (k - 1) * mse + (k * (msc - mse)) / n)
  const a = (k * icc2) / (n * (1 - icc2)), b = 1 + (k * icc2 * (n - 1)) / (n * (1 - icc2))
  const v = (a * msc + b * mse) ** 2 / ((a * msc) ** 2 / (k - 1) + (b * mse) ** 2 / ((n - 1) * (k - 1)))
  const f2u = fCuantil(0.975, n - 1, v), f2l = fCuantil(0.975, v, n - 1)
  const lo2 = (n * (msr - f2u * mse)) / (f2u * (k * msc + (k * n - k - n) * mse) + n * msr)
  const hi2 = (n * (f2l * msr - mse)) / (k * msc + (k * n - k - n) * mse + n * f2l * msr)
  return {
    n, k, msr, msc, mse, F, df1: dfr, df2: dfe, p: pF,
    icc2, ic2: [lo2, hi2], icc3, ic3: [(fl3 - 1) / (fl3 + k - 1), (fu3 - 1) / (fu3 + k - 1)],
  }
}
export const nivelIcc = (x) => (!finito(x) ? '' : x < 0.5 ? 'Pobre' : x < 0.75 ? 'Moderada' : x < 0.9 ? 'Buena' : 'Excelente')

// ---------- mínimos cuadrados (QR de Householder con detección de columnas redundantes) ----------
export function rssRango(X, y) {
  const n = X.length, p = X[0].length
  const A = X.map((f) => [...f])
  const b = [...y]
  let rango = 0
  for (let j = 0; j < p && rango < n; j++) {
    let norma = 0
    for (let i = rango; i < n; i++) norma += A[i][j] ** 2
    norma = Math.sqrt(norma)
    let colNorma = 0
    for (let i = 0; i < n; i++) colNorma += A[i][j] ** 2
    if (norma <= 1e-9 * Math.max(1, Math.sqrt(colNorma))) continue   // columna redundante (combinación de las anteriores)
    const alfa = A[rango][j] > 0 ? -norma : norma
    const v = new Array(n).fill(0)
    for (let i = rango; i < n; i++) v[i] = A[i][j]
    v[rango] -= alfa
    const vv = v.reduce((s, x) => s + x * x, 0)
    if (vv > 0) {
      for (let c = j; c < p; c++) {
        let s = 0
        for (let i = rango; i < n; i++) s += v[i] * A[i][c]
        const f = (2 * s) / vv
        for (let i = rango; i < n; i++) A[i][c] -= f * v[i]
      }
      let s = 0
      for (let i = rango; i < n; i++) s += v[i] * b[i]
      const f = (2 * s) / vv
      for (let i = rango; i < n; i++) b[i] -= f * v[i]
    }
    // la columna j queda resuelta en la fila «rango»; las demás filas de esa columna son cero
    rango++
  }
  let rss = 0
  for (let i = rango; i < n; i++) rss += b[i] ** 2
  return { rss, rango }
}

// ANOVA de dos vías con interacción, sumas de cuadrados tipo II (igual que car::Anova(lm(y ~ A * B), type = 2))
// datos: [{ y, a, b }]
export function anova2(datos) {
  const d = datos.filter((x) => finito(x.y))
  const na = [...new Set(d.map((x) => x.a))], nb = [...new Set(d.map((x) => x.b))]
  if (na.length < 2 || nb.length < 2) return null
  const y = d.map((x) => x.y)
  const da = (x) => na.slice(1).map((v) => (x.a === v ? 1 : 0))
  const db = (x) => nb.slice(1).map((v) => (x.b === v ? 1 : 0))
  const dab = (x) => { const A = da(x), B = db(x); return A.flatMap((u) => B.map((w) => u * w)) }
  const M = (fs) => d.map((x) => [1, ...fs.flatMap((f) => f(x))])
  const mA = rssRango(M([da]), y), mB = rssRango(M([db]), y), mAB = rssRango(M([da, db]), y), mI = rssRango(M([da, db, dab]), y)
  const dfe = d.length - mI.rango
  if (dfe < 1) return null
  const mse = mI.rss / dfe
  const fila = (nombre, ss, df) => {
    const F = df > 0 && mse > 0 ? ss / df / mse : NaN
    return { nombre, ss, df, ms: df > 0 ? ss / df : NaN, F, p: finito(F) ? 1 - fCdf(F, df, dfe) : NaN }
  }
  return {
    filas: [
      fila('A', mB.rss - mAB.rss, mAB.rango - mB.rango),
      fila('B', mA.rss - mAB.rss, mAB.rango - mA.rango),
      fila('AB', mAB.rss - mI.rss, mI.rango - mAB.rango),
      { nombre: 'Residual', ss: mI.rss, df: dfe, ms: mse, F: NaN, p: NaN },
    ],
    n: d.length,
  }
}

// ---------- análisis completo ----------
// exps: [{ id, nombre }] (placas = experimentos); valores(exp, cepa) → array de pocillos aceptados
export function reproducibilidad(exps, cepas, valores) {
  // 1. variabilidad entre experimentos: un valor (la media de sus pocillos) por experimento
  const medias = {}
  cepas.forEach((c) => { medias[c] = exps.map((e) => { const v = valores(e, c); return v.length ? media(v) : NaN }) })
  const variab = cepas.map((c) => {
    const v = medias[c].filter(finito)
    const m = media(v), sd = v.length > 1 ? desvio(v) : NaN
    return { cepa: c, n: v.length, media: m, sd, cv: finito(sd) && m !== 0 ? (100 * sd) / Math.abs(m) : NaN, porExp: medias[c] }
  })
  // 2. ¿difieren los experimentos? por cepa, con los pocillos
  const porCepa = cepas.map((c) => {
    const grupos = exps.map((e) => valores(e, c)).filter((v) => v.length)
    const resid = grupos.flatMap((v) => { const m = media(v); return v.map((x) => x - m) })
    const sw = shapiro(resid)
    const an = anova1(grupos)
    const kw = kruskal(grupos)
    const nMin = grupos.length ? Math.min(...grupos.map((v) => v.length)) : 0
    const usarKw = (sw && sw.p < 0.05) || nMin < 3
    return { cepa: c, k: grupos.length, n: grupos.reduce((s, v) => s + v.length, 0), nMin, sw, anova: an, kw, usarKw }
  })
  const d2 = cepas.flatMap((c) => exps.flatMap((e) => valores(e, c).map((y) => ({ y, a: c, b: e.id }))))
  const dos = anova2(d2)
  // 3. correlación entre pares de experimentos (cepas con dato en los dos)
  const pares = []
  for (let i = 0; i < exps.length; i++) for (let j = i + 1; j < exps.length; j++) {
    const ok = cepas.filter((c) => finito(medias[c][i]) && finito(medias[c][j]))
    const x = ok.map((c) => medias[c][i]), y = ok.map((c) => medias[c][j])
    pares.push({ a: exps[i], b: exps[j], n: ok.length, pearson: pearson(x, y), spearman: spearman(x, y) })
  }
  // normalidad de cada experimento (medias de las cepas), para elegir Pearson o Spearman
  const normalExp = exps.map((_, j) => shapiro(cepas.map((c) => medias[c][j]).filter(finito)))
  // 4. ICC con las cepas que tienen dato en todos los experimentos
  const completas = cepas.filter((c) => medias[c].every(finito))
  const ICC = icc(completas.map((c) => medias[c]))
  return { variab, porCepa, dos, pares, normalExp, expsIdx: Object.fromEntries(exps.map((e, i) => [e.id, i])), completas, icc: ICC, medias }
}
