// ============================================================
// Motor de cálculo en JavaScript (equivalente al de R en api/funciones.R).
// Permite usar la aplicación completa en el navegador, sin servidor.
// Lectura de la placa, filtro de Hampel, test Q y de Dixon, ODc y clasificación
// (Stepanović et al., 2000).
// ============================================================
import { Q_TABLA, DIXON_TABLA } from './criticos.js'
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
  if (!cacheHojas.has(file)) {
    const { default: leer } = await import('read-excel-file/browser')
    cacheHojas.set(file, await leer(file))
  }
  return cacheHojas.get(file)
}

const esCSV = (nombre) => ['csv', 'txt', 'tsv'].includes(nombre.split('.').pop().toLowerCase())

export async function hojasDe(file) {
  if (esCSV(file.name)) return { hojas: ['csv'] }
  if (file.name.toLowerCase().endsWith('.xls')) {
    throw new Error('Los archivos .xls antiguos no se pueden leer en el navegador. Guardalo como .xlsx o .csv y probá de nuevo.')
  }
  return { hojas: (await hojasExcel(file)).map((h) => h.sheet) }
}

export async function leerCrudo(file, hoja) {
  if (esCSV(file.name)) return parsearCSV(await decodificar(file))
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
function hampelGrupo(x, nsig, minDif) {
  const n = x.length
  const res = { Mediana: Array(n).fill(null), Limite: Array(n).fill(null), Sospechoso: Array(n).fill(false) }
  const ok = x.map(finito)
  if (ok.filter(Boolean).length < 3) return res
  const med = mediana(x)
  const s = 1.4826 * mediana(x.map((v) => Math.abs(v - med)))
  const lim = Math.max(nsig * s, minDif)
  for (let i = 0; i < n; i++) {
    res.Mediana[i] = med
    res.Limite[i] = lim
    res.Sospechoso[i] = ok[i] && Math.abs(x[i] - med) > lim
  }
  return res
}

const varianteDixon = (n) => (n <= 7 ? 'r10' : n <= 10 ? 'r11' : n <= 13 ? 'r21' : 'r22')
function razonDixon(s, v) {
  const n = s.length
  const r = {
    r10: (s[1] - s[0]) / (s[n - 1] - s[0]),
    r11: (s[1] - s[0]) / (s[n - 2] - s[0]),
    r21: (s[2] - s[0]) / (s[n - 2] - s[0]),
    r22: (s[2] - s[0]) / (s[n - 3] - s[0]),
  }[v]
  return finito(r) ? r : 0
}

export function detectarDixon(x, conf = '95', metodo = 'q') {
  const n = x.length
  const res = { idx: null, stat: null, crit: null, variante: '', n, lado: '' }
  if (n < 3 || x.some((v) => !finito(v))) return res
  let v, crit
  if (metodo === 'q') {
    if (n > 10) return res
    v = 'r10'; crit = Q_TABLA[conf][n - 3]
  } else {
    if (n > 30) return res
    v = varianteDixon(n); crit = DIXON_TABLA[n - 3][{ 90: 2, 95: 3, 99: 4 }[conf]]
  }
  const o = x.map((_, i) => i).sort((a, b) => x[a] - x[b])
  const s = o.map((i) => x[i])
  if (s[n - 1] === s[0]) return res
  const rBajo = razonDixon(s, v)
  const rAlto = razonDixon(s.map((z) => -z).reverse(), v)
  res.stat = Math.max(rBajo, rAlto)
  res.crit = crit
  res.variante = v
  res.lado = rAlto > rBajo ? 'superior' : 'inferior'
  if (res.stat > crit) res.idx = rAlto > rBajo ? o[n - 1] : o[0]
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

  const metodo = det?.metodo || 'hampel'
  const nsig = finito(Number(det?.nsig)) ? Number(det.nsig) : 3
  const minDif = finito(Number(det?.min)) ? Number(det.min) : 0.02
  const conf = String(det?.conf || '95')
  const manual = new Set(exclManual || [])
  const forzado = new Set(exclForzado || [])
  const detalle = e.map(() => '')
  e.forEach((r) => {
    r.Manual = manual.has(r.Pocillo)
    r.Mediana = null; r.Limite = null; r.Estadistico = null; r.Critico = null; r.Sospechoso = false
  })
  for (const g of [...new Set(e.map((r) => r.Muestra))]) {
    const idx = e.map((r, i) => (r.Muestra === g && !r.Manual ? i : -1)).filter((i) => i >= 0)
    if (idx.length < 3) continue
    const x = idx.map((i) => e[i].OD)
    if (metodo === 'hampel') {
      const h = hampelGrupo(x, nsig, minDif)
      idx.forEach((i, k) => {
        e[i].Mediana = h.Mediana[k]; e[i].Limite = h.Limite[k]; e[i].Sospechoso = h.Sospechoso[k]
        detalle[i] = `Hampel: |OD − mediana| = ${fmtOd(Math.abs(e[i].OD - h.Mediana[k]))} > límite ${fmtOd(h.Limite[k])}`
      })
    } else {
      const d = detectarDixon(x, conf, metodo)
      idx.forEach((i) => { e[i].Estadistico = d.stat; e[i].Critico = d.crit })
      if (d.idx !== null) {
        const i = idx[d.idx]
        e[i].Sospechoso = true
        detalle[i] = `${metodo === 'q' ? 'Test Q' : 'Test de Dixon'} (${d.variante}, extremo ${d.lado}): ${metodo === 'q' ? 'Q' : 'r'} = ${d.stat.toFixed(3)} > crítico ${d.crit.toFixed(3)} (n = ${d.n}, confianza ${conf} %)`
      }
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
