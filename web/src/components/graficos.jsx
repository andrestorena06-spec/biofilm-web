import { CompararTab } from './comparar.jsx'
import { GraficoTab } from './tabs2.jsx'
import { Grupo, OpcionesCinta } from './cinta.jsx'
import { OrdenTab } from './orden.jsx'
const ESCALA_OPC = ['od', 'odc']

// Pestaña «Gráfico»: en la cinta se elige qué mirar: la placa activa (barras y clasificación), la comparación entre placas
// o el orden de las cepas de placa en placa (para decidir si se puede usar la placa como bloque)
export function GraficoPestana({ s }) {
  const vista = ['comparar', 'orden'].includes(s.opts.comparar.vistaG) ? s.opts.comparar.vistaG : 'placa'
  const poner = (v) => s.setOpts((o) => ({ ...o, comparar: { ...o.comparar, vistaG: v } }))
  const escala = ESCALA_OPC.includes(s.opts.barras.escala) ? s.opts.barras.escala : 'od'
  const grupoVer = (
    <Grupo titulo="Ver">
      <OpcionesCinta valor={vista} onChange={poner} opciones={[
        ['placa', 'Placa activa', null, 'barras', `Placa activa\nBarras de OD y clasificación de «${s.a?.nombre || 'la placa elegida'}»`],
        ['comparar', 'Comparar placas', null, 'placas', 'Comparar placas\nLas placas y muestras elegidas en un mismo gráfico: por placa, por medio de cultivo o por pocillo'],
        ['orden', 'Orden', null, 'ordenar', 'Orden de las cepas entre placas\n¿La cepa que más forma en una placa es también la que más forma en las otras? Sirve para decidir si se puede usar la placa como bloque en Estadística'],
      ]} />
    </Grupo>
  )
  const grupoVista = (<>
    {grupoVer}
    <Grupo titulo="Escala">
      <OpcionesCinta valor={escala} onChange={(v) => s.setOpts((o) => ({ ...o, barras: { ...o.barras, escala: v } }))} opciones={[
        ['od', 'OD', 'OD', null, 'OD tal cual'],
        ['odc', 'OD ÷ ODc', '÷', null, 'Escala OD ÷ ODc\nCada OD dividida por el ODc de su placa: cada unidad es un ODc (1 = ODc, 2 = 2 × ODc, 4 = 4 × ODc).\nQuita la variación de la tinción entre placas; las líneas de clase quedan en 1, 2 y 4.'],
      ]} />
    </Grupo>
  </>)
  if (vista === 'orden') return <OrdenTab s={s} grupoVer={grupoVer} />
  return vista === 'placa' ? <GraficoTab s={s} grupoVista={grupoVista} /> : <CompararTab s={s} grupoVista={grupoVista} />
}
