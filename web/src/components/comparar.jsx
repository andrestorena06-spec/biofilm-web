import { useMemo, useRef, useState } from 'react'
import { BarChart } from './charts.jsx'
import { ExportDialog } from './exportar.jsx'
import { TablaAvanzada } from './tabs2.jsx'
import { Vacio } from './tabs.jsx'
import { Campo, Check, EstiloDialog, MenuContextual, Num, Panel, Select, useMenuContextual } from './ui.jsx'
import { anova1, holm, marcaSig, resumenGrupo, welch } from '../estadistica.js'
import { estiloDefecto, fmt, paletaMuestras } from '../utils.js'

const clasificarR = (r) => (!Number.isFinite(r) ? null : r <= 1 ? 'No productor' : r <= 2 ? 'Productor débil' : r <= 4 ? 'Productor moderado' : 'Productor fuerte')
const redondear = (x, d = 4) => (Number.isFinite(x) ? Number(x.toFixed(d)) : null)
const tamDe = (svg) => ({ w: svg.viewBox.baseVal.width, h: svg.viewBox.baseVal.height })

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

  // muestras presentes en las placas elegidas (en el orden de la lista de muestras)
  const todas = useMemo(() => {
    const pres = [...new Set(placasSel.flatMap((p) => s.analisisMap[p.id].resumen.map((r) => r.Muestra)))]
    return [...s.muestras.filter((m) => pres.includes(m)), ...pres.filter((m) => !s.muestras.includes(m))]
  }, [placasSel, s.muestras, s.analisisMap])
  const selMuestras = o.muestrasSel ? o.muestrasSel.filter((m) => todas.includes(m)) : todas
  const control = todas.includes(o.control) ? o.control : todas[0] || ''

  const metrica = o.metrica
  const etiquetaMetrica = { razon: 'OD ÷ ODc de cada placa', media: s.ejeOD, pct: '% del control de cada placa' }[metrica]

  // un valor por muestra y por placa
  const valores = useMemo(() => {
    const r = {}
    todas.forEach((m) => { r[m] = [] })
    placasSel.forEach((p) => {
      const A = s.analisisMap[p.id]
      const ctrl = A.resumen.find((x) => x.Muestra === control)
      A.resumen.forEach((row) => {
        let v = null
        if (metrica === 'media') v = row.Media
        else if (metrica === 'razon') v = row.Razon_ODc
        else if (ctrl && Number.isFinite(ctrl.Media) && Number.isFinite(row.Media)) v = (100 * row.Media) / ctrl.Media
        if (Number.isFinite(v)) {
          r[row.Muestra]?.push({
            placa: p.nombre, id: p.id, valor: v, color: colores[p.id],
            clase: row.Clasificacion, razon: row.Razon_ODc,
          })
        }
      })
    })
    return r
  }, [placasSel, todas, metrica, control, s.analisisMap, colores])

  if (!conAnalisis.length) {
    return <Vacio texto="Cargá al menos dos placas (botón «+ Agregar placa»), configurá sus pocillos y volvé acá para compararlas." />
  }

  // ---- estadísticos por muestra ----
  const stats = selMuestras.map((m) => ({ m, g: resumenGrupo(valores[m].map((x) => x.valor)), v: valores[m] })).filter((x) => x.g.n > 0)
  const ctrlVals = (valores[control] || []).map((x) => x.valor)
  let pAjustados = {}
  let pCrudos = {}
  let difs = {}
  if (o.test === 'control') {
    const otros = stats.filter((x) => x.m !== control)
    const res = otros.map((x) => welch(x.v.map((y) => y.valor), ctrlVals))
    const aj = holm(res.map((r) => (r ? r.p : NaN)))
    otros.forEach((x, i) => { pCrudos[x.m] = res[i]?.p ?? null; pAjustados[x.m] = aj[i]; difs[x.m] = res[i]?.dif ?? null })
  }
  const anova = o.test === 'anova' ? anova1(stats.map((x) => x.v.map((y) => y.valor))) : null

  // ---- gráfico ----
  let filas = stats.map((x) => ({
    Muestra: x.m, Media: x.g.media, SD: x.g.sd, SEM: x.g.sem, IC95: x.g.ic95,
    Clasificacion: metrica === 'razon' ? clasificarR(x.g.media) : null,
  }))
  if (o.orden === 'asc') filas = [...filas].sort((a, b) => a.Media - b.Media)
  if (o.orden === 'desc') filas = [...filas].sort((a, b) => b.Media - a.Media)
  const puntos = stats.flatMap((x) => x.v.map((y) => ({ Muestra: x.m, OD: y.valor, Pocillo: y.placa, color: y.color })))
  const oGraf = { ...o, lineas: o.lineas && metrica === 'razon', color: metrica === 'razon' ? o.color : 'uno', error: o.error }
  const errTxt = { ic95: 'IC 95 %', sd: 'desviación estándar', sem: 'error estándar', ninguno: '' }[o.error]
  const nota = `Barras: media de ${placasSel.length} ${placasSel.length === 1 ? 'placa' : 'placas'} (réplicas biológicas); puntos: cada placa${errTxt ? `; error: ${errTxt}` : ''}`
  const ejeY = { razon: 'OD ÷ ODc', media: s.ejeOD, pct: '% del control' }[metrica]

  // ---- tablas ----
  const tablaStats = stats.map((x) => {
    const clases = x.v.map((y) => y.clase).filter(Boolean)
    const consistente = clases.length < 2 ? '–' : clases.every((c) => c === clases[0]) ? 'Sí' : 'No'
    const f = {
      Muestra: x.m, Placas: x.g.n, Media: redondear(x.g.media), DE: redondear(x.g.sd), SEM: redondear(x.g.sem),
      IC95_mas_menos: redondear(x.g.ic95), CV_pct: redondear(x.g.cv, 2),
    }
    if (metrica === 'razon') f.Clasificacion = clasificarR(x.g.media) || ''
    f.Consistente = consistente
    if (o.test === 'control') {
      const es = x.m === control
      f.Dif_vs_control = es ? null : redondear(difs[x.m])
      f.p_Welch = es ? null : redondear(pCrudos[x.m], 4)
      f.p_ajustado_Holm = es ? null : redondear(pAjustados[x.m], 4)
      f.Signif = es ? 'control' : marcaSig(pAjustados[x.m])
    }
    return f
  })
  const colsStats = Object.keys(tablaStats[0] || { Muestra: 1 })

  const nombresPlacas = placasSel.map((p) => p.nombre)
  const matriz = selMuestras.map((m) => {
    const f = { Muestra: m }
    placasSel.forEach((p) => {
      const row = s.analisisMap[p.id].resumen.find((r) => r.Muestra === m)
      f[p.nombre] = row && Number.isFinite(row.Razon_ODc) ? `${row.Razon_ODc.toFixed(2)} · ${row.Clasificacion}` : '–'
    })
    const cl = (valores[m] || []).map((y) => y.clase).filter(Boolean)
    f.Consistente = cl.length < 2 ? '–' : cl.every((c) => c === cl[0]) ? 'Sí' : 'No'
    return f
  })

  const tablaPlacas = placasSel.map((p) => {
    const A = s.analisisMap[p.id]
    return {
      Placa: p.nombre, Pocillos_con_dato: p.placa?.datos.length ?? null, Configurados: p.config.length,
      Blancos_aceptados: A.odc.n, Media_blancos: redondear(A.odc.media), DE_blancos: redondear(A.odc.sd), ODc: redondear(A.odc.odc),
      Excluidos: A.estado.filter((e) => !e.Usado).length, Sospechosos: A.estado.filter((e) => e.Sospechoso).length,
    }
  })

  const noop = () => {}

  return (
    <div className="con-lateral">
      <Panel titulo="Comparar placas">
        <p className="ayuda">Cada placa aporta un valor por muestra (la media de sus réplicas). Las placas son las réplicas biológicas.</p>
        <Campo label="Valor a comparar">
          <Select value={metrica} onChange={(v) => setO('metrica', v)}
            opciones={[['razon', 'OD ÷ ODc de cada placa (recomendado)'], ['media', 'OD media sin normalizar'], ['pct', '% del control de cada placa']]} />
        </Campo>
        <Campo label="Placas incluidas">
          <div className="fila-ctrl" style={{ margin: '0 0 4px' }}>
            <button className="chico" onClick={() => setO('placasSel', conAnalisis.map((p) => p.id))}>Todas</button>
            <button className="chico" onClick={() => setO('placasSel', [])}>Ninguna</button>
          </div>
          <div className="lista-check">
            {conAnalisis.map((p) => (
              <Check key={p.id} label={<><i className="punto-placa" style={{ background: colores[p.id] }} /> {p.nombre}</>}
                checked={placasSel.some((x) => x.id === p.id)}
                onChange={(v) => setO('placasSel', v ? [...placasSel.map((x) => x.id), p.id] : placasSel.filter((x) => x.id !== p.id).map((x) => x.id))} />
            ))}
          </div>
        </Campo>
        <Campo label="Muestras incluidas">
          <div className="fila-ctrl" style={{ margin: '0 0 4px' }}>
            <button className="chico" onClick={() => setO('muestrasSel', todas)}>Todas</button>
            <button className="chico" onClick={() => setO('muestrasSel', [])}>Ninguna</button>
          </div>
          <div className="lista-check">
            {todas.map((m) => (
              <Check key={m} label={m} checked={selMuestras.includes(m)}
                onChange={(v) => setO('muestrasSel', v ? [...selMuestras, m] : selMuestras.filter((x) => x !== m))} />
            ))}
          </div>
        </Campo>
        <Campo label="Muestra control">
          <Select value={control} onChange={(v) => setO('control', v)} opciones={todas.map((m) => [m, m])} />
        </Campo>
        <Campo label="Prueba estadística">
          <Select value={o.test} onChange={(v) => setO('test', v)}
            opciones={[['control', 'Cada muestra vs. control (Welch + Holm)'], ['anova', 'ANOVA de una vía (p global)'], ['ninguno', 'Ninguna']]} />
        </Campo>
        <hr />
        <Campo label="Barras de error">
          <Select value={o.error} onChange={(v) => setO('error', v)}
            opciones={[['ic95', 'IC 95 %'], ['sd', 'Desviación estándar'], ['sem', 'Error estándar (SEM)'], ['ninguno', 'Ninguna']]} />
        </Campo>
        <Campo label="Orden de las muestras">
          <Select value={o.orden} onChange={(v) => setO('orden', v)}
            opciones={[['lista', 'Como en la lista'], ['asc', 'Valor creciente'], ['desc', 'Valor decreciente']]} />
        </Campo>
        <Check label="Mostrar un punto por placa" checked={o.puntos} onChange={(v) => setO('puntos', v)} />
        <Check label="Mostrar valores promedio" checked={o.medias} onChange={(v) => setO('medias', v)} />
        {o.medias && <Check label="Mostrar error junto al promedio" checked={o.errores} onChange={(v) => setO('errores', v)} />}
        {metrica === 'razon' && <Check label="Mostrar líneas de clasificación (1, 2 y 4 × ODc)" checked={o.lineas} onChange={(v) => setO('lineas', v)} />}
        <Campo label="Rotación de etiquetas (°)"><Num value={o.rotar} min={0} max={90} step={15} onChange={(v) => setO('rotar', v === '' ? 0 : v)} /></Campo>
        <button className="primario ancho" onClick={() => setExp(true)} disabled={!filas.length}>Descargar imagen…</button>
      </Panel>

      <div className="principal">
        <h1>Comparación entre placas <span className="sub">· {etiquetaMetrica}</span></h1>
        {placasSel.length < 2 && <p className="aviso-sel">Hay {placasSel.length === 1 ? 'una sola placa' : 'ninguna placa'} incluida: sin al menos 2 placas no se puede calcular el error ni hacer pruebas estadísticas.</p>}
        {filas.length ? (
          <BarChart ref={svg} filas={filas} puntos={o.puntos ? puntos : []} odc={metrica === 'razon' ? 1 : NaN} o={oGraf}
            est={s.estilos.comparar} eje={ejeY} onContext={abrirMenu} nota={nota}
            leyendaPuntos={o.puntos ? placasSel.map((p) => ({ nombre: p.nombre, color: colores[p.id] })) : []} />
        ) : <Vacio texto="Elegí al menos una placa y una muestra con datos." />}
        <p className="ayuda">Clic derecho sobre el gráfico: estilo de todos los textos. Pasá el mouse sobre un punto para ver de qué placa es.</p>
        {anova && (
          <p className="aviso-sel" style={{ background: '#f3f8ef', borderColor: '#d5e5c8', color: '#4b6b34' }}>
            ANOVA de una vía entre las {stats.length} muestras: F({anova.df1}; {anova.df2}) = {Number.isFinite(anova.F) ? anova.F.toFixed(3) : '∞'}, p = {anova.p < 0.0001 ? '< 0,0001' : anova.p.toFixed(4)} {marcaSig(anova.p)}
          </p>
        )}
        {o.test === 'control' && control && <p className="ayuda">Comparaciones contra <b>{control}</b> con la prueba t de Welch y ajuste de Holm. n = número de placas; con 2 o 3 placas por muestra la potencia es muy baja, mirá también los puntos.</p>}

        <TablaAvanzada id="comparacion_muestras" titulo="Resumen por muestra (entre placas)" columnas={colsStats} filas={tablaStats} onVista={noop} />
        <TablaAvanzada id="clasificacion_por_placa" titulo="Clasificación por placa (OD ÷ ODc · clase)" columnas={['Muestra', ...nombresPlacas, 'Consistente']} filas={matriz} onVista={noop} />
        <TablaAvanzada id="control_de_placas" titulo="Control de las placas" columnas={Object.keys(tablaPlacas[0] || { Placa: 1 })} filas={tablaPlacas} onVista={noop} />
      </div>

      <MenuContextual menu={menu} items={[
        ['Estilo de texto…', () => { cerrarMenu(); setDlg(true) }],
        ['Restablecer estilo de texto', () => { cerrarMenu(); s.setEstilos({ ...s.estilos, comparar: estiloDefecto() }) }],
      ]} />
      {dlg && <EstiloDialog estilo={s.estilos.comparar} conClases ejeDefecto={ejeY} onClose={() => setDlg(false)}
        onGuardar={(e) => { s.setEstilos({ ...s.estilos, comparar: e }); setDlg(false) }} />}
      {exp && svg.current && (
        <ExportDialog nombre="comparacion_placas" size0={tamDe(svg.current)} onClose={() => setExp(false)}
          render={(ref, tam) => (
            <BarChart ref={ref} filas={filas} puntos={o.puntos ? puntos : []} odc={metrica === 'razon' ? 1 : NaN} o={oGraf}
              est={s.estilos.comparar} eje={ejeY} onContext={(e) => e.preventDefault()} tam={tam} nota={nota}
              leyendaPuntos={o.puntos ? placasSel.map((p) => ({ nombre: p.nombre, color: colores[p.id] })) : []} />
          )} />
      )}
    </div>
  )
}
