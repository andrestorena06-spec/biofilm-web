// ============================================================
// La placa como bloque. Cada placa (un día de experimento) mide todos los grupos a la vez: si una placa tiñó más,
// sube a todos. El ANOVA en bloques (grupo + placa, sin interacción) saca esa variación del error y gana potencia.
// Si los residuos no son normales se usa Friedman (rangos dentro de cada placa).
// También: la escala sugerida según cómo crece la DE con la media.
// ============================================================
import { holm, media, varianza } from './estadistica.js'
import { chi2Sup, fCdf, pnorm, rangos, shapiro, tSup2 } from './reproducibilidad.js'
import { dunnettP, letras, levene, razonSD } from './decision.js'
import { pTukey } from './tukey.js'

const finito = Number.isFinite

// Tabla placas × grupos con las placas que tienen TODOS los grupos (bloques completos).
// grupos: [{ nombre, det: [{ placaId, y }] }]; si un grupo tiene varios valores en una placa (varias cepas), se promedian.
export function tablaBloques(grupos) {
  const ids = [...new Set(grupos.flatMap((g) => (g.det || []).map((d) => d.placaId).filter(Boolean)))]
  const completos = ids.filter((id) => grupos.every((g) => (g.det || []).some((d) => d.placaId === id && finito(d.y))))
  const Y = completos.map((id) => grupos.map((g) => media(g.det.filter((d) => d.placaId === id && finito(d.y)).map((d) => d.y))))
  return { bloques: completos, Y, sueltas: ids.filter((id) => !completos.includes(id)) }
}

// ¿se puede usar la placa como bloque? Hacen falta 2 o más grupos y 3 o más placas que tengan todos los grupos
export const puedeBloques = (grupos) => {
  const g = grupos.filter((x) => x.v?.length)
  return g.length >= 2 && g.every((x) => x.det?.every((d) => d.placaId)) && tablaBloques(g).bloques.length >= 3
}

// ANOVA de dos factores sin interacción (grupo + bloque) sobre la tabla Y (bloques × grupos)
export function anovaBloques(Y) {
  const b = Y.length, k = Y[0].length, N = b * k
  const G = Y.flat().reduce((a, x) => a + x, 0) / N
  const mb = Y.map((f) => f.reduce((a, x) => a + x, 0) / k)
  const mg = Y[0].map((_, j) => Y.reduce((a, f) => a + f[j], 0) / b)
  const sst = Y.flat().reduce((a, x) => a + (x - G) ** 2, 0)
  const ssg = b * mg.reduce((a, m) => a + (m - G) ** 2, 0)
  const ssb = k * mb.reduce((a, m) => a + (m - G) ** 2, 0)
  const sse = Math.max(0, sst - ssg - ssb)
  const dfg = k - 1, dfb = b - 1, dfe = (k - 1) * (b - 1)
  const mse = sse / dfe
  const Fg = mse > 0 ? ssg / dfg / mse : Infinity, Fb = mse > 0 ? ssb / dfb / mse : Infinity
  const resid = Y.flatMap((f, i) => f.map((x, j) => x - mb[i] - mg[j] + G))
  return {
    b, k, G, mb, mg, sst, ssg, ssb, sse, dfg, dfb, dfe, mse, Fg, Fb,
    pg: mse > 0 ? 1 - fCdf(Fg, dfg, dfe) : 0, pb: mse > 0 ? 1 - fCdf(Fb, dfb, dfe) : 0, resid,
    // parte de la variación total que se lleva la placa (lo que se le saca al error)
    pctBloque: sst > 0 ? (100 * ssb) / sst : 0,
  }
}

// Friedman: rangos dentro de cada placa (con corrección por empates), como friedman.test de R
export function friedman(Y) {
  const b = Y.length, k = Y[0].length
  const R = Y.map((f) => rangos(f))
  const Rj = Y[0].map((_, j) => R.reduce((a, f) => a + f[j], 0))
  let Q = (12 / (b * k * (k + 1))) * Rj.reduce((a, r) => a + r * r, 0) - 3 * b * (k + 1)
  // empates dentro de cada placa
  let emp = 0
  Y.forEach((f) => { const c = new Map(); f.forEach((x) => c.set(x, (c.get(x) || 0) + 1)); c.forEach((t) => { emp += t ** 3 - t }) })
  const corr = 1 - emp / (b * (k ** 3 - k))
  if (corr > 0) Q /= corr
  return { Q, df: k - 1, p: chi2Sup(Q, k - 1), Rj, rMed: Rj.map((r) => r / b), b, k }
}

