import { Grupo, InterruptorCinta } from './cinta.jsx'

// «Restar blanco»: un solo interruptor para todo el programa. Está en ODc y mapa, Calidad, Gráfico y Estadística;
// cambiarlo en cualquiera de ellas actualiza la corrección en todas las pantallas.
export const TIP_BLANCO = 'OD corregida = OD leída − media de los blancos aceptados de cada placa (los mismos del ODc).\n'
  + 'Es uno solo para todo el programa: cambia ODc y mapa, Calidad, Gráfico, Estadística, Datos, Métodos e informe, en todas las placas.\n'
  + 'Los valores atípicos, el ODc y la clasificación se calculan con la OD leída.'

export const BotonBlanco = ({ s }) => (
  <InterruptorCinta icono="matraz" texto="Restar blanco" valor={s.restarBlanco} onChange={s.setRestarBlanco} tip={TIP_BLANCO} />
)

export const GrupoBlanco = ({ s }) => <Grupo titulo="Blanco"><BotonBlanco s={s} /></Grupo>
