import { useMemo, useRef, useState } from 'react'
import { CompararChart } from './compararchart.jsx'
import { ExportDialog } from './exportar.jsx'
import { Vacio } from './tabs.jsx'
import { Campo, Check, EstiloDialog, MenuContextual, Num, Panel, Select, useMenuContextual } from './ui.jsx'
import { anova1, holm, marcaSig, resumenGrupo, welch } from '../estadistica.js'
import { armarComparacion } from '../comparacion.js'
import { estiloDefecto, fmt } from '../utils.js'

const tamDe = (svg) => ({ w: svg.viewBox.baseVal.width, h: svg.viewBox.baseVal.height })
const pTxt = (p) => (p === null || p === undefined || !Number.isFinite(p) ? '–' : p < 0.0001 ? '< 0,0001' : p.toFixed(4).replace('.', ','))

export function CompararTab({ s }) {
  const svg = useRef()
  const [menu, abrirMenu, cerrarMenu] = useMenuContextual()
  const [dlg, setDlg] = useState(false)
  const [exp, setExp] = useState(false)
  const o = s.opts.comparar
  const setO = (k, v) => s.setOpts({ ...s.opts, comparar: { ...o, [k]: v } })
  const setVarios = (cambios) => s.setOpts({ ...s.opts, comparar: { ...o, ...cambios } })

  // todos los datos del gráfico salen de un solo lugar; la vista (barras / cajas / puntos) no cambia nada de esto
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const D = useMemo(() => armarComparacion(s), [s.placas, s.analisisMap, s.muestras, o])
  const { modo, conAnalisis, placasSel, mediosPres, colores, colorBase, ocultos, clave, muestras, etiqueta, tieneMuestra, grupos, leyenda, nota, sinMedio } = D

  const elementos = {
    barras: o.barras !== false, cajas: !!o.cajas, puntos: o.puntos !== false, barrasError: o.barrasError !== false,
    valores: o.valores !== false, errores: !!o.errores, rotar: o.rotar ?? 45,
  }
  const sinElementos = !elementos.barras && !elementos.cajas && !elementos.puntos

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

  // ---- por medio de cultivo: cada medio contra un medio control, muestra por muestra (t de Welch, ajuste de Holm) ----
  const controlG = mediosPres.includes(o.controlG) ? o.controlG : mediosPres[0] || ''
  let filasG = []
  if (modo === 'medio' && o.testG === 'control' && controlG) {
    const comps = []
    grupos.forEach((g) => {
      const c = g.barras.find((b) => b.id.startsWith(controlG + '|'))
      g.barras.forEach((b) => { if (!b.id.startsWith(controlG + '|')) comps.push({ muestra: g.etiqueta, b, c }) })
    })
    const resG = comps.map((x) => (x.c ? welch(x.b.vp, x.c.vp) : null))
    const ajG = holm(resG.map((r) => (r ? r.p : NaN)))
    filasG = comps.map((x, i) => ({
      m: x.muestra, grupo: x.b.placa, media: x.b.media, ctrl: x.c ? x.c.media : null, dif: resG[i] ? resG[i].dif : null, p: resG[i] ? resG[i].p : null, pa: ajG[i],
      texto: !resG[i] ? 'No se puede calcular (hacen falta 2 o más placas en cada medio)' : ajG[i] < 0.05 ? `Distinto del medio control (${marcaSig(ajG[i])})` : 'Sin diferencia clara con el medio control',
    }))
  }
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
  const preset = elementos.barras && elementos.cajas ? 'ambas' : elementos.cajas ? 'cajas' : elementos.barras ? 'barras' : ''

  return (
    <div className="con-lateral">
      <Panel titulo="Comparar placas">
        <p className="ayuda">El medio de cultivo de cada placa se elige en la pestaña «Placa»; las placas con el mismo medio quedan juntas y del mismo color.</p>
        <Campo label="Cómo comparar">
          <Select value={modo} onChange={(v) => setO('modo', v)}
            opciones={[['placas', 'Una columna por placa'], ['medio', 'Una columna por medio de cultivo (promedio de sus placas)'], ['pocillo', 'Una columna por pocillo']]} />
        </Campo>
        {modo === 'medio' && sinMedio.length > 0 && (
          <p className="aviso-sel">Placas sin medio indicado (no se muestran): {sinMedio.map((p) => p.nombre).join(', ')}. Elegí su medio en la pestaña «Placa».</p>
        )}
        {modo === 'medio' && (
          <Campo label="Puntos y cajas de cada medio">
            <Select value={o.puntosMedio || 'pocillos'} onChange={(v) => setO('puntosMedio', v)}
              opciones={[['pocillos', 'Todos los pocillos de sus placas'], ['placas', 'Un punto por placa (su promedio)']]} />
          </Campo>
        )}

        <Campo label="Qué mostrar en el gráfico">
          <div className="seg">
            <button className={preset === 'barras' ? 'on' : ''} onClick={() => setVarios({ barras: true, cajas: false })}>Barras</button>
            <button className={preset === 'cajas' ? 'on' : ''} onClick={() => setVarios({ barras: false, cajas: true })}>Cajas</button>
            <button className={preset === 'ambas' ? 'on' : ''} onClick={() => setVarios({ barras: true, cajas: true })}>Ambas</button>
          </div>
          <div className="lista-check" style={{ marginTop: 6 }}>
            <Check label="Barras (promedio)" checked={elementos.barras} onChange={(v) => setO('barras', v)} />
            <Check label="Cajas (cuartiles, mediana y media ◇)" checked={elementos.cajas} onChange={(v) => setO('cajas', v)} />
            <Check label={modo === 'medio' && o.puntosMedio === 'placas' ? 'Puntos (uno por placa)' : 'Puntos (pocillos)'} checked={elementos.puntos} onChange={(v) => setO('puntos', v)} />
            <Check label="Barras de error" checked={elementos.barrasError} onChange={(v) => setO('barrasError', v)} />
            <Check label="Etiquetas con el valor de cada columna" checked={elementos.valores} onChange={(v) => setO('valores', v)} />
            {elementos.valores && <Check label="Incluir el error en la etiqueta" checked={elementos.errores} onChange={(v) => setO('errores', v)} />}
          </div>
          {sinElementos && <p className="aviso-sel">No hay nada para dibujar: activá barras, cajas o puntos.</p>}
          {modo === 'pocillo' && <p className="ayuda">Con una columna por pocillo no hay cajas ni barras de error (cada columna es un solo valor).</p>}
        </Campo>
        {(modo === 'placas' || modo === 'medio') && (
          <Campo label="Tipo de error">
            <Select value={o.error} onChange={(v) => setO('error', v)}
              opciones={[['sd', 'Desviación estándar'], ['sem', 'Error estándar (SEM)'], ['ic95', 'IC 95 %'], ['ninguno', 'Ninguno']]} />
          </Campo>
        )}
        <Campo label="Rotación de etiquetas (°)"><Num value={o.rotar} min={0} max={90} step={15} onChange={(v) => setO('rotar', v === '' ? 0 : v)} /></Campo>

        <Campo label="Placas a ver">
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
        <Check label="Mostrar también los blancos" checked={D.verBlancos} onChange={(v) => setO('blancos', v)} />

        <Campo label="Muestras a mostrar de cada placa">
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
          <p className="ayuda">Cada columna es una placa (mismo color que en el gráfico). Destildá una celda para ocultar esa muestra solo en esa placa, o la casilla de la izquierda para ocultarla en todas.</p>
        </Campo>
        <hr />
        {modo === 'medio' && (
          <>
            <Campo label="Prueba estadística entre medios (opcional)">
              <Select value={o.testG} onChange={(v) => setO('testG', v)}
                opciones={[['ninguno', 'Ninguna'], ['control', 'Cada medio contra un medio control, muestra por muestra']]} />
            </Campo>
            {o.testG === 'control' && (
              <Campo label="Medio control">
                <Select value={controlG} onChange={(v) => setO('controlG', v)} opciones={mediosPres.map((x) => [x, x])} />
              </Campo>
            )}
          </>
        )}
        {modo === 'placas' && (
          <>
            <Campo label="Prueba estadística (opcional)">
              <Select value={o.test} onChange={(v) => setO('test', v)}
                opciones={[['ninguno', 'Ninguna'], ['control', 'Cada muestra contra un control'], ['anova', 'ANOVA: ¿hay alguna diferencia?']]} />
            </Campo>
            {o.test === 'control' && (
              <Campo label="Muestra control">
                <Select value={control} onChange={(v) => setO('control', v)} opciones={grupos.map((g) => [g.muestra, g.etiqueta])} />
              </Campo>
            )}
          </>
        )}
        <button className="primario ancho" onClick={() => setExp(true)} disabled={!grupos.length || sinElementos}>Descargar imagen…</button>
      </Panel>

      <div className="principal">
        <h1>Comparación entre placas <span className="sub">· {modo === 'medio' ? 'por medio de cultivo' : modo === 'pocillo' ? 'pocillo por pocillo' : 'placa por placa'}</span></h1>
        {grupos.length && !sinElementos ? grafico(svg, undefined, abrirMenu) : <Vacio texto={sinElementos ? 'Activá barras, cajas o puntos para ver el gráfico.' : 'Elegí al menos una placa y una muestra para mostrar.'} />}
        <p className="ayuda">Clic derecho sobre el gráfico: estilo de todos los textos. Pasá el mouse sobre una columna o un punto para ver su detalle. {nCols > 0 && `${nCols} columnas.`}</p>

        {modo === 'medio' && o.testG === 'control' && (
          <section className="resultado-test">
            <h2>Cada medio contra «{controlG}»</h2>
            {filasG.length ? (
              <div className="tabla-scroll">
                <table className="tabla">
                  <thead><tr><th>Muestra</th><th>Medio</th><th>Media del medio</th><th>Media del control</th><th>Diferencia</th><th>p</th><th>p ajustado</th><th>Resultado</th></tr></thead>
                  <tbody>
                    {filasG.map((f, i) => (
                      <tr key={i}>
                        <td><b>{f.m}</b></td><td>{f.grupo}</td><td>{fmt(f.media)}</td><td>{f.ctrl === null ? '–' : fmt(f.ctrl)}</td>
                        <td>{f.dif === null ? '–' : (f.dif > 0 ? '+' : '') + fmt(f.dif)}</td><td>{pTxt(f.p)}</td><td>{pTxt(f.pa)}</td><td>{f.texto}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : <p>Hacen falta al menos dos medios con placas.</p>}
            <p className="ayuda">Cada placa cuenta como una réplica (n = número de placas de cada medio; con 3 placas por medio la prueba solo detecta diferencias grandes). Es una prueba t de Welch por muestra con el ajuste de Holm entre todas las comparaciones.</p>
          </section>
        )}

        {modo === 'placas' && o.test === 'anova' && (
          <section className="resultado-test">
            <h2>Resultado del ANOVA</h2>
            {anova ? (
              <>
                <p>F({anova.df1}; {anova.df2}) = {Number.isFinite(anova.F) ? anova.F.toFixed(3).replace('.', ',') : '∞'} · <b>p = {pTxt(anova.p)}</b></p>
                <p>{anova.p < 0.05
                  ? <><b>Hay diferencias</b> entre al menos dos de las muestras mostradas (p menor que 0,05). El ANOVA no dice cuáles: para eso usá «Cada muestra contra un control».</>
                  : <><b>No hay evidencia de diferencias</b> entre las muestras mostradas (p mayor o igual que 0,05).</>}</p>
              </>
            ) : <p>No se puede calcular: hacen falta al menos 2 muestras y más datos que grupos.</p>}
            <p className="ayuda">Cada placa cuenta como una réplica. Más detalle en Datos › Método, sección 7.</p>
          </section>
        )}

        {modo === 'placas' && o.test === 'control' && (
          <section className="resultado-test">
            <h2>Cada muestra contra «{control}»</h2>
            <div className="tabla-scroll">
              <table className="tabla">
                <thead><tr><th>Muestra</th><th>Placas</th><th>Media entre placas</th><th>DE entre placas</th><th>Diferencia con el control</th><th>p</th><th>p ajustado</th><th>Resultado</th></tr></thead>
                <tbody>
                  {filasTest.map((f) => (
                    <tr key={f.m} className={f.texto === 'control' ? 'fila-activa' : ''}>
                      <td><b>{f.m}</b></td><td>{f.n}</td><td>{fmt(f.media)}</td><td>{fmt(f.sd)}</td>
                      <td>{f.dif === null ? '–' : (f.dif > 0 ? '+' : '') + fmt(f.dif)}</td>
                      <td>{pTxt(f.p)}</td><td>{pTxt(f.pa)}</td><td>{f.texto}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="ayuda">Cada placa cuenta como una réplica (n = número de placas). Con 2 o 3 placas la prueba detecta solo diferencias muy grandes. Cómo leer esta tabla: Datos › Método, sección 7.</p>
          </section>
        )}
      </div>

      <MenuContextual menu={menu} items={[
        ['Estilo de texto…', () => { cerrarMenu(); setDlg(true) }],
        ['Restablecer estilo de texto', () => { cerrarMenu(); s.setEstilos({ ...s.estilos, comparar: estiloDefecto() }) }],
      ]} />
      {dlg && <EstiloDialog estilo={s.estilos.comparar} conClases={false} ejeDefecto={s.ejeOD} onClose={() => setDlg(false)}
        onGuardar={(e) => { s.setEstilos({ ...s.estilos, comparar: e }); setDlg(false) }} />}
      {exp && svg.current && (
        <ExportDialog nombre="comparacion_placas" size0={tamDe(svg.current)} onClose={() => setExp(false)}
          render={(ref, tam) => grafico(ref, tam, (e) => e.preventDefault())} />
      )}
    </div>
  )
}
