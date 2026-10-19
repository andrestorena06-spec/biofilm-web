// Significado de siglas, símbolos y términos: se muestra al pasar el mouse sobre la palabra (ver GloboInfo en components/tip.jsx).
// Formato: 'palabra': 'Nombre completo\nExplicación o fórmula'
export const SIGLAS = {
  OD: 'Densidad óptica (OD)\nAbsorbancia del cristal violeta disuelto, medida a 560, 595 o 600 nm. Más OD = más biofilm adherido.',
  DO: 'Densidad óptica (DO)\nAbsorbancia del cristal violeta disuelto. Más DO = más biofilm adherido.',
  ODc: 'Punto de corte (ODc)\nODc = media de los blancos + 3 × DE de los blancos (Stepanović et al., 2000). Separa productores de no productores.',
  DE: 'Desviación estándar\ns = √[Σ(x − x̄)² / (n − 1)]. Dispersión de los datos en sus unidades.',
  SD: 'Desviación estándar (SD)\ns = √[Σ(x − x̄)² / (n − 1)].',
  EE: 'Error estándar\nDesvío de una media o de una diferencia de medias: s/√n (o la raíz de la suma de varianzas/n).',
  CV: 'Coeficiente de variación\nCV (%) = 100 · DE / media. Variabilidad relativa; sirve para comparar dispersión entre cepas o placas.',
  SC: 'Suma de cuadrados\nΣ (valor − media)²: variación total atribuida a una fuente.',
  CM: 'Cuadrado medio\nCM = SC / gl. Es una varianza; el cociente de dos CM da el F.',
  gl: 'Grados de libertad\nNúmero de datos independientes disponibles para estimar una variación (entre: k − 1; dentro: N − k).',
  RSS: 'Suma de cuadrados residual (RSS)\nΣ (dato − valor ajustado)². Lo que el modelo no explica.',
  ICC: 'Coeficiente de correlación intraclase\nProporción de la variación que se debe a las cepas y no a las placas. < 0,5 pobre · 0,5–0,75 moderada · 0,75–0,9 buena · > 0,9 excelente.',
  UFC: 'Unidades formadoras de colonia\nCantidad de bacterias viables contadas como colonias en placa.',
  BHI: 'Caldo infusión cerebro-corazón (BHI)\nMedio de cultivo rico, de uso general para Listeria.',
  TSBye: 'Caldo tripticasa de soja con extracto de levadura (TSB-YE)\nMedio de cultivo usado para biofilm de Listeria.',
  SCV: 'Variante de colonia pequeña (small colony variant)\nFenotipo de colonias pequeñas de la cepa.',
  Rug: 'Variante rugosa\nFenotipo de colonias de aspecto rugoso de la cepa.',
  ANOVA: 'Análisis de la varianza\nCompara las medias de varios grupos con F = CM entre / CM dentro. H₀: todas las medias son iguales.',
  Welch: 'ANOVA / t de Welch\nVersión que no exige varianzas iguales: pondera cada grupo por n/s² y corrige los grados de libertad (Welch–Satterthwaite).',
  KW: 'Kruskal-Wallis\nANOVA basado en rangos; no exige normalidad.',
  'Kruskal-Wallis': 'Prueba de Kruskal-Wallis\nCompara grupos con los rangos de los datos: H = 12/(N(N+1)) · Σ R²/n − 3(N+1). No exige normalidad.',
  Dunn: 'Prueba de Dunn\nComparaciones de a pares tras Kruskal-Wallis, con z sobre rangos medios y ajuste de Holm.',
  Dunnett: 'Prueba de Dunnett\nCompara cada grupo contra un control controlando el error de toda la familia con la t multivariada.',
  Holm: 'Ajuste de Holm (Holm-Bonferroni)\nOrdena los p de menor a mayor y multiplica el i-ésimo por (m − i + 1); controla el error por familia.',
  'Shapiro-Wilk': 'Prueba de Shapiro-Wilk\nPrueba de normalidad. H₀: los datos (residuos) vienen de una distribución normal. p < 0,05 → se rechaza.',
  Shapiro: 'Prueba de Shapiro-Wilk\nPrueba de normalidad de los residuos.',
  Levene: 'Prueba de Levene (Brown-Forsythe)\nPrueba de igualdad de varianzas: ANOVA sobre |dato − mediana del grupo|. p < 0,05 → varianzas distintas.',
  'Brown-Forsythe': 'Brown-Forsythe\nVersión de Levene que usa la mediana, más robusta a valores extremos.',
  Royston: 'Aproximación de Royston\nMétodo (AS R94) para calcular los coeficientes y el p de Shapiro-Wilk.',
  AS: 'Algoritmo estadístico (Applied Statistics)\nSerie de algoritmos publicados; AS R94 es el de Royston para Shapiro-Wilk.',
  QR: 'Descomposición QR\nMétodo numérico para ajustar mínimos cuadrados de forma estable.',
  'Q–Q': 'Gráfico cuantil-cuantil\nCompara cada residuo ordenado con el valor esperado bajo normalidad; los puntos sobre la recta indican normalidad.',
  Q: 'Q de Dixon\nPrueba de valores atípicos: Q = (distancia al vecino más cercano) / (rango).',
  Dixon: 'Prueba Q de Dixon\nDetecta un valor atípico en muestras pequeñas: Q = |extremo − vecino| / rango.',
  Grubbs: 'Prueba de Grubbs\nDetecta un valor atípico: G = |x − media| / s.',
  'H₀': 'Hipótesis nula\nNo hay diferencia (o efecto). Se rechaza si p < α.',
  'H₁': 'Hipótesis alternativa\nHay diferencia o efecto.',
  H: 'Estadístico H de Kruskal-Wallis\nH = 12/(N(N+1)) · Σ R²/n − 3(N+1); se compara con χ² de k − 1 gl.',
  'α': 'Nivel de significancia (α)\nProbabilidad aceptada de falso positivo; aquí 0,05.',
  p: 'Valor p\nProbabilidad de obtener una diferencia tan grande o mayor si H₀ fuera cierta. p < 0,05 → significativo.',
  F: 'Estadístico F\nF = CM entre / CM dentro. Grande → los grupos se separan más de lo que varían internamente.',
  t: 'Estadístico t de Student\nDiferencia de medias dividida por su error estándar.',
  n: 'n: tamaño del grupo\nCantidad de datos de un grupo.',
  N: 'N: total de datos\nSuma de los n de todos los grupos.',
  k: 'k: cantidad de grupos\nNúmero de grupos que se comparan.',
  W: 'Estadístico W de Shapiro-Wilk\nCerca de 1 → normalidad. Menor valor → más apartamiento de la normal.',
  R: 'R: suma de rangos\nSuma de las posiciones (rangos) de los datos de un grupo (Kruskal-Wallis). En muestras R1–R4: réplica 1 a 4.',
  ln: 'Logaritmo natural\nTransforma la OD para estabilizar la varianza: las diferencias pasan a ser razones.',
  'x̄': 'Media\nx̄ = Σ x / n',
  s: 'Desviación estándar muestral\ns = √[Σ(x − x̄)² / (n − 1)]',
  's²': 'Varianza muestral\ns² = Σ(x − x̄)² / (n − 1)',
  'μ': 'Media poblacional (μ)\nValor real, desconocido, que la media muestral estima.',
  'λ': 'λ (Dunnett)\nλᵢ = √[nᵢ / (nᵢ + n_control)]: correlación entre comparaciones que comparten control.',
  'Λ': 'Λ (Welch)\nΛ = Σ (1 − wᵢ/W)² / (nᵢ − 1): corrige los grados de libertad.',
  'ρ': 'Coeficiente de Spearman (ρ)\nCorrelación entre rangos; mide si dos variables crecen juntas.',
  w: 'Peso de Welch\nw = n / s²: los grupos más precisos pesan más.',
  PBS: 'Solución salina tamponada (PBS)\nSe usa para lavar los pocillos.',
  IC: 'Intervalo de confianza\nRango plausible del valor real; IC 95 % deja 5 % de error.',
  'Pearson': 'Correlación de Pearson\nCorrelación lineal entre dos variables (−1 a 1).',
  'Spearman': 'Correlación de Spearman\nCorrelación entre rangos; no exige normalidad.',
  Student: 'Distribución t de Student\nDistribución de la diferencia de medias estandarizada con varianza estimada.',
  'χ²': 'Chi-cuadrado\nDistribución usada para el p de Kruskal-Wallis (k − 1 gl).',
  Stepanović: 'Stepanović et al. (2000)\nCriterio de clasificación de productores de biofilm basado en el ODc.',
  Listeria: 'Listeria\nBacteria cuya producción de biofilm se mide aquí con cristal violeta.',
  blancos: 'Blancos\nPocillos sin bacterias (solo medio) que dan la OD de fondo y sirven para el ODc.',
  Usado: 'Usado\nIndica si el pocillo entra en los cálculos (no excluido a mano ni por valores atípicos).',
  pH: 'pH\nAcidez del medio.',
}

