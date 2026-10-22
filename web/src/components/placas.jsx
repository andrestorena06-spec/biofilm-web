// Pestaña «Placas»: cargar el Excel de cada lectura, escribir o pegar las OD a mano, medio de cada placa y vista previa
import { useMemo, useRef, useState } from 'react'
import { ACEPTA_LIBRO, TEXTO_FORMATOS } from '../libro.js'
import { Icono } from './iconos.jsx'
import { BotonCinta, CampoCinta, Cinta, Grupo } from './cinta.jsx'
import { Modal, Num, Select, aNumero } from './ui.jsx'
import { FILAS, fmt, paletaMuestras } from '../utils.js'

const COLS = Array.from({ length: 12 }, (_, i) => i + 1)

// Lee un bloque pegado desde Excel o LibreOffice (filas separadas por saltos de línea y columnas por tabulador o punto y coma).
// Si trae los encabezados de la placa (1…12 arriba, A…H a la izquierda) se saltean.
export function leerBloque(texto) {
  let filas = texto.replace(/\r/g, '').split('\n').filter((l) => l.trim() !== '').map((l) => l.split(/\t|;/).map((c) => c.trim()))
  if (filas.length && filas[0].slice(1).filter(Boolean).every((c) => /^\d{1,2}$/.test(c)) && !Number.isFinite(aNumero(filas[0][0]))) filas = filas.slice(1)
  if (filas.length && filas.every((f) => /^[A-Ha-h]$/.test(f[0]))) filas = filas.map((f) => f.slice(1))
  return filas.map((f) => f.map((c) => aNumero(c)))
}

