import { useMemo, useRef, useState } from 'react'
import { GroupedBarChart } from './charts.jsx'
import { ExportDialog } from './exportar.jsx'
import { Vacio } from './tabs.jsx'
import { Campo, Check, EstiloDialog, MenuContextual, Num, Panel, Select, useMenuContextual } from './ui.jsx'
import { anova1, holm, marcaSig, resumenGrupo, welch } from '../estadistica.js'
import { estiloDefecto, fmt, paletaMuestras } from '../utils.js'

const tamDe = (svg) => ({ w: svg.viewBox.baseVal.width, h: svg.viewBox.baseVal.height })
const ERR_TXT = { ic95: 'IC 95 %', sd: 'desviación estándar', sem: 'error estándar', ninguno: '' }
const pTxt = (p) => (p === null || p === undefined || !Number.isFinite(p) ? '–' : p < 0.0001 ? '< 0,0001' : p.toFixed(4).replace('.', ','))

export function CompararTab({ s }) {
  const svg = useRef()
  const [menu, abrirMenu, cerrarMenu] = useMenuContextual()
  const [dlg, setDlg] = useState(false)
  const [exp, setExp] = useState(false)
  const o = s.opts.comparar
  const setO = (k, v) => s.setOpts({ ...s.opts, comparar: { ...o, [k]: v } })

  const conAnalisis = s.placas.filter((p) => s.analisisMap[p.id]?.resumen?.length)
  const placasSel = o.placasSel ? conAnalisis.filter((p) => o.placasSel.includes(p.id)) : conAnalisis
  const colores = useMemo(() => paletaMuestras(s.placas.map((p) => p.id)), [s.placas])
  const ocultos = useMemo(() => new Set(o.ocultos || []), [o.ocultos])
  const clave = (id, m) => `${id}|${m}`

  // muestras presentes en las placas elegidas (en el orden de la lista de muestras)
  const muestras = useMemo(() => {
    const pres = [...new Set(placasSel.flatMap((p) => s.analisisMap[p.id].resumen.map((r) => r.Muestra)))]
    return [...s.muestras.filter((m) => pres.includes(m)), ...pres.filter((m) => !s.muestras.includes(m))]
  }, [placasSel, s.muestras, s.analisisMap])

  const tieneMuestra = (p, m) => s.analisisMap[p.id].resumen.some((r) => r.Muestra === m)

  // grupos del gráfico: una barra por placa para cada muestra (solo las que están marcadas)
  const grupos = useMemo(() => muestras.map((m) => ({
    muestra: m,
    barras: placasSel.flatMap((p) => {
      if (ocultos.has(clave(p.id, m))) return []
      const A = s.analisisMap[p.id]
      const r = A.resumen.find((x) => x.Muestra === m)
      if (!r || !Number.isFinite(r.Media)) return []
      const err = o.error === 'ic95' ? r.IC95 : o.error === 'sd' ? r.SD : o.error === 'sem' ? r.SEM : null
      return [{
        id: p.id + '|' + m, placa: p.nombre, color: colores[p.id], media: r.Media, err: Number.isFinite(err) ? err : null,
        pts: A.estado.filter((e) => !e.EsBlanco && e.Muestra === m && e.Usado).map((e) => e.OD),
      }]
    }),
  })).filter((g) => g.barras.length), [muestras, placasSel, ocultos, o.error, colores, s.analisisMap])

  if (!conAnalisis.length) {
    return <Vacio texto="Cargá al menos dos placas (botón «+ Agregar placa»), configurá sus pocillos y volvé acá para compararlas." />
  }

  // ---- prueba estadística (opcional): cada placa aporta un valor por muestra ----
  const control = grupos.some((g) => g.muestra === o.control) ? o.control : grupos[0]?.muestra || ''
  const valoresDe = (m) => (grupos.find((g) => g.muestra === m)?.barras || []).map((b) => b.media)
  let filasTest = []
  let anova = null
  if (o.test === 'control') {
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
  } else if (o.test === 'anova') {
    anova = anova1(grupos.map((g) => valoresDe(g.muestra)))
  }

  const nota = `Barras: OD media de las réplicas aceptadas de cada placa${ERR_TXT[o.error] ? `; error: ${ERR_TXT[o.error]} entre pocillos de la placa` : ''}`
  const leyenda = placasSel.map((p) => ({ id: p.id, nombre: p.nombre, color: colores[p.id] }))
  const oGraf = { valores: o.valores, errores: o.errores, puntos: o.puntos, rotar: o.rotar }
  const nBarras = grupos.reduce((a, g) => a + g.barras.length, 0)

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
        <p className="ayuda">Barras de OD de cada muestra, una por placa. El color indica de qué placa es cada barra.</p>
        <Campo label="Placas a ver">
          <div className="fila-ctrl" style={{ margin: '0 0 4px' }}>
            <button className="chico" onClick={() => setO('placasSel', conAnalisis.map((p) => p.id))}>Todas</button>
            <button className="chico" onClick={() => setO('placasSel', [])}>Ninguna</button>
          </div>
          <div className="lista-check">
            {conAnalisis.map((p) => (
              <Check key={p.id} label={<><i className="punto-placa" style={{ background: colores[p.id] }} /> {p.nombre}</>}
                checked={placasSel.some((x) => x.id === p.id)}
                onChange={(v) => setO('placasSel', v ? conAnalisis.filter((x) => x.id === p.id || placasSel.some((y) => y.id === x.id)).map((x) => x.id) : placasSel.filter((x) => x.id !== p.id).map((x) => x.id))} />
            ))}
          </div>
        </Campo>

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
                        <input type="checkbox" checked={todas} onChange={(e) => cambiarFila(m, e.target.checked)} /><span>{m}</span></label></td>
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

        <Campo label="Barras de error">
          <Select value={o.error} onChange={(v) => setO('error', v)}
            opciones={[['sd', 'Desviación estándar (entre pocillos)'], ['sem', 'Error estándar (SEM)'], ['ic95', 'IC 95 %'], ['ninguno', 'Ninguna']]} />
        </Campo>
        <Check label="Mostrar la OD sobre cada barra" checked={o.valores} onChange={(v) => setO('valores', v)} />
        <Check label="Mostrar el error junto al valor medio" checked={o.errores} onChange={(v) => setO('errores', v)} />
        <Check label="Mostrar los pocillos individuales" checked={o.puntos} onChange={(v) => setO('puntos', v)} />
        <Campo label="Rotación de etiquetas (°)"><Num value={o.rotar} min={0} max={90} step={15} onChange={(v) => setO('rotar', v === '' ? 0 : v)} /></Campo>
        <hr />
        <Campo label="Prueba estadística (opcional)">
          <Select value={o.test} onChange={(v) => setO('test', v)}
            opciones={[['ninguno', 'Ninguna'], ['control', 'Cada muestra contra un control'], ['anova', 'ANOVA: ¿hay alguna diferencia?']]} />
        </Campo>
        {o.test === 'control' && (
          <Campo label="Muestra control">
            <Select value={control} onChange={(v) => setO('control', v)} opciones={grupos.map((g) => [g.muestra, g.muestra])} />
          </Campo>
        )}
        <button className="primario ancho" onClick={() => setExp(true)} disabled={!grupos.length}>Descargar imagen…</button>
      </Panel>

      <div className="principal">
        <h1>Comparación entre placas <span className="sub">· OD de cada muestra</span></h1>
        {grupos.length ? (
          <GroupedBarChart ref={svg} grupos={grupos} placas={leyenda} o={oGraf} est={s.estilos.comparar} eje={s.ejeOD} onContext={abrirMenu} nota={nota} />
        ) : <Vacio texto="Elegí al menos una placa y una muestra para mostrar." />}
        <p className="ayuda">Clic derecho sobre el gráfico: estilo de todos los textos. Pasá el mouse sobre una barra para ver su placa y su valor. {nBarras > 0 && `${nBarras} barras.`}</p>

        {o.test === 'anova' && (
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

        {o.test === 'control' && (
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
          render={(ref, tam) => (
            <GroupedBarChart ref={ref} grupos={grupos} placas={leyenda} o={oGraf} est={s.estilos.comparar} eje={s.ejeOD}
              onContext={(e) => e.preventDefault()} tam={tam} nota={nota} />
          )} />
      )}
    </div>
  )
}
