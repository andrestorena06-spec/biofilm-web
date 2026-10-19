import { CompararTab } from './comparar.jsx'
import { GraficoTab } from './tabs2.jsx'

// Pestaña «Gráfico»: arriba se elige qué mirar, la placa actual (barras y clasificación) o la comparación entre placas
export function GraficoPestana({ s }) {
  const o = s.opts.comparar
  const vista = o.vistaG === 'comparar' ? 'comparar' : 'placa'
  const poner = (v) => s.setOpts({ ...s.opts, comparar: { ...o, vistaG: v } })
  return (
    <div className="pagina-grafico">
      <div className="vista-grafico" role="tablist" aria-label="Qué gráfico ver">
        <button role="tab" aria-selected={vista === 'placa'} className={vista === 'placa' ? 'on' : ''} onClick={() => poner('placa')}
          data-tip={'Placa actual\nBarras de OD y clasificación de la placa que está activa.'}>
          <b>Ver la placa actual</b><small>{s.a ? s.a.nombre : 'barras y clasificación'}</small>
        </button>
        <button role="tab" aria-selected={vista === 'comparar'} className={vista === 'comparar' ? 'on' : ''} onClick={() => poner('comparar')}
          data-tip={'Comparar placas\nLas placas y muestras elegidas en un mismo gráfico, por placa, por medio de cultivo o por pocillo.'}>
          <b>Comparar placas</b><small>{s.placas.filter((p) => !p.oculta).length} placas</small>
        </button>
      </div>
      {vista === 'placa' ? <GraficoTab s={s} /> : <CompararTab s={s} />}
    </div>
  )
}
