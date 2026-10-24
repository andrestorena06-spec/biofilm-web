// ============================================================
// Corrección por blanco (Calidad › Restar blanco)
// OD corregida = OD leída − media de los blancos aceptados de la placa (los mismos que dan el ODc).
// Se aplica al análisis de cada placa, así que llega a todo lo que viene después de Calidad.
// Los valores atípicos, el ODc y la clasificación de Stepanović se calculan antes, con la OD leída:
// restar una constante no cambia el test Q ni el de Grubbs, y los umbrales de clase están definidos sobre la OD leída.
// ============================================================
const finito = Number.isFinite

export function corregirAnalisis(a) {
  if (!a?.estado) return a
  const b = a.odc?.media
  if (!finito(b)) return { ...a, blanco: { restado: false } }
  const estado = a.estado.map((e) => ({ ...e, ODleida: e.OD, OD: e.OD - b }))
  const resumen = (a.resumen || []).map((r) => {
    const Media = finito(r.Media) ? r.Media - b : r.Media
    // el CV solo tiene sentido con media positiva
    return { ...r, MediaLeida: r.Media, Media, CV_pct: finito(r.SD) && Media > 0 ? (100 * r.SD) / Media : null }
  })
  return { ...a, estado, resumen, odc: { ...a.odc, resta: b }, blanco: { restado: true, valor: b, n: a.odc.n } }
}

// OD leída de un pocillo o de una media (sirve igual con o sin corrección)
export const odLeida = (v, a) => (finito(v) ? v + (a?.odc?.resta || 0) : v)

export const textoBlanco = (a) => (a?.blanco?.restado
  ? `OD corregida = OD leída − ${a.blanco.valor.toFixed(4)} (media de ${a.blanco.n} ${a.blanco.n === 1 ? 'blanco aceptado' : 'blancos aceptados'})`
  : '')
