// ============================================================
// Distribución del rango studentizado (la de Tukey): ptukey(q, k, gl) = P(Q ≤ q).
// Traducción del algoritmo de R (nmath/ptukey.c, Copenhaver y Holland, 1988), con cuadratura de Gauss-Legendre.
// La usan Tukey-Kramer (después del ANOVA clásico) y Games-Howell (después del ANOVA de Welch).
// ============================================================
const SQRT_2PI = Math.sqrt(2 * Math.PI)

function pnorm(x) {
  // Φ(x) con erfc (Numerical Recipes, error < 1,2e-7)
  const z = Math.abs(x) / Math.SQRT2, t = 1 / (1 + 0.5 * z)
  const r = t * Math.exp(-z * z - 1.26551223 + t * (1.00002368 + t * (0.37409196 + t * (0.09678418 + t * (-0.18628806 + t * (0.27886807 + t * (-1.13520398 + t * (1.48851587 + t * (-0.82215223 + t * 0.17087277)))))))))
  return x >= 0 ? 1 - r / 2 : r / 2
}
function lgamma(x) {
  const c = [76.18009172947146, -86.50532032941677, 24.01409824083091, -1.231739572450155, 0.1208650973866179e-2, -0.5395239384953e-5]
  let y = x, tmp = x + 5.5
  tmp -= (x + 0.5) * Math.log(tmp)
  let s = 1.000000000190015
  for (const k of c) s += k / ++y
  return -tmp + Math.log((2.5066282746310005 * s) / x)
}

const XLEG = [0.981560634246719250690549090149, 0.904117256370474856678465866119, 0.769902674194304687036893833213, 0.587317954286617447296702418941, 0.367831498998180193752691536644, 0.125233408511468915472441369464]
const ALEG = [0.047175336386511827194615961485, 0.106939325995318430960254718194, 0.160078328543346226334652529543, 0.203167426723065921749064455810, 0.233492536538354808760849898925, 0.249147045813402785000562436043]

// probabilidad del rango de cc normales (rr = 1 grupo de rangos)
function wprob(w, rr, cc) {
  const nleg = 12, ihalf = 6, C1 = -30, C2 = -50, C3 = 60, bb = 8, wlar = 3
  const qsqz = w * 0.5
  if (qsqz >= bb) return 1
  let prw = 2 * pnorm(qsqz) - 1
  prw = prw >= Math.exp(C2 / cc) ? prw ** cc : 0
  const wincr = w > wlar ? 2 : 3
  let blb = qsqz
  const binc = (bb - qsqz) / wincr
  let bub = blb + binc, einsum = 0
  const cc1 = cc - 1
  for (let wi = 1; wi <= wincr; wi++) {
    let elsum = 0
    const a = 0.5 * (bub + blb), b = 0.5 * (bub - blb)
    for (let jj = 1; jj <= nleg; jj++) {
      let j, xx
      if (ihalf < jj) { j = nleg - jj + 1; xx = XLEG[j - 1] } else { j = jj; xx = -XLEG[j - 1] }
      const ac = a + b * xx, qexpo = ac * ac
      if (qexpo > C3) break
      const pplus = 2 * pnorm(ac), pminus = 2 * pnorm(ac - w)
      let rinsum = pplus * 0.5 - pminus * 0.5
      if (rinsum >= Math.exp(C1 / cc1)) elsum += ALEG[j - 1] * Math.exp(-(0.5 * qexpo)) * rinsum ** cc1
    }
    einsum += elsum * ((2 * b * cc) / SQRT_2PI)
    blb = bub
    bub += binc
  }
  prw += einsum
  if (prw <= Math.exp(C1 / rr)) return 0
  prw = prw ** rr
  return prw >= 1 ? 1 : prw
}

const XLEGQ = [0.989400934991649932596154173450, 0.944575023073232576077988415535, 0.865631202387831743880467897712, 0.755404408355003033895101194847, 0.617876244402643748446671764049, 0.458016777657227386342419442984, 0.281603550779258913230460501460, 0.950125098376374401853193354250e-1]
const ALEGQ = [0.271524594117540948517805724560e-1, 0.622535239386478928628438369944e-1, 0.951585116824927848099251076022e-1, 0.124628971255533872052476282192, 0.149595988816576732081501730547, 0.169156519395002538189312079030, 0.182603415044923588866763667969, 0.189450610455068496285396723208]

// P(Q ≤ q) para k grupos y gl grados de libertad del error
export function ptukey(q, k, gl) {
  const rr = 1, cc = k
  if (!(q > 0)) return 0
  if (!(gl >= 2) || cc < 2) return NaN
  if (!Number.isFinite(q)) return 1
  if (gl > 25000) return wprob(q, rr, cc)
  const nlegq = 16, ihalfq = 8, eps1 = -30, eps2 = 1e-14
  const f2 = gl * 0.5
  let f2lf = f2 * Math.log(gl) - gl * Math.LN2 - lgamma(f2)
  const f21 = f2 - 1, ff4 = gl * 0.25
  const ulen = gl <= 100 ? 1 : gl <= 800 ? 0.5 : gl <= 5000 ? 0.25 : 0.125
  f2lf += Math.log(ulen)
  let ans = 0, otsum = 0
  for (let i = 1; i <= 50; i++) {
    otsum = 0
    const twa1 = (2 * i - 1) * ulen
    for (let jj = 1; jj <= nlegq; jj++) {
      let j, t1, qsqz
      if (ihalfq < jj) {
        j = jj - ihalfq - 1
        t1 = f2lf + f21 * Math.log(twa1 + XLEGQ[j] * ulen) - (XLEGQ[j] * ulen + twa1) * ff4
      } else {
        j = jj - 1
        t1 = f2lf + f21 * Math.log(twa1 - XLEGQ[j] * ulen) + (XLEGQ[j] * ulen - twa1) * ff4
      }
      if (t1 >= eps1) {
        qsqz = ihalfq < jj ? q * Math.sqrt((XLEGQ[j] * ulen + twa1) * 0.5) : q * Math.sqrt((-(XLEGQ[j] * ulen) + twa1) * 0.5)
        otsum += wprob(qsqz, rr, cc) * ALEGQ[j] * Math.exp(t1)
      }
    }
    if (i * ulen >= 1 && otsum <= eps2) break
    ans += otsum
  }
  return ans > 1 ? 1 : ans
}

// p ajustado de un par: 1 − P(Q ≤ q)
export const pTukey = (q, k, gl) => Math.max(0, Math.min(1, 1 - ptukey(q, k, gl)))
