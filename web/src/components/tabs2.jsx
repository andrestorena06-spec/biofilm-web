import { useEffect, useMemo, useRef, useState } from 'react'
import { BarChart, ExcluirChart } from './charts.jsx'
import { Campo, Check, EstiloDialog, MenuContextual, Num, Panel, Select, useMenuContextual } from './ui.jsx'
import { ExportDialog } from './exportar.jsx'
import { Vacio } from './tabs.jsx'
import { excelDe } from '../api.js'
import { Q_TABLA, DIXON_TABLA } from '../criticos.js'
import { descargarBlob, estiloDefecto, fmt, tCuantil } from '../utils.js'

const METODOS = [['hampel', 'Filtro de Hampel (mediana y MAD)'], ['q', 'Test Q de Dixon (n de 3 a 10)'], ['dixon', 'Test de Dixon general (n de 3 a 30)']]
// Tamaño (en unidades de figura) del gráfico que se ve ahora en pantalla
const tamDe = (svg) => ({ w: svg.viewBox.baseVal.width, h: svg.viewBox.baseVal.height })
const nombreMetodo ={ hampel: 'Hampel', q: 'Test Q', dixon: 'Test de Dixon' }

// ===============================================================
// EXCLUIR PUNTOS
// ===============================================================
export function ExcluirTab({ s }) {
  const svg = useRef()
  const [menu, abrirMenu, cerrarMenu] = useMenuContextual()
  const [dlg, setDlg] = useState(false)
  const [exp, setExp] = useState(false)
  const o = s.opts.excluir
  const setO = (k, v) => s.setOpts({ ...s.opts, excluir: { ...o, [k]: v } })
  const d = s.deteccion
  const setD = (k, v) => s.setDeteccion({ ...d, [k]: v })

  if (!s.analisis?.estado?.length) return <Vacio texto="Configurá los pocillos para poder excluir puntos." />
  const estado = s.analisis.estado
  const excluidos = estado.filter((e) => !e.Usado)

  return (
    <div className="con-lateral">
      <Panel titulo="Excluir puntos">
        <p className="ayuda">Clic sobre un punto para excluirlo o incluirlo. Azul: aceptado. Cruz roja: excluido. Anillo naranja: sospechoso según el test elegido.</p>

        <h3>Opciones del gráfico</h3>
        <Check label="Mostrar puntos" checked={o.puntos} onChange={(v) => setO('puntos', v)} />
        <Check label="Mostrar valor medio sobre cada muestra" checked={o.medias} onChange={(v) => setO('medias', v)} />
        <Check label="Mostrar error junto al valor medio" checked={o.errores} onChange={(v) => setO('errores', v)} />
        <Campo label="Tipo de error">
          <Select value={o.error} onChange={(v) => setO('error', v)}
            opciones={[['sd', 'Desviación estándar'], ['sem', 'Error estándar (SEM)'], ['ic95', 'IC 95 %']]} />
        </Campo>
        {d.metodo === 'hampel' && <Check label="Mostrar banda de Hampel (mediana ± límite)" checked={o.banda} onChange={(v) => setO('banda', v)} />}
        <Campo label="Rotación de etiquetas (°)"><Num value={o.rotar} min={0} max={90} step={15} onChange={(v) => setO('rotar', v === '' ? 0 : v)} /></Campo>

        <h3>Detección de valores atípicos</h3>
        <Campo label="Método">
          <Select value={d.metodo} onChange={(v) => setD('metodo', v)} opciones={METODOS} />
        </Campo>
        {d.metodo === 'hampel' ? (
          <>
            <Campo label="Desviaciones (n × 1,4826 × MAD)"><Num value={d.nsig} min={1} step={0.5} onChange={(v) => setD('nsig', v)} /></Campo>
            <Campo label="Diferencia mínima (OD)"><Num value={d.min} min={0} step={0.005} onChange={(v) => setD('min', v)} /></Campo>
          </>
        ) : (
          <Campo label="Nivel de confianza">
            <Select value={d.conf} onChange={(v) => setD('conf', v)} opciones={[['90', '90 %'], ['95', '95 %'], ['99', '99 %']]} />
          </Campo>
        )}
        <Check label="Excluir automáticamente los sospechosos" checked={d.usar} onChange={(v) => setD('usar', v)} />
        <p className="ayuda">
          {d.metodo === 'hampel' ? 'Necesita al menos 3 pocillos por muestra.'
            : d.metodo === 'q' ? 'Detecta como máximo un valor atípico por muestra, con 3 a 10 pocillos.'
              : 'Detecta como máximo un valor atípico por muestra, con 3 a 30 pocillos. La razón usada depende de n.'}
          {' '}El detalle del cálculo está en Datos › Método.
        </p>
        <button className="ancho" onClick={() => s.restablecerExclusiones()}>Restablecer exclusiones</button>
      </Panel>
      <div className="principal">
        <ExcluirChart ref={svg} estado={estado} orden={s.ordenMuestras} o={o} est={s.estilos.excluir} eje={s.ejeOD}
          onClickPunto={s.alternarPocillo} onContext={abrirMenu} />
        <div className="fila-ctrl">
          <button className="primario" onClick={() => setExp(true)}>Descargar imagen…</button>
          <span className="ayuda">Clic derecho sobre el gráfico: estilo de todos los textos.</span>
        </div>
        {excluidos.length ? <p><b>Excluidos: </b>{excluidos.map((e) => `${e.Pocillo} (${e.Muestra} R${e.Replica})`).join(', ')}</p>
          : <p className="ayuda">No hay puntos excluidos.</p>}
      </div>
      <MenuContextual menu={menu} items={[
        ['Estilo de texto…', () => { cerrarMenu(); setDlg(true) }],
        ['Restablecer estilo de texto', () => { cerrarMenu(); s.setEstilos({ ...s.estilos, excluir: estiloDefecto() }) }],
      ]} />
      {dlg && <EstiloDialog estilo={s.estilos.excluir} conClases={false} ejeDefecto={s.ejeOD} onClose={() => setDlg(false)}
        onGuardar={(e) => { s.setEstilos({ ...s.estilos, excluir: e }); setDlg(false) }} />}
      {exp && svg.current && (
        <ExportDialog nombre="excluir_puntos" size0={tamDe(svg.current)} onClose={() => setExp(false)}
          render={(ref, tam) => <ExcluirChart ref={ref} estado={estado} orden={s.ordenMuestras} o={o} est={s.estilos.excluir}
            eje={s.ejeOD} onClickPunto={() => {}} onContext={(e) => e.preventDefault()} tam={tam} />} />
      )}
    </div>
  )
}

