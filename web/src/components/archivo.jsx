import { useRef, useState } from 'react'
import { Campo, Modal, Select } from './ui.jsx'
import { MODO } from '../api.js'
import { aCSV, descargarBlob, descargarTexto, fmt, pocillos96 } from '../utils.js'

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
  const layoutRef = useRef()
  const destinoLayout = useRef(false)   // true = el CSV que se elija va a todas las placas

  const abrirArchivos = async (files, idDestino = null) => {
    if (!files || !files.length) return
    setCargando(true)
    await s.agregarPlacas(files, idDestino)
    setCargando(false)
  }

  const exportarLayout = () => {
    const filas = [...s.config].sort((a, b) => pocillos96().indexOf(a.Pocillo) - pocillos96().indexOf(b.Pocillo))
      .map((c) => ({ Pocillo: c.Pocillo, Muestra: c.Muestra, Replica: c.Replica, Blanco: c.EsBlanco ? 1 : 0 }))
    descargarTexto(aCSV(filas, ['Pocillo', 'Muestra', 'Replica', 'Blanco']), 'layout_placa.csv')
  }

  // Lee el CSV del layout y lo aplica a la placa activa (aTodas = false) o a todas las placas con datos (aTodas = true)
  const importarLayout = async (file, aTodas) => {
    const txt = (await file.text()).replace(/^﻿/, '')
    const lineas = txt.split(/\r?\n/).filter(Boolean)
    if (!lineas.length) return s.avisar('El archivo está vacío.', 'error')
    const sep = lineas[0].includes(';') ? ';' : ','
    const cab = lineas[0].split(sep).map((x) => x.trim().toLowerCase())
    const ix = (n) => cab.findIndex((c) => n.includes(c))
    const iP = ix(['pocillo', 'well']), iM = ix(['muestra', 'sample']), iR = ix(['replica', 'rep']), iB = ix(['blanco', 'blank', 'esblanco'])
    if (iP < 0 || iM < 0) return s.avisar("El layout necesita las columnas 'Pocillo' y 'Muestra'.", 'error')
    const validos = new Set(pocillos96())
    const cfg = []
    for (const l of lineas.slice(1)) {
      const c = l.split(sep).map((x) => x.trim().replace(/^"|"$/g, ''))
      const p = c[iP]?.toUpperCase().replace(/^([A-H])0+(\d)/, '$1$2')
      if (!p || !validos.has(p) || !c[iM] || cfg.some((x) => x.Pocillo === p)) continue
      cfg.push({ Pocillo: p, Muestra: c[iM], Replica: iR >= 0 ? Number(c[iR]) || 0 : 0,
        EsBlanco: iB >= 0 && ['1', 'true', 'si', 'sí', 'yes', 'x'].includes((c[iB] || '').toLowerCase()) })
    }
    if (!cfg.length) return s.avisar('Ningún pocillo válido (A1 a H12) con muestra en el layout.', 'error')
    const ordenados = cfg.sort((a, b) => pocillos96().indexOf(a.Pocillo) - pocillos96().indexOf(b.Pocillo))
    const cont = {}
    ordenados.forEach((c) => { cont[c.Muestra] = (cont[c.Muestra] || 0) + 1; if (!c.Replica) c.Replica = cont[c.Muestra] })
    s.aplicarLayout(ordenados, aTodas)
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
          <span>Cada archivo (o cada hoja con una placa) se agrega como una placa distinta · .xlsx · .csv · .txt</span>
        </div>
        <input ref={inputRef} type="file" multiple hidden accept=".xlsx,.xls,.csv,.txt"
          onChange={(e) => { abrirArchivos(e.target.files, destinoRef.current); e.target.value = ''; destinoRef.current = null }} />

        {s.placas.length > 0 && (
          <div className="tabla-scroll" style={{ marginTop: 14 }}>
            <table className="tabla">
              <thead><tr><th>Placa</th><th>Archivo</th><th>Pocillos</th><th>Onda</th><th>Fecha de lectura</th><th>Configurados</th><th>ODc</th><th /></tr></thead>
              <tbody>
                {s.placas.map((x) => {
                  const an = s.analisisMap[x.id]
                  return (
                    <tr key={x.id} className={x.id === s.activaId ? 'fila-activa' : ''}>
                      <td><b>{x.nombre}</b>{x.id === s.activaId && <small className="ayuda"> · activa</small>}</td>
                      <td>{x.archivo ? `${x.archivo.nombre}${x.archivo.hoja && x.archivo.hoja !== 'csv' ? ' · ' + x.archivo.hoja : ''}` : ''}</td>
                      {x.placa ? (
                        <>
                          <td>{x.placa.datos.length}</td>
                          <td>{Number.isFinite(x.placa.onda) ? `${x.placa.onda} nm` : '–'}</td>
                          <td>{x.placa.fecha || '–'}</td>
                        </>
                      ) : (
                        <td colSpan={3}>
                          <span className="ayuda">Sin datos del Excel. </span>
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
          <p className="ayuda" style={{ marginTop: 0 }}>La lista de muestras es común a todas las placas.</p>
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
          <p className="ayuda">Estas muestras aparecen al configurar cada pocillo. Los medios (BHI, TSBye) se marcan como blancos al configurar el pocillo.</p>
        </section>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <section className="tarjeta">
            <h2>Sesión</h2>
            <p className="ayuda" style={{ marginTop: 0 }}>Guarda <b>todas las placas con sus datos del Excel</b>, la configuración de pocillos, muestras, exclusiones, ajustes y estilos. Para continuar otro día alcanza con cargar la sesión: no hace falta volver a subir los Excel.</p>
            <div className="fila-ctrl">
              <button className="primario" onClick={guardarSesion} disabled={!s.placas.length}>Guardar sesión</button>
              <button onClick={() => sesionRef.current.click()}>Cargar sesión</button>
              <input ref={sesionRef} type="file" hidden accept=".json" onChange={(e) => { e.target.files[0] && cargarSesion(e.target.files[0]); e.target.value = '' }} />
            </div>
          </section>
          <section className="tarjeta">
            <h2>Layout de la placa activa</h2>
            <p className="ayuda" style={{ marginTop: 0 }}>CSV con las columnas Pocillo, Muestra y, opcionalmente, Replica y Blanco (1/0).</p>
            <div className="fila-ctrl">
              <button onClick={exportarLayout} disabled={!s.config.length}>Exportar CSV</button>
              <button onClick={() => { destinoLayout.current = false; layoutRef.current.click() }} disabled={!p}>
                Importar CSV en «{act?.nombre || 'placa activa'}»
              </button>
              {s.placas.length > 1 && (
                <button className="primario" onClick={() => { destinoLayout.current = true; layoutRef.current.click() }} disabled={!s.placas.some((x) => x.placa)}>
                  Importar CSV en todas las placas
                </button>
              )}
              <input ref={layoutRef} type="file" hidden accept=".csv,.txt"
                onChange={(e) => { e.target.files[0] && importarLayout(e.target.files[0], destinoLayout.current); e.target.value = '' }} />
            </div>
            {s.placas.length > 1 && (
              <div className="fila-ctrl">
                <button disabled={!s.config.length} onClick={() => s.copiarConfig()}>Copiar el layout de esta placa a las demás</button>
              </div>
            )}
            <p className="ayuda">
              {s.placas.length > 1
                ? 'Aplicar el layout a todas es una copia única: después, los cambios que hagas en la pestaña Placa afectan solo a la placa activa.'
                : 'Con varias placas vas a poder aplicar el mismo layout a todas de una vez.'}
            </p>
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
