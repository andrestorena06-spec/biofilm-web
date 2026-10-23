import { useMemo } from 'react'
import { Nota } from './tip.jsx'
import { Vacio } from './ui.jsx'
import { BotonCinta, Cinta, Grupo } from './cinta.jsx'
import { ResultadosPruebas, objetivoDe, usaMedio } from './pruebas.jsx'
import { BarraSeleccion, GrupoModo } from './seleccion.jsx'
import { ReproTab } from './repro.jsx'
import { armarComparacion } from '../comparacion.js'

// Pestaña «Estadística»: en la cinta se elige qué comparar; debajo la selección de grupos, las hipótesis, las pruebas y las tablas
export function EstadisticaTab({ s }) {
  const o = s.opts.comparar
  const setO = (k, v) => s.setOpts((x) => ({ ...x, comparar: { ...x.comparar, [k]: v } }))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const D = useMemo(() => armarComparacion(s), [s.placas, s.analisisMap, s.muestras, o])
  const grupoModo = <GrupoModo o={o} setO={setO} />
  const irDesarrollo = (
    <Grupo titulo="Desarrollo">
      <BotonCinta icono="libro" texto="Ver los cálculos" onClick={() => { s.irA('metodos'); setTimeout(() => document.getElementById('m-estadistica')?.scrollIntoView({ block: 'start' }), 80) }}
        tip="Cómo se elige cada prueba y su desarrollo completo con tus datos (pestaña «Métodos»)" />
    </Grupo>
  )
  if (!D.conAnalisis.length) return <><Cinta>{grupoModo}</Cinta><Vacio titulo="Todavía no hay placas analizadas" texto="Cargá las placas y configurá sus pocillos para compararlas." accion={<button className="primario" onClick={() => s.irA('placas')}>Ir a Placas</button>} /></>
  if (objetivoDe(o) === 'concordancia') return <ReproTab s={s} D={D} o={o} setO={setO} grupoModo={<>{grupoModo}{irDesarrollo}</>} />
  const nOcultas = (o.ocultos || []).length
  const sinAnalisis = s.placas.filter((p) => !p.oculta && !s.analisisMap[p.id]?.resumen?.length)
  const sinMedio = D.placasSel.filter((p) => !p.medio)
  // pocillos que NO entran en las pruebas: excluidos a mano o por el criterio de valores atípicos
  const fuera = D.placasSel.flatMap((p) => (s.analisisMap[p.id]?.estado || []).filter((e) => !e.EsBlanco && !e.Usado).map((e) => ({ placa: p.nombre, ...e })))
  return (
    <div className="estadistica-pag">
      <Cinta>{grupoModo}{irDesarrollo}</Cinta>
      <BarraSeleccion s={s} D={D} o={o} setO={setO} />
      {sinAnalisis.length > 0 && <p className="aviso-caja">{sinAnalisis.map((p) => `«${p.nombre}»`).join(', ')} {sinAnalisis.length === 1 ? 'todavía no entra' : 'todavía no entran'} en las pruebas: {sinAnalisis.some((p) => !p.placa) ? 'faltan los datos (Excel u OD a mano) o ' : ''}falta indicar qué muestra hay en cada pocillo. <button className="chico" onClick={() => { s.setActiva(sinAnalisis[0].id); s.irA(sinAnalisis[0].placa ? 'pocillos' : 'placas') }}>Completar</button></p>}
      {usaMedio(objetivoDe(o)) && sinMedio.length > 0 && <p className="aviso-caja">{sinMedio.map((p) => `«${p.nombre}»`).join(', ')} no {sinMedio.length === 1 ? 'tiene' : 'tienen'} medio de cultivo: no {sinMedio.length === 1 ? 'entra' : 'entran'} en las comparaciones que separan por medio. <button className="chico" onClick={() => { s.setActiva(sinMedio[0].id); s.irA('pocillos') }}>Elegir el medio</button></p>}
      <p className={fuera.length ? 'aviso-sel' : 'ayuda'} data-tip={fuera.length ? `Pocillos que no entran en las pruebas\n${fuera.map((e) => `${e.placa} · ${e.Pocillo} (${e.Muestra}): OD ${e.OD.toFixed(3)} — ${e.Manual ? 'excluido a mano' : 'valor atípico excluido'}`).join('\n')}` : undefined}>
        {fuera.length ? `${fuera.length} ${fuera.length === 1 ? 'pocillo excluido' : 'pocillos excluidos'} (a mano o por valores atípicos): no entran en las pruebas. ` : 'Ningún pocillo excluido. '}
        {D.placasSel.length} {D.placasSel.length === 1 ? 'placa' : 'placas'}{nOcultas ? ` · ${nOcultas} muestras ocultas` : ''}
        <Nota>Las placas y muestras que entran se eligen en «Gráfico › Comparar placas» (y las placas ocultas quedan afuera). Cada placa es una réplica biológica.</Nota>
      </p>
      <ResultadosPruebas s={s} D={D} o={o} />
    </div>
  )
}