// ===============================================================
// GRÁFICO DE BARRAS
// ===============================================================
export function GraficoTab({ s }) {
  const svg = useRef()
  const [menu, abrirMenu, cerrarMenu] = useMenuContextual()
  const [dlg, setDlg] = useState(false)
  const [exp, setExp] = useState(false)
  const o = s.opts.barras
  const setO = (k, v) => s.setOpts({ ...s.opts, barras: { ...o, [k]: v } })
  const a = s.analisis
  if (!a?.resumen?.length) return <Vacio texto="Configurá los pocillos para ver el gráfico." />

  const todas = a.resumen.map((r) => r.Muestra)
  const selMuestras = o.muestrasSel ? o.muestrasSel.filter((m) => todas.includes(m)) : todas
  let filas = a.resumen.filter((r) => selMuestras.includes(r.Muestra) && Number.isFinite(r.Media))
  if (o.orden === 'asc') filas = [...filas].sort((x, y) => x.Media - y.Media)
  if (o.orden === 'desc') filas = [...filas].sort((x, y) => y.Media - x.Media)
  const puntos = a.estado.filter((e) => !e.EsBlanco && e.Usado && filas.some((f) => f.Muestra === e.Muestra))

  return (
    <div className="con-lateral">
      <Panel titulo="Gráfico de barras">
        <Campo label="Muestras a mostrar">
          <div className="fila-ctrl" style={{ margin: '0 0 4px' }}>
            <button className="chico" onClick={() => setO('muestrasSel', todas)}>Seleccionar todas</button>
            <button className="chico" onClick={() => setO('muestrasSel', [])}>Deseleccionar todas</button>
          </div>
          <div className="lista-check">
            {todas.map((m) => (
              <Check key={m} label={m} checked={selMuestras.includes(m)}
                onChange={(v) => setO('muestrasSel', v ? [...selMuestras, m] : selMuestras.filter((x) => x !== m))} />
            ))}
          </div>
        </Campo>
        <Campo label="Barras de error">
          <Select value={o.error} onChange={(v) => setO('error', v)}
            opciones={[['ic95', 'IC 95 %'], ['sd', 'Desviación estándar'], ['sem', 'Error estándar (SEM)'], ['ninguno', 'Ninguna']]} />
        </Campo>
        <Campo label="Orden de las muestras">
          <Select value={o.orden} onChange={(v) => setO('orden', v)}
            opciones={[['lista', 'Como en la lista'], ['asc', 'OD creciente'], ['desc', 'OD decreciente']]} />
        </Campo>
        <Campo label="Color de las barras">
          <Select value={o.color} onChange={(v) => setO('color', v)} opciones={[['clase', 'Según clasificación'], ['uno', 'Un solo color']]} />
        </Campo>
        <Check label="Mostrar puntos (réplicas)" checked={o.puntos} onChange={(v) => setO('puntos', v)} />
        <Check label="Mostrar valores promedios" checked={o.medias} onChange={(v) => setO('medias', v)} />
        {o.medias && <Check label="Mostrar errores junto a valores promedios" checked={o.errores} onChange={(v) => setO('errores', v)} />}
        <Check label="Mostrar líneas y nombres de clasificación" checked={o.lineas} onChange={(v) => setO('lineas', v)} />
        {o.lineas && <Check label="Mostrar el valor numérico bajo cada nombre" checked={o.valoresClase} onChange={(v) => setO('valoresClase', v)} />}
        <Campo label="Rotación de etiquetas (°)"><Num value={o.rotar} min={0} max={90} step={15} onChange={(v) => setO('rotar', v === '' ? 0 : v)} /></Campo>
        <p className="ayuda">El título y las leyendas se editan con clic derecho sobre el gráfico.</p>
        <button className="primario ancho" onClick={() => setExp(true)}>Descargar imagen…</button>
      </Panel>
      <div className="principal">
        {filas.length ? (
          <BarChart ref={svg} filas={filas} puntos={puntos} odc={a.odc.odc} o={o} est={s.estilos.barras} eje={s.ejeOD} onContext={abrirMenu} />
        ) : <Vacio texto="Seleccioná al menos una muestra con réplicas aceptadas." />}
        <p className="ayuda">Clic derecho sobre el gráfico: estilo de todos los textos (título, leyendas, etiquetas, números, valores y clasificaciones).</p>
        {!Number.isFinite(a.odc.odc) && <p className="ayuda">Sin ODc (faltan blancos): las barras no se pueden clasificar.</p>}
      </div>
      <MenuContextual menu={menu} items={[
        ['Estilo de texto…', () => { cerrarMenu(); setDlg(true) }],
        ['Restablecer estilo de texto', () => { cerrarMenu(); s.setEstilos({ ...s.estilos, barras: estiloDefecto() }) }],
      ]} />
      {dlg && <EstiloDialog estilo={s.estilos.barras} conClases ejeDefecto={s.ejeOD} onClose={() => setDlg(false)}
        onGuardar={(e) => { s.setEstilos({ ...s.estilos, barras: e }); setDlg(false) }} />}
      {exp && svg.current && (
        <ExportDialog nombre="barras_biofilm" size0={tamDe(svg.current)} onClose={() => setExp(false)}
          render={(ref, tam) => <BarChart ref={ref} filas={filas} puntos={puntos} odc={a.odc.odc} o={o} est={s.estilos.barras}
            eje={s.ejeOD} onContext={(e) => e.preventDefault()} tam={tam} />} />
      )}
    </div>
  )
}

