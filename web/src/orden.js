// ============================================================
// ¿Se mantiene el orden de las cepas (o serotipos) de placa en placa?
// Es lo que hay que mirar antes de usar la placa como bloque: el modelo en bloques supone que una placa
// «más teñida» sube a todos por igual, sin cambiar el orden.
//   · puestos de cada unidad en cada placa (1 = más biofilm)
//   · W de Kendall: concordancia del orden entre placas (0 = ninguna, 1 = idéntico), con el p de Friedman
//   · Spearman entre cada par de placas: qué placa se parece menos a las demás
//   · interacción unidad × placa con los pocillos: ¿el orden cambia más de lo que explica el ruido?
//   · no aditividad de Tukey: ¿el efecto de la placa suma (OD) o multiplica (mejor en ln)?
// ============================================================
import { media } from './estadistica.js'
import { fCdf, rangos } from './reproducibilidad.js'
import { friedman } from './bloques.js'
import { placaCepa } from './decision.js'

const finito = Number.isFinite

// puestos de una fila: 1 = el valor más alto (empates promediados)
export const puestos = (fila) => rangos(fila.map((x) => -x))

// W de Kendall a partir de Friedman (con la corrección por empates de R): W = χ² / (b (k − 1))
export function kendallW(M) {
  if (M.length < 2 || M[0].length < 2) return null
  const F = friedman(M)
  return { W: F.Q / (M.length * (M[0].length - 1)), p: F.p, b: M.length, k: M[0].length }
}

const pearson = (a, b) => {
  const ma = media(a), mb = media(b)
  let sab = 0, sa = 0, sb = 0
  a.forEach((x, i) => { sab += (x - ma) * (b[i] - mb); sa += (x - ma) ** 2; sb += (b[i] - mb) ** 2 })
  return sa > 0 && sb > 0 ? sab / Math.sqrt(sa * sb) : NaN
}

// No aditividad de Tukey (1 gl) sobre una tabla placas × unidades sin repetición
export function noAditividad(M) {
  const b = M.length, k = M[0].length
  if (b < 3 || k < 3) return null
  const G = media(M.flat()), fm = M.map(media), cm = M[0].map((_, j) => media(M.map((f) => f[j])))
  const a = fm.map((x) => x - G), c = cm.map((x) => x - G)
  let num = 0
  M.forEach((f, i) => f.forEach((y, j) => { num += a[i] * c[j] * y }))
  const den = a.reduce((s, x) => s + x * x, 0) * c.reduce((s, x) => s + x * x, 0)
  if (!(den > 0)) return null
  const ssN = (num * num) / den
  let sse = 0
  M.forEach((f, i) => f.forEach((y, j) => { sse += (y - fm[i] - cm[j] + G) ** 2 }))
  const df = (b - 1) * (k - 1) - 1, ssr = sse - ssN
  if (!(df > 0) || !(ssr > 0)) return null
  const F = ssN / (ssr / df)
  return { F, p: 1 - fCdf(F, 1, df), df }
}

// Análisis completo. filas: [{ id, nombre, medio, valores: { unidad: OD media }, valoresLeidos, pozos: [{ unidad, y }] }]
export function analizarOrden(placas0, unidades) {
  const sueltas = placas0.filter((p) => unidades.some((u) => !finito(p.valores[u])))
  const placas = placas0.filter((p) => !sueltas.includes(p))
  if (placas.length < 2 || unidades.length < 3) return { ok: false, placas, sueltas, motivo: unidades.length < 3 ? 'Hacen falta 3 o más cepas (o serotipos) para hablar de un orden.' : 'Hacen falta 2 o más placas que tengan todas las cepas elegidas.' }
  const M = placas.map((p) => unidades.map((u) => p.valores[u]))
  const P = M.map(puestos)
  const kw = kendallW(M)
  // por medio
  const medios = [...new Set(placas.map((p) => p.medio))]
  const porMedio = medios.map((m) => { const idx = placas.map((p, i) => (p.medio === m ? i : -1)).filter((i) => i >= 0); return { medio: m, n: idx.length, ...(idx.length >= 2 ? kendallW(idx.map((i) => M[i])) : {}) } })
  // Spearman entre placas (Pearson de los puestos)
  const rho = P.map((a) => P.map((b) => pearson(a, b)))
  const rhoMedio = placas.map((_, i) => media(rho[i].filter((_, j) => j !== i)))
  const iPeor = rhoMedio.reduce((m, x, i) => (x < rhoMedio[m] ? i : m), 0)
  const sinPeor = placas.length >= 3 ? kendallW(M.filter((_, i) => i !== iPeor)) : null
  // interacción con los pocillos
  const pc = placaCepa(placas.flatMap((p) => p.pozos.filter((x) => unidades.includes(x.unidad)).map((x) => ({ cepa: x.unidad, placa: p.id, y: x.y }))))
  const inter = pc ? { F: pc.filas[2].F, p: pc.filas[2].p, ss: pc.filas[2].ss, ssUnidad: pc.filas[1].ss, ssPlaca: pc.filas[0].ss, pct: pc.filas[1].ss > 0 ? (100 * pc.filas[2].ss) / pc.filas[1].ss : NaN } : null
  // ¿suma o multiplica? (OD y logaritmo de la OD leída)
  const adOD = noAditividad(M)
  const Ml = placas.map((p) => unidades.map((u) => Math.log(p.valoresLeidos[u])))
  const adLn = Ml.flat().every(finito) ? noAditividad(Ml) : null
  // veredicto
  const W = kw.W
  const nivel = W >= 0.7 && kw.p < 0.05 ? 'ok' : W >= 0.5 ? 'medio' : 'no'
  const multiplica = !!adOD && adOD.p < 0.05 && (!adLn || adLn.p >= 0.05)
  // una placa que se parece poco a las demás (correlación media < 0,4) y sin la cual el orden concuerda más
  const mejoraSinPeor = !!sinPeor && rhoMedio[iPeor] < 0.4 && sinPeor.W > W
  return { ok: true, placas, sueltas, unidades, M, P, kw, porMedio, rho, rhoMedio, iPeor, sinPeor, mejoraSinPeor, inter, adOD, adLn, multiplica, nivel }
}
