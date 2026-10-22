import { useEffect, useMemo, useRef, useState } from 'react'
import { BarChart, ExcluirChart } from './charts.jsx'
import { Check, EstiloDialog, MenuContextual, Num, RangoDialog, Select, Vacio, tamDe, useMenuContextual } from './ui.jsx'
import { BotonCinta, Cajon, CampoCinta, Cinta, Grupo, InterruptorCinta, OpcionesCinta } from './cinta.jsx'
import { Icono } from './iconos.jsx'
import { ExportDialog } from './exportar.jsx'
import { dCV, dClase, dDE, dIC, dMedia, dRazon, dSEM } from '../calculos.js'
import { Nota } from './tip.jsx'
import { PasoAPaso } from './pasos.jsx'
import { MetodoEstadistico } from './metodoest.jsx'
import { abrirInforme } from './informe.jsx'
import { descargarExcelCompleto } from './resumen.jsx'
import { resumenBlancos } from '../blancos.js'
import { excelDe } from '../api.js'
import { Q_TABLA } from '../criticos.js'
import { criticoGrubbs, normalizarMetodo } from '../motor.js'
import { descargarBlob, estiloDefecto, fmt, tCuantil } from '../utils.js'

const nombreMetodo = { q: 'Test Q de Dixon', grubbs: 'Test de Grubbs', cv: 'Coeficiente de variación (%RSD)' }
const ERRORES = [['ic95', 'IC 95 %'], ['sd', 'DE'], ['sem', 'SEM']]
const NOMBRE_ERROR = { ic95: 'IC 95 %', sd: 'desviación estándar', sem: 'error estándar (SEM)', ninguno: 'sin barras de error' }

// Grupo «Imagen» de la cinta: guardar la figura, estilo de los textos y rango del eje (también con clic derecho)
const GrupoImagen = ({ onGuardar, onEstilo, onRango }) => (
  <Grupo titulo="Imagen">
    <BotonCinta icono="imagen" texto="Guardar imagen" onClick={onGuardar} tip="PNG o SVG con el tamaño y la resolución que elijas" />
    <BotonCinta simbolo="Aa" texto="Textos" onClick={onEstilo} tip="Título, leyendas, etiquetas y números (también con clic derecho sobre el gráfico)" />
    <BotonCinta icono="ordenar" texto="Eje Y" onClick={onRango} tip="Mínimo y máximo del eje Y (también con clic derecho)" />
  </Grupo>
)

