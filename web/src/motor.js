// ============================================================
// Motor de cálculo en JavaScript (equivalente al de R en api/funciones.R).
// Permite usar la aplicación completa en el navegador, sin servidor.
// Lectura de la placa, valores atípicos (test Q de Dixon, Grubbs, CV), ODc y clasificación
// (Stepanović et al., 2000).
// ============================================================
import { Q_TABLA } from './criticos.js'
import { leerHojasLibro } from './libro.js'
import { tCuantil } from './utils.js'

const LETRAS = 'ABCDEFGH'.split('')
export const pocillos96 = () => LETRAS.flatMap((f) => Array.from({ length: 12 }, (_, i) => f + (i + 1)))
const CLASES = ['No productor', 'Productor débil', 'Productor moderado', 'Productor fuerte']

// ---------- utilidades ----------
export function convertirNumero(x) {
  if (typeof x === 'number') return x
  if (x === null || x === undefined) return NaN
  const s = String(x).trim().replace(',', '.')
  return s === '' ? NaN : Number(s)
}
const finito = Number.isFinite
const mediana = (v) => {
  const a = v.filter(finito).sort((x, y) => x - y)
  if (!a.length) return NaN
  const m = a.length >> 1
  return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2
}
const media = (v) => v.reduce((s, x) => s + x, 0) / v.length
const desvio = (v) => {
  if (v.length < 2) return NaN
  const m = media(v)
  return Math.sqrt(v.reduce((s, x) => s + (x - m) ** 2, 0) / (v.length - 1))
}
const nul = (x) => (finito(x) ? x : null)
const fmtOd = (x, d = 3) => (finito(x) ? x.toFixed(d) : 'NA')

// ---------- lectura de archivos ----------
function aTexto(celda) {
  if (celda === null || celda === undefined) return ''
  if (celda instanceof Date) {
    const p = (n) => String(n).padStart(2, '0')
    return `${p(celda.getUTCDate())}/${p(celda.getUTCMonth() + 1)}/${celda.getUTCFullYear()}`
  }
  return String(celda)
}

async function decodificar(file) {
  const buf = await file.arrayBuffer()
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(buf)
  } catch {
    return new TextDecoder('windows-1252').decode(buf)
  }
}

export function parsearCSV(texto) {
  const limpio = texto.replace(/^﻿/, '')
  const muestra = limpio.split(/\r?\n/).slice(0, 30)
  const cuenta = [';', '\t', ','].map((s) => muestra.reduce((a, l) => a + (l.split(s).length - 1), 0))
  const max = Math.max(...cuenta)
  const sep = max === 0 ? ',' : [';', '\t', ','][cuenta.indexOf(max)]
  const filas = []
  let fila = [], campo = '', comillas = false
  for (let i = 0; i < limpio.length; i++) {
    const c = limpio[i]
    if (comillas) {
      if (c === '"') { if (limpio[i + 1] === '"') { campo += '"'; i++ } else comillas = false } else campo += c
    } else if (c === '"') comillas = true
    else if (c === sep) { fila.push(campo.trim()); campo = '' }
    else if (c === '\n') { fila.push(campo.trim()); filas.push(fila); fila = []; campo = '' }
    else if (c !== '\r') campo += c
  }
  if (campo !== '' || fila.length) { fila.push(campo.trim()); filas.push(fila) }
  const ancho = Math.max(...filas.map((f) => f.length), 1)
  return filas.map((f) => Array.from({ length: ancho }, (_, j) => f[j] ?? ''))
}

const cacheHojas = new WeakMap()
async function hojasExcel(file) {
  if (!cacheHojas.has(file)) cacheHojas.set(file, await leerHojasLibro(file))
  return cacheHojas.get(file)
}

export async function hojasDe(file) {
  return { hojas: (await hojasExcel(file)).map((h) => h.sheet) }
}

export async function leerCrudo(file, hoja) {
  const hojas = await hojasExcel(file)
  const h = hojas.find((x) => x.sheet === hoja) || hojas[0]
  const ancho = Math.max(...h.data.map((f) => f.length), 1)
  return h.data.map((f) => Array.from({ length: ancho }, (_, j) => (f[j] === undefined ? '' : f[j])))
}