// ===============================================================
// TABLA CON FILTROS, COLUMNAS MOVIBLES Y DESCARGA A EXCEL
// ===============================================================
const num = (v) => (typeof v === 'number' ? v : NaN)

// Filtro de una columna. Numéricas: >0.3  <=0.5  =1  !=2  0.1..0.4  (varias condiciones separadas por espacio).
// Texto: contiene; "=texto" exacto; "!texto" no contiene.
function cumple(valor, filtro, esNum) {
  const f = filtro.trim()
  if (!f) return true
  if (!esNum) {
    const v = String(valor ?? '').toLowerCase()
    const q = f.toLowerCase()
    if (q.startsWith('=')) return v === q.slice(1).trim()
    if (q.startsWith('!')) return !v.includes(q.slice(1).trim())
    return v.includes(q)
  }
  const x = num(valor)
  return f.split(/\s+/).every((t) => {
    let m
    if ((m = t.match(/^(-?[\d.,]+)\.\.(-?[\d.,]+)$/))) return x >= parseFloat(m[1].replace(',', '.')) && x <= parseFloat(m[2].replace(',', '.'))
    if ((m = t.match(/^(>=|<=|!=|>|<|=)(-?[\d.,]+)$/))) {
      const y = parseFloat(m[2].replace(',', '.'))
      return { '>=': x >= y, '<=': x <= y, '!=': x !== y, '>': x > y, '<': x < y, '=': x === y }[m[1]]
    }
    if ((m = t.match(/^-?[\d.,]+$/))) return x === parseFloat(t.replace(',', '.'))
    return String(valor ?? '').toLowerCase().includes(t.toLowerCase())
  })
}

