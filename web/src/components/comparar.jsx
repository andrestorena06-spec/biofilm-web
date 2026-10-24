import { useMemo, useRef, useState } from 'react'
import { CompararChart } from './compararchart.jsx'
import { Nota } from './tip.jsx'
import { ExportDialog } from './exportar.jsx'
import { Check, EstiloDialog, MenuContextual, Num, RangoDialog, Select, Vacio, tamDe, useMenuContextual } from './ui.jsx'
import { BotonCinta, Cajon, CampoCinta, Cinta, Grupo, InterruptorCinta, OpcionesCinta } from './cinta.jsx'
import { armarComparacion } from '../comparacion.js'
import { ESCALAS, conRango, estiloDefecto, estiloEscala } from '../utils.js'

// Comparación entre placas: el gráfico (por placa, por medio de cultivo o por pocillo). Las pruebas están en «Estadística».
export function CompararTab({ s, grupoVista }) {
  const svg = useRef()
  const [menu, abrirMenu, cerrarMenu] = useMenuContextual()
  const [rng, setRng] = useState(false)
  const [dlg, setDlg] = useState(false)
  const [exp, setExp] = useState(false)
  const [cajon, setCajon] = useState(null)   // 'placas' | 'muestras'
  const o = s.opts.comparar
  const setVarios = (cambios) => s.setOpts((x) => ({ ...x, comparar: { ...x.comparar, ...cambios } }))
  const setO = (k, v) => setVarios({ [k]: v })

  // todos los datos del gráfico salen de un solo lugar; la vista (barras / cajas / puntos) no cambia nada de esto
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const D = useMemo(() => armarComparacion(s), [s.placas, s.analisisMap, s.muestras, o, s.opts.barras?.escala])
  const { modo, conAnalisis, placasSel, colores, colorBase, ocultos, clave, muestras, etiqueta, tieneMuestra, grupos, leyenda, nota, sinMedio, escala, rel, sinOdc } = D
  const eje = rel ? ESCALAS[escala].eje : s.ejeOD
  const umbTxt = rel ? ESCALAS[escala].umbrales.map((u) => u[0]).join(', ').replace(/, (\d)$/, ' y $1') : ''

  // elementos del gráfico (las sesiones viejas traían una sola opción «cajas»)
  const el = {
    barras: o.barras !== false, barrasError: o.barrasError !== false,
    caja: o.caja ?? !!o.cajas, mediana: o.mediana ?? !!o.cajas, bigotes: o.bigotes ?? !!o.cajas, media: o.media ?? !!o.cajas,
    puntos: o.puntos !== false, valores: o.valores !== false, errores: !!o.errores, rotar: o.rotar ?? 45,
    errorTipo: o.error, valoresClase: !!o.valoresClase,
    errorNombre: { sd: 'desviación estándar', sem: 'error estándar de la media', ic95: 'intervalo de confianza del 95 %', ninguno: 'error' }[o.error] || 'error',
  }
  const sinElementos = !el.barras && !el.caja && !el.mediana && !el.bigotes && !el.media && !el.puntos
  // la caja (cuartiles) y los bigotes solo tienen sentido con 5 o más datos por columna
  const nMaxCol = Math.max(0, ...grupos.flatMap((g) => g.barras.map((b) => b.pts.length)))
  const puedeCaja = nMaxCol >= 5
  const poner = (cambios) => setVarios({ ...cambios, cajas: undefined })

  if (!conAnalisis.length) return <><Cinta>{grupoVista}</Cinta><Vacio titulo="Todavía no hay placas para comparar" texto="Cargá al menos dos placas y configurá sus pocillos." accion={<button className="primario" onClick={() => s.irA('placas')}>Ir a Placas</button>} /></>

  // con un valor por placa y una sola placa en algún medio no hay error ni dispersión entre placas
  const porPlacaG = o.puntosMedio === 'placas'
  const medios1 = modo === 'medio' && porPlacaG ? [...new Set(grupos.flatMap((g) => g.barras.filter((b) => b.nPlacas < 2).map((b) => b.medio)))] : []
  const unaPlaca = modo === 'todas' && porPlacaG && placasSel.length < 2
  const nCols = grupos.reduce((a, g) => a + g.barras.length, 0)
  const grafico = (ref, tam, ctx) => <CompararChart ref={ref} grupos={grupos} leyenda={leyenda} o={el} est={s.estilos.comparar} eje={eje} onContext={ctx} tam={tam} nota={nota}
    clases={rel && o.lineas !== false} escala={escala} unidad={rel ? ESCALAS[escala].corto : 'OD'} />

  const cambiarCelda = (id, m, v) => { const k = clave(id, m); const sin = (o.ocultos || []).filter((x) => x !== k); setO('ocultos', v ? sin : [...sin, k]) }
  const cambiarFila = (m, v) => {
    const ks = placasSel.filter((p) => tieneMuestra(p, m)).map((p) => clave(p.id, m))
    const sin = (o.ocultos || []).filter((x) => !ks.includes(x))
    setO('ocultos', v ? sin : [...sin, ...ks])
  }
  const todoVisible = (v) => {
    const ks = placasSel.flatMap((p) => muestras.filter((m) => tieneMuestra(p, m)).map((m) => clave(p.id, m)))
    const sin = (o.ocultos || []).filter((x) => !ks.includes(x))
    setO('ocultos', v ? sin : [...sin, ...ks])
  }
  const nOcultas = (o.ocultos || []).length

  return (
    <div>
      <Cinta>
        {grupoVista}
        <Grupo titulo="Columnas">
          <OpcionesCinta valor={modo} onChange={(v) => setO('modo', v)} opciones={[
            ['placas', 'Por placa', null, 'placas', 'Una columna por placa (la altura es la OD media de sus réplicas)'],
            ['medio', 'Por medio', null, 'matraz', 'Una columna por medio de cultivo: las placas del mismo medio juntas (el medio se elige en «Pocillos»)'],
            ['todas', 'Todas', 'x̄', null, 'Una columna por cepa con todas las placas juntas, sin separar por medio: el promedio de cada cepa en todo el experimento'],
            ['pocillo', 'Por pocillo', null, 'puntos', 'Una columna por pocillo (sin error: un solo valor por columna)'],
          ]} />
          {(modo === 'medio' || modo === 'todas') && (
            <CampoCinta etiqueta={modo === 'medio' ? 'Datos de cada medio' : 'Datos'} tip={`Define los puntos, la media, el error y la dispersión.\nPocillos: todos los pocillos ${modo === 'medio' ? 'del medio' : 'de todas las placas'}.\nUn valor por placa: cada placa es una réplica biológica (hacen falta 2 o más placas para el error).`}>
              <Select value={o.puntosMedio || 'pocillos'} onChange={(v) => setO('puntosMedio', v)} opciones={[['pocillos', 'Pocillos'], ['placas', 'Un valor por placa']]} />
            </CampoCinta>
          )}
        </Grupo>
        <Grupo titulo="Datos">
          <BotonCinta icono="placas" texto={`Placas ${placasSel.length}/${conAnalisis.length}`} activo={cajon === 'placas'} onClick={() => setCajon(cajon === 'placas' ? null : 'placas')} tip="Elegir qué placas entran en el gráfico" />
          <BotonCinta icono="filtro" texto={nOcultas ? `Muestras (${nOcultas} ocultas)` : 'Muestras'} activo={cajon === 'muestras'} onClick={() => setCajon(cajon === 'muestras' ? null : 'muestras')} tip="Qué muestra se ve en cada placa" />
          <InterruptorCinta icono="matraz" texto="Blancos" valor={D.verBlancos} onChange={(v) => setO('blancos', v)} tip="Incluir los blancos (medio sin inocular)" />
        </Grupo>
        <Grupo titulo="Elementos">
          <InterruptorCinta simbolo="▮" texto="Barras" valor={el.barras} onChange={(v) => poner({ barras: v })} tip="Media de las réplicas aceptadas" />
          <InterruptorCinta simbolo="⊥" texto="Error" valor={el.barrasError} onChange={(v) => poner({ barrasError: v })} deshabilitado={modo === 'pocillo'} tip="Barra de error del tipo elegido" />
          <InterruptorCinta simbolo="▭" texto="Caja" valor={el.caja && puedeCaja} onChange={(v) => poner({ caja: v })} deshabilitado={!puedeCaja} tip={puedeCaja ? 'Cuartiles Q1–Q3: el 50 % central de los datos' : `Hacen falta 5 o más datos por columna (hoy el máximo es ${nMaxCol})`} />
          <InterruptorCinta simbolo="—" texto="Mediana" valor={el.mediana} onChange={(v) => poner({ mediana: v })} tip="Valor central: la mitad de los datos queda por debajo" />
          <InterruptorCinta simbolo="┆" texto="Mín–máx" valor={el.bigotes && puedeCaja} onChange={(v) => poner({ bigotes: v })} deshabilitado={!puedeCaja} tip="Bigotes del mínimo al máximo (5 o más datos por columna)" />
          <InterruptorCinta simbolo="◇" texto="Media" valor={el.media} onChange={(v) => poner({ media: v })} tip="Rombo en el promedio" />
          <InterruptorCinta icono="puntos" texto="Puntos" valor={el.puntos} onChange={(v) => poner({ puntos: v })} tip="Cada valor medido" />
          <InterruptorCinta simbolo="0,4" texto="Valores" valor={el.valores} onChange={(v) => poner({ valores: v })} tip="Escribe la media sobre cada columna" />
          <InterruptorCinta simbolo="±" texto="± error" valor={el.errores} onChange={(v) => poner({ errores: v })} deshabilitado={!el.valores} tip="Agrega el error al valor escrito" />
          {rel && <InterruptorCinta icono="umbral" texto="Clases" valor={o.lineas !== false} onChange={(v) => setO('lineas', v)} tip={`Líneas en ${umbTxt} (ODc, 2 × ODc y 4 × ODc de cada placa) con el nombre de cada clase.\nEn esta escala los umbrales son los mismos para todas las placas.`} />}
          {rel && <InterruptorCinta simbolo="0,3" texto="Umbrales" valor={!!o.valoresClase} onChange={(v) => setO('valoresClase', v)} deshabilitado={o.lineas === false} tip="Escribe el rango de cada clase bajo su nombre" />}
        </Grupo>
        <Grupo titulo="Ajustes">
          {modo !== 'pocillo' && <CampoCinta etiqueta="Error"><Select value={o.error} onChange={(v) => setO('error', v)} opciones={[['sd', 'DE'], ['sem', 'SEM'], ['ic95', 'IC 95 %'], ['ninguno', 'Ninguno']]} /></CampoCinta>}
          <CampoCinta etiqueta="Rotación (°)"><Num value={o.rotar} min={0} max={90} ancho={56} onChange={(v) => setO('rotar', v === '' ? 0 : v)} /></CampoCinta>
        </Grupo>
        <Grupo titulo="Imagen">
          <BotonCinta icono="imagen" texto="Guardar imagen" onClick={() => setExp(true)} deshabilitado={!grupos.length || sinElementos} tip="PNG o SVG con el tamaño y la resolución que elijas" />
          <BotonCinta simbolo="Aa" texto="Textos" onClick={() => setDlg(true)} tip="Título, leyendas, etiquetas y números (también con clic derecho)" />
          <BotonCinta icono="ordenar" texto="Eje Y" onClick={() => setRng(true)} tip="Mínimo y máximo del eje Y" />
        </Grupo>
      </Cinta>

      <Cajon titulo="Placas que entran en el gráfico" abierto={cajon === 'placas'} onClose={() => setCajon(null)}>
        <div className="fila" style={{ marginBottom: 8 }}>
          <button className="chico" onClick={() => setO('placasFuera', [])}>Todas</button>
          <button className="chico" onClick={() => setO('placasFuera', conAnalisis.map((x) => x.id))}>Ninguna</button>
        </div>
        <div className="lista-check columnas">
          {conAnalisis.map((p) => (
            <Check key={p.id} label={<><i className="punto" style={{ background: colores[p.id] || colorBase[p.id] }} /> {p.nombre}{p.medio && <small className="medio-placa">{p.medio}</small>}</>}
              checked={placasSel.some((x) => x.id === p.id)}
              onChange={(v) => setO('placasFuera', v ? (o.placasFuera || []).filter((x) => x !== p.id) : [...(o.placasFuera || []), p.id])} />
          ))}
        </div>
      </Cajon>
      <Cajon titulo="Qué muestra se ve en cada placa" abierto={cajon === 'muestras'} onClose={() => setCajon(null)}>
        <p className="ayuda" style={{ marginTop: 0 }}>Cada columna es una placa (mismo color que en el gráfico). Destildá una celda para ocultar esa muestra solo en esa placa, o la casilla de la izquierda para ocultarla en todas.</p>
        <div className="fila" style={{ marginBottom: 8 }}>
          <button className="chico" onClick={() => todoVisible(true)}>Mostrar todas</button>
          <button className="chico" onClick={() => todoVisible(false)}>Ocultar todas</button>
        </div>
        <div className="tabla-scroll">
          <table className="tabla compacta matriz-muestras">
            <thead><tr><th>Muestra</th>{placasSel.map((p) => <th key={p.id} className="celda-chk" data-tip={p.nombre}><i className="punto" style={{ background: colores[p.id] }} /> {p.nombre}</th>)}</tr></thead>
            <tbody>
              {muestras.map((m) => {
                const todas = placasSel.filter((p) => tieneMuestra(p, m)).every((p) => !ocultos.has(clave(p.id, m)))
                return (
                  <tr key={m}>
                    <td><label className="check" style={{ margin: 0 }}><input type="checkbox" checked={todas} onChange={(e) => cambiarFila(m, e.target.checked)} /><span>{etiqueta(m)}</span></label></td>
                    {placasSel.map((p) => (
                      <td key={p.id} className="celda-chk">
                        {tieneMuestra(p, m) ? <input type="checkbox" checked={!ocultos.has(clave(p.id, m))} onChange={(e) => cambiarCelda(p.id, m, e.target.checked)} aria-label={`${m} en ${p.nombre}`} /> : <span className="tenue">–</span>}
                      </td>
                    ))}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </Cajon>

      {sinOdc.length > 0 && <p className="aviso-caja">Sin ODc (faltan blancos aceptados), no entran en la escala {ESCALAS[escala].eje}: {sinOdc.map((p) => p.nombre).join(', ')}.</p>}
      {modo === 'medio' && sinMedio.length > 0 && <p className="aviso-caja">Placas sin medio indicado (no se muestran): {sinMedio.map((p) => p.nombre).join(', ')}. Elegí su medio en «Pocillos» o en «Placas».</p>}
      {unaPlaca && <p className="aviso-caja">Con una sola placa no hay error ni dispersión entre placas. Elegí «Pocillos» para verlos.</p>}
      {medios1.length > 0 && <p className="aviso-caja">Con una sola placa en {medios1.join(', ')} no hay error ni dispersión entre placas. Elegí «Pocillos» para verlos.</p>}
      <section className="tarjeta">
        <div className="cabeza-tarjeta">
          <span className="etiqueta-seccion">{modo === 'medio' ? 'Por medio de cultivo' : modo === 'todas' ? 'Todas las placas juntas' : modo === 'pocillo' ? 'Pocillo por pocillo' : 'Placa por placa'} · {placasSel.length} {placasSel.length === 1 ? 'placa' : 'placas'} · {nCols} columnas</span>
          <span className="ayuda">Pasá el mouse por una barra, caja o punto para ver su valor y el cálculo<Nota>Las pruebas estadísticas entre cepas, medios y placas están en «Estadística». Clic derecho sobre el gráfico: estilo de los textos, rango del eje Y y guardar la imagen.</Nota></span>
        </div>
        {grupos.length && !sinElementos ? <div className="figura">{grafico(svg, undefined, abrirMenu)}</div>
          : <Vacio texto={sinElementos ? 'Activá barras, mediana, media o puntos en la cinta.' : 'Elegí al menos una placa y una muestra para mostrar.'} />}
      </section>

      <MenuContextual menu={menu} items={[
        ['Estilo de texto…', () => { cerrarMenu(); setDlg(true) }],
        ['Rango del eje Y…', () => { cerrarMenu(); setRng(true) }],
        ['Guardar imagen…', () => { cerrarMenu(); setExp(true) }],
        ['Restablecer estilo de texto', () => { cerrarMenu(); s.setEstilos((e) => ({ ...e, comparar: estiloDefecto() })) }],
      ]} />
      {rng && <RangoDialog est={estiloEscala(s.estilos.comparar, escala)} onClose={() => setRng(false)} onGuardar={(e) => { s.setEstilos((x) => ({ ...x, comparar: conRango(x.comparar, e, escala) })); setRng(false) }} />}
      {dlg && <EstiloDialog estilo={s.estilos.comparar} conClases={rel} ejeDefecto={eje} onClose={() => setDlg(false)}
        onGuardar={(e) => { s.setEstilos((x) => ({ ...x, comparar: e })); setDlg(false) }} />}
      {exp && svg.current && <ExportDialog nombre="comparacion_placas" size0={tamDe(svg.current)} onClose={() => setExp(false)} render={(ref, tam) => grafico(ref, tam, (e) => e.preventDefault())} />}
    </div>
  )
}
