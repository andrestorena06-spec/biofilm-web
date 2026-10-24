import { tCuantil } from './utils.js'

// Resumen de las muestras que son blanco (medio sin inocular), con el mismo formato que las filas de `resumen`,
// para poder dibujarlas junto a las demás en los gráficos. No tienen clasificación.
export function resumenBlancos(estado) {
  const bl = (estado || []).filter((e) => e.EsBlanco)
  return [...new Set(bl.map((e) => e.Muestra))].map((m) => {
    const g = bl.filter((e) => e.Muestra === m)
    const u = g.filter((e) => e.Usado).map((e) => e.OD)
    const n = u.length
    const media = n ? u.reduce((a, b) => a + b, 0) / n : NaN
    const sd = n > 1 ? Math.sqrt(u.reduce((a, b) => a + (b - media) ** 2, 0) / (n - 1)) : NaN
    const sem = sd / Math.sqrt(n)
    const f = (x) => (Number.isFinite(x) ? x : null)
    return {
      Muestra: m, EsBlanco: true, N_total: g.length, N_aceptadas: n, N_excluidas: g.length - n, Media: f(media), SD: f(sd), SEM: f(sem),
      IC95: n > 1 ? tCuantil(0.975, n - 1) * sem : null, CV_pct: media > 1e-6 ? f((100 * sd) / media) : null, Sospechosos: g.filter((e) => e.Sospechoso).length,
      Razon_ODc: null, Clasificacion: null,
    }
  })
}