const OPERADORES = [['gt', 'Mayor que'], ['ge', 'Mayor o igual que'], ['lt', 'Menor que'], ['le', 'Menor o igual que'], ['eq', 'Igual a'], ['entre', 'Entre']]

function cumpleNum(valor, f) {
  const a = parseFloat(String(f?.a ?? '').replace(',', '.'))
  if (!f || !Number.isFinite(a)) return true
  const x = num(valor)
  if (!Number.isFinite(x)) return false
  const b = parseFloat(String(f.b ?? '').replace(',', '.'))
  switch (f.op) {
    case 'gt': return x > a
    case 'ge': return x >= a
    case 'lt': return x < a
    case 'le': return x <= a
    case 'eq': return Math.abs(x - a) < 1e-9
    case 'entre': return Number.isFinite(b) ? x >= Math.min(a, b) && x <= Math.max(a, b) : x >= a
    default: return true
  }
}

const filtroActivo = (f) => f && Number.isFinite(parseFloat(String(f.a ?? '').replace(',', '.')))
const resumenFiltro = (f) => {
  const op = { gt: '>', ge: '≥', lt: '<', le: '≤', eq: '=' }[f.op]
  return f.op === 'entre' ? `entre ${f.a} y ${f.b || '…'}` : `${op} ${f.a}`
}

function PopoverFiltro({ col, pos, valor, onChange, onClose }) {
  const ref = useRef()
  useEffect(() => {
    const fuera = (e) => { if (ref.current && !ref.current.contains(e.target)) onClose() }
    const tecla = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('mousedown', fuera)
    window.addEventListener('keydown', tecla)
    window.addEventListener('scroll', onClose, true)
    return () => {
      window.removeEventListener('mousedown', fuera)
      window.removeEventListener('keydown', tecla)
      window.removeEventListener('scroll', onClose, true)
    }
  }, [onClose])
  const f = valor || { op: 'gt', a: '', b: '' }
  const set = (k, v) => onChange({ ...f, [k]: v })
  return (
    <div ref={ref} className="popover-filtro" style={{ left: pos.x, top: pos.y }}>
      <h5>Filtrar: {col.replace(/_/g, ' ')}</h5>
      <Select value={f.op} onChange={(v) => set('op', v)} opciones={OPERADORES} />
      <Campo label={f.op === 'entre' ? 'Desde' : 'Valor'}>
        <input autoFocus type="number" step="any" value={f.a} onChange={(e) => set('a', e.target.value)} />
      </Campo>
      {f.op === 'entre' && (
        <Campo label="Hasta"><input type="number" step="any" value={f.b} onChange={(e) => set('b', e.target.value)} /></Campo>
      )}
      <div className="fila-ctrl">
        <button className="chico" onClick={() => { onChange(null); onClose() }}>Quitar filtro</button>
        <button className="chico primario" onClick={onClose}>Listo</button>
      </div>
    </div>
  )
}