// Busca 8 filas consecutivas A..H con >= 8 valores numéricos
export function leerPlacaDeMatriz(raw) {
  if (!raw.length || raw[0].length < 2) throw new Error('El archivo no contiene suficientes filas o columnas.')
  const c1 = raw.map((f) => aTexto(f[0]).trim())
  const nc = Math.min(raw[0].length, 13)
  const cuentaNum = raw.map((f) => f.slice(1, nc).filter((v) => finito(convertirNumero(v))).length)
  const esFila = c1.map((c, i) => LETRAS.includes(c.toUpperCase()) && cuentaNum[i] >= 8)

  let ini = -1
  for (let i = 0; i <= raw.length - 8; i++) {
    let ok = true
    for (let k = 0; k < 8; k++) if (!esFila[i + k] || c1[i + k].toUpperCase() !== LETRAS[k]) { ok = false; break }
    if (ok) { ini = i; break }
  }
  if (ini < 0) throw new Error('No encontré una placa (filas A a H con valores numéricos) en esta hoja.')

  let cols = Array.from({ length: nc - 1 }, (_, j) => j + 1)
  if (ini > 0) {
    const h = raw[ini - 1].slice(1, nc).map(convertirNumero)
    if (h.filter(finito).length >= 8) cols = h.map((v) => (finito(v) ? Math.trunc(v) : NaN))
  }
  const validos = new Set(pocillos96())
  const datos = []
  for (let k = 0; k < 8; k++) {
    const v = raw[ini + k].slice(1, nc).map(convertirNumero)
    v.forEach((od, j) => {
      const p = LETRAS[k] + cols[j]
      if (finito(od) && validos.has(p)) datos.push({ Pocillo: p, OD: od })
    })
  }
  let onda = NaN
  for (const c of c1) {
    const m = c.match(/[Ww]avelength[^0-9]*([0-9]+)/)
    if (m) { onda = Number(m[1]); break }
  }
  const fecha = c1.find((c) => /^[0-9]{1,2}\/[0-9]{1,2}\/[0-9]{4}/.test(c)) ?? null
  return { datos, onda: nul(onda), fecha }
}

export async function leerPlaca(file, hoja) {
  const raw = await leerCrudo(file, hoja)
  const p = leerPlacaDeMatriz(raw)
  const preview = raw.slice(0, 40).map((f) => f.slice(0, 14).map(aTexto))
  return { ...p, preview }
}

// ---------- detección de valores atípicos ----------
// Los tres métodos evalúan un pocillo por muestra (el más alejado) y necesitan al menos 3 pocillos.
export const METODOS_ATIPICOS = ['q', 'grubbs', 'cv']
export const normalizarMetodo = (m) => (METODOS_ATIPICOS.includes(m) ? m : 'q')   // sesiones viejas: hampel / dixon -> Q

// Test Q de Dixon (razón r10, n = 3 a 10)
export function detectarQ(x, conf = '95') {
  const n = x.length
  const res = { idx: null, stat: null, crit: null, n, lado: '' }
  if (n < 3 || n > 10 || x.some((v) => !finito(v))) return res
  const o = x.map((_, i) => i).sort((a, b) => x[a] - x[b])
  const s = o.map((i) => x[i])
  const rango = s[n - 1] - s[0]
  if (!(rango > 0)) return res
  const qBajo = (s[1] - s[0]) / rango
  const qAlto = (s[n - 1] - s[n - 2]) / rango
  res.stat = Math.max(qBajo, qAlto)
  res.crit = Q_TABLA[conf][n - 3]
  res.lado = qAlto > qBajo ? 'superior' : 'inferior'
  if (res.stat > res.crit) res.idx = qAlto > qBajo ? o[n - 1] : o[0]
  return res
}

// Valor crítico de Grubbs (bilateral): G = (n − 1)/√n · √(t² / (n − 2 + t²)), t = t(1 − α/(2n); n − 2)
export function criticoGrubbs(n, conf = '95') {
  if (n < 3) return null
  const alfa = 1 - Number(conf) / 100
  const t = tCuantil(1 - alfa / (2 * n), n - 2)
  return ((n - 1) / Math.sqrt(n)) * Math.sqrt((t * t) / (n - 2 + t * t))
}