// ===============================================================
// CALIDAD: valores atípicos y exclusión de pocillos
// ===============================================================
export function ExcluirTab({ s }) {
  const svg = useRef()
  const [menu, abrirMenu, cerrarMenu] = useMenuContextual()
  const [dlg, setDlg] = useState(false)
  const [rng, setRng] = useState(false)
  const [exp, setExp] = useState(false)
  const o = s.opts.excluir
  const setO = (k, v) => s.setOpts((x) => ({ ...x, excluir: { ...x.excluir, [k]: v } }))
  const d = { ...s.deteccion, metodo: normalizarMetodo(s.deteccion.metodo) }
  const setD = (k, v) => s.setDeteccion({ ...d, [k]: v })

  if (!s.placa) return <Vacio titulo="Esta placa no tiene datos" texto="Cargá el Excel o escribí las OD en «Placas»." accion={<button className="primario" onClick={() => s.irA('placas')}>Ir a Placas</button>} />
  if (!s.analisis?.estado?.length) return <Vacio titulo="Faltan los pocillos" texto="Indicá qué muestra hay en cada pocillo para revisar las réplicas." accion={<button className="primario" onClick={() => s.irA('pocillos')}>Ir a Pocillos</button>} />
  const estado = s.analisis.estado
  const excluidos = estado.filter((e) => !e.Usado)
  const sospechosos = estado.filter((e) => e.Sospechoso && e.Usado)

  return (
    <div>
      <Cinta>
        <Grupo titulo="Valores atípicos">
          <OpcionesCinta valor={d.metodo} onChange={(v) => setD('metodo', v)} opciones={[
            ['q', 'Dixon', 'Q', null, 'Test Q de Dixon (n de 3 a 10)\nQ = hueco del extremo / rango'],
            ['grubbs', 'Grubbs', 'G', null, 'Test de Grubbs (n ≥ 3)\nG = máx |x − x̄| / s\nCon 3 réplicas casi nunca declara un atípico'],
            ['cv', 'CV', '%', null, 'Coeficiente de variación (%RSD)\nSi el CV supera el límite, marca el pocillo más alejado de la media'],
          ]} />
          {d.metodo === 'cv'
            ? <CampoCinta etiqueta="CV máximo (%)" tip="Límite de CV entre réplicas; para cristal violeta se suele aceptar hasta 15–20 %"><Num value={d.cvMax ?? 20} min={1} max={200} ancho={64} onChange={(v) => setD('cvMax', v === '' ? 20 : v)} /></CampoCinta>
            : <CampoCinta etiqueta="Confianza"><Select value={d.conf} onChange={(v) => setD('conf', v)} opciones={[['90', '90 %'], ['95', '95 %'], ['99', '99 %']]} /></CampoCinta>}
          <InterruptorCinta icono="escudo" texto="Excluir solos" valor={d.usar} onChange={(v) => setD('usar', v)} tip="Excluir automáticamente los pocillos que el test marca como sospechosos (en todas las placas)" />
          <BotonCinta icono="refrescar" texto="Restablecer" onClick={s.restablecerExclusiones} tip="Vuelve a incluir los pocillos excluidos a mano en esta placa" />
        </Grupo>
        <Grupo titulo="Mostrar">
          <InterruptorCinta icono="puntos" texto="Puntos" valor={o.puntos} onChange={(v) => setO('puntos', v)} />
          <InterruptorCinta simbolo="x̄" texto="Media" valor={o.medias} onChange={(v) => setO('medias', v)} tip="Valor medio escrito sobre cada muestra" />
          <InterruptorCinta simbolo="±" texto="Error" valor={o.errores} onChange={(v) => setO('errores', v)} tip="Agrega el error junto al valor medio" />
          <CampoCinta etiqueta="Error"><Select value={o.error} onChange={(v) => setO('error', v)} opciones={ERRORES} /></CampoCinta>
          <CampoCinta etiqueta="Rotación (°)"><Num value={o.rotar} min={0} max={90} ancho={56} onChange={(v) => setO('rotar', v === '' ? 0 : v)} /></CampoCinta>
        </Grupo>
        <GrupoImagen onGuardar={() => setExp(true)} onEstilo={() => setDlg(true)} onRango={() => setRng(true)} />
      </Cinta>

      <section className="tarjeta">
        <div className="cabeza-tarjeta">
          <span className="etiqueta-seccion">Réplicas de cada muestra · {nombreMetodo[d.metodo]}{d.metodo === 'cv' ? ` (máx. ${d.cvMax ?? 20} %)` : ` (${d.conf} %)`}{d.usar ? ' · exclusión automática' : ''}</span>
          <span className="ayuda">Clic sobre un punto para excluirlo o incluirlo <Nota>Azul: aceptado. Cruz roja: excluido. Anillo naranja: sospechoso según el test. Lo que decidís a mano tiene prioridad sobre el test. El desarrollo del cálculo está en «Métodos».</Nota></span>
        </div>
        <div className="figura">
          <ExcluirChart ref={svg} estado={estado} orden={s.ordenMuestras} o={o} est={s.estilos.excluir} eje={s.ejeOD} onClickPunto={s.alternarPocillo} onContext={abrirMenu} />
        </div>
        <div className="fila" style={{ marginTop: 10 }}>
          {sospechosos.length > 0 && <span className="chip aviso" data-tip={`Sospechosos dentro del análisis\n${sospechosos.map((e) => `${e.Pocillo} (${e.Muestra} R${e.Replica}): ${e.Motivo || ''}`).join('\n')}`}>{sospechosos.length} sospechoso{sospechosos.length > 1 ? 's' : ''} sin excluir</span>}
          {excluidos.length ? <span className="ayuda"><b>Excluidos:</b> {excluidos.map((e) => <span key={e.Pocillo} className="chip peligro chip-boton" style={{ margin: '0 4px 4px 0' }} data-tip={`${e.Pocillo} · ${e.Muestra} R${e.Replica}\nOD = ${fmt(e.OD, 4)}\n${e.Manual ? 'Excluido a mano' : e.Motivo || ''}\nClic para volver a incluirlo`} onClick={() => s.alternarPocillo(e.Pocillo)}>{e.Pocillo} · {e.Muestra}</span>)}</span>
            : <span className="ayuda">No hay pocillos excluidos en esta placa.</span>}
        </div>
      </section>
      <MenuContextual menu={menu} items={[
        ['Estilo de texto…', () => { cerrarMenu(); setDlg(true) }],
        ['Rango del eje Y…', () => { cerrarMenu(); setRng(true) }],
        ['Guardar imagen…', () => { cerrarMenu(); setExp(true) }],
        ['Restablecer estilo de texto', () => { cerrarMenu(); s.setEstilos((e) => ({ ...e, excluir: estiloDefecto() })) }],
      ]} />
      {rng && <RangoDialog est={s.estilos.excluir} onClose={() => setRng(false)} onGuardar={(e) => { s.setEstilos((x) => ({ ...x, excluir: e })); setRng(false) }} />}
      {dlg && <EstiloDialog estilo={s.estilos.excluir} conClases={false} ejeDefecto={s.ejeOD} onClose={() => setDlg(false)}
        onGuardar={(e) => { s.setEstilos((x) => ({ ...x, excluir: e })); setDlg(false) }} />}
      {exp && svg.current && (
        <ExportDialog nombre={`calidad_${s.a.nombre}`} size0={tamDe(svg.current)} onClose={() => setExp(false)}
          render={(ref, tam) => <ExcluirChart ref={ref} estado={estado} orden={s.ordenMuestras} o={o} est={s.estilos.excluir}
            eje={s.ejeOD} onClickPunto={() => {}} onContext={(e) => e.preventDefault()} tam={tam} />} />
      )}
    </div>
  )
}

