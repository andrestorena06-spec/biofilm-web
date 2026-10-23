import { useRef, useState } from 'react'
import { Icono } from './iconos.jsx'
import { BotonCinta, Cinta, Grupo } from './cinta.jsx'
import { esLibro, TEXTO_FORMATOS } from '../libro.js'
import { MODO } from '../api.js'

const fecha = (f) => { try { return new Date(f).toLocaleString('es', { dateStyle: 'medium', timeStyle: 'short' }) } catch { return '' } }
const resumenExp = (e) => {
  const n = e.placas?.length || 0
  const medios = [...new Set((e.placas || []).map((p) => p.medio).filter(Boolean))]
  return `${n} ${n === 1 ? 'placa' : 'placas'}${medios.length ? ` · ${medios.join(', ')}` : ''}${e.info?.organismo ? ` · ${e.info.organismo}` : ''}`
}

// Pestaña «Archivo»: empezar, abrir, guardar y retomar los experimentos recientes de este equipo
export function Inicio({ exp, archivo, recientes = [], onNuevo, onAbrir, onAbrirArchivo, onAbrirReciente, onBorrarReciente, onGuardar, onGuardarComo, onVolver }) {
  const [sobre, setSobre] = useState(false)
  const ref = useRef()
  const todos = recientes.filter((r) => r.exp?.id !== exp?.id)
  const ultimo = !exp && todos[0]
  const otros = ultimo ? todos.slice(1) : todos
  // soltar archivos: Excel = experimento nuevo con esas placas; .json = abrir la sesión
  // pares { file, h }: el manejador (para poder sobrescribir el archivo) se pide durante el evento de soltar
  const soltar = async (pares) => {
    const sesion = pares.find((p) => p.file && /\.json$/i.test(p.file.name))
    if (sesion) return onAbrirArchivo(sesion.file, await sesion.h)
    const lista = pares.map((p) => p.file).filter(Boolean)
    const excel = lista.filter((f) => esLibro(f.name))
    if (excel.length) onNuevo(excel)
  }
  return (
    <div className="inicio">
      <Cinta>
        <Grupo titulo="Experimento">
          <BotonCinta icono="nuevo" texto="Nuevo" onClick={() => onNuevo()} tip="Empezar un experimento nuevo (el que está abierto queda en «Recientes»)" />
          <BotonCinta icono="carpeta" texto="Abrir" onClick={onAbrir} tip="Abrir una sesión guardada (.biofilm.json o sesion_biofilm.json de versiones anteriores)" />
          <BotonCinta icono="guardar" texto="Guardar" onClick={onGuardar} deshabilitado={!exp} tip={archivo && !archivo.viejo ? `Sobrescribe «${archivo.nombre}» (Ctrl + S)` : 'Elegís dónde guardar la sesión; después «Guardar» escribe en ese archivo (Ctrl + S)'} />
          <BotonCinta icono="copiar" texto="Guardar como" onClick={onGuardarComo} deshabilitado={!exp} tip="Guardar la sesión en otro archivo (Ctrl + Mayús + S)" />
        </Grupo>
        {exp && <Grupo titulo="Volver"><BotonCinta icono="flecha" texto="Al experimento" onClick={onVolver} /></Grupo>}
      </Cinta>

      <div className="portada">
        <div>
          <span className="etiqueta-seccion">Producción de biofilm · cristal violeta</span>
          <h1>Biofilm</h1>
          <p className="sub">Placas de 96 pocillos leídas a 560–600 nm: punto de corte (ODc), clasificación de Stepanović, control de calidad de las réplicas,
            gráficos y comparación estadística entre cepas, medios y placas.</p>
          {MODO === 'web' && <p className="ayuda"><Icono n="escudo" size={14} style={{ verticalAlign: -2 }} /> Todo se calcula en este equipo: los archivos no se envían a ningún servidor.</p>}
        </div>
        <div className="acciones-portada">
          {ultimo && (
            <button className="accion-portada primaria" onClick={() => onAbrirReciente(ultimo)}>
              <Icono n="refrescar" size={22} /><b>Continuar «{ultimo.exp.info?.nombre || 'Experimento'}»</b><small>{resumenExp(ultimo.exp)} · {fecha(ultimo.fecha)}</small>
            </button>
          )}
          <button className={`accion-portada ${ultimo ? '' : 'primaria'}`} onClick={() => onNuevo()}><Icono n="nuevo" size={22} /><b>Nuevo experimento</b><small>Cargás el Excel de cada placa y configurás los pocillos.</small></button>
          <button className="accion-portada" onClick={onAbrir}><Icono n="carpeta" size={22} /><b>Abrir una sesión</b><small>Un archivo guardado antes, en esta u otra computadora (también de versiones anteriores).</small></button>
        </div>
      </div>

      <div className={`zona-carga ${sobre ? 'sobre' : ''}`} onClick={() => ref.current.click()}
        onDragOver={(e) => { e.preventDefault(); setSobre(true) }} onDragLeave={() => setSobre(false)}
        onDrop={(e) => {
          e.preventDefault(); setSobre(false)
          const items = [...e.dataTransfer.items].filter((i) => i.kind === 'file')
          soltar(items.map((i) => ({ file: i.getAsFile(), h: i.getAsFileSystemHandle ? i.getAsFileSystemHandle().catch(() => null) : Promise.resolve(null) })))
        }}>
        <Icono n="subir" size={24} />
        <b>Soltá acá los Excel de las placas o una sesión guardada</b>
        <small>Excel: arranca un experimento nuevo con esas placas · sesión (.json): la abre · {TEXTO_FORMATOS}</small>
        <input ref={ref} type="file" hidden multiple onChange={(e) => { soltar([...e.target.files].map((file) => ({ file, h: Promise.resolve(null) }))); e.target.value = '' }} />
      </div>

      {exp && (
        <section className="tarjeta ficha-abierta">
          <div className="cabeza-tarjeta"><span className="etiqueta-seccion">Experimento abierto</span></div>
          <div className="fila">
            <div style={{ flex: 1, minWidth: 220 }}>
              <h2 style={{ margin: '2px 0' }}>{exp.info.nombre}</h2>
              <span className="ayuda">{resumenExp(exp)} · {archivo ? `archivo: ${archivo.nombre}` : 'todavía sin guardar en un archivo'}</span>
            </div>
            <button onClick={onGuardar}><Icono n="guardar" size={15} />Guardar sesión</button>
            <button className="primario" onClick={onVolver}>Seguir trabajando<Icono n="flecha" size={15} /></button>
          </div>
        </section>
      )}

      <section className="tarjeta">
        <div className="cabeza-tarjeta">
          <span className="etiqueta-seccion">Recientes en este equipo</span>
          <span className="ayuda">Se guardan solos mientras trabajás (hasta 8). Para llevarlos a otro equipo, usá «Guardar».</span>
        </div>
        {!otros.length ? <p className="ayuda" style={{ margin: '8px 0 0' }}>{exp || ultimo ? 'No hay otros experimentos recientes.' : 'Todavía no hay experimentos recientes.'}</p> : (
          <div className="lista-recientes">
            {otros.map((r) => (
              <div key={r.exp.id} className="reciente">
                <button className="abrir-reciente" onClick={() => onAbrirReciente(r)}>
                  <Icono n="placa" size={18} />
                  <span><b>{r.exp.info?.nombre || 'Experimento'}</b><small>{resumenExp(r.exp)}</small></span>
                  <small className="fecha-reciente">{fecha(r.fecha)}</small>
                </button>
                <button className="fantasma icono" aria-label="Quitar de recientes" data-tip="Quitar de la lista (no borra los archivos guardados)" onClick={() => onBorrarReciente(r)}><Icono n="x" size={15} /></button>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
