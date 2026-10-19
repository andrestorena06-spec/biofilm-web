import { useMemo } from 'react'
import { Vacio } from './tabs.jsx'
import { Panel } from './ui.jsx'
import { Nota } from './tip.jsx'
import { PanelPruebas, ResultadosPruebas, objetivoDe } from './pruebas.jsx'
import { ReproTab } from './repro.jsx'
import { armarComparacion } from '../comparacion.js'

// Pestaña «Estadística»: pruebas y tablas de resultados (el gráfico de comparación está en «Gráfico»)
export function EstadisticaTab({ s }) {
  const o = s.opts.comparar
  const setO = (k, v) => s.setOpts({ ...s.opts, comparar: { ...o, [k]: v } })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const D = useMemo(() => armarComparacion(s), [s.placas, s.analisisMap, s.muestras, o])
  if (!D.conAnalisis.length) return <Vacio texto="Cargá al menos dos placas (botón «+ Agregar placa»), configurá sus pocillos y volvé acá para compararlas." />
  const panel = <PanelPruebas o={o} setO={setO} D={D} />
  if (objetivoDe(o) === 'concordancia') return <ReproTab s={s} D={D} o={o} setO={setO} selectorModo={panel} />
  const nOcultas = (o.ocultos || []).length
  // pocillos que NO entran en las pruebas: excluidos a mano o por el criterio de valores atípicos
  const fuera = D.placasSel.flatMap((p) => (s.analisisMap[p.id]?.estado || []).filter((e) => !e.EsBlanco && !e.Usado).map((e) => ({ placa: p.nombre, ...e })))
  return (
    <div className="con-lateral">
      <Panel titulo="Estadística">
        {panel}
        <hr />
        <div className="datos-incluidos">
          <h3 className="sub-seccion">Datos incluidos <Nota>Las pruebas usan las placas y muestras que elegiste en «Gráfico › Comparar placas». Cada placa es una réplica.</Nota></h3>
          <div className="fila-chips">
            {D.placasSel.map((p) => <span key={p.id} className="chip-op on" style={{ cursor: 'default' }} data-tip={`${p.nombre}\nMedio: ${p.medio || 'sin medio'}`}>{p.nombre}{p.medio ? ` · ${p.medio}` : ''}</span>)}
          </div>
          <p className={fuera.length ? 'aviso-sel' : 'ayuda'} data-tip={fuera.length ? `Pocillos que no entran en las pruebas\n${fuera.map((e) => `${e.placa} · ${e.Pocillo} (${e.Muestra}): OD ${e.OD.toFixed(3)} — ${e.Manual ? 'excluido a mano' : 'valor atípico excluido'}`).join('\n')}` : undefined}>
            {fuera.length ? `${fuera.length} ${fuera.length === 1 ? 'pocillo excluido' : 'pocillos excluidos'} (a mano o por valores atípicos): no entran en las pruebas. ` : 'Ningún pocillo excluido. '}
          </p>
          <p className="ayuda">{D.placasSel.length} {D.placasSel.length === 1 ? 'placa' : 'placas'} · {D.muestras.length} muestras{nOcultas ? ` · ${nOcultas} ocultas` : ''}{D.verBlancos ? ' · con blancos' : ''}</p>
          <button className="chico" onClick={() => { s.setOpts({ ...s.opts, comparar: { ...o, vistaG: 'comparar' } }); s.irA('grafico') }}>Cambiar en Gráfico › Comparar</button>
        </div>
      </Panel>
      <div className="principal">
        <h1>Estadística <span className="sub">· {({ medios: 'entre medios', placas: 'entre placas', placastodas: 'entre placas (todos los medios)', cepas: 'entre cepas' })[objetivoDe(o)]}</span></h1>
        <ResultadosPruebas s={s} D={D} o={o} />
      </div>
    </div>
  )
}
