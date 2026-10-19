import { useMemo } from 'react'
import { Vacio } from './tabs.jsx'
import { Nota } from './tip.jsx'
import { ResultadosPruebas, objetivoDe } from './pruebas.jsx'
import { BarraSeleccion, SelectorModo } from './seleccion.jsx'
import { ReproTab } from './repro.jsx'
import { armarComparacion } from '../comparacion.js'

// Pestaña «Estadística»: arriba la selección horizontal de qué se compara; debajo hipótesis, pruebas y tablas.
export function EstadisticaTab({ s }) {
  const o = s.opts.comparar
  const setO = (k, v) => s.setOpts({ ...s.opts, comparar: { ...o, [k]: v } })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const D = useMemo(() => armarComparacion(s), [s.placas, s.analisisMap, s.muestras, o])
  if (!D.conAnalisis.length) return <Vacio texto="Cargá al menos dos placas (botón «+ Agregar placa»), configurá sus pocillos y volvé acá para compararlas." />
  if (objetivoDe(o) === 'concordancia') {
    return (
      <div>
        <section className="barra-seleccion"><div className="barra-fila"><div className="barra-modo"><span className="multi-t">¿Qué comparar?</span><SelectorModo o={o} setO={setO} /></div></div></section>
        <ReproTab s={s} D={D} o={o} setO={setO} selectorModo={null} />
      </div>
    )
  }
  const nOcultas = (o.ocultos || []).length
  // pocillos que NO entran en las pruebas: excluidos a mano o por el criterio de valores atípicos
  const fuera = D.placasSel.flatMap((p) => (s.analisisMap[p.id]?.estado || []).filter((e) => !e.EsBlanco && !e.Usado).map((e) => ({ placa: p.nombre, ...e })))
  const titulo = { libre: 'a medida', medios: 'entre medios', placas: 'entre placas', placastodas: 'entre placas (todos los medios)', cepas: 'entre cepas', cepastodas: 'entre cepas (todos los medios)' }[objetivoDe(o)]
  return (
    <div className="estadistica-pag">
      <BarraSeleccion s={s} D={D} o={o} setO={setO} />
      <div className="principal">
        <h1>Estadística <span className="sub">· {titulo}</span></h1>
        <p className={fuera.length ? 'aviso-sel' : 'ayuda'} data-tip={fuera.length ? `Pocillos que no entran en las pruebas\n${fuera.map((e) => `${e.placa} · ${e.Pocillo} (${e.Muestra}): OD ${e.OD.toFixed(3)} — ${e.Manual ? 'excluido a mano' : 'valor atípico excluido'}`).join('\n')}` : undefined}>
          {fuera.length ? `${fuera.length} ${fuera.length === 1 ? 'pocillo excluido' : 'pocillos excluidos'} (a mano o por valores atípicos): no entran en las pruebas. ` : 'Ningún pocillo excluido. '}
          {D.placasSel.length} {D.placasSel.length === 1 ? 'placa' : 'placas'}{nOcultas ? ` · ${nOcultas} muestras ocultas` : ''}
          <Nota>Las placas y muestras ocultas se cambian en «Gráfico › Comparar placas». Cada placa es una réplica biológica.</Nota>
        </p>
        <ResultadosPruebas s={s} D={D} o={o} />
      </div>
    </div>
  )
}