// ===============================================================
// GRÁFICO DE BARRAS DE LA PLACA ACTIVA (con la clasificación)
// ===============================================================
export function GraficoTab({ s, grupoVista }) {
  const svg = useRef()
  const [menu, abrirMenu, cerrarMenu] = useMenuContextual()
  const [dlg, setDlg] = useState(false)
  const [rng, setRng] = useState(false)
  const [exp, setExp] = useState(false)
  const [cajon, setCajon] = useState(false)
  const o = s.opts.barras
  const setO = (k, v) => s.setOpts((x) => ({ ...x, barras: { ...x.barras, [k]: v } }))
  const a = s.analisis
  if (!s.placa || !a?.resumen?.length) return <><Cinta>{grupoVista}</Cinta><Vacio titulo="Todavía no hay barras" texto={s.placa ? 'Indicá qué muestra hay en cada pocillo.' : 'Esta placa no tiene datos.'} accion={<button className="primario" onClick={() => s.irA(s.placa ? 'pocillos' : 'placas')}>Ir a {s.placa ? 'Pocillos' : 'Placas'}</button>} /></>

  const verBlancos = o.blancos !== false
  const blancosRes = verBlancos ? resumenBlancos(a.estado) : []
  const todas = [...a.resumen.map((r) => r.Muestra), ...blancosRes.map((r) => r.Muestra)]
  const selMuestras = o.muestrasSel ? o.muestrasSel.filter((m) => todas.includes(m)) : todas
  let filas = [...a.resumen, ...blancosRes].filter((r) => selMuestras.includes(r.Muestra) && Number.isFinite(r.Media))
  if (o.orden === 'asc') filas = [...filas].sort((x, y) => x.Media - y.Media)
  if (o.orden === 'desc') filas = [...filas].sort((x, y) => y.Media - x.Media)
  const puntos = a.estado.filter((e) => e.Usado && filas.some((f) => f.Muestra === e.Muestra))
  const sinOdc = !Number.isFinite(a.odc.odc)

  return (
    <div>
      <Cinta>
        {grupoVista}
        <Grupo titulo="Datos">
          <BotonCinta icono="filtro" texto={`Muestras ${selMuestras.length}/${todas.length}`} activo={cajon} onClick={() => setCajon(!cajon)} tip="Elegir qué muestras se dibujan" />
          <InterruptorCinta icono="matraz" texto="Blancos" valor={verBlancos} onChange={(v) => setO('blancos', v)} tip="Mostrar también los blancos (medio sin inocular)" />
          <CampoCinta etiqueta="Orden"><Select value={o.orden} onChange={(v) => setO('orden', v)} opciones={[['lista', 'Como en la lista'], ['asc', 'OD creciente'], ['desc', 'OD decreciente']]} /></CampoCinta>
        </Grupo>
        <Grupo titulo="Mostrar">
          <InterruptorCinta icono="puntos" texto="Réplicas" valor={o.puntos} onChange={(v) => setO('puntos', v)} tip="Un punto por pocillo aceptado" />
          <InterruptorCinta simbolo="x̄" texto="Media" valor={o.medias} onChange={(v) => setO('medias', v)} tip="Valor medio escrito sobre cada barra" />
          <InterruptorCinta simbolo="±" texto="Error" valor={o.errores} onChange={(v) => setO('errores', v)} deshabilitado={!o.medias} tip="Agrega el error junto al valor medio" />
          <InterruptorCinta icono="umbral" texto="Clases" valor={o.lineas} onChange={(v) => setO('lineas', v)} deshabilitado={sinOdc} tip="Líneas de ODc, 2 × ODc y 4 × ODc con el nombre de cada clase" />
          <InterruptorCinta simbolo="0,3" texto="Umbrales" valor={o.valoresClase} onChange={(v) => setO('valoresClase', v)} deshabilitado={sinOdc || !o.lineas} tip="Escribe el valor numérico bajo el nombre de cada clase" />
        </Grupo>
        <Grupo titulo="Barras">
          <CampoCinta etiqueta="Error"><Select value={o.error} onChange={(v) => setO('error', v)} opciones={[...ERRORES, ['ninguno', 'Ninguno']]} /></CampoCinta>
          <CampoCinta etiqueta="Color"><Select value={o.color} onChange={(v) => setO('color', v)} opciones={[['clase', 'Según la clase'], ['uno', 'Un solo color']]} /></CampoCinta>
          <CampoCinta etiqueta="Rotación (°)"><Num value={o.rotar} min={0} max={90} ancho={56} onChange={(v) => setO('rotar', v === '' ? 0 : v)} /></CampoCinta>
        </Grupo>
        <GrupoImagen onGuardar={() => setExp(true)} onEstilo={() => setDlg(true)} onRango={() => setRng(true)} />
      </Cinta>
      <Cajon titulo="Muestras que se dibujan" abierto={cajon} onClose={() => setCajon(false)}>
        <div className="fila" style={{ marginBottom: 8 }}>
          <button className="chico" onClick={() => setO('muestrasSel', null)}>Todas</button>
          <button className="chico" onClick={() => setO('muestrasSel', [])}>Ninguna</button>
        </div>
        <div className="lista-check columnas">
          {todas.map((m) => <Check key={m} label={m} checked={selMuestras.includes(m)} onChange={(v) => setO('muestrasSel', v ? [...selMuestras, m] : selMuestras.filter((x) => x !== m))} />)}
        </div>
      </Cajon>

      {sinOdc && <p className="aviso-caja">Sin ODc (faltan blancos aceptados): las barras no se pueden clasificar.</p>}
      <section className="tarjeta">
        <div className="cabeza-tarjeta">
          <span className="etiqueta-seccion">OD media de las réplicas aceptadas · {NOMBRE_ERROR[o.error]}</span>
          <span className="ayuda">Pasá el mouse por una barra para ver el cálculo<Nota>Clic derecho sobre el gráfico: estilo de los textos, rango del eje Y y guardar la imagen.</Nota></span>
        </div>
        {filas.length ? (
          <div className="figura"><BarChart ref={svg} filas={filas} puntos={puntos} odc={a.odc.odc} o={o} est={s.estilos.barras} eje={s.ejeOD} onContext={abrirMenu} /></div>
        ) : <Vacio texto="Elegí al menos una muestra con réplicas aceptadas." />}
      </section>
      <MenuContextual menu={menu} items={[
        ['Estilo de texto…', () => { cerrarMenu(); setDlg(true) }],
        ['Rango del eje Y…', () => { cerrarMenu(); setRng(true) }],
        ['Guardar imagen…', () => { cerrarMenu(); setExp(true) }],
        ['Restablecer estilo de texto', () => { cerrarMenu(); s.setEstilos((e) => ({ ...e, barras: estiloDefecto() })) }],
      ]} />
      {rng && <RangoDialog est={s.estilos.barras} onClose={() => setRng(false)} onGuardar={(e) => { s.setEstilos((x) => ({ ...x, barras: e })); setRng(false) }} />}
      {dlg && <EstiloDialog estilo={s.estilos.barras} conClases ejeDefecto={s.ejeOD} onClose={() => setDlg(false)}
        onGuardar={(e) => { s.setEstilos((x) => ({ ...x, barras: e })); setDlg(false) }} />}
      {exp && svg.current && (
        <ExportDialog nombre={`barras_${s.a.nombre}`} size0={tamDe(svg.current)} onClose={() => setExp(false)}
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

export function TablaAvanzada({ id, titulo, columnas, filas, onVista, tips }) {
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
      <div className="cabeza-tarjeta">
        <span className="etiqueta-seccion">{titulo} · {vista.length} de {filas.length} filas</span>
        <span className="ayuda">Pasá el mouse por un número para ver cómo se calculó<Nota>Clic en un encabezado para ordenar; arrastralo para mover la columna. Las columnas numéricas tienen un botón ▾ para filtrar.</Nota></span>
        <span className="espacio" />
        {hayFiltro && <button className="chico" onClick={() => setFiltros({})}>Quitar filtros</button>}
        <button className="chico fantasma" onClick={() => { setOrden(columnas); setSort(null) }}>Orden original</button>
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
            {vista.map((f, i) => <tr key={i}>{orden.map((c) => { const t = tips ? tips(f, c) : null; return <td key={c} data-tip={t || undefined} className={[typeof f[c] === 'number' ? 'num' : '', t ? 'con-calculo' : ''].join(' ').trim() || undefined}>{f[c]}</td> })}</tr>)}
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
// DATOS: tablas de la placa activa
// ===============================================================
export function DatosTab({ s }) {
  const a = s.analisis
  const vistas = useRef({})
  const onVista = (id, v) => { vistas.current[id] = v }
  const informe = () => { if (abrirInforme(s)) s.avisar('En el cuadro de impresión elegí «Guardar como PDF» como destino.') }
  const cinta = (
    <Cinta>
      <Grupo titulo="Exportar">
        <BotonCinta icono="tabla" texto="Excel de la placa" deshabilitado={!a?.resumen} onClick={() => excelDe(['muestras', 'pocillos'].map((k) => vistas.current[k]).filter(Boolean)).then((b) => descargarBlob(b, `resultados_${s.a?.nombre || 'placa'}.xlsx`))}
          tip="Las dos tablas de esta placa, como se ven (con filtros y orden)" />
        <BotonCinta icono="placas" texto="Excel completo" onClick={() => descargarExcelCompleto(s).catch((e) => s.avisar(e.message, 'error'))} tip="Todas las placas: placas, muestras, medias por placa, pocillos y lecturas, con los datos del experimento" />
        <BotonCinta icono="imprimir" texto="Informe PDF" onClick={informe} tip="Gráficos y tablas de todas las placas, listos para imprimir o guardar como PDF" />
      </Grupo>
    </Cinta>
  )
  if (!a?.resumen) return <>{cinta}<Vacio titulo="Todavía no hay datos para esta placa" texto="Cargá los datos e indicá qué muestra hay en cada pocillo." /></>
  const r = (x, d = 4) => (Number.isFinite(x) ? Number(x.toFixed(d)) : null)
  const muestras = a.resumen.map((m) => ({
    Muestra: m.Muestra, Pocillos: m.N_total, Aceptadas: m.N_aceptadas, Excluidas: m.N_excluidas,
    Media_OD: r(m.Media), DE: r(m.SD), SEM: r(m.SEM), IC95_mas_menos: r(m.IC95), CV_pct: r(m.CV_pct, 2),
    OD_sobre_ODc: r(m.Razon_ODc, 2), Clasificacion: m.Clasificacion || '',
    _v: a.estado.filter((e) => e.Muestra === m.Muestra && e.Usado).map((e) => e.OD),
  }))
  const pocillos = a.estado.map((e) => ({
    Pocillo: e.Pocillo, Muestra: e.Muestra, Replica: e.Replica, Blanco: e.EsBlanco ? 'Sí' : 'No', OD: r(e.OD),
    Estado: e.Usado ? 'Aceptado' : 'Excluido', Sospechoso: e.Sospechoso ? 'Sí' : 'No',
    Motivo: e.Manual ? 'Excluido manualmente' : e.Motivo || '',
  }))
  const odcNum = a.odc?.odc
  const tipsMuestras = (f, c) => {
    const v = f._v
    if (!v || !v.length) return null
    if (c === 'Media_OD') return dMedia(v)
    if (c === 'DE') return dDE(v)
    if (c === 'SEM') return dSEM(v)
    if (c === 'IC95_mas_menos') return dIC(v)
    if (c === 'CV_pct') return dCV(v)
    if (c === 'OD_sobre_ODc' && Number.isFinite(odcNum)) return dRazon(f.Media_OD, odcNum)
    if (c === 'Clasificacion' && Number.isFinite(odcNum) && f.Clasificacion) return dClase(f.Media_OD, odcNum, f.Clasificacion)
    if (c === 'Aceptadas') return `Réplicas aceptadas\n${f.Aceptadas} de ${f.Pocillos} pocillos entran en los cálculos\nExcluidas: ${f.Excluidas} (a mano o por valor atípico)`
    return null
  }
  const tipsPocillos = (f, c) => (c === 'Estado' || c === 'Motivo' || c === 'Sospechoso' ? `Pocillo ${f.Pocillo} (${f.Muestra} R${f.Replica})\nOD = ${f.OD}\nEstado: ${f.Estado}${f.Sospechoso === 'Sí' ? ' · sospechoso (valor atípico)' : ''}\n${f.Motivo || 'Sin observaciones'}` : null)
  const cm = Object.keys(muestras[0] || {}).filter((k) => !k.startsWith('_'))
  const cp = Object.keys(pocillos[0] || {})
  return (
    <div>
      {cinta}
      <TablaAvanzada id="muestras" titulo="Muestras" columnas={cm} filas={muestras} onVista={onVista} tips={tipsMuestras} />
      <TablaAvanzada id="pocillos" titulo="Pocillos" columnas={cp} filas={pocillos} onVista={onVista} tips={tipsPocillos} />
    </div>
  )
}

// ===============================================================
// MÉTODOS: cálculo paso a paso con los datos, lógica de la estadística y descripción de cada método
// ===============================================================
export function MetodosTab({ s }) {
  const a = s.analisis
  const ir = (id) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  return (
    <div className="metodos-pag">
      <Cinta>
        <Grupo titulo="Ir a">
          <BotonCinta icono="tabla" texto="Paso a paso" onClick={() => ir('m-pasos')} deshabilitado={!a?.resumen} tip="ODc, media y errores y valores atípicos con los datos de la placa activa" />
          <BotonCinta icono="sigma" texto="Estadística" onClick={() => ir('m-estadistica')} tip="Cómo se elige cada prueba y su desarrollo con tus datos" />
          <BotonCinta icono="libro" texto="Métodos" onClick={() => ir('m-detalle')} tip="Fórmulas, tablas de valores críticos y referencias" />
        </Grupo>
        <Grupo titulo="Exportar">
          <BotonCinta icono="imprimir" texto="Imprimir" onClick={() => window.print()} tip="Imprime o guarda como PDF esta pantalla" />
        </Grupo>
      </Cinta>
      <div id="m-pasos">{a?.resumen ? <PasoAPaso s={s} /> : <Vacio texto="El cálculo paso a paso aparece cuando la placa activa tiene pocillos configurados." />}</div>
      <div id="m-estadistica"><MetodoEstadistico s={s} /></div>
      <div id="m-detalle"><MetodoDetalle d={s.deteccion} odc={a?.odc} /></div>
    </div>
  )
}

// ===============================================================
// MÉTODO (descripción de los cálculos)
// ===============================================================
function MetodoDetalle({ d, odc }) {
  const metodo = normalizarMetodo(d.metodo)
  const cvMax = Number(d.cvMax) || 20
  const activo = nombreMetodo[metodo]
  return (
    <section className="tarjeta metodo">
      <h2>Método</h2>
      <p className="ayuda">Detección activa: <b>{activo}</b>{metodo === 'cv' ? ` (CV máximo ${cvMax} %)` : ` (confianza ${d.conf} %)`}
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

      <h3>3. Valores atípicos: cuándo se aplica cada criterio</h3>
      <p>Los tres criterios se aplican por muestra, sobre sus pocillos no excluidos a mano, necesitan al menos 3 pocillos y marcan como máximo <b>un</b> pocillo sospechoso por muestra (el más extremo). Con 3 réplicas, quitar un valor deja solo 2: hacelo solo si hay un motivo claro.</p>

      <h3>4. Test Q de Dixon</h3>
      <p>Prueba si <b>un</b> valor extremo es atípico en una muestra de n = 3 a 10 pocillos. Se ordenan los valores <code>x₍₁₎ ≤ … ≤ x₍ₙ₎</code> y se calcula la razón de huecos (r10):</p>
      <ul>
        <li>extremo inferior: <code>Q = (x₍₂₎ − x₍₁₎) / (x₍ₙ₎ − x₍₁₎)</code></li>
        <li>extremo superior: <code>Q = (x₍ₙ₎ − x₍ₙ₋₁₎) / (x₍ₙ₎ − x₍₁₎)</code></li>
      </ul>
      <p>Se toma el mayor de los dos Q (el extremo más aislado) y se compara con el valor crítico <code>Q crít (n, confianza)</code> de la tabla. Si <code>Q &gt; Q crít</code>, ese valor se declara atípico. Es una prueba bilateral que supone distribución normal; con pocas réplicas tiene poca potencia.</p>
      <div className="tabla-scroll chica"><table className="tabla"><thead><tr><th>n</th>{Q_TABLA.n.map((n) => <th key={n}>{n}</th>)}</tr></thead>
        <tbody>{['90', '95', '99'].map((c) => <tr key={c}><td><b>{c} %</b></td>{Q_TABLA[c].map((v, i) => <td key={i}>{v.toFixed(3)}</td>)}</tr>)}</tbody></table></div>
      <p className="ayuda">Valores críticos de Q (bilateral) según Rorabacher (1991).</p>

      <h3>5. Test de Grubbs</h3>
      <p>Compara el valor más alejado de la media con la dispersión del grupo (supone distribución normal; bilateral):</p>
      <ul>
        <li>Estadístico: <code>G = máx |xᵢ − x̄| / s</code>, con <code>s</code> la desviación estándar muestral (n − 1).</li>
        <li>Valor crítico: <code>G crít = ((n − 1) / √n) × √( t² / (n − 2 + t²) )</code>, donde <code>t = t(1 − α / (2n); n − 2)</code> es el cuantil de la t de Student y <code>α = 1 − confianza</code>.</li>
        <li>Si <code>G &gt; G crít</code>, el valor más alejado es atípico.</li>
      </ul>
      <p>Con n = 3, G nunca puede superar <code>(n − 1)/√n = 1,155</code> y el crítico al 95 % es 1,153: el test casi nunca declara un atípico con 3 réplicas. Es más útil con 4 o más pocillos por muestra.</p>
      <div className="tabla-scroll chica"><table className="tabla"><thead><tr><th>n</th>{[3, 4, 5, 6, 7, 8, 9, 10, 12, 15, 20].map((n) => <th key={n}>{n}</th>)}</tr></thead>
        <tbody>{['90', '95', '99'].map((c) => <tr key={c}><td><b>{c} %</b></td>{[3, 4, 5, 6, 7, 8, 9, 10, 12, 15, 20].map((n) => <td key={n}>{criticoGrubbs(n, c).toFixed(3)}</td>)}</tr>)}</tbody></table></div>
      <p className="ayuda">Valores críticos de G calculados con la fórmula de arriba (coinciden con las tablas publicadas de Grubbs, 1969).</p>

      <h3>6. Coeficiente de variación (%RSD)</h3>
      <p>Mide la dispersión de las réplicas en relación con su media: <code>CV = 100 × s / x̄</code> (en %). No es un test estadístico sino un criterio de calidad: si el CV de una muestra supera el límite elegido (actual: {cvMax} %), se marca como sospechoso el pocillo más alejado de la media, que es el que más aporta a la dispersión. En el detalle se informa también el CV que quedaría sin ese pocillo. Para OD de cristal violeta se suele aceptar un CV de hasta 15 a 20 % entre réplicas técnicas.</p>

      <h3>7. Qué pasa con los sospechosos</h3>
      <p>Sea cual sea el método, un pocillo sospechoso solo se <b>excluye automáticamente</b> si activás esa opción. Siempre podés forzar el estado de cada pocillo con un clic en el gráfico o en el mapa de la placa: lo que se decide a mano tiene prioridad sobre el test. Un pocillo excluido a mano no entra en el cálculo de los tests ni en las medias, y si era un blanco deja de contarse en el ODc.</p>
      <p className="ayuda">Un test estadístico no distingue un error experimental de una variación biológica real: revisá cada sospechoso antes de excluirlo y no elimines datos solo porque no te gusta el resultado.</p>

      <h3>8. Comparación entre placas</h3>
      <p>En <b>Gráfico › Comparar placas</b> cada muestra se dibuja con <b>una columna por placa</b> (la altura es la OD media de sus réplicas aceptadas), <b>una por medio de cultivo</b> (las placas del mismo medio juntas, con todos sus pocillos o un valor por placa) o <b>una por pocillo</b>. Se puede mostrar barras con error, cajas (Q1–Q3, con 5 o más datos por columna), mediana, mínimo y máximo, media y los puntos. No hay líneas de ODc: es una comparación directa de OD.</p>
      <h4>Qué cuenta como réplica</h4>
      <p>Los pocillos de una misma placa son <b>réplicas técnicas</b>: salen del mismo cultivo, el mismo día y el mismo lector. Las <b>placas</b> (hechas en días o experimentos distintos) son las <b>réplicas biológicas</b>. Para las pruebas cada placa aporta <b>un solo número por muestra</b> (su OD media), así que el <b>n es el número de placas</b>. Contar los pocillos como réplicas independientes produce diferencias «significativas» que no lo son (pseudorreplicación).</p>
      <h4>Barras de error del gráfico</h4>
      <p>Son las de la sección 2 (DE, SEM o IC 95 %) calculadas con los datos de cada columna. Con una columna por placa muestran cuánto varían las réplicas técnicas dentro de esa placa; <b>no</b> miden la diferencia entre placas.</p>
      <h4>Pruebas estadísticas</h4>
      <p>Se hacen en la pestaña <b>Estadística</b>: arriba se elige qué comparar (cepas, medios, placas, una comparación «a medida» o la concordancia entre placas) y el programa revisa la normalidad (Shapiro-Wilk) y las varianzas (Levene) para elegir solo entre ANOVA clásico, ANOVA de Welch y Kruskal-Wallis, con comparaciones de a pares ajustadas por Holm (o Dunnett contra un control). La lógica completa y el desarrollo con tus datos están en la sección «Estadística: cálculos, razones y lógica de cada método» de esta misma pantalla.</p>
      <h4>Concordancia entre placas (reproducibilidad)</h4>
      <ul>
        <li><b>Variabilidad</b>: cada placa aporta la media de sus pocillos por cepa; entre placas se calculan media, DE y <code>CV % = DE ÷ media × 100</code>. En biofilm un CV menor que 20–30 % suele considerarse aceptable (los límites se pueden cambiar).</li>
        <li><b>¿Difieren las placas?</b> Para cada cepa, ANOVA de una vía con la placa como factor y los pocillos como datos (Kruskal-Wallis si los residuos no son normales o alguna placa tiene menos de 3 pocillos), y ANOVA de dos vías cepa × placa (sumas de cuadrados tipo II).</li>
        <li><b>Correlación</b> entre pares de placas con la media de cada cepa: Pearson si las medias son normales, si no Spearman. Hacen falta 3 o más cepas.</li>
        <li><b>ICC</b> (Shrout y Fleiss): ICC(2,1) de acuerdo absoluto e ICC(3,1) de consistencia, con IC 95 % (McGraw y Wong). Menor que 0,5 pobre, 0,5–0,75 moderada, 0,75–0,9 buena, mayor que 0,9 excelente (Koo y Li, 2016).</li>
      </ul>
      <h4>Precauciones</h4>
      <ul>
        <li><b>Pocas placas, poca potencia.</b> Con 2 o 3 placas solo se detectan diferencias grandes; un p alto no prueba que no haya diferencia. Idealmente, 3 o más placas independientes por condición.</li>
        <li><b>La OD se compara tal cual.</b> Si las placas tienen fondos muy distintos (mirá el ODc de cada una), conviene comparar <b>OD ÷ ODc</b> o ln(OD), que se eligen en Estadística.</li>
        <li>Las placas leídas a distintas longitudes de onda no son comparables (el Resumen lo avisa).</li>
      </ul>
      <p className="ayuda">Los cálculos se verificaron contra R (t.test, p.adjust, aov, oneway.test, kruskal.test, shapiro.test, car::Anova y psych::ICC) con los mismos datos.</p>
    </section>
  )
}
