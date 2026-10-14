import { useMemo, useRef, useState } from 'react'
import { GroupedBarChart } from './charts.jsx'
import { DispersionChart } from './dispersion.jsx'
import { ExportDialog } from './exportar.jsx'
import { Vacio } from './tabs.jsx'
import { Campo, Check, EstiloDialog, MenuContextual, Num, Panel, Select, useMenuContextual } from './ui.jsx'
import { anova1, holm, marcaSig, resumenGrupo, welch } from '../estadistica.js'
import { resumenBlancos } from '../blancos.js'
import { estiloDefecto, fmt, paletaMuestras } from '../utils.js'

const tamDe = (svg) => ({ w: svg.viewBox.baseVal.width, h: svg.viewBox.baseVal.height })
const ERR_TXT = { ic95: 'IC 95 %', sd: 'desviación estándar', sem: 'error estándar', ninguno: '' }
const pTxt = (p) => (p === null || p === undefined || !Number.isFinite(p) ? '–' : p < 0.0001 ? '< 0,0001' : p.toFixed(4).replace('.', ','))

// aclara un color hsl(h, s%, l%) (f de 0 a 1): los tonos de una familia, uno por placa
export const aclarar = (col, f) => {
  const m = /hsl\((\d+),\s*(\d+)%,\s*(\d+)%\)/.exec(col)
  if (!m) return col
  return `hsl(${m[1]}, ${m[2]}%, ${(Number(m[3]) + (88 - Number(m[3])) * f).toFixed(0)}%)`
}

