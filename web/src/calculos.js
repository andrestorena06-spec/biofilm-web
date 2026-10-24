import { tCuantil } from './utils.js'

// Desarrollo paso a paso de cada número, con los valores reales, para mostrar al pasar el mouse (data-tip).
// Cada función devuelve texto: la primera línea es el título; las demás, el desarrollo.
export const F = (x, d = 3) => (Number.isFinite(x) ? x.toFixed(d) : '–')
const suma = (v) => v.reduce((a, b) => a + b, 0)
const lista = (v) => (v.length > 6 ? `${v.slice(0, 5).map((x) => F(x)).join(' + ')} + … (${v.length} valores)` : v.map((x) => F(x)).join(' + '))

export function estad(v) {
  const n = v.length
  const m = n ? suma(v) / n : NaN
  const ss = suma(v.map((x) => (x - m) ** 2))
  const sd = n > 1 ? Math.sqrt(ss / (n - 1)) : NaN
  const sem = n > 1 ? sd / Math.sqrt(n) : NaN
  const t = n > 1 ? tCuantil(0.975, n - 1) : NaN
  return { n, m, ss, sd, sem, t, ic: t * sem, cv: m ? (100 * sd) / m : NaN }
}

export const dMedia = (v) => {
  const e = estad(v)
  return `Media (x̄)\nx̄ = Σ OD / n\n  = (${lista(v)}) / ${e.n}\n  = ${F(e.m, 4)}`
}
export const dDE = (v) => {
  const e = estad(v)
  return e.n < 2 ? 'Desviación estándar (DE)\nNecesita n ≥ 2' : `Desviación estándar muestral (DE)\nDE = √[ Σ(OD − x̄)² / (n − 1) ]\n   = √[ ${F(e.ss, 5)} / ${e.n - 1} ]\n   = ${F(e.sd, 4)}`
}
export const dSEM = (v) => {
  const e = estad(v)
  return e.n < 2 ? 'Error estándar (SEM)\nNecesita n ≥ 2' : `Error estándar de la media (SEM)\nSEM = DE / √n\n    = ${F(e.sd, 4)} / √${e.n}\n    = ${F(e.sem, 4)}`
}
export const dIC = (v) => {
  const e = estad(v)
  return e.n < 2 ? 'IC 95 %\nNecesita n ≥ 2' : `Intervalo de confianza 95 % (±)\nIC = t(0.975; n−1) × SEM\n   = ${F(e.t, 3)} × ${F(e.sem, 4)}   (t de Student, ${e.n - 1} gl)\n   = ${F(e.ic, 4)}\nva de ${F(e.m - e.ic, 3)} a ${F(e.m + e.ic, 3)}`
}
export const dCV = (v) => {
  const e = estad(v)
  return e.n < 2 ? 'Coeficiente de variación (CV)\nNecesita n ≥ 2' : `Coeficiente de variación (CV)\nCV = 100 × DE / x̄\n   = 100 × ${F(e.sd, 4)} / ${F(e.m, 4)}\n   = ${F(e.cv, 2)} %`
}
export const dError = (tipo, v) => (tipo === 'sd' ? dDE(v) : tipo === 'sem' ? dSEM(v) : tipo === 'ic95' ? dIC(v) : '')
export const dRazon = (media, odc, resta = 0) => (resta
  ? `Razón OD / ODc (con la OD leída)\nOD / ODc = (${F(media - resta, 4)} + ${F(resta, 4)}) / ${F(odc, 4)}\n         = ${F(media / odc, 2)}`
  : `Razón OD / ODc\nOD / ODc = ${F(media, 4)} / ${F(odc, 4)}\n         = ${F(media / odc, 2)}`)
// media: OD media leída. resta: blanco restado (si la OD está corregida), para mostrar de dónde sale la OD leída
export const dClase = (media, odc, clase, resta = 0) => `Clasificación (Stepanović et al., 2000)\nODc = ${F(odc, 4)} · 2×ODc = ${F(2 * odc, 4)} · 4×ODc = ${F(4 * odc, 4)}\n${resta ? `Se clasifica con la OD leída = corregida + blanco\n= ${F(media - resta, 4)} + ${F(resta, 4)} = ${F(media, 4)}` : `OD media = ${F(media, 4)}`}\n≤ ODc: no productor · ≤ 2×ODc: débil\n≤ 4×ODc: moderado · > 4×ODc: fuerte\n→ ${clase}`
export const dODc = (bl) => {
  const e = estad(bl)
  return `Punto de corte (ODc)\nODc = media(blancos) + 3 × DE(blancos)\n    = ${F(e.m, 4)} + 3 × ${F(e.sd, 4)}\n    = ${F(e.m + 3 * e.sd, 4)}\nblancos aceptados (n = ${e.n}): ${lista(bl)}`
}
// bloque completo de una barra: media, error elegido y, si corresponde, clasificación
// resta: blanco restado a cada OD de v (la clasificación usa la OD leída)
export const dBarra = (titulo, v, tipoError, odc, clase, resta = 0) => {
  const partes = [dMedia(v)]
  if (tipoError && tipoError !== 'ninguno' && v.length > 1) partes.push(dError(tipoError, v))
  if (Number.isFinite(odc) && clase) partes.push(dClase(estad(v).m + resta, odc, clase, resta))
  return `${titulo}\n${partes.join('\n\n')}`
}
// posición de un cuantil por interpolación lineal (la misma que usa R por defecto)
const cuantil = (v, q) => {
  const a = [...v].sort((x, y) => x - y)
  const pos = (a.length - 1) * q
  const i = Math.floor(pos)
  return a[i] + (a[Math.min(i + 1, a.length - 1)] - a[i]) * (pos - i)
}
export const dCaja = (v) => {
  const a = [...v].sort((x, y) => x - y)
  const q1 = cuantil(a, 0.25), q3 = cuantil(a, 0.75)
  return `Caja: cuartiles Q1–Q3\nvalores ordenados: ${a.map((x) => F(x)).join(', ')}\nQ1 (25 %) = ${F(q1)} · Q3 (75 %) = ${F(q3)}\nRIC = Q3 − Q1 = ${F(q3 - q1)}\nEl 50 % central de los datos está dentro de la caja.`
}
export const dMediana = (v) => {
  const a = [...v].sort((x, y) => x - y)
  return `Mediana\nvalores ordenados: ${a.map((x) => F(x)).join(', ')}\nmediana = ${F(cuantil(a, 0.5), 4)}\nLa mitad de los datos queda por debajo y la otra mitad por encima.`
}
export const dBigotes = (v) => `Bigotes: mínimo y máximo\nmínimo = ${F(Math.min(...v))} · máximo = ${F(Math.max(...v))}\nrango = ${F(Math.max(...v) - Math.min(...v))}`