// Elige y corre la prueba con la placa como bloque (misma forma de resultado que analizar() de decision.js)
// forzado: 'auto' | 'anova' | 'welch' | 'kw'; ajuste: 'holm' | 'tukey' | 'lsd'
export function analizarBloques(grupos0, forzado = 'auto', ctrl = null, ajuste = 'holm', nombreBloque = (id) => id) {
  const grupos = grupos0.filter((x) => x.v?.length)
  const T = tablaBloques(grupos)
  if (grupos.length < 2) return { ok: false, grupos, motivo: 'Hace falta más de un grupo con datos.' }
  if (T.bloques.length < 3) return { ok: false, grupos, motivo: 'Para usar la placa como bloque hacen falta 3 o más placas con todos los grupos.' }
  const A = anovaBloques(T.Y)
  const g = grupos.map((x, j) => ({ nombre: x.nombre, v: T.Y.map((f) => f[j]) }))
  const sw = A.resid.length >= 3 && A.resid.some((x) => Math.abs(x) > 1e-12) ? shapiro(A.resid) : null
  const swUtil = !!sw && A.resid.length >= 8
  const lev = levene(g.map((x) => x.v))
  let tipo, razon
  const intro = `La placa se usa como bloque: ${T.bloques.length} placas con todos los grupos${T.sueltas.length ? ` (${T.sueltas.length} sin todos los grupos quedan afuera: ${T.sueltas.map(nombreBloque).join(', ')})` : ''}. La variación entre placas (${A.pctBloque.toFixed(0)} % del total) se saca del error.`
  if (forzado === 'kw') { tipo = 'friedman'; razon = `${intro} Elegida por vos: Friedman, la versión por rangos.` }
  else if (forzado === 'anova' || forzado === 'welch') { tipo = 'bloques'; razon = `${intro} Elegida por vos: ANOVA en bloques.${forzado === 'welch' ? ' (No hay versión de Welch con bloques: se usó el ANOVA en bloques.)' : ''}` }
  else if (swUtil && sw.p < 0.05) { tipo = 'friedman'; razon = `${intro} Los residuos del modelo no son normales (Shapiro-Wilk p = ${sw.p.toFixed(3)}): Friedman, que compara rangos dentro de cada placa.` }
  else { tipo = 'bloques'; razon = `${intro} Residuos sin evidencia de no normalidad${sw ? ` (Shapiro-Wilk p = ${sw.p.toFixed(3)})` : ''}: ANOVA en bloques.` }

  const k = g.length, b = T.bloques.length
  const lista = []
  for (let i = 0; i < k; i++) for (let j = i + 1; j < k; j++) {
    if (ctrl && g[i].nombre !== ctrl && g[j].nombre !== ctrl) continue
    lista.push(ctrl && g[i].nombre === ctrl ? [j, i] : [i, j])
  }
  let global, pr
  if (tipo === 'bloques') {
    global = { nombre: 'ANOVA en bloques (grupo + placa)', est: 'F', valor: A.Fg, df1: A.dfg, df2: A.dfe, p: A.pg,
      filas: [['Grupos', A.ssg, A.dfg, A.ssg / A.dfg, A.Fg, A.pg], ['Placas (bloque)', A.ssb, A.dfb, A.ssb / A.dfb, A.Fb, A.pb], ['Error', A.sse, A.dfe, A.mse, null, null], ['Total', A.sst, b * k - 1, null, null, null]] }
    const se = Math.sqrt((2 * A.mse) / b)
    const filas = lista.map(([i, j]) => { const dif = A.mg[i] - A.mg[j], t = se > 0 ? dif / se : NaN; return { a: g[i].nombre, b: g[j].nombre, ma: A.mg[i], mb: A.mg[j], dif, est: t, df: A.dfe, p: finito(t) ? tSup2(Math.abs(t), A.dfe) : NaN } })
    if (ctrl) pr = filas.map((f) => ({ ...f, pa: finito(f.est) ? dunnettP(Math.abs(f.est), filas.map(() => Math.SQRT1_2), A.dfe) : NaN, metodo: 'Dunnett' }))
    else if (ajuste === 'tukey') pr = filas.map((f) => { const q = Math.abs(f.dif) / Math.sqrt(A.mse / b); return { ...f, q, pa: pTukey(q, k, A.dfe), metodo: 'Tukey' } })
    else if (ajuste === 'lsd') pr = filas.map((f) => ({ ...f, pa: A.pg < 0.05 ? f.p : 1, protegido: A.pg >= 0.05, metodo: 'LSD' }))
    else { const aj = holm(filas.map((f) => f.p)); pr = filas.map((f, i) => ({ ...f, pa: aj[i], metodo: 'Holm' })) }
  } else {
    const F = friedman(T.Y)
    global = { nombre: 'Friedman (rangos dentro de cada placa)', est: 'χ²', valor: F.Q, df1: F.df, df2: null, p: F.p }
    // pares: diferencia de rangos medios; error estándar de Nemenyi / Conover simple
    const se = Math.sqrt((k * (k + 1)) / (6 * b))
    const filas = lista.map(([i, j]) => { const d = F.rMed[i] - F.rMed[j], z = d / se; return { a: g[i].nombre, b: g[j].nombre, ma: media(g[i].v), mb: media(g[j].v), dif: media(g[i].v) - media(g[j].v), est: z, df: NaN, p: 2 * (1 - pnorm(Math.abs(z))), rMedA: F.rMed[i], rMedB: F.rMed[j] } })
    if (ajuste === 'tukey' && !ctrl) pr = filas.map((f) => { const q = Math.abs(f.est) * Math.SQRT2; return { ...f, q, pa: pTukey(q, k, 1e6), metodo: 'Nemenyi' } })
    else { const aj = holm(filas.map((f) => f.p)); pr = filas.map((f, i) => ({ ...f, pa: aj[i], metodo: 'Holm' })) }
  }
  if (pr[0]?.metodo === 'Tukey') razon += ' Pares con Tukey usando el error del modelo en bloques.'
  if (pr[0]?.metodo === 'Nemenyi') razon += ' Pares con Nemenyi (la versión de Tukey para rangos de Friedman).'
  if (pr[0]?.metodo === 'Dunnett') razon += ' Contra el control: Dunnett con el error del modelo en bloques.'
  return { ok: true, tipo, razon, sw, lev, global, grupos: g, pares: pr, letras: ctrl ? null : letras(g, pr), razonSD: razonSD(g.map((x) => x.v)), bloques: { b, sueltas: T.sueltas, pct: A.pctBloque, pBloque: A.pb } }
}

