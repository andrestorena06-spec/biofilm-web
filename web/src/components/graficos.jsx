import { CompararTab } from './comparar.jsx'
import { GraficoTab } from './tabs2.jsx'
import { Grupo, OpcionesCinta } from './cinta.jsx'
import { TXT_LOGODC } from '../utils.js'

// Pestaña «Gráfico»: en la cinta se elige qué mirar, la placa activa (barras y clasificación) o la comparación entre placas
export function GraficoPestana({ s }) {
  const vista = s.opts.comparar.vistaG === 'comparar' ? 'comparar' : 'placa'
  const poner = (v) => s.setOpts((o) => ({ ...o, comparar: { ...o.comparar, vistaG: v } }))
  const escala = s.opts.barras.escala === 'logodc' ? 'logodc' : 'od'
  const grupoVista = (<>
    <Grupo titulo="Ver">
      <OpcionesCinta valor={vista} onChange={poner} opciones={[
        ['placa', 'Placa activa', null, 'barras', `Placa activa\nBarras de OD y clasificación de «${s.a?.nombre || 'la placa elegida'}»`],
        ['comparar', 'Comparar placas', null, 'placas', 'Comparar placas\nLas placas y muestras elegidas en un mismo gráfico: por placa, por medio de cultivo o por pocillo'],
      ]} />
    </Grupo>
    <Grupo titulo="Escala">
      <OpcionesCinta valor={escala} onChange={(v) => s.setOpts((o) => ({ ...o, barras: { ...o.barras, escala: v } }))} opciones={[
        ['od', 'OD', 'OD', null, 'OD tal cual'],
        ['logodc', 'log ODc', 'log', null, `Escala ${TXT_LOGODC}\nCada OD se mide contra el ODc de su placa en escala logarítmica: 1 = ODc, 2 = 2 × ODc, 3 = 4 × ODc.\nQuita la variación de la tinción entre placas; las líneas de clase quedan en 1, 2 y 3.`],
      ]} />
    </Grupo>
  </>)
  return vista === 'placa' ? <GraficoTab s={s} grupoVista={grupoVista} /> : <CompararTab s={s} grupoVista={grupoVista} />
}
