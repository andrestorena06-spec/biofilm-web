// ============================================================
// Serotipo de cada cepa (se carga en «Datos del experimento»): exp.serotipos = { muestra: '1/2a', … }
// Sirve para comparar serotipos en Estadística y para agrupar por serotipo en Gráfico › Comparar placas.
// ============================================================
import { media } from './estadistica.js'

// serotipos de Listeria monocytogenes (se pueden escribir otros)
export const SEROTIPOS_SUG = ['1/2a', '1/2b', '1/2c', '3a', '3b', '3c', '4a', '4ab', '4b', '4c', '4d', '4e', '7']

export const seroDe = (exp, m) => String(exp?.serotipos?.[m] || '').trim()

// serotipos presentes entre esas cepas, en el orden de la lista de muestras
export const serotiposDe = (exp, cepas) => [...new Set(cepas.map((c) => seroDe(exp, c)).filter(Boolean))]

// cepas de cada serotipo
export const cepasDeSero = (exp, cepas, sero) => cepas.filter((c) => seroDe(exp, c) === sero)

// Valores de un serotipo según la réplica elegida:
//  'cepa'    → un valor por cepa (la media de sus placas): la cepa es la réplica del serotipo (recomendado)
//  'placa'   → un valor por placa y cepa
//  'pocillo' → todos los pocillos
// obsPlaca / obsPozo: [{ cepa, medio, placaId, placa, y, etq }]
export function valoresSerotipo(obsPlaca, obsPozo, cepas, nivel) {
  if (nivel === 'pocillo') return obsPozo.filter((x) => cepas.includes(x.cepa))
  if (nivel === 'placa') return obsPlaca.filter((x) => cepas.includes(x.cepa))
  return cepas.map((c) => {
    const v = obsPlaca.filter((x) => x.cepa === c)
    return v.length ? { cepa: c, y: media(v.map((x) => x.y)), n: v.length, etq: `${c} (media de ${v.length} ${v.length === 1 ? 'placa' : 'placas'})` } : null
  }).filter(Boolean)
}

export const NIVEL_SERO_TXT = {
  cepa: 'cada punto es una cepa (la media de sus placas)',
  placa: 'cada punto es una placa de una cepa',
  pocillo: 'cada punto es un pocillo',
}
