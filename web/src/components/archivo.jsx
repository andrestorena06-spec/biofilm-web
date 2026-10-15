import { ACEPTA_LIBRO } from '../libro.js'
import { Nota } from './tip.jsx'
import { useRef, useState } from 'react'
import { Campo, Modal, Select } from './ui.jsx'
import { MODO } from '../api.js'
import { descargarBlob, fmt } from '../utils.js'

// ===============================================================
// ARCHIVO: placas (un Excel = una placa), muestras, sesión y layout
// ===============================================================
export function ArchivoTab({ s }) {
  const [nueva, setNueva] = useState('')
  const [edit, setEdit] = useState(null)
  const [cargando, setCargando] = useState(false)
  const inputRef = useRef()
  const destinoRef = useRef(null) // placa a la que se le asigna un archivo (si venía sin datos)
  const sesionRef = useRef()

  const abrirArchivos = async (files, idDestino = null) => {
    if (!files || !files.length) return
    setCargando(true)
    await s.agregarPlacas(files, idDestino)
    setCargando(false)
  }

  const guardarSesion = () => descargarBlob(new Blob([JSON.stringify(s.exportarSesion())], { type: 'application/json' }), 'sesion_biofilm.json')
  const cargarSesion = async (file) => {
    try { s.importarSesion(JSON.parse(await file.text())); s.avisar('Sesión cargada.') } catch { s.avisar('No se pudo leer la sesión.', 'error') }
  }

  const agregar = () => {
    const n = nueva.trim()
    if (!n) return
    if (s.muestras.some((m) => m.toLowerCase() === n.toLowerCase())) return s.avisar(`La muestra '${n}' ya existe.`, 'error')
    s.setMuestras([...s.muestras, n])
    setNueva('')
  }

  const p = s.placa
  const act = s.a
  return (
    <div className="pagina">
      <section className="tarjeta">
        <div className="titulo-fila">
          <h2>Placas {s.placas.length > 0 && <small className="ayuda">({s.placas.length})</small>}</h2>
        </div>
        {MODO === 'web' && (
          <p className="ayuda aviso-privacidad">Los cálculos se hacen en tu navegador: los archivos y los resultados <b>no se envían a ningún servidor</b>.</p>
        )}
        <div className="dropzone" onClick={() => { destinoRef.current = null; inputRef.current.click() }}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => { e.preventDefault(); abrirArchivos(e.dataTransfer.files) }}>
          <strong>{cargando ? 'Leyendo…' : 'Soltá uno o varios Excel acá, o hacé clic para elegirlos'}</strong>
          <span>Cada archivo (o cada hoja con una placa) se agrega como una placa distinta · Excel o LibreOffice (.xlsx, .xls, .ods…)</span>
        </div>
        <input ref={inputRef} type="file" multiple hidden accept={ACEPTA_LIBRO}
          onChange={(e) => { abrirArchivos(e.target.files, destinoRef.current); e.target.value = ''; destinoRef.current = null }} />

        {s.placas.length > 0 && (
          <div className="tabla-scroll" style={{ marginTop: 14 }}>
            <table className="tabla">
              <thead><tr><th>Placa</th><th>Medio</th><th>Archivo</th><th>Pocillos</th><th>Onda</th><th>Fecha de lectura</th><th>Configurados</th><th>ODc</th><th /></tr></thead>
              <tbody>
                {s.placas.map((x) => {
                  const an = s.analisisMap[x.id]
                  return (
                    <tr key={x.id} className={x.id === s.activaId ? 'fila-activa' : ''}>
                      <td><b>{x.nombre}</b>{x.id === s.activaId && <small className="ayuda"> · activa</small>}</td>
                      <td>{x.medio || '–'}</td>
                      <td>{x.archivo ? `${x.archivo.nombre}${x.archivo.hoja && x.archivo.hoja !== 'csv' ? ' · ' + x.archivo.hoja : ''}` : ''}</td>
                      {x.placa ? (
                        <>
                          <td>{x.placa.datos.length}</td>
                          <td>{Number.isFinite(x.placa.onda) ? `${x.placa.onda} nm` : '–'}</td>
                          <td>{x.placa.fecha || '–'}</td>
                        </>
                      ) : (
                        <td colSpan={3}>
                          <span className="ayuda">Todavía sin Excel (la configuración ya cargada se aplica sola al cargarlo). </span>
                          <button className="chico primario" onClick={() => { destinoRef.current = x.id; inputRef.current.click() }}>Cargar archivo</button>
                        </td>
                      )}
                      <td>{x.config.length}</td>
                      <td>{an && Number.isFinite(an.odc.odc) ? fmt(an.odc.odc, 4) : '–'}</td>
                      <td style={{ textAlign: 'right' }}>
                        {x.id !== s.activaId && <button className="chico" onClick={() => s.setActiva(x.id)}>Abrir</button>}{' '}
                        <button className="chico" onClick={() => setEdit({ id: x.id, nombre: x.nombre })}>Renombrar</button>{' '}
                        <button className="chico peligro" onClick={() => s.quitarPlaca(x.id)}>Quitar</button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
        {act?.archivo?.hojas?.length > 1 && s.tieneArchivo(act.id) && (
          <Campo label={`Hoja del Excel de «${act.nombre}»`}>
            <Select value={act.archivo.hoja} onChange={(h) => s.cambiarHoja(act.id, h)} opciones={act.archivo.hojas.map((h) => [h, h])} />
          </Campo>
        )}
        {p && (
          <dl className="datos">
            <dt>Placa activa</dt><dd>{act.nombre}</dd>
            <dt>OD mín. / máx.</dt><dd>{fmt(Math.min(...p.datos.map((d) => d.OD)))} / {fmt(Math.max(...p.datos.map((d) => d.OD)))}</dd>
          </dl>
        )}
      </section>

      <div className="rejilla-2">
        <section className="tarjeta">
          <h2>Muestras</h2>
          <p className="ayuda" style={{ marginTop: 0 }}><Nota titulo="Ayuda">La lista de muestras es común a todas las placas.</Nota></p>
          <div className="fila-ctrl">
            <input className="grande" placeholder="Nombre de la muestra y Enter (ej.: L100)" value={nueva}
              onChange={(e) => setNueva(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && agregar()} />
            <button className="primario" onClick={agregar}>Agregar</button>
          </div>
          <ul className="lista-muestras">
            {s.muestras.map((m, i) => {
              const n = s.placas.reduce((a, x) => a + x.config.filter((c) => c.Muestra === m).length, 0)
              return (
                <li key={m}>
                  <span><b>{m}</b>{n > 0 && <small> ({n} {n === 1 ? 'pocillo' : 'pocillos'} en total)</small>}</span>
                  <span>
                    <button onClick={() => setEdit({ i, viejo: m, nuevo: m })}>Modificar</button>
                    <button className="peligro" onClick={() => s.borrarMuestra(m)}>Borrar</button>
                  </span>
                </li>
              )
            })}
          </ul>
          <p className="ayuda"><Nota titulo="Ayuda">Estas muestras aparecen al configurar cada pocillo. Los medios (BHI, TSBye) se marcan como blancos al configurar el pocillo.</Nota></p>
        </section>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <section className="tarjeta">
            <h2>Sesión</h2>
            <p className="ayuda" style={{ marginTop: 0 }}><Nota titulo="Ayuda">Guarda <b>todas las placas con sus datos del Excel</b>, la configuración de pocillos, muestras, exclusiones, ajustes y estilos. Para continuar otro día alcanza con cargar la sesión: no hace falta volver a subir los Excel.</Nota></p>
            <div className="fila-ctrl">
              <button className="primario" onClick={guardarSesion} disabled={!s.placas.length}>Guardar sesión</button>
              <button onClick={() => sesionRef.current.click()}>Cargar sesión</button>
              <input ref={sesionRef} type="file" hidden accept=".json" onChange={(e) => { e.target.files[0] && cargarSesion(e.target.files[0]); e.target.value = '' }} />
            </div>
          </section>
        </div>
      </div>

      {p?.preview && (
        <section className="tarjeta">
          <h2>Vista previa del archivo de «{act.nombre}»</h2>
          <div className="tabla-scroll">
            <table className="tabla">
              <tbody>
                {p.preview.map((fila, i) => (
                  <tr key={i}>{Object.values(fila).map((v, j) => <td key={j}>{v}</td>)}</tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {edit && edit.id && (
        <Modal titulo="Renombrar placa" onClose={() => setEdit(null)}
          pie={<><button onClick={() => setEdit(null)}>Cancelar</button>
            <button className="primario" onClick={() => { s.renombrarPlaca(edit.id, edit.nombre.trim()); setEdit(null) }}>Guardar</button></>}>
          <Campo label="Nombre de la placa"><input autoFocus value={edit.nombre} onChange={(e) => setEdit({ ...edit, nombre: e.target.value })}
            onKeyDown={(e) => { if (e.key === 'Enter') { s.renombrarPlaca(edit.id, edit.nombre.trim()); setEdit(null) } }} /></Campo>
          <p className="ayuda">Este nombre aparece en la barra de placas y en las comparaciones.</p>
        </Modal>
      )}
      {edit && !edit.id && (
        <Modal titulo="Modificar muestra" onClose={() => setEdit(null)}
          pie={<><button onClick={() => setEdit(null)}>Cancelar</button>
            <button className="primario" onClick={() => { s.renombrarMuestra(edit.viejo, edit.nuevo.trim()); setEdit(null) }}>Guardar</button></>}>
          <Campo label="Nuevo nombre"><input autoFocus value={edit.nuevo} onChange={(e) => setEdit({ ...edit, nuevo: e.target.value })} /></Campo>
          <p className="ayuda">El cambio también se aplica a los pocillos de todas las placas que ya usan esta muestra.</p>
        </Modal>
      )}
    </div>
  )
}
