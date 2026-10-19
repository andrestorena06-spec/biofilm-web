import { useMemo, useRef, useState } from 'react'
import { CompararChart } from './compararchart.jsx'
import { Nota } from './tip.jsx'
import { ExportDialog } from './exportar.jsx'
import { Vacio } from './tabs.jsx'
import { Campo, Check, EstiloDialog, MenuContextual, Num, Panel, RangoDialog, Select, useMenuContextual } from './ui.jsx'
import { anova1, holm, marcaSig, resumenGrupo, welch } from '../estadistica.js'
import { armarComparacion } from '../comparacion.js'
import { estiloDefecto, fmt } from '../utils.js'

const tamDe = (svg) => ({ w: svg.viewBox.baseVal.width, h: svg.viewBox.baseVal.height })
const pTxt = (p) => (p === null || p === undefined || !Number.isFinite(p) ? '–' : p < 0.0001 ? '< 0,0001' : p.toFixed(4).replace('.', ','))

export function CompararTab({ s }) {
  const svg = useRef()
  const [menu, abrirMenu, cerrarMenu] = useMenuContextual()
  const [rng, setRng] = useState(false)
  const [dlg, setDlg] = useState(false)
  const [exp, setExp] = useState(false)
  const o = s.opts.comparar
  const setO = (k, v) => s.setOpts({ ...s.opts, comparar: { ...o, [k]: v } })
  const setVarios = (cambios) => s.setOpts({ ...s.opts, comparar: { ...o, ...cambios } })

  // todos los datos del gráfico salen de un solo lugar; la vista (barras / cajas / puntos) no cambia nada de esto
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const D = useMemo(() => armarComparacion(s), [s.placas, s.analisisMap, s.muestras, o])
  const { modo, conAnalisis, placasSel, mediosPres, colores, colorBase, ocultos, clave, muestras, etiqueta, tieneMuestra, grupos, leyenda, nota, sinMedio } = D

  // elementos del gráfico (cada uno se muestra u oculta por separado; las sesiones viejas traían una sola opción «cajas»)
  const elementos = {
    barras: o.barras !== false, barrasError: o.barrasError !== false,
    caja: o.caja ?? !!o.cajas, mediana: o.mediana ?? !!o.cajas, bigotes: o.bigotes ?? !!o.cajas, media: o.media ?? !!o.cajas,
    puntos: o.puntos !== false, valores: o.valores !== false, errores: !!o.errores, rotar: o.rotar ?? 45,
    errorTipo: o.error,
    errorNombre: { sd: 'desviación estándar', sem: 'error estándar de la media', ic95: 'intervalo de confianza del 95 %', ninguno: 'error' }[o.error] || 'error',
  }
  const sinElementos = !elementos.barras && !elementos.caja && !elementos.mediana && !elementos.bigotes && !elementos.media && !elementos.puntos
  // la caja (cuartiles) y los bigotes solo tienen sentido con 5 o más datos por columna
  const nMaxCol = Math.max(0, ...grupos.flatMap((g) => g.barras.map((b) => b.pts.length)))
  const puedeCaja = nMaxCol >= 5
  const LISTA = [
    ['barras', 'Barras', 'Media de las réplicas aceptadas.'], ['barrasError', 'Error', 'Barra de error del tipo elegido (DE, SEM o IC 95 %).'],
    ['caja', 'Caja Q1–Q3', 'Cuartiles Q1 y Q3: contiene el 50 % central de los datos. Solo con 5 o más datos por columna.'],
    ['mediana', 'Mediana', 'Valor central: la mitad de los datos queda por debajo.'],
    ['bigotes', 'Mín–máx', 'Bigotes del mínimo al máximo. Solo con 5 o más datos por columna.'],
    ['media', 'Media ◇', 'Rombo en el promedio.'], ['puntos', modo === 'medio' && o.puntosMedio === 'placas' ? 'Puntos (placa)' : 'Puntos', 'Cada valor medido.'],
    ['valores', 'Valores', 'Escribe la media sobre cada columna.'], ['errores', '± Error', 'Agrega el error al valor escrito.'],
  ]
  const poner = (cambios) => setVarios({ ...cambios, cajas: undefined })
  const selectorModo = (
    <Campo label={<>Qué mostrar<Nota>El medio de cultivo de cada placa se elige en la pestaña «Placa»; las placas con el mismo medio quedan juntas y del mismo color. «Reproducibilidad» toma cada placa como una repetición del experimento.</Nota></>}>
      <Select value={modo} onChange={(v) => setO('modo', v)}
        opciones={[['placas', 'Una columna por placa'], ['medio', 'Una columna por medio de cultivo'], ['pocillo', 'Una columna por pocillo']]} />
    </Campo>
  )

  if (!conAnalisis.length) {
    return <Vacio texto="Cargá al menos dos placas (botón «+ Agregar placa»), configurá sus pocillos y volvé acá para compararlas." />
  }

  // ---- prueba estadística (opcional): cada placa aporta un valor por muestra ----
  const control = grupos.some((g) => g.muestra === o.control) ? o.control : grupos[0]?.muestra || ''
  const valoresDe = (m) => (grupos.find((g) => g.muestra === m)?.barras || []).map((b) => b.media)
  let filasTest = []
  let anova = null
  if (modo === 'placas' && o.test === 'control') {
    const ctrl = valoresDe(control)
    const otros = grupos.filter((g) => g.muestra !== control)
    const res = otros.map((g) => welch(valoresDe(g.muestra), ctrl))
    const aj = holm(res.map((r) => (r ? r.p : NaN)))
    filasTest = grupos.map((g) => {
      const r = resumenGrupo(valoresDe(g.muestra))
      if (g.muestra === control) return { m: g.etiqueta, n: r.n, media: r.media, sd: r.sd, dif: null, p: null, pa: null, texto: 'control' }
      const i = otros.findIndex((x) => x.muestra === g.muestra)
      const w = res[i]
      const pa = aj[i]
      return {
        m: g.etiqueta, n: r.n, media: r.media, sd: r.sd, dif: w ? w.dif : null, p: w ? w.p : null, pa,
        texto: !w ? 'No se puede calcular (hacen falta 2 o más placas en la muestra y en el control)'
          : pa < 0.05 ? `Distinta del control (${marcaSig(pa)})` : 'Sin diferencia clara con el control',
      }
    })
  } else if (modo === 'placas' && o.test === 'anova') {
    anova = anova1(grupos.map((g) => valoresDe(g.muestra)))
  }

  // ---- por medio de cultivo: las mismas pruebas que por placa (dentro de cada medio) y además medio contra medio ----
  // los datos de cada columna (pocillos o un valor por placa) son los mismos que se dibujan
  const testG = o.testG === 'control' ? 'medio' : o.testG || 'ninguno'   // sesiones anteriores: 'control' era medio contra medio
  const porPlacaG = o.puntosMedio === 'placas'
  const controlG = mediosPres.includes(o.controlG) ? o.controlG : mediosPres[0] || ''
  const controlM = grupos.some((g) => g.muestra === o.controlM) ? o.controlM : grupos[0]?.muestra || ''
  const sinDatos = porPlacaG ? 'hacen falta 2 o más placas en cada grupo' : 'hacen falta 2 o más pocillos en cada grupo'
  let filasG = [], filasGM = [], anovasG = []
  if (modo === 'medio' && testG === 'medio' && controlG) {
    const comps = []
    grupos.forEach((g) => {
      const c = g.barras.find((b) => b.medio === controlG)
      g.barras.forEach((b) => { if (b.medio !== controlG) comps.push({ muestra: g.etiqueta, b, c }) })
    })
    const resG = comps.map((x) => (x.c ? welch(x.b.vp, x.c.vp) : null))
    const ajG = holm(resG.map((r) => (r ? r.p : NaN)))
    filasG = comps.map((x, i) => ({
      m: x.muestra, grupo: x.b.medio, n: x.b.vp.length, media: x.b.media, ctrl: x.c ? x.c.media : null, dif: resG[i] ? resG[i].dif : null, p: resG[i] ? resG[i].p : null, pa: ajG[i],
      texto: !resG[i] ? `No se puede calcular (${sinDatos})` : ajG[i] < 0.05 ? `Distinto del medio control (${marcaSig(ajG[i])})` : 'Sin diferencia clara con el medio control',
    }))
  } else if (modo === 'medio' && testG === 'muestra' && controlM) {
    const gc = grupos.find((g) => g.muestra === controlM)
    const comps = []
    mediosPres.forEach((md) => {
      const c = gc?.barras.find((b) => b.medio === md)
      grupos.forEach((g) => {
        if (g.muestra === controlM) return
        const b = g.barras.find((x) => x.medio === md)
        if (b) comps.push({ muestra: g.etiqueta, md, b, c })
      })
    })
    const res = comps.map((x) => (x.c ? welch(x.b.vp, x.c.vp) : null))
    const aj = holm(res.map((r) => (r ? r.p : NaN)))
    filasGM = comps.map((x, i) => {
      const r = resumenGrupo(x.b.vp)
      return {
        m: x.muestra, grupo: x.md, n: r.n, media: r.media, sd: r.sd, ctrl: x.c ? x.c.media : null, dif: res[i] ? res[i].dif : null, p: res[i] ? res[i].p : null, pa: aj[i],
        texto: !x.c ? 'El control no está en este medio' : !res[i] ? `No se puede calcular (${sinDatos})` : aj[i] < 0.05 ? `Distinta del control (${marcaSig(aj[i])})` : 'Sin diferencia clara con el control',
      }
    })
  } else if (modo === 'medio' && testG === 'anova') {
    anovasG = mediosPres.map((md) => {
      const vs = grupos.map((g) => g.barras.find((b) => b.medio === md)?.vp).filter((v) => v && v.length)
      return { md, k: vs.length, r: anova1(vs) }
    })
  }
  // con un valor por placa y una sola placa en algún medio no hay error ni dispersión entre placas
  const medios1 = modo === 'medio' && porPlacaG ? [...new Set(grupos.flatMap((g) => g.barras.filter((b) => b.nPlacas < 2).map((b) => b.medio)))] : []
  const nCols = grupos.reduce((a, g) => a + g.barras.length, 0)
  const grafico = (ref, tam, ctx) => (
    <CompararChart ref={ref} grupos={grupos} leyenda={leyenda} o={elementos} est={s.estilos.comparar} eje={s.ejeOD} onContext={ctx} tam={tam} nota={nota} />
  )

  const cambiarCelda = (id, m, v) => {
    const k = clave(id, m)
    const sin = (o.ocultos || []).filter((x) => x !== k)
    setO('ocultos', v ? sin : [...sin, k])
  }
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

  return (
    <div className="con-lateral">
      <Panel titulo="Comparar placas">
        <h3 className="seccion-lateral"><i>1</i> Gráfico</h3>
        {selectorModo}
        {modo === 'medio' && sinMedio.length > 0 && (
          <p className="aviso-sel">Placas sin medio indicado (no se muestran): {sinMedio.map((p) => p.nombre).join(', ')}. Elegí su medio en la pestaña «Placa».</p>
        )}
        {modo === 'medio' && (
          <Campo label={<>Datos de cada medio<Nota>{'Define los puntos, la media, el error, la dispersión y las pruebas.\nPocillos: todos los pocillos del medio (de todas sus placas).\nPromedio por placa: un valor por placa; cada placa es una réplica biológica (hacen falta 2 o más placas por medio para el error).'}</Nota></>}>
            <Select value={o.puntosMedio || 'pocillos'} onChange={(v) => setO('puntosMedio', v)}
              opciones={[['pocillos', 'Pocillos'], ['placas', 'Promedio por placa']]} />
          </Campo>
        )}
        {medios1.length > 0 && (
          <p className="aviso-sel">Con una sola placa en {medios1.join(', ')} no hay error ni dispersión entre placas. Elegí «Pocillos» para verlos.</p>
        )}

        <Campo label={<>Elementos<Nota>Se activan y desactivan al instante. Pasá el mouse por cada elemento del gráfico para ver su valor y cómo se calcula. Con una columna por pocillo no hay cajas ni errores (un solo valor por columna).</Nota></>}>
          <div className="fila-chips">
            <button className="chip-op" data-tip="Solo barras y puntos" onClick={() => poner({ barras: true, barrasError: true, caja: false, mediana: false, bigotes: false, media: false, puntos: true })}>⟲ Barras</button>
            <button className="chip-op" disabled={!puedeCaja} data-tip={puedeCaja ? 'Caja, mediana, mín–máx y puntos' : 'Hacen falta 5 o más datos por columna'}
              onClick={() => poner({ barras: false, barrasError: false, caja: true, mediana: true, bigotes: true, media: true, puntos: true })}>⟲ Cajas</button>
          </div>
          <div className="fila-chips">
            {LISTA.map(([k, t, d]) => {
              const bloq = (k === 'caja' || k === 'bigotes') && !puedeCaja
              return (
                <button key={k} type="button" className={`chip-op ${elementos[k] && !bloq ? 'on' : ''}`} disabled={bloq}
                  data-tip={bloq ? `${t}\nHacen falta 5 o más datos por columna (hoy el máximo es ${nMaxCol}).` : `${t}\n${d}`}
                  onClick={() => poner({ [k]: !elementos[k] })}>{t}</button>
              )
            })}
          </div>
          {sinElementos && <p className="aviso-sel">No hay nada para dibujar: activá barras, mediana, media o puntos.</p>}
        </Campo>
        {(modo === 'placas' || modo === 'medio') && (
          <Campo label="Error">
            <Select value={o.error} onChange={(v) => setO('error', v)}
              opciones={[['sd', 'DE'], ['sem', 'SEM'], ['ic95', 'IC 95 %'], ['ninguno', 'Ninguno']]} />
          </Campo>
        )}
        <Campo label="Rotación (°)"><Num value={o.rotar} min={0} max={90} step={15} onChange={(v) => setO('rotar', v === '' ? 0 : v)} /></Campo>
        <button className="ancho" onClick={() => setExp(true)} disabled={!grupos.length || sinElementos}>Descargar imagen…</button>

        <h3 className="seccion-lateral"><i>2</i> Placas</h3>

        <Campo label="Placas a incluir">
          <div className="fila-ctrl" style={{ margin: '0 0 4px' }}>
            <button className="chico" onClick={() => setO('placasSel', conAnalisis.map((p) => p.id))}>Todas</button>
            <button className="chico" onClick={() => setO('placasSel', [])}>Ninguna</button>
          </div>
          <div className="lista-check">
            {conAnalisis.map((p) => (
              <Check key={p.id} label={<><i className="punto-placa" style={{ background: colores[p.id] || colorBase[p.id] }} /> {p.nombre}{p.medio && <small className="medio-placa">{p.medio}</small>}</>}
                checked={placasSel.some((x) => x.id === p.id)}
                onChange={(v) => setO('placasSel', v ? conAnalisis.filter((x) => x.id === p.id || placasSel.some((y) => y.id === x.id)).map((x) => x.id) : placasSel.filter((x) => x.id !== p.id).map((x) => x.id))} />
            ))}
          </div>
        </Campo>
        <Check label="Incluir blancos" checked={D.verBlancos} onChange={(v) => setO('blancos', v)} />

        <h3 className="seccion-lateral"><i>3</i> Muestras</h3>
        <Campo label={<>Qué muestra se ve en cada placa<Nota>Cada columna es una placa (mismo color que en el gráfico). Destildá una celda para ocultar esa muestra solo en esa placa, o la casilla de la izquierda para ocultarla en todas.</Nota></>}>
          <div className="fila-ctrl" style={{ margin: '0 0 4px' }}>
            <button className="chico" onClick={() => todoVisible(true)}>Mostrar todas</button>
            <button className="chico" onClick={() => todoVisible(false)}>Ocultar todas</button>
          </div>
          <div className="matriz-muestras">
            <table>
              <thead>
                <tr>
                  <th />
                  {placasSel.map((p) => <th key={p.id} title={p.nombre}><i className="punto-placa" style={{ background: colores[p.id] }} /></th>)}
                </tr>
              </thead>
              <tbody>
                {muestras.map((m) => {
                  const existentes = placasSel.filter((p) => tieneMuestra(p, m))
                  const todas = existentes.every((p) => !ocultos.has(clave(p.id, m)))
                  return (
                    <tr key={m}>
                      <td><label className="check" style={{ margin: 0 }}>
                        <input type="checkbox" checked={todas} onChange={(e) => cambiarFila(m, e.target.checked)} /><span>{etiqueta(m)}</span></label></td>
                      {placasSel.map((p) => (
                        <td key={p.id} className="celda-chk">
                          {tieneMuestra(p, m)
                            ? <input type="checkbox" checked={!ocultos.has(clave(p.id, m))} onChange={(e) => cambiarCelda(p.id, m, e.target.checked)} title={`${m} en ${p.nombre}`} />
                            : <span className="ayuda">–</span>}
                        </td>
                      ))}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </Campo>
      </Panel>

      <div className="principal">
        <h1>Comparación entre placas <span className="sub">· {modo === 'medio' ? 'por medio de cultivo' : modo === 'pocillo' ? 'pocillo por pocillo' : 'placa por placa'}</span></h1>
        {grupos.length && !sinElementos ? grafico(svg, undefined, abrirMenu) : <Vacio texto={sinElementos ? 'Activá barras, mediana, media o puntos para ver el gráfico.' : 'Elegí al menos una placa y una muestra para mostrar.'} />}
        <p className="ayuda">{nCols} columnas <Nota>Pasá el mouse por una barra, caja o punto para ver su valor y el cálculo. Clic derecho sobre el gráfico: estilo de los textos.</Nota></p>
      </div>

      <MenuContextual menu={menu} items={[
        ['Estilo de texto…', () => { cerrarMenu(); setDlg(true) }],
        ['Rango del eje Y…', () => { cerrarMenu(); setRng(true) }],
        ['Restablecer estilo de texto', () => { cerrarMenu(); s.setEstilos({ ...s.estilos, comparar: estiloDefecto() }) }],
      ]} />
      {rng && <RangoDialog est={s.estilos.comparar} onClose={() => setRng(false)} onGuardar={(e) => { s.setEstilos({ ...s.estilos, comparar: e }); setRng(false) }} />}
      {dlg && <EstiloDialog estilo={s.estilos.comparar} conClases={false} ejeDefecto={s.ejeOD} onClose={() => setDlg(false)}
        onGuardar={(e) => { s.setEstilos({ ...s.estilos, comparar: e }); setDlg(false) }} />}
      {exp && svg.current && (
        <ExportDialog nombre="comparacion_placas" size0={tamDe(svg.current)} onClose={() => setExp(false)}
          render={(ref, tam) => grafico(ref, tam, (e) => e.preventDefault())} />
      )}
    </div>
  )
}
