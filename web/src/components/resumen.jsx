// Pestaña «Resumen»: ficha del experimento, avance de los pasos, lo que conviene revisar (con acceso directo),
// la clasificación de cada muestra en cada placa y el estado de las placas.
import { Icono } from './iconos.jsx'
import { BotonCinta, Cinta, Grupo, Mosaico } from './cinta.jsx'
import { pendientes, TITULO_PASO } from '../progreso.js'
import { excelDe } from '../api.js'
import { abrirInforme } from './informe.jsx'
import { COLOR_CLASE, descargarBlob, fmt, paletaMuestras } from '../utils.js'
import { nombreArchivo } from '../modelo.js'

const finito = Number.isFinite
const PASOS_TRABAJO = ['placas', 'pocillos', 'calidad', 'odc', 'grafico', 'estadistica', 'datos']
const r4 = (x, d = 4) => (finito(x) ? Number(x.toFixed(d)) : null)
const METODO = { q: 'Test Q de Dixon', grubbs: 'Test de Grubbs', cv: 'Coeficiente de variación' }

// Excel con todo el experimento: una hoja por tabla, con los datos del experimento y los ajustes
export async function descargarExcelCompleto(s) {
  const { exp, analisisMap } = s
  const placas = exp.placas.filter((p) => !p.oculta)
  const i = exp.info, d = exp.deteccion
  const hojaExp = [
    ['Experimento', i.nombre], ['Fecha', i.fecha], ['Organismo', i.organismo], ['Responsable', i.responsable], ['Equipo (lector)', i.equipo],
    ['Temperatura (°C)', i.temperatura], ['Incubación', i.incubacion], ['Tinción', i.tincion], ['Notas', i.notas],
    ['Valores atípicos', `${METODO[d.metodo] || d.metodo}${d.metodo === 'cv' ? ` (CV máximo ${d.cvMax} %)` : ` (confianza ${d.conf} %)`}`],
    ['Exclusión automática de sospechosos', d.usar ? 'Sí' : 'No'],
    ['Punto de corte', 'ODc = media(blancos) + 3 × DE(blancos) (Stepanović et al., 2000)'],
    ['Exportado', new Date().toLocaleString('es')],
  ].map(([Campo, Valor]) => ({ Campo, Valor: Valor ?? '' }))
  const hPlacas = [], hMuestras = [], hPocillos = [], hCrudas = []
  placas.forEach((p) => {
    const a = analisisMap[p.id]
    hPlacas.push({
      Placa: p.nombre, Medio: p.medio || '', Archivo: p.archivo?.nombre || '', Hoja: p.archivo?.hoja || '', Onda_nm: p.placa?.onda ?? null, Fecha_lectura: p.placa?.fecha || '',
      Pocillos_con_datos: p.placa?.datos.length || 0, Configurados: p.config.length, Blancos_usados: (p.blancosUsados ?? a?.blancos ?? []).join(', '),
      N_blancos: a?.odc?.n ?? null, Media_blancos: r4(a?.odc?.media), DE_blancos: r4(a?.odc?.sd), ODc: r4(a?.odc?.odc),
    })
    ;(a?.resumen || []).forEach((m) => hMuestras.push({
      Placa: p.nombre, Medio: p.medio || '', Muestra: m.Muestra, Pocillos: m.N_total, Aceptadas: m.N_aceptadas, Excluidas: m.N_excluidas,
      Media_OD: r4(m.Media), DE: r4(m.SD), SEM: r4(m.SEM), IC95_mas_menos: r4(m.IC95), CV_pct: r4(m.CV_pct, 2), OD_sobre_ODc: r4(m.Razon_ODc, 3), Clasificacion: m.Clasificacion || '',
    }))
    ;(a?.estado || []).forEach((e) => hPocillos.push({
      Placa: p.nombre, Medio: p.medio || '', Pocillo: e.Pocillo, Muestra: e.Muestra, Replica: e.Replica, Blanco: e.EsBlanco ? 'Sí' : 'No', OD: r4(e.OD),
      Estado: e.Usado ? 'Aceptado' : 'Excluido', Sospechoso: e.Sospechoso ? 'Sí' : 'No', Motivo: e.Manual ? 'Excluido manualmente' : e.Motivo || '',
    }))
    ;(p.placa?.datos || []).forEach((x) => hCrudas.push({ Placa: p.nombre, Pocillo: x.Pocillo, OD: x.OD, Muestra: p.config.find((c) => c.Pocillo === x.Pocillo)?.Muestra || '' }))
  })
  // medias de cada muestra en cada placa y variación entre placas (réplicas biológicas)
  const nombres = placas.filter((p) => analisisMap[p.id]?.resumen?.length)
  const cepas = [...new Set(nombres.flatMap((p) => analisisMap[p.id].resumen.map((m) => m.Muestra)))]
  const hMedias = cepas.map((c) => {
    const fila = { Muestra: c }
    const v = []
    nombres.forEach((p) => { const m = analisisMap[p.id].resumen.find((x) => x.Muestra === c); fila[p.nombre] = r4(m?.Media); if (finito(m?.Media)) v.push(m.Media) })
    const med = v.length ? v.reduce((a, b) => a + b, 0) / v.length : NaN
    const de = v.length > 1 ? Math.sqrt(v.reduce((a, b) => a + (b - med) ** 2, 0) / (v.length - 1)) : NaN
    return { ...fila, Placas_con_dato: v.length, Media_entre_placas: r4(med), DE_entre_placas: r4(de), CV_entre_placas_pct: r4(finito(de) && med ? (100 * de) / med : NaN, 2) }
  })
  const hoja = (nombre, filas) => ({ nombre, columnas: Object.keys(filas[0] || { Sin_datos: '' }), filas })
  const b = await excelDe([hoja('Experimento', hojaExp), hoja('Placas', hPlacas), hoja('Muestras', hMuestras), hoja('Medias por placa', hMedias), hoja('Pocillos', hPocillos), hoja('Lecturas', hCrudas)])
  descargarBlob(b, nombreArchivo(exp).replace('.biofilm.json', '_completo.xlsx'))
}

