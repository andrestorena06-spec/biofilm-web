import { CompararTab } from './comparar.jsx'
import { GraficoTab } from './tabs2.jsx'
import { Grupo, OpcionesCinta } from './cinta.jsx'

// Pestaña «Gráfico»: en la cinta se elige qué mirar, la placa activa (barras y clasificación) o la comparación entre placas
export function GraficoPestana({ s }) {
  const vista = s.opts.comparar.vistaG === 'comparar' ? 'comparar' : 'placa'
  const poner = (v) => s.setOpts((o) => ({ ...o, comparar: { ...o.comparar, vistaG: v } }))
  const grupoVista = (
    <Grupo titulo="Ver">
      <OpcionesCinta valor={vista} onChange={poner} opciones={[
        ['placa', 'Placa activa', null, 'barras', `Placa activa\nBarras de OD y clasificación de «${s.a?.nombre || 'la placa elegida'}»`],
        ['comparar', 'Comparar placas', null, 'placas', 'Comparar placas\nLas placas y muestras elegidas en un mismo gráfico: por placa, por medio de cultivo o por pocillo'],
      ]} />
    </Grupo>
  )
  return vista === 'placa' ? <GraficoTab s={s} grupoVista={grupoVista} /> : <CompararTab s={s} grupoVista={grupoVista} />
}