export function CompararTab({ s }) {
  const svg = useRef()
  const [menu, abrirMenu, cerrarMenu] = useMenuContextual()
  const [dlg, setDlg] = useState(false)
  const [exp, setExp] = useState(false)
  const o = s.opts.comparar
  const setO = (k, v) => s.setOpts({ ...s.opts, comparar: { ...o, [k]: v } })
  const modo = o.modo === 'medio' ? 'medio' : 'placas'
  const vista = o.vista === 'dispersion' ? 'dispersion' : 'barras'
  const verBlancos = o.blancos !== false

  const conAnalisis = s.placas.filter((p) => s.analisisMap[p.id]?.resumen?.length)
  const placasSel0 = o.placasSel ? conAnalisis.filter((p) => o.placasSel.includes(p.id)) : conAnalisis
  // las placas se ordenan por medio de cultivo (las del mismo medio quedan juntas)
  const placasSel = useMemo(() => {
    const orden = [...new Set(s.placas.map((p) => p.medio || ''))].filter(Boolean)
    return [...placasSel0].sort((a, b) => {
      const ia = a.medio ? orden.indexOf(a.medio) : 999, ib = b.medio ? orden.indexOf(b.medio) : 999
      return ia - ib
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [placasSel0.map((p) => p.id + p.medio).join('|'), s.placas])
  const mediosPres = useMemo(() => [...new Set(placasSel.map((p) => p.medio).filter(Boolean))], [placasSel])
  const coloresMedio = useMemo(() => paletaMuestras(mediosPres), [mediosPres])
  const colorBase = useMemo(() => paletaMuestras(s.placas.map((p) => p.id)), [s.placas])
  // color de cada placa: familia de tonos del medio si lo tiene; si no, un color propio
  const colores = useMemo(() => {
    const out = {}
    mediosPres.forEach((md) => {
      const ps = placasSel.filter((p) => p.medio === md)
      ps.forEach((p, i) => { out[p.id] = aclarar(coloresMedio[md], ps.length > 1 ? (0.5 * i) / (ps.length - 1) : 0) })
    })
    placasSel.forEach((p) => { if (!out[p.id]) out[p.id] = colorBase[p.id] })
    return out
  }, [placasSel, mediosPres, coloresMedio, colorBase])

  const ocultos = useMemo(() => new Set(o.ocultos || []), [o.ocultos])
  const clave = (id, m) => `${id}|${m}`
  const blancosDe = (p) => (verBlancos ? resumenBlancos(s.analisisMap[p.id].estado) : [])
  const filasDe = (p) => [...s.analisisMap[p.id].resumen, ...blancosDe(p)]

  // muestras presentes en las placas elegidas (en el orden de la lista de muestras; los blancos al final)
  const { muestras, esBlanco } = useMemo(() => {
    const nb = [...new Set(placasSel.flatMap((p) => s.analisisMap[p.id].resumen.map((r) => r.Muestra)))]
    const bl = verBlancos ? [...new Set(placasSel.flatMap((p) => resumenBlancos(s.analisisMap[p.id].estado).map((r) => r.Muestra)))].filter((m) => !nb.includes(m)) : []
    return {
      muestras: [...s.muestras.filter((m) => nb.includes(m)), ...nb.filter((m) => !s.muestras.includes(m)), ...bl],
      esBlanco: new Set(bl),
    }
  }, [placasSel, s.muestras, s.analisisMap, verBlancos])
  const etiqueta = (m) => (esBlanco.has(m) ? `${m} (blanco)` : m)
  const tieneMuestra = (p, m) => filasDe(p).some((r) => r.Muestra === m)
  const ptsDe = (p, m) => s.analisisMap[p.id].estado.filter((e) => e.Muestra === m && e.Usado).map((e) => e.OD)
  const errDe = (r) => (o.error === 'ic95' ? r.IC95 : o.error === 'sd' ? r.SD : o.error === 'sem' ? r.SEM : null)

  // barras: una por placa para cada muestra, o una por medio de cultivo (promedio de sus placas; cada placa aporta un valor)
  const grupos = useMemo(() => muestras.map((m) => ({
    muestra: m, etiqueta: etiqueta(m),
    barras: modo === 'medio' ? mediosPres.flatMap((md) => {
      const vals = []
      placasSel.filter((p) => p.medio === md).forEach((p) => {
        if (ocultos.has(clave(p.id, m))) return
        const r = filasDe(p).find((x) => x.Muestra === m)
        if (r && Number.isFinite(r.Media)) vals.push(r.Media)
      })
      if (!vals.length) return []
      const rg = resumenGrupo(vals)
      const err = o.error === 'ic95' ? rg.ic95 : o.error === 'sd' ? rg.sd : o.error === 'sem' ? rg.sem : null
      return [{ id: md + '|' + m, placa: `${md} (n = ${vals.length} ${vals.length === 1 ? 'placa' : 'placas'})`, color: coloresMedio[md],
        media: rg.media, err: Number.isFinite(err) ? err : null, pts: vals }]
    }) : placasSel.flatMap((p) => {
      if (ocultos.has(clave(p.id, m))) return []
      const r = filasDe(p).find((x) => x.Muestra === m)
      if (!r || !Number.isFinite(r.Media)) return []
      const err = errDe(r)
      return [{ id: p.id + '|' + m, placa: p.nombre + (p.medio ? ` · ${p.medio}` : ''), color: colores[p.id], media: r.Media, err: Number.isFinite(err) ? err : null, pts: ptsDe(p, m) }]
    }),
  })).filter((g) => g.barras.length),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  [muestras, placasSel, ocultos, o.error, colores, s.analisisMap, modo, mediosPres, coloresMedio, verBlancos])

  // vista de dispersión: siempre una columna por placa (ordenadas por medio) con los pocillos como puntos
  const gruposDisp = useMemo(() => muestras.map((m) => ({
    muestra: m, etiqueta: etiqueta(m),
    barras: placasSel.flatMap((p) => {
      if (ocultos.has(clave(p.id, m))) return []
      const r = filasDe(p).find((x) => x.Muestra === m)
      const pts = ptsDe(p, m)
      if (!r || !pts.length) return []
      return [{ id: p.id + '|' + m, placa: p.nombre + (p.medio ? ` · ${p.medio}` : ''), color: colores[p.id], media: r.Media, pts }]
    }),
  })).filter((g) => g.barras.length),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  [muestras, placasSel, ocultos, colores, s.analisisMap, verBlancos])

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
      if (g.muestra === control) return { m: g.muestra, n: r.n, media: r.media, sd: r.sd, dif: null, p: null, pa: null, texto: 'control' }
      const i = otros.findIndex((x) => x.muestra === g.muestra)
      const w = res[i]
      const pa = aj[i]
      return {
        m: g.muestra, n: r.n, media: r.media, sd: r.sd, dif: w ? w.dif : null, p: w ? w.p : null, pa,
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
    const resG = comps.map((x) => (x.c ? welch(x.b.pts, x.c.pts) : null))
    const ajG = holm(resG.map((r) => (r ? r.p : NaN)))
    filasG = comps.map((x, i) => ({
      m: x.muestra, grupo: x.b.placa, media: x.b.media, ctrl: x.c ? x.c.media : null, dif: resG[i] ? resG[i].dif : null, p: resG[i] ? resG[i].p : null, pa: ajG[i],
      texto: !resG[i] ? 'No se puede calcular (hacen falta 2 o más placas en cada medio)' : ajG[i] < 0.05 ? `Distinto del medio control (${marcaSig(ajG[i])})` : 'Sin diferencia clara con el medio control',
    }))
  }
  const sinMedio = placasSel.filter((p) => !p.medio)
  const nota = vista === 'dispersion'
    ? 'Cada punto es un pocillo aceptado · caja: cuartiles y mediana · rombo negro: media'
    : modo === 'medio'
      ? `Barras: promedio de las placas de cada medio (cada placa = un valor)${ERR_TXT[o.error] ? `; error: ${ERR_TXT[o.error]} entre placas` : ''}`
      : `Barras: OD media de las réplicas aceptadas de cada placa${ERR_TXT[o.error] ? `; error: ${ERR_TXT[o.error]} entre pocillos de la placa` : ''}`
  const leyenda = vista === 'barras' && modo === 'medio'
    ? mediosPres.filter((md) => grupos.some((g) => g.barras.some((b) => b.id.startsWith(md + '|')))).map((md) => ({ id: md, nombre: md, color: coloresMedio[md] }))
    : placasSel.map((p) => ({ id: p.id, nombre: p.nombre + (p.medio ? ` · ${p.medio}` : ''), color: colores[p.id] }))
  const oGraf = { valores: o.valores, errores: o.errores, puntos: o.puntos, rotar: o.rotar }
  const datosGrafico = vista === 'dispersion' ? gruposDisp : grupos
  const nBarras = datosGrafico.reduce((a, g) => a + g.barras.length, 0)

  const grafico = (ref, tam, ctx) => (vista === 'dispersion'
    ? <DispersionChart ref={ref} grupos={gruposDisp} leyenda={leyenda} o={oGraf} est={s.estilos.comparar} eje={s.ejeOD} onContext={ctx} tam={tam} nota={nota} />
    : <GroupedBarChart ref={ref} grupos={grupos} placas={leyenda} o={oGraf} est={s.estilos.comparar} eje={s.ejeOD} onContext={ctx} tam={tam} nota={nota} />)

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
        <p className="ayuda">El medio de cultivo de cada placa se elige en la pestaña «Placa»; las placas con el mismo medio quedan juntas y del mismo color.</p>
        <Campo label="Vista">
          <div className="seg">
            <button className={vista === 'barras' ? 'on' : ''} onClick={() => setO('vista', 'barras')}>Barras</button>
            <button className={vista === 'dispersion' ? 'on' : ''} onClick={() => setO('vista', 'dispersion')}>Dispersión (puntos y cajas)</button>
          </div>
        </Campo>
        {vista === 'barras' && (
          <Campo label="Cómo comparar">
            <Select value={modo} onChange={(v) => setO('modo', v)}
              opciones={[['placas', 'Una barra por placa'], ['medio', 'Una barra por medio de cultivo (promedio de sus placas)']]} />
          </Campo>
        )}
        {vista === 'barras' && modo === 'medio' && sinMedio.length > 0 && (
          <p className="aviso-sel">Placas sin medio indicado (no se muestran): {sinMedio.map((p) => p.nombre).join(', ')}. Elegí su medio en la pestaña «Placa».</p>
        )}
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
        <Check label="Mostrar también los blancos" checked={verBlancos} onChange={(v) => setO('blancos', v)} />

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

        {vista === 'barras' && (
          <>
            <Campo label="Barras de error">
              <Select value={o.error} onChange={(v) => setO('error', v)}
                opciones={[['sd', 'Desviación estándar'], ['sem', 'Error estándar (SEM)'], ['ic95', 'IC 95 %'], ['ninguno', 'Ninguna']]} />
            </Campo>
            <Check label="Mostrar la OD sobre cada barra" checked={o.valores} onChange={(v) => setO('valores', v)} />
            <Check label="Mostrar el error junto al valor medio" checked={o.errores} onChange={(v) => setO('errores', v)} />
            <Check label={modo === 'medio' ? 'Mostrar el valor de cada placa' : 'Mostrar los pocillos individuales'} checked={o.puntos} onChange={(v) => setO('puntos', v)} />
          </>
        )}
        <Campo label="Rotación de etiquetas (°)"><Num value={o.rotar} min={0} max={90} step={15} onChange={(v) => setO('rotar', v === '' ? 0 : v)} /></Campo>
        <hr />
        {vista === 'barras' && modo === 'medio' && (
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
        {vista === 'barras' && modo === 'placas' && (
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
        <button className="primario ancho" onClick={() => setExp(true)} disabled={!datosGrafico.length}>Descargar imagen…</button>
      </Panel>

      <div className="principal">
        <h1>Comparación entre placas <span className="sub">· {vista === 'dispersion' ? 'dispersión de los pocillos' : 'OD de cada muestra'}</span></h1>
        {datosGrafico.length ? grafico(svg, undefined, abrirMenu) : <Vacio texto="Elegí al menos una placa y una muestra para mostrar." />}
        <p className="ayuda">Clic derecho sobre el gráfico: estilo de todos los textos. Pasá el mouse sobre {vista === 'dispersion' ? 'una columna' : 'una barra'} para ver su placa y su valor. {nBarras > 0 && `${nBarras} ${vista === 'dispersion' ? 'columnas' : 'barras'}.`}</p>

        {vista === 'barras' && modo === 'medio' && o.testG === 'control' && (
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

        {vista === 'barras' && modo === 'placas' && o.test === 'anova' && (
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

        {vista === 'barras' && modo === 'placas' && o.test === 'control' && (
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