// Test de Grubbs: G = máx |xᵢ − x̄| / s
export function detectarGrubbs(x, conf = '95') {
  const n = x.length
  const res = { idx: null, stat: null, crit: null, n, lado: '' }
  if (n < 3 || x.some((v) => !finito(v))) return res
  const m = media(x), s = desvio(x)
  if (!(s > 0)) return res
  let k = 0
  x.forEach((v, i) => { if (Math.abs(v - m) > Math.abs(x[k] - m)) k = i })
  res.stat = Math.abs(x[k] - m) / s
  res.crit = criticoGrubbs(n, conf)
  res.lado = x[k] > m ? 'superior' : 'inferior'
  if (res.stat > res.crit) res.idx = k
  return res
}

// Coeficiente de variación (%RSD = 100 · s / x̄): si supera el límite, es sospechoso el pocillo
// más alejado de la media (el que más aporta a la dispersión)
export function detectarCV(x, limite = 20) {
  const n = x.length
  const res = { idx: null, stat: null, crit: limite, n, lado: '', cvSin: null }
  if (n < 3 || x.some((v) => !finito(v))) return res
  const m = media(x)
  if (!(m !== 0)) return res
  const cv = (100 * desvio(x)) / Math.abs(m)
  let k = 0
  x.forEach((v, i) => { if (Math.abs(v - m) > Math.abs(x[k] - m)) k = i })
  const resto = x.filter((_, i) => i !== k)
  res.stat = cv
  res.cvSin = (100 * desvio(resto)) / Math.abs(media(resto))
  res.lado = x[k] > m ? 'superior' : 'inferior'
  if (cv > limite) res.idx = k
  return res
}

// ---------- estado de cada pocillo, ODc y resumen ----------
export function estadoPocillos(datos, cfg, exclManual, exclForzado, det) {
  if (!cfg.length || !datos.length) return null
  const od = new Map(datos.map((d) => [d.Pocillo, d.OD]))
  const orden = Object.fromEntries(pocillos96().map((p, i) => [p, i]))
  const e = cfg.filter((c) => od.has(c.Pocillo)).map((c) => ({
    Pocillo: c.Pocillo, Muestra: c.Muestra, Replica: c.Replica, EsBlanco: !!c.EsBlanco, OD: od.get(c.Pocillo),
  })).sort((a, b) => orden[a.Pocillo] - orden[b.Pocillo])
  if (!e.length) return null

  const metodo = normalizarMetodo(det?.metodo)
  const conf = String(det?.conf || '95')
  const cvMax = finito(Number(det?.cvMax)) && Number(det.cvMax) > 0 ? Number(det.cvMax) : 20
  const manual = new Set(exclManual || [])
  const forzado = new Set(exclForzado || [])
  const detalle = e.map(() => '')
  e.forEach((r) => {
    r.Manual = manual.has(r.Pocillo)
    r.Estadistico = null; r.Critico = null; r.Sospechoso = false
  })
  for (const g of [...new Set(e.map((r) => r.Muestra))]) {
    const idx = e.map((r, i) => (r.Muestra === g && !r.Manual ? i : -1)).filter((i) => i >= 0)
    if (idx.length < 3) continue
    const x = idx.map((i) => e[i].OD)
    const d = metodo === 'grubbs' ? detectarGrubbs(x, conf) : metodo === 'cv' ? detectarCV(x, cvMax) : detectarQ(x, conf)
    idx.forEach((i) => { e[i].Estadistico = d.stat; e[i].Critico = d.crit })
    if (d.idx !== null) {
      const i = idx[d.idx]
      e[i].Sospechoso = true
      detalle[i] = metodo === 'grubbs'
        ? `Test de Grubbs (extremo ${d.lado}): G = ${d.stat.toFixed(3)} > crítico ${d.crit.toFixed(3)} (n = ${d.n}, confianza ${conf} %)`
        : metodo === 'cv'
          ? `CV de la muestra = ${d.stat.toFixed(1)} % > límite ${cvMax} % (pocillo más alejado de la media; sin él, CV = ${d.cvSin.toFixed(1)} %)`
          : `Test Q de Dixon (extremo ${d.lado}): Q = ${d.stat.toFixed(3)} > crítico ${d.crit.toFixed(3)} (n = ${d.n}, confianza ${conf} %)`
    }
  }
  e.forEach((r, i) => {
    r.Forzado = forzado.has(r.Pocillo)
    r.AutoExcl = !!det?.usar && r.Sospechoso && !r.Forzado
    r.Usado = !r.Manual && !r.AutoExcl
    r.Motivo = r.Manual ? 'Excluido manualmente'
      : r.AutoExcl ? `Excluido automáticamente. ${detalle[i]}`
        : r.Sospechoso && r.Forzado ? `Sospechoso, conservado manualmente. ${detalle[i]}`
          : r.Sospechoso ? `Sospechoso. ${detalle[i]} (exclusión automática desactivada)` : ''
  })
  return e
}

