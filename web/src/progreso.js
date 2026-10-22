// Nombres de las pantallas (los mismos del menú)
export const TITULO_PASO = { resumen: 'Resumen', placas: 'Placas', pocillos: 'Pocillos', calidad: 'Calidad', odc: 'ODc y mapa', grafico: 'Gráfico', estadistica: 'Estadística', datos: 'Datos', metodos: 'Métodos' }

// Avance del análisis y lo que conviene revisar (Resumen, menú lateral y barra de estado)
const finito = Number.isFinite

// placas que cuentan: visibles y con datos
export const placasActivas = (exp) => exp.placas.filter((p) => !p.oculta)
export const conDatos = (exp) => placasActivas(exp).filter((p) => p.placa)

// ¿el paso tiene lo que necesita?
export function listo(id, exp, analisisMap) {
  if (!exp) return false
  const pl = conDatos(exp)
  const an = pl.map((p) => analisisMap[p.id]).filter((a) => a?.resumen?.length)
  switch (id) {
    case 'placas': return pl.length > 0
    case 'pocillos': return pl.length > 0 && pl.every((p) => p.config.length > 0)
    case 'calidad': return an.length > 0
    case 'odc': return an.length > 0 && an.every((a) => finito(a.odc?.odc))
    case 'grafico': case 'datos': return an.length > 0
    case 'estadistica': return an.length > 1
    default: return false
  }
}

// [{ nivel: 'aviso' | 'info', texto, ir, placa }]
export function pendientes(exp, analisisMap) {
  const out = []
  const vis = placasActivas(exp)
  if (!exp.placas.length) { out.push({ nivel: 'aviso', texto: 'Todavía no hay placas: cargá el Excel de cada lectura.', ir: 'placas' }); return out }
  const sinExcel = vis.filter((p) => !p.placa)
  if (sinExcel.length) out.push({ nivel: 'aviso', texto: `${sinExcel.length === 1 ? 'Una placa sin datos' : `${sinExcel.length} placas sin datos`}: ${sinExcel.map((p) => p.nombre).join(', ')}.`, ir: 'placas' })
  const sinCfg = vis.filter((p) => p.placa && !p.config.length)
  if (sinCfg.length) out.push({ nivel: 'aviso', texto: `Falta indicar qué muestra hay en cada pocillo: ${sinCfg.map((p) => p.nombre).join(', ')}.`, ir: 'pocillos', placa: sinCfg[0].id })
  const conCfg = vis.filter((p) => p.placa && p.config.length)
  const sinBlanco = conCfg.filter((p) => !p.config.some((c) => c.EsBlanco))
  if (sinBlanco.length) out.push({ nivel: 'aviso', texto: `Sin pocillos de blanco (no hay ODc ni clasificación): ${sinBlanco.map((p) => p.nombre).join(', ')}.`, ir: 'pocillos', placa: sinBlanco[0].id })
  const sinOdc = conCfg.filter((p) => p.config.some((c) => c.EsBlanco) && analisisMap[p.id] && !finito(analisisMap[p.id].odc?.odc))
  if (sinOdc.length) out.push({ nivel: 'aviso', texto: `ODc sin calcular (hacen falta 2 blancos aceptados): ${sinOdc.map((p) => p.nombre).join(', ')}.`, ir: 'odc', placa: sinOdc[0].id })
  if (vis.length > 1) {
    const sinMedio = vis.filter((p) => !p.medio)
    if (sinMedio.length) out.push({ nivel: 'info', texto: `${sinMedio.length === 1 ? 'Una placa' : `${sinMedio.length} placas`} sin medio de cultivo (no entra${sinMedio.length > 1 ? 'n' : ''} en las comparaciones por medio): ${sinMedio.map((p) => p.nombre).join(', ')}.`, ir: 'pocillos', placa: sinMedio[0].id })
  }
  const ondas = [...new Set(vis.map((p) => p.placa?.onda).filter(finito))]
  if (ondas.length > 1) out.push({ nivel: 'aviso', texto: `Las placas se leyeron a distintas longitudes de onda (${ondas.join(', ')} nm): la OD no es comparable entre ellas.`, ir: 'placas' })
  // control de calidad
  let sosp = 0, excl = 0, cvAlto = [], pocas = []
  conCfg.forEach((p) => {
    const a = analisisMap[p.id]
    if (!a?.estado) return
    sosp += a.estado.filter((e) => e.Sospechoso && e.Usado).length
    excl += a.estado.filter((e) => !e.Usado).length
    a.resumen.forEach((r) => {
      if (finito(r.CV_pct) && r.CV_pct > 20) cvAlto.push(`${r.Muestra} (${p.nombre}, ${r.CV_pct.toFixed(0)} %)`)
      if (r.N_aceptadas < 3) pocas.push(`${r.Muestra} (${p.nombre})`)
    })
  })
  if (sosp) out.push({ nivel: 'aviso', texto: `${sosp === 1 ? 'Un pocillo sospechoso' : `${sosp} pocillos sospechosos`} según el test de valores atípicos, todavía dentro del análisis.`, ir: 'calidad' })
  if (cvAlto.length) out.push({ nivel: 'info', texto: `CV entre réplicas mayor que 20 %: ${cvAlto.slice(0, 4).join(', ')}${cvAlto.length > 4 ? ` y ${cvAlto.length - 4} más` : ''}.`, ir: 'calidad' })
  if (pocas.length) out.push({ nivel: 'info', texto: `Menos de 3 réplicas aceptadas: ${pocas.slice(0, 4).join(', ')}${pocas.length > 4 ? ` y ${pocas.length - 4} más` : ''}.`, ir: 'calidad' })
  if (excl) out.push({ nivel: 'info', texto: `${excl === 1 ? 'Un pocillo excluido' : `${excl} pocillos excluidos`} del análisis (a mano o por el test).`, ir: 'calidad' })
  const ocultas = exp.placas.filter((p) => p.oculta)
  if (ocultas.length) out.push({ nivel: 'info', texto: `${ocultas.length === 1 ? 'Una placa oculta' : `${ocultas.length} placas ocultas`} (fuera de los cálculos): ${ocultas.map((p) => p.nombre).join(', ')}.`, ir: 'placas' })
  // réplicas biológicas por medio para la estadística
  const porMedio = {}
  conCfg.forEach((p) => { if (p.medio) porMedio[p.medio] = (porMedio[p.medio] || 0) + 1 })
  const pocasPl = Object.entries(porMedio).filter(([, n]) => n < 2).map(([m]) => m)
  if (conCfg.length > 1 && pocasPl.length) out.push({ nivel: 'info', texto: `Con una sola placa en ${pocasPl.join(', ')} no hay réplica biológica para comparar ese medio.`, ir: 'estadistica' })
  return out
}
