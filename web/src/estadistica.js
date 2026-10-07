// ============================================================
// Estadística para comparar muestras entre placas.
// Cada valor de entrada es UNA réplica biológica (la media de una muestra en una placa).
// Equivalentes en R: t.test(x, y) (Welch), p.adjust(p, "holm"), summary(aov(y ~ grupo)).
// ============================================================
import { betaInc, tCdf, tCuantil } from './utils.js'

const finito = Number.isFinite

export const media = (v) => (v.length ? v.reduce((s, x) => s + x, 0) / v.length : NaN)
export const varianza = (v) => {
  if (v.length < 2) return NaN
  const m = media(v)
  return v.reduce((s, x) => s + (x - m) ** 2, 0) / (v.length - 1)
}
export const desvio = (v) => Math.sqrt(varianza(v))

// Resumen de un grupo de valores: media, DE, SEM, IC 95 % (±), CV
export function resumenGrupo(v) {
  const x = v.filter(finito)
  const n = x.length
  const m = media(x)
  const sd = desvio(x)
  const sem = sd / Math.sqrt(n)
  return {
    n, media: m, sd: finito(sd) ? sd : null, sem: finito(sem) ? sem : null,
    ic95: n > 1 ? tCuantil(0.975, n - 1) * sem : null,
    cv: finito(sd) && m !== 0 ? (100 * sd) / m : null,
  }
}

// Prueba t de Welch (varianzas desiguales), bilateral. Igual que t.test(x, y) de R.
export function welch(x, y) {
  const nx = x.length, ny = y.length
  if (nx < 2 || ny < 2) return null
  const vx = varianza(x), vy = varianza(y)
  const dif = media(x) - media(y)
  const se2 = vx / nx + vy / ny
  if (se2 === 0) return { dif, t: dif === 0 ? 0 : Infinity, df: nx + ny - 2, p: dif === 0 ? 1 : 0 }
  const t = dif / Math.sqrt(se2)
  const df = se2 ** 2 / ((vx / nx) ** 2 / (nx - 1) + (vy / ny) ** 2 / (ny - 1))
  const p = Math.min(1, 2 * (1 - tCdf(Math.abs(t), df)))
  return { dif, t, df, p }
}

// Ajuste de Holm para comparaciones múltiples. Igual que p.adjust(p, "holm").
export function holm(ps) {
  const idx = ps.map((p, i) => ({ p, i })).filter((o) => finito(o.p)).sort((a, b) => a.p - b.p)
  const m = idx.length
  const out = ps.map(() => null)
  let previo = 0
  idx.forEach((o, k) => {
    previo = Math.max(previo, Math.min(1, (m - k) * o.p))
    out[o.i] = previo
  })
  return out
}

// ANOVA de una vía. grupos: array de arrays. Devuelve F, gl y p (igual que summary(aov(...)) de R).
export function anova1(grupos) {
  const g = grupos.map((v) => v.filter(finito)).filter((v) => v.length > 0)
  const k = g.length
  const N = g.reduce((s, v) => s + v.length, 0)
  if (k < 2 || N - k < 1) return null
  const gm = media(g.flat())
  const ssb = g.reduce((s, v) => s + v.length * (media(v) - gm) ** 2, 0)
  const ssw = g.reduce((s, v) => s + v.reduce((a, x) => a + (x - media(v)) ** 2, 0), 0)
  const df1 = k - 1, df2 = N - k
  if (ssw === 0) return { F: Infinity, df1, df2, p: ssb === 0 ? 1 : 0 }
  const F = ssb / df1 / (ssw / df2)
  const p = betaInc(df2 / (df2 + df1 * F), df2 / 2, df1 / 2)
  return { F, df1, df2, p }
}

export const marcaSig = (p) => (!finito(p) ? '' : p < 0.001 ? '***' : p < 0.01 ? '**' : p < 0.05 ? '*' : 'ns')