// Ventana para escribir o pegar las 96 OD de una placa
function EditorOD({ placa, onGuardar, onClose }) {
  const ini = useMemo(() => Object.fromEntries((placa.placa?.datos || []).map((d) => [d.Pocillo, String(d.OD).replace('.', ',')])), [placa])
  const [txt, setTxt] = useState(ini)
  const [onda, setOnda] = useState(placa.placa?.onda ?? 595)
  const validos = Object.values(txt).filter((v) => Number.isFinite(aNumero(v))).length
  const malos = Object.entries(txt).filter(([, v]) => v.trim() !== '' && !Number.isFinite(aNumero(v))).map(([p]) => p)
  const pegar = (e, fi, ci) => {
    const t = e.clipboardData.getData('text')
    if (!/[\t\n;]/.test(t)) return   // un solo valor: se pega normal
    e.preventDefault()
    const b = leerBloque(t)
    const n = { ...txt }
    b.forEach((fila, i) => fila.forEach((v, j) => {
      const f = FILAS[fi + i], c = ci + j + 1
      if (f && c <= 12) n[f + c] = Number.isFinite(v) ? String(v).replace('.', ',') : ''
    }))
    setTxt(n)
  }
  const mover = (e) => {
    const k = e.key
    if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Enter'].includes(k)) return
    const [f, c] = e.target.dataset.pos.split(',').map(Number)
    const dest = k === 'ArrowUp' ? [f - 1, c] : k === 'ArrowDown' || k === 'Enter' ? [f + 1, c] : k === 'ArrowLeft' ? [f, c - 1] : [f, c + 1]
    const el = document.querySelector(`.editor-od input[data-pos="${dest[0]},${dest[1]}"]`)
    if (el) { e.preventDefault(); el.focus(); el.select() }
  }
  const guardar = () => {
    if (malos.length) return
    onGuardar(Object.fromEntries(Object.entries(txt).map(([p, v]) => [p, aNumero(v)]).filter(([, v]) => Number.isFinite(v))), onda === '' ? NaN : onda)
  }
  return (
    <Modal titulo={`OD de «${placa.nombre}»`} onClose={onClose} ancho={1000}
      pie={<><span className="ayuda" style={{ marginRight: 'auto' }}>{validos} pocillos con OD{malos.length ? ` · revisá ${malos.join(', ')}` : ''}</span>
        <button onClick={() => setTxt({})}>Vaciar</button><button onClick={onClose}>Cancelar</button><button className="primario" disabled={!!malos.length} onClick={guardar}>Guardar</button></>}>
      <p className="ayuda" style={{ marginTop: 0 }}>Escribí cada OD (con coma o punto decimal) o pegá la placa entera desde Excel: copiá las 8 filas × 12 columnas, hacé clic en A1 y pegá (Ctrl + V).
        Las flechas y Enter mueven el cursor. Los pocillos vacíos quedan sin datos.</p>
      <div className="fila" style={{ marginBottom: 10 }}>
        <label className="campo" style={{ marginBottom: 0 }}><span>Longitud de onda (nm)</span><Num value={onda} ancho={90} onChange={setOnda} /></label>
      </div>
      <div className="editor-od placa-wrap">
        <table className="placa">
          <thead><tr><th />{COLS.map((c) => <th key={c}>{c}</th>)}</tr></thead>
          <tbody>
            {FILAS.map((f, fi) => (
              <tr key={f}><th>{f}</th>
                {COLS.map((c) => {
                  const p = f + c, v = txt[p] ?? ''
                  const mal = v.trim() !== '' && !Number.isFinite(aNumero(v))
                  return (
                    <td key={p}>
                      <input inputMode="decimal" data-pos={`${fi},${c - 1}`} className={mal ? 'mal' : ''} value={v} placeholder={p} aria-label={`OD de ${p}`}
                        onChange={(e) => setTxt({ ...txt, [p]: e.target.value })} onPaste={(e) => pegar(e, fi, c - 1)} onKeyDown={mover} onFocus={(e) => e.target.select()} />
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Modal>
  )
}

export function PlacasVista({ s }) {
  const [sobre, setSobre] = useState(false)
  const [cargando, setCargando] = useState(false)
  const [editor, setEditor] = useState(null)   // id de la placa
  const [verPrevia, setVerPrevia] = useState(false)
  const inputRef = useRef()
  const destinoRef = useRef(null)
  const colores = paletaMuestras(s.placas.map((p) => p.id))
  const act = s.a

  const abrirArchivos = async (files, idDestino = null) => {
    if (!files || !files.length) return
    setCargando(true)
    await s.agregarPlacas(files, idDestino)
    setCargando(false)
  }
  const elegir = (id = null) => { destinoRef.current = id; inputRef.current.click() }
  const opciones = (p) => [['', '(sin indicar)'], ...s.medios.map((m) => [m, m]), ['__otro', 'Otro medio…']]
  const [medioNuevo, setMedioNuevo] = useState(null)   // { id, nombre }
  const placaEditor = s.placas.find((p) => p.id === editor)

  return (
    <div>
      <Cinta>
        <Grupo titulo="Agregar">
          <BotonCinta icono="subir" texto="Excel de placas" onClick={() => elegir()} tip={`Uno o varios archivos: cada archivo (o cada hoja con una placa) es una placa\n${TEXTO_FORMATOS}`} />
          <BotonCinta icono="placa" texto="Placa sin datos" onClick={s.nuevaPlacaVacia} tip="Crear una placa para dejar listos su nombre, medio y pocillos; los datos se cargan después" />
          <BotonCinta icono="teclado" texto="Escribir OD" onClick={() => act && setEditor(act.id)} deshabilitado={!act} tip={`Escribir o pegar las OD de la placa elegida${act ? ` («${act.nombre}»)` : ''}`} />
        </Grupo>
        {s.placas.length > 1 && (
          <Grupo titulo="Placas nuevas">
            <CampoCinta etiqueta="Copiar el layout de" tip="Las placas que se agreguen sin layout copian la distribución de muestras de esta placa">
              <Select value={s.opts.archivo.layoutBase} onChange={(v) => s.setOpts({ ...s.opts, archivo: { ...s.opts.archivo, layoutBase: v } })}
                opciones={[['', '(ninguna)'], ...s.placas.filter((x) => x.config.length > 0).map((x) => [x.id, x.nombre])]} />
            </CampoCinta>
          </Grupo>
        )}
        {act?.placa?.preview && <Grupo titulo="Archivo"><BotonCinta icono="ojo" texto="Vista previa" activo={verPrevia} onClick={() => setVerPrevia(!verPrevia)} tip={`Primeras filas del archivo de «${act.nombre}»`} /></Grupo>}
      </Cinta>

      <div className={`zona-carga ${s.placas.length ? 'compacta' : ''} ${sobre ? 'sobre' : ''}`} onClick={() => elegir()}
        onDragOver={(e) => { e.preventDefault(); setSobre(true) }} onDragLeave={() => setSobre(false)}
        onDrop={(e) => { e.preventDefault(); setSobre(false); abrirArchivos(e.dataTransfer.files) }}>
        <Icono n="subir" size={s.placas.length ? 20 : 26} />
        <b>{cargando ? 'Leyendo…' : 'Soltá uno o varios Excel acá, o hacé clic para elegirlos'}</b>
        <small>Cada archivo (o cada hoja con una placa) se agrega como una placa · {TEXTO_FORMATOS}</small>
      </div>
      <input ref={inputRef} type="file" multiple hidden accept={ACEPTA_LIBRO}
        onChange={(e) => { abrirArchivos(e.target.files, destinoRef.current); e.target.value = ''; destinoRef.current = null }} />

      {s.placas.length > 0 && (
        <section className="tarjeta">
          <div className="cabeza-tarjeta"><span className="etiqueta-seccion">Placas del experimento ({s.placas.length})</span>
            <span className="ayuda">Clic en el nombre para renombrar · el orden se cambia arrastrando las placas en la barra de placas</span></div>
          <div className="tabla-scroll alta">
            <table className="tabla">
              <thead><tr><th>Placa</th><th>Medio</th><th>Datos</th><th className="num">Pocillos</th><th className="num">Onda</th><th>Lectura</th><th className="num">Configurados</th><th className="num">ODc</th><th /></tr></thead>
              <tbody>
                {s.placas.map((x) => {
                  const an = s.analisisMap[x.id]
                  return (
                    <tr key={x.id} className={`${x.id === s.activaId ? 'elegida' : ''} ${x.oculta ? 'fuera' : ''}`}>
                      <td><i className="punto" style={{ background: colores[x.id] }} /> <button className="enlace" onClick={() => s.pedirRenombre(x)} data-tip="Renombrar">{x.nombre}</button>{x.oculta && <small className="ayuda"> · oculta</small>}</td>
                      <td><select value={x.medio || ''} onChange={(e) => (e.target.value === '__otro' ? setMedioNuevo({ id: x.id, nombre: '' }) : s.setMedio(x.id, e.target.value))}>
                        {opciones(x).map(([v, t]) => <option key={v} value={v}>{t}</option>)}</select></td>
                      <td>{x.placa ? (
                        x.archivo?.hojas?.length > 1 && s.tieneArchivo(x.id)
                          ? <span className="fila" style={{ gap: 6, flexWrap: 'nowrap' }}>{x.archivo.nombre} · <Select value={x.archivo.hoja} onChange={(h) => s.cambiarHoja(x.id, h)} opciones={x.archivo.hojas.map((h) => [h, h])} /></span>
                          : <span data-tip={x.archivo?.hojas?.length > 1 ? 'Para elegir otra hoja, volvé a cargar el archivo' : undefined}>{x.archivo?.nombre || '—'}{x.archivo?.hoja && x.archivo.hoja !== 'csv' && x.archivo.hojas?.length > 1 ? ` · ${x.archivo.hoja}` : ''}</span>
                      ) : <span className="chip aviso">sin datos</span>}</td>
                      <td className="num">{x.placa ? x.placa.datos.length : '—'}</td>
                      <td className="num">{Number.isFinite(x.placa?.onda) ? `${x.placa.onda} nm` : '—'}</td>
                      <td>{x.placa?.fecha || '—'}</td>
                      <td className="num">{x.config.length}</td>
                      <td className="num">{an && Number.isFinite(an.odc?.odc) ? fmt(an.odc.odc, 4) : '—'}</td>
                      <td><div className="acciones-fila">
                        {!x.placa && <button className="chico primario" onClick={() => elegir(x.id)}><Icono n="subir" size={13} />Excel</button>}
                        <button className="chico" onClick={() => setEditor(x.id)} data-tip="Escribir o pegar las OD a mano"><Icono n="teclado" size={13} />OD</button>
                        <button className="chico" onClick={() => { s.setActiva(x.id); s.irA('pocillos') }} data-tip="Configurar los pocillos de esta placa">Pocillos<Icono n="flecha" size={12} /></button>
                        <button className="fantasma icono" onClick={() => s.ocultarPlaca(x.id, !x.oculta)} data-tip={x.oculta ? 'Mostrar (vuelve a los cálculos)' : 'Ocultar (queda fuera de los cálculos)'}><Icono n="ojo" size={15} /></button>
                        <button className="fantasma icono peligro" onClick={() => s.quitarPlaca(x.id)} data-tip="Quitar la placa (Ctrl + Z para deshacer)"><Icono n="borrar" size={15} /></button>
                      </div></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {verPrevia && act?.placa?.preview && (
        <section className="tarjeta">
          <div className="cabeza-tarjeta"><span className="etiqueta-seccion">Vista previa del archivo de «{act.nombre}»</span></div>
          <div className="tabla-scroll">
            <table className="tabla compacta">
              <tbody>{act.placa.preview.map((fila, i) => <tr key={i}>{Object.values(fila).map((v, j) => <td key={j}>{v}</td>)}</tr>)}</tbody>
            </table>
          </div>
        </section>
      )}

      {placaEditor && <EditorOD placa={placaEditor} onClose={() => setEditor(null)}
        onGuardar={(valores, onda) => { s.ponerDatosManual(placaEditor.id, valores, onda); setEditor(null); s.avisar(`OD de «${placaEditor.nombre}» guardadas (${Object.keys(valores).length} pocillos).`) }} />}
      {medioNuevo && (
        <Modal titulo="Otro medio de cultivo" onClose={() => setMedioNuevo(null)} ancho={420}
          pie={<><button onClick={() => setMedioNuevo(null)}>Cancelar</button><button className="primario" onClick={() => { if (medioNuevo.nombre.trim()) s.setMedio(medioNuevo.id, medioNuevo.nombre.trim()); setMedioNuevo(null) }}>Guardar</button></>}>
          <label className="campo"><span>Nombre del medio (por ejemplo LB, TSB, M9…)</span><input autoFocus value={medioNuevo.nombre} onChange={(e) => setMedioNuevo({ ...medioNuevo, nombre: e.target.value })}
            onKeyDown={(e) => { if (e.key === 'Enter' && medioNuevo.nombre.trim()) { s.setMedio(medioNuevo.id, medioNuevo.nombre.trim()); setMedioNuevo(null) } }} /></label>
        </Modal>
      )}
    </div>
  )
}