export function Resumen({ s }) {
  const { exp, analisisMap } = s
  const i = exp.info
  const pend = pendientes(exp, analisisMap)
  const hechos = PASOS_TRABAJO.filter((p) => s.listo(p)).length
  const proximo = PASOS_TRABAJO.find((p) => !s.listo(p))
  const vis = exp.placas.filter((p) => !p.oculta)
  const conAn = vis.filter((p) => analisisMap[p.id]?.resumen?.length)
  const cepas = exp.muestras.filter((m) => conAn.some((p) => analisisMap[p.id].resumen.some((r) => r.Muestra === m)))
  const colorCepa = paletaMuestras(exp.muestras)
  const colorPlaca = paletaMuestras(exp.placas.map((p) => p.id))
  const ondas = [...new Set(vis.map((p) => p.placa?.onda).filter(finito))]
  const ficha = [
    ['Fecha', i.fecha], ['Organismo', i.organismo], ['Tinción', i.tincion], ['Incubación', [i.incubacion, finito(Number(String(i.temperatura).replace(',', '.'))) && i.temperatura !== '' ? `${i.temperatura} °C` : ''].filter(Boolean).join(' · ')],
    ['Longitud de onda', ondas.length ? ondas.map((x) => `${x} nm`).join(', ') : ''], ['Equipo', i.equipo], ['Responsable', i.responsable],
  ]
  const ir = (x) => { if (x.placa) s.setActiva(x.placa); s.irA(x.ir) }
  const informe = () => { if (abrirInforme(s)) s.avisar('En el cuadro de impresión elegí «Guardar como PDF» como destino.'); else s.avisar('Todavía no hay placas analizadas para el informe.', 'error') }

  return (
    <div>
      <Cinta>
        <Grupo titulo="Experimento">
          <BotonCinta icono="guardar" texto="Guardar" onClick={s.guardar} tip="Descarga la sesión con los datos de todas las placas (Ctrl + S)" />
          <BotonCinta icono="editar" texto="Datos del experimento" onClick={s.abrirEditar} tip="Nombre, fecha, condiciones, notas, muestras y medios (renombrar en todo el experimento)" />
        </Grupo>
        <Grupo titulo="Exportar">
          <BotonCinta icono="tabla" texto="Excel completo" onClick={() => descargarExcelCompleto(s).catch((e) => s.avisar(e.message, 'error'))} deshabilitado={!conAn.length} tip="Todas las tablas del análisis (placas, muestras, medias por placa, pocillos y lecturas), una por hoja, con los datos del experimento" />
          <BotonCinta icono="imprimir" texto="Informe PDF" onClick={informe} deshabilitado={!conAn.length} tip="Gráficos y tablas de todas las placas, listos para imprimir o guardar como PDF" />
        </Grupo>
        {proximo && <Grupo titulo="Siguiente"><BotonCinta icono="flecha" texto={TITULO_PASO[proximo]} onClick={() => s.irA(proximo)} tip="Primer paso que falta completar" /></Grupo>}
      </Cinta>

      <section className="ficha-exp">
        <div className="ficha-titulo">
          <span className="etiqueta-seccion">Experimento</span>
          <h1>{i.nombre}</h1>
          {i.notas && <p className="ayuda" style={{ margin: '4px 0 0', whiteSpace: 'pre-line' }}>{i.notas}</p>}
        </div>
        <dl className="ficha-datos">
          {ficha.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v || <span className="tenue">—</span>}</dd></div>)}
          <div><dt>Medios</dt><dd className="ficha-cepas">{exp.medios.filter((m) => vis.some((p) => p.medio === m)).map((m) => <span key={m} className="chip">{m}</span>)}{!vis.some((p) => p.medio) && <span className="tenue">—</span>}</dd></div>
          <div className="ancha"><dt>Muestras con datos</dt><dd className="ficha-cepas">{cepas.length ? cepas.map((m) => <span key={m}><i className="punto" style={{ background: colorCepa[m] }} />{m}</span>) : <span className="tenue">—</span>}</dd></div>
        </dl>
        <button className="fantasma chico ficha-editar" onClick={s.abrirEditar}><Icono n="editar" size={14} />Editar</button>
      </section>

      <div className="tablero">
        <Mosaico titulo="Avance del análisis">
          <div className="barra-prog"><i style={{ width: `${(100 * hechos) / PASOS_TRABAJO.length}%` }} /></div>
          <p className="ayuda" style={{ margin: '6px 0 10px' }}>{hechos} de {PASOS_TRABAJO.length} pasos con datos</p>
          <ol className="lista-pasos">
            {PASOS_TRABAJO.map((p) => (
              <li key={p} className={s.listo(p) ? 'hecho' : p === proximo ? 'proximo' : ''}>
                <button className="fantasma" onClick={() => s.irA(p)}>
                  <span className="marca-paso">{s.listo(p) ? <Icono n="check" size={12} ancho={3} /> : null}</span>{TITULO_PASO[p]}
                  {p === proximo && <span className="chip acento" style={{ marginLeft: 'auto' }}>siguiente</span>}
                </button>
              </li>
            ))}
          </ol>
        </Mosaico>

        <Mosaico titulo={`Para revisar${pend.length ? ` (${pend.length})` : ''}`}>
          {!pend.length ? <p className="todo-bien"><Icono n="check" size={16} ancho={3} />No hay nada pendiente.</p> : (
            <ul className="lista-pendientes">
              {pend.map((x, k) => (
                <li key={k} className={x.nivel}>
                  <span className="icono-pend">{x.nivel === 'aviso' ? '!' : 'i'}</span>
                  <span className="texto-pend">{x.texto}</span>
                  {x.ir && <button className="fantasma chico" onClick={() => ir(x)}>{TITULO_PASO[x.ir]}<Icono n="flecha" size={12} /></button>}
                </li>
              ))}
            </ul>
          )}
        </Mosaico>

        <Mosaico titulo={`Placas (${vis.length})`} accion="Placas" onAccion={() => s.irA('placas')}>
          {!exp.placas.length ? <p className="ayuda">Todavía no hay placas.</p> : (
            <div className="mini-placas">
              {exp.placas.map((p) => {
                const a = analisisMap[p.id]
                return (
                  <button key={p.id} className={`mini-placa ${p.oculta ? 'oculta' : ''}`} onClick={() => { s.setActiva(p.id); s.irA('pocillos') }}
                    data-tip={`${p.nombre}${p.medio ? ` · ${p.medio}` : ''}\n${p.placa ? `${p.placa.datos.length} pocillos con datos · ${p.config.length} configurados` : 'Sin datos'}${a && finito(a.odc?.odc) ? `\nODc = ${fmt(a.odc.odc, 4)} (n = ${a.odc.n} blancos)` : ''}${p.oculta ? '\nOculta: fuera de los cálculos' : ''}`}>
                    <i className="punto" style={{ background: colorPlaca[p.id] }} />
                    <b>{p.nombre}</b>
                    <small>{p.medio || 'sin medio'} · {a && finito(a.odc?.odc) ? `ODc ${fmt(a.odc.odc, 3)}` : p.placa ? (p.config.length ? 'sin ODc' : 'sin configurar') : 'sin datos'}</small>
                  </button>
                )
              })}
            </div>
          )}
        </Mosaico>

        <Mosaico titulo="Clasificación de cada muestra (Stepanović)" accion="Gráfico" onAccion={() => s.irA('grafico')} className="m-ancho">
          {!conAn.length || !cepas.length ? <p className="ayuda">Aparece cuando haya placas con pocillos configurados.</p> : (
            <>
              <div className="tabla-scroll">
                <table className="tabla compacta matriz-clase">
                  <thead><tr><th>Muestra</th>{conAn.map((p) => <th key={p.id} className="num" data-tip={`${p.nombre}${p.medio ? ` · ${p.medio}` : ''}`}><i className="punto" style={{ background: colorPlaca[p.id] }} /> {p.nombre}</th>)}</tr></thead>
                  <tbody>
                    {cepas.map((m) => (
                      <tr key={m}>
                        <td><i className="punto" style={{ background: colorCepa[m] }} /> {m}</td>
                        {conAn.map((p) => {
                          const a = analisisMap[p.id]
                          const r = a.resumen.find((x) => x.Muestra === m)
                          if (!r || !finito(r.Media)) return <td key={p.id} className="num tenue">—</td>
                          const c = r.Clasificacion
                          return (
                            <td key={p.id} className="num celda-clase" style={{ '--clase': COLOR_CLASE[c] || 'transparent' }} onClick={() => { s.setActiva(p.id); s.irA('odc') }}
                              data-tip={`${m} · ${p.nombre}\nOD media = ${fmt(r.Media, 3)}${finito(r.SD) ? ` ± ${fmt(r.SD, 3)} (DE)` : ''} · n = ${r.N_aceptadas}${finito(a.odc?.odc) ? `\nODc = ${fmt(a.odc.odc, 4)} → OD ÷ ODc = ${fmt(r.Razon_ODc, 2)}` : ''}\n${c || 'Sin clasificar (falta el ODc)'}`}>
                              {fmt(r.Media, 3)}
                            </td>
                          )
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="leyenda-clases">
                {Object.entries(COLOR_CLASE).filter(([k]) => k.startsWith('No') || k.startsWith('Productor')).map(([k, c]) => <span key={k}><i className="punto" style={{ background: c }} />{k}</span>)}
                <span className="tenue">OD media de las réplicas aceptadas · clic: ver la placa</span>
              </div>
            </>
          )}
        </Mosaico>
      </div>
    </div>
  )
}
