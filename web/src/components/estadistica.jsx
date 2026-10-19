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
          <p className="ayuda">{D.placasSel.length} {D.placasSel.length === 1 ? 'placa' : 'placas'} · {D.muestras.length} muestras{nOcultas ? ` · ${nOcultas} ocultas` : ''}{D.verBlancos ? ' · con blancos' : ''}</p>
          <button className="chico" onClick={() => { s.setOpts({ ...s.opts, comparar: { ...o, vistaG: 'comparar' } }); s.irA('grafico') }}>Cambiar en Gráfico › Comparar</button>
        </div>
      </Panel>
      <div className="principal">
        <h1>Estadística <span className="sub">· {({ medios: 'entre medios', placas: 'entre placas', cepas: 'entre cepas' })[objetivoDe(o)]}</span></h1>
        <ResultadosPruebas s={s} D={D} o={o} />
      </div>
    </div>
  )
}