export function TablaAvanzada({ id, titulo, columnas, filas, onVista }) {
  const [orden, setOrden] = useState(columnas)
  const [filtros, setFiltros] = useState({})
  const [abierto, setAbierto] = useState(null)
  const [sort, setSort] = useState(null)
  const arrastre = useRef(null)
  useEffect(() => { setOrden((o) => (columnas.every((c) => o.includes(c)) && o.length === columnas.length ? o : columnas)) }, [columnas.join('|')])

  const esNum = useMemo(() => Object.fromEntries(columnas.map((c) => [c, filas.some((f) => typeof f[c] === 'number')])), [columnas, filas])
  const vista = useMemo(() => {
    let r = filas.filter((f) => orden.every((c) => !esNum[c] || cumpleNum(f[c], filtros[c])))
    if (sort) {
      const k = sort.col
      r = [...r].sort((a, b) => {
        const x = a[k], y = b[k]
        const c = esNum[k] ? (num(x) || 0) - (num(y) || 0) : String(x ?? '').localeCompare(String(y ?? ''))
        return sort.dir === 'asc' ? c : -c
      })
    }
    return r
  }, [filas, filtros, sort, orden, esNum])

  useEffect(() => { onVista(id, { nombre: titulo, columnas: orden, filas: vista }) }, [vista, orden])

  const soltar = (destino) => {
    const o = arrastre.current
    if (!o || o === destino) return
    const nuevo = orden.filter((c) => c !== o)
    nuevo.splice(nuevo.indexOf(destino), 0, o)
    setOrden(nuevo)
  }
  const hayFiltro = Object.values(filtros).some(filtroActivo)

  return (
    <section className="tarjeta">
      <div className="titulo-fila">
        <h2>{titulo} <small className="ayuda">({vista.length} de {filas.length} filas)</small></h2>
        <div className="fila-ctrl" style={{ margin: 0 }}>
          {hayFiltro && <button className="chico" onClick={() => setFiltros({})}>Quitar filtros</button>}
          <button className="chico" onClick={() => { setOrden(columnas); setSort(null) }}>Orden original</button>
          <button className="chico primario" onClick={() => excelDe([{ nombre: titulo, columnas: orden, filas: vista }]).then((b) => descargarBlob(b, `${id}_biofilm.xlsx`))}>Descargar Excel</button>
        </div>
      </div>
      <div className="tabla-scroll">
        <table className="tabla">
          <thead>
            <tr>
              {orden.map((c) => (
                <th key={c} draggable onDragStart={() => { arrastre.current = c }} onDragOver={(e) => e.preventDefault()}
                  onDrop={() => soltar(c)} title="Arrastrá para mover la columna · clic para ordenar"
                  onClick={() => setSort(sort?.col === c ? (sort.dir === 'asc' ? { col: c, dir: 'desc' } : null) : { col: c, dir: 'asc' })}>
                  <span className="agarre">⋮⋮</span> {c.replace(/_/g, ' ')}
                  {sort?.col === c && <span> {sort.dir === 'asc' ? '▲' : '▼'}</span>}
                  {esNum[c] && (
                    <button className={`th-filtro ${filtroActivo(filtros[c]) ? 'activo' : ''}`}
                      title={filtroActivo(filtros[c]) ? `Filtro: ${resumenFiltro(filtros[c])}` : 'Filtrar esta columna'}
                      onClick={(e) => {
                        e.stopPropagation()
                        const r = e.currentTarget.getBoundingClientRect()
                        setAbierto({ col: c, pos: { x: Math.min(r.left, window.innerWidth - 250), y: r.bottom + 6 } })
                      }}>
                      ▾{filtroActivo(filtros[c]) ? ' ' + resumenFiltro(filtros[c]) : ''}
                    </button>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {vista.map((f, i) => <tr key={i}>{orden.map((c) => <td key={c}>{f[c]}</td>)}</tr>)}
            {!vista.length && <tr><td colSpan={orden.length} className="ayuda">Ninguna fila cumple los filtros.</td></tr>}
          </tbody>
        </table>
      </div>
      {abierto && (
        <PopoverFiltro col={abierto.col} pos={abierto.pos} valor={filtros[abierto.col]}
          onChange={(v) => setFiltros((p) => ({ ...p, [abierto.col]: v }))} onClose={() => setAbierto(null)} />
      )}
    </section>
  )
}

// ===============================================================
// DATOS
// ===============================================================
export function DatosTab({ s }) {
  const a = s.analisis
  const vistas = useRef({})
  const onVista = (id, v) => { vistas.current[id] = v }
  if (!a?.resumen) return <Vacio texto="Todavía no hay datos para mostrar." />
  const r = (x, d = 4) => (Number.isFinite(x) ? Number(x.toFixed(d)) : null)
  const muestras = a.resumen.map((m) => ({
    Muestra: m.Muestra, Pocillos: m.N_total, Aceptadas: m.N_aceptadas, Excluidas: m.N_excluidas,
    Media_OD: r(m.Media), DE: r(m.SD), SEM: r(m.SEM), IC95_mas_menos: r(m.IC95), CV_pct: r(m.CV_pct, 2),
    OD_sobre_ODc: r(m.Razon_ODc, 2), Clasificacion: m.Clasificacion || '',
  }))
  const pocillos = a.estado.map((e) => ({
    Pocillo: e.Pocillo, Muestra: e.Muestra, Replica: e.Replica, Blanco: e.EsBlanco ? 'Sí' : 'No', OD: r(e.OD),
    Estado: e.Usado ? 'Aceptado' : 'Excluido', Sospechoso: e.Sospechoso ? 'Sí' : 'No',
    Motivo: e.Manual ? 'Excluido manualmente' : e.Motivo || '',
  }))
  const cm = Object.keys(muestras[0] || {})
  const cp = Object.keys(pocillos[0] || {})
  const ambas = () => {
    const hojas = ['muestras', 'pocillos'].map((k) => vistas.current[k]).filter(Boolean)
    excelDe(hojas).then((b) => descargarBlob(b, 'resultados_biofilm.xlsx'))
  }
  return (
    <div className="pagina">
      <div className="titulo-fila">
        <p className="ayuda" style={{ margin: 0 }}>Cada columna numérica tiene un botón <code>▾</code> para filtrar (mayor, menor, igual o entre). Clic en un encabezado para ordenar; arrastralo para mover la columna.</p>
        <button className="primario" onClick={ambas}>Descargar ambas tablas (Excel)</button>
      </div>
      <TablaAvanzada id="muestras" titulo="Muestras" columnas={cm} filas={muestras} onVista={onVista} />
      <TablaAvanzada id="pocillos" titulo="Pocillos" columnas={cp} filas={pocillos} onVista={onVista} />
      <MetodoDetalle d={s.deteccion} odc={a.odc} />
    </div>
  )
}

// ===============================================================
// MÉTODO (descripción de los cálculos)
// ===============================================================
function MetodoDetalle({ d, odc }) {
  const nsig = Number(d.nsig) || 3
  const mind = Number(d.min) || 0.02
  const activo = nombreMetodo[d.metodo]
  return (
    <section className="tarjeta metodo">
      <h2>Método</h2>
      <p className="ayuda">Detección activa: <b>{activo}</b>{d.metodo === 'hampel' ? ` (n = ${nsig}, diferencia mínima = ${mind} OD)` : ` (confianza ${d.conf} %)`}
        {d.usar ? ', con exclusión automática.' : ', solo marca los sospechosos.'}</p>

      <h3>1. Punto de corte y clasificación</h3>
      <p>El punto de corte se calcula con los pocillos de blanco aceptados: <b>ODc = media(blancos) + 3 × DE(blancos)</b>, donde DE es la desviación estándar muestral (n − 1) de los pocillos blanco individuales. Valor actual: {Number.isFinite(odc?.odc) ? fmt(odc.odc, 4) : 'sin calcular'} (n = {odc?.n ?? 0}). Según Stepanović et al. (2000), cada muestra se clasifica con la media de sus réplicas aceptadas:</p>
      <ul>
        <li>No productor: OD ≤ ODc</li>
        <li>Productor débil: ODc &lt; OD ≤ 2 × ODc</li>
        <li>Productor moderado: 2 × ODc &lt; OD ≤ 4 × ODc</li>
        <li>Productor fuerte: OD &gt; 4 × ODc</li>
      </ul>
      <h3>2. Media y errores del gráfico (SD, SEM, IC 95 %)</h3>
      <p>Para cada muestra solo se usan las <b>n réplicas aceptadas</b>; los pocillos excluidos no entran en ningún cálculo. Con n &lt; 2 no se puede calcular ningún error. Sea <code>xᵢ</code> la OD de cada réplica:</p>
      <ul>
        <li><b>Media</b>: <code>x̄ = Σxᵢ / n</code>. Es la altura de la barra y el número que se muestra sobre ella.</li>
        <li><b>Desviación estándar (SD)</b>: <code>s = √( Σ(xᵢ − x̄)² / (n − 1) )</code>. Es la desviación muestral (se divide por n − 1) y describe cuánto se dispersan las réplicas.</li>
        <li><b>Error estándar de la media (SEM)</b>: <code>SEM = s / √n</code>. Describe la incertidumbre de la media: baja al aumentar n, aunque la dispersión de las réplicas no cambie.</li>
        <li><b>Intervalo de confianza del 95 % (IC 95 %)</b>: <code>IC = x̄ ± t(0,975; n − 1) × SEM</code>, donde <code>t(0,975; n − 1)</code> es el cuantil 97,5 % de la distribución t de Student con n − 1 grados de libertad (equivale a <code>qt(0.975, n − 1)</code> de R). La barra de error dibujada es <code>± t × SEM</code>.</li>
        <li><b>Coeficiente de variación (CV)</b>: <code>CV = 100 × s / x̄</code> (en %).</li>
      </ul>
      <p>El tipo de error que elegís en el panel (IC 95 %, SD o SEM) es el que se dibuja como barra de error y el que aparece después del símbolo ± junto a la media. Con pocas réplicas t es grande, por eso el IC 95 % resulta mucho más ancho que el SEM:</p>
      <div className="tabla-scroll chica"><table className="tabla"><thead><tr><th>n (réplicas)</th>{[2, 3, 4, 5, 6, 8, 11, 21, 31].map((n) => <th key={n}>{n}</th>)}</tr></thead>
        <tbody>
          <tr><td>g.l. = n − 1</td>{[2, 3, 4, 5, 6, 8, 11, 21, 31].map((n) => <td key={n}>{n - 1}</td>)}</tr>
          <tr><td><b>t(0,975; n − 1)</b></td>{[2, 3, 4, 5, 6, 8, 11, 21, 31].map((n) => <td key={n}>{tCuantil(0.975, n - 1).toFixed(3)}</td>)}</tr>
          <tr><td>IC 95 % en múltiplos de SEM</td>{[2, 3, 4, 5, 6, 8, 11, 21, 31].map((n) => <td key={n}>{tCuantil(0.975, n - 1).toFixed(2)} × SEM</td>)}</tr>
        </tbody></table></div>
      <p className="ayuda">Ejemplo: con 3 réplicas, IC 95 % = 4,303 × SEM = 4,303 × s / √3 ≈ 2,484 × s. Con 30 réplicas el factor baja a 2,045 × SEM.</p>

      <h3>3. Filtro de Hampel (mediana y MAD)</h3>
      <p>Se aplica por muestra, sobre sus pocillos no excluidos a mano, y necesita al menos 3 pocillos.</p>
      <ol>
        <li>Mediana del grupo: <code>med = mediana(x₁ … xₙ)</code>.</li>
        <li><b>MAD</b> (desviación absoluta mediana): <code>MAD = mediana(|xᵢ − med|)</code>. Es una medida de dispersión robusta: un valor extremo casi no la modifica.</li>
        <li>Escala robusta: <code>s = 1,4826 × MAD</code>. El factor 1,4826 = 1 / Φ⁻¹(0,75) hace que s estime la desviación estándar si los datos son normales.</li>
        <li>Límite: <code>L = máx( n × s ; diferencia mínima )</code>. La diferencia mínima evita marcar desvíos minúsculos cuando las réplicas son casi idénticas (MAD ≈ 0).</li>
        <li>Un pocillo es <b>sospechoso</b> si <code>|xᵢ − med| &gt; L</code>. Puede haber más de uno por muestra.</li>
      </ol>
      <p>Parámetros actuales: n = {nsig}, diferencia mínima = {mind} OD. La banda gris del gráfico es <code>med ± L</code>.</p>

      <h3>4. Test Q de Dixon</h3>
      <p>Prueba si <b>un</b> valor extremo es atípico en una muestra de n = 3 a 10 pocillos. Se ordenan los valores <code>x₍₁₎ ≤ … ≤ x₍ₙ₎</code> y se calcula la razón de huecos (r10):</p>
      <ul>
        <li>extremo inferior: <code>Q = (x₍₂₎ − x₍₁₎) / (x₍ₙ₎ − x₍₁₎)</code></li>
        <li>extremo superior: <code>Q = (x₍ₙ₎ − x₍ₙ₋₁₎) / (x₍ₙ₎ − x₍₁₎)</code></li>
      </ul>
      <p>Se toma el mayor de los dos Q (el extremo más aislado) y se compara con el valor crítico <code>Q crít (n, confianza)</code> de la tabla. Si <code>Q &gt; Q crít</code>, ese valor se declara atípico. Se evalúa una sola vez por muestra (como máximo un atípico). Es una prueba bilateral que supone distribución normal; con pocas réplicas tiene poca potencia.</p>
      <div className="tabla-scroll chica"><table className="tabla"><thead><tr><th>n</th>{Q_TABLA.n.map((n) => <th key={n}>{n}</th>)}</tr></thead>
        <tbody>{['90', '95', '99'].map((c) => <tr key={c}><td><b>{c} %</b></td>{Q_TABLA[c].map((v, i) => <td key={i}>{v.toFixed(3)}</td>)}</tr>)}</tbody></table></div>
      <p className="ayuda">Valores críticos de Q (bilateral) según Rorabacher (1991).</p>

      <h3>5. Test de Dixon general</h3>
      <p>Es la familia completa de razones de Dixon (1951): para que la prueba conserve potencia cuando n crece, se usa una razón que ignora el valor adyacente al extremo. La razón depende de n:</p>
      <ul>
        <li><b>r10</b> (n = 3 a 7): <code>(x₍₂₎ − x₍₁₎) / (x₍ₙ₎ − x₍₁₎)</code> — equivale al test Q</li>
        <li><b>r11</b> (n = 8 a 10): <code>(x₍₂₎ − x₍₁₎) / (x₍ₙ₋₁₎ − x₍₁₎)</code></li>
        <li><b>r21</b> (n = 11 a 13): <code>(x₍₃₎ − x₍₁₎) / (x₍ₙ₋₁₎ − x₍₁₎)</code></li>
        <li><b>r22</b> (n = 14 a 30): <code>(x₍₃₎ − x₍₁₎) / (x₍ₙ₋₂₎ − x₍₁₎)</code></li>
      </ul>
      <p>Para el extremo superior se aplica la misma fórmula sobre los datos reflejados. Se toma la mayor de las dos razones y se compara con su valor crítico. <b>Los valores críticos de esta tabla se obtuvieron por simulación de Monte Carlo</b> (400 000 muestras normales por cada n, semilla fija; razón máxima de los dos extremos, percentil 90, 95 y 99 %). Para validar el procedimiento, la misma simulación con la razón r10 reproduce la tabla de Q de arriba para n = 3 a 10 con una diferencia máxima de 0,005. Con n = 8 a 10 los valores de Dixon difieren de los de Q porque usan r11 en lugar de r10.</p>
      <div className="tabla-scroll chica"><table className="tabla"><thead><tr><th>n</th><th>Razón</th><th>90 %</th><th>95 %</th><th>99 %</th></tr></thead>
        <tbody>{DIXON_TABLA.map((f) => <tr key={f[0]}><td>{f[0]}</td><td>{f[1]}</td><td>{f[2].toFixed(3)}</td><td>{f[3].toFixed(3)}</td><td>{f[4].toFixed(3)}</td></tr>)}</tbody></table></div>

      <h3>6. Qué pasa con los sospechosos</h3>
      <p>Sea cual sea el método, un pocillo sospechoso solo se <b>excluye automáticamente</b> si activás esa opción. Siempre podés forzar el estado de cada pocillo con un clic en el gráfico o en el mapa de la placa: lo que se decide a mano tiene prioridad sobre el test. Un pocillo excluido a mano no entra en el cálculo de los tests ni en las medias, y si era un blanco deja de contarse en el ODc.</p>
      <p className="ayuda">Un test estadístico no distingue un error experimental de una variación biológica real: revisá cada sospechoso antes de excluirlo y no elimines datos solo porque no te gusta el resultado.</p>

      <h3>7. Comparación entre placas</h3>
      <p>En la pestaña Comparar, cada placa aporta <b>un solo valor por muestra</b>: la media de sus réplicas aceptadas en esa placa. Los pocillos de una misma placa son <b>réplicas técnicas</b>; las placas (hechas en días o experimentos distintos) son las <b>réplicas biológicas</b>. Por eso el <b>n de la comparación es el número de placas</b>, no el de pocillos. Tratar los pocillos como réplicas independientes inflaría el n y daría diferencias «significativas» que no lo son (pseudorreplicación).</p>
      <p><b>Valor que se compara</b> (se elige en el panel):</p>
      <ul>
        <li><b>OD ÷ ODc de su placa</b> (recomendado): <code>R = Media_muestra / ODc_placa</code>. Cada placa tiene su propio blanco y su propio ODc, así que dividir por él quita la variación entre placas (lector, medio, día). Un valor 1 es el punto de corte; la clasificación de Stepanović se vuelve R ≤ 1, 1–2, 2–4 y &gt; 4.</li>
        <li><b>OD media</b>: la OD sin normalizar. Solo es comparable si las placas son muy parecidas; no permite clasificar porque cada placa tiene un ODc distinto.</li>
        <li><b>% del control</b>: <code>100 × Media_muestra / Media_control</code>, con el control de la <i>misma placa</i>.</li>
      </ul>
      <p><b>Resumen por muestra</b> con las n placas: media, DE, SEM e IC 95 % con las fórmulas de la sección 2, con n = número de placas y t(0,975; n − 1). Con una sola placa no hay error.</p>
      <p><b>Pruebas estadísticas</b> (opcionales):</p>
      <ul>
        <li><b>Prueba t de Welch contra el control</b> (bilateral, no supone varianzas iguales): <code>t = (x̄₁ − x̄₂) / √(s₁²/n₁ + s₂²/n₂)</code>, con grados de libertad de Welch–Satterthwaite <code>gl = (s₁²/n₁ + s₂²/n₂)² / [ (s₁²/n₁)²/(n₁−1) + (s₂²/n₂)²/(n₂−1) ]</code>. Equivale a <code>t.test(x, y)</code> de R. Necesita al menos 2 placas por muestra.</li>
        <li><b>Ajuste de Holm</b> para comparar varias muestras contra el control: se ordenan los p de menor a mayor y <code>p_aj(k) = máx de los ( (m − j + 1) × p(j) ) para j ≤ k</code>, limitado a 1. Equivale a <code>p.adjust(p, "holm")</code>.</li>
        <li><b>ANOVA de una vía</b> (p global entre todas las muestras comparadas): <code>F = [SCentre / (k − 1)] / [SCdentro / (N − k)]</code>. Equivale a <code>summary(aov(y ~ muestra))</code>.</li>
      </ul>
      <p>Se verificó que estas funciones dan los mismos valores que R. Con 2 o 3 placas por muestra las pruebas tienen muy poca potencia: mirá los puntos individuales además del valor de p.</p>
      <p><b>Consistencia entre placas</b>: para cada muestra se muestra la clasificación que le tocó en cada placa; es <i>consistente</i> si es la misma en todas.</p>
    </section>
  )
}