const LIMPIA = /[\p{L}\p{N}\p{M}₀-₉⁰-⁹²³'’-]/u
// devuelve el texto de ayuda de la palabra bajo el cursor (o null)
export function siglaBajo(x, y, corta = true) {
  let nodo, off
  if (document.caretPositionFromPoint) { const p = document.caretPositionFromPoint(x, y); if (p) { nodo = p.offsetNode; off = p.offset } }
  else if (document.caretRangeFromPoint) { const r = document.caretRangeFromPoint(x, y); if (r) { nodo = r.startContainer; off = r.startOffset } }
  if (!nodo || nodo.nodeType !== 3) return null
  const t = nodo.textContent
  // el cursor debe estar realmente sobre el texto (no en el hueco de la línea)
  try {
    const rg = document.createRange(); rg.setStart(nodo, Math.min(off, t.length)); rg.setEnd(nodo, Math.min(off + 1, t.length))
    const b = rg.getBoundingClientRect()
    const ok = (b.width || b.height) && x >= b.left - 8 && x <= b.right + 8 && y >= b.top - 2 && y <= b.bottom + 2
    if (!ok) return null
  } catch { return null }
  let a = off, z = off
  while (a > 0 && LIMPIA.test(t[a - 1])) a--
  while (z < t.length && LIMPIA.test(t[z])) z++
  let w = t.slice(a, z).replace(/^[-'’]+|[-'’]+$/g, '')
  if (!w) return null
  if (!corta && w.replace(/[₀-₉⁰-⁹²³0-9]+$/, '').length <= 1) return null
  if (SIGLAS[w]) return SIGLAS[w]
  const base = w.replace(/[₀-₉⁰-⁹²³0-9]+$/, '')
  if (base && SIGLAS[base]) return SIGLAS[base]
  // palabras compuestas con guion o con la sigla pegada (p. ej. «ODc», «Kruskal-Wallis», «ln(OD)»)
  const trozos = w.split(/[-–]/)
  if (trozos.length > 1 && SIGLAS[trozos[0]]) return SIGLAS[trozos[0]]
  return null
}