export function odcCalculo(e, blancosUsados) {
  const b = e ? e.filter((r) => r.EsBlanco && r.Usado && blancosUsados.includes(r.Muestra)) : []
  const n = b.length
  const m = n > 0 ? media(b.map((r) => r.OD)) : NaN
  const s = n > 1 ? desvio(b.map((r) => r.OD)) : NaN
  return { n, media: nul(m), sd: nul(s), k: 3, odc: n > 1 ? m + 3 * s : null }
}

export function clasificar(od, odc) {
  if (!finito(odc) || !finito(od)) return null
  return od <= odc ? CLASES[0] : od <= 2 * odc ? CLASES[1] : od <= 4 * odc ? CLASES[2] : CLASES[3]
}

export function resumenMuestras(e, odc) {
  const nb = e.filter((r) => !r.EsBlanco)
  return [...new Set(nb.map((r) => r.Muestra))].map((m) => {
    const g = nb.filter((r) => r.Muestra === m)
    const u = g.filter((r) => r.Usado).map((r) => r.OD)
    const na = u.length
    const Media = na > 0 ? media(u) : NaN
    const SD = na > 1 ? desvio(u) : NaN
    const SEM = SD / Math.sqrt(na)
    return {
      Muestra: m, N_total: g.length, N_aceptadas: na, N_excluidas: g.length - na,
      Media: nul(Media), SD: nul(SD), Sospechosos: g.filter((r) => r.Sospechoso).length,
      SEM: nul(SEM), IC95: na > 1 ? tCuantil(0.975, na - 1) * SEM : null,
      CV_pct: nul((100 * SD) / Media), Razon_ODc: finito(odc) ? nul(Media / odc) : null,
      Clasificacion: clasificar(Media, odc),
    }
  })
}

// Punto de entrada: mismo formato que la API de R (/api/analizar)
export function analizarLocal(p) {
  const cfg = p.config || []
  const e = estadoPocillos(p.datos || [], cfg, p.excl_manual, p.excl_forzado, p.deteccion)
  if (!e) return { estado: [], odc: odcCalculo(null, []), resumen: [] }
  const blancos = [...new Set(cfg.filter((c) => c.EsBlanco).map((c) => c.Muestra))].sort((a, b) => a.localeCompare(b, 'es'))
  const usados = p.blancos_usados ? blancos.filter((b) => p.blancos_usados.includes(b)) : blancos
  const odc = odcCalculo(e, usados)
  return { estado: e, odc, resumen: resumenMuestras(e, odc.odc), blancos }
}

// ---------- Excel ----------
export async function excelLocal(hojas) {
  const { default: escribir } = await import('write-excel-file/browser')
  const data = hojas.map((h) => ({
    sheet: String(h.nombre || 'Hoja').replace(/[[\]*?/\\:]/g, '_').slice(0, 31),
    data: [
      h.columnas.map((c) => ({ value: c, fontWeight: 'bold' })),
      ...h.filas.map((f) => f.map((v) => (v === null || v === undefined ? null : v))),
    ],
  }))
  return escribir(data).toBlob()
}