// Escala sugerida: si la DE de los grupos crece en proporción a la media (pendiente ≈ 1 en log DE vs log media),
// el logaritmo iguala las varianzas; si no crece (pendiente ≈ 0), conviene la OD tal cual.
export function escalaSugerida(grupos) {
  const g = grupos.filter((x) => x.v?.length >= 2).map((x) => ({ m: media(x.v), s: Math.sqrt(varianza(x.v)) })).filter((x) => x.m > 0 && x.s > 0)
  const conNeg = grupos.some((x) => x.v?.some((y) => !(y > 0)))
  if (g.length < 3) return null
  const xs = g.map((x) => Math.log(x.m)), ys = g.map((x) => Math.log(x.s))
  const mx = media(xs), my = media(ys)
  const sxx = xs.reduce((a, x) => a + (x - mx) ** 2, 0)
  if (!(sxx > 0)) return null
  const pend = xs.reduce((a, x, i) => a + (x - mx) * (ys[i] - my), 0) / sxx
  const ln = pend >= 0.6 && !conNeg
  return {
    pend, escala: ln ? 'ln' : 'od', conNeg,
    texto: ln
      ? `La DE crece casi en proporción a la media (pendiente ${pend.toFixed(2)}): conviene ln(OD), que iguala las varianzas y acerca los residuos a la normal.`
      : pend >= 0.6 && conNeg ? `La DE crece con la media (pendiente ${pend.toFixed(2)}), pero hay valores ≤ 0 (OD corregida) y el logaritmo no se puede usar: queda OD.`
        : `La DE no crece mucho con la media (pendiente ${pend.toFixed(2)}): la OD tal cual está bien.`,
  }
}
