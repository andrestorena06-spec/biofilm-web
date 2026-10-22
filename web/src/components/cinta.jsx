// Cinta de herramientas (estilo Office, igual que en Curvas de crecimiento): cada pantalla pone sus grupos de botones
// en la cinta de arriba con <Cinta>. No hay paneles laterales: todo lo que se ajusta está arriba.
import { createContext, useContext, useEffect, useLayoutEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { Icono } from './iconos.jsx'

export const CintaCtx = createContext(null)

// Lo que se ponga dentro aparece en la cinta (portal al nodo de la cinta)
export function Cinta({ children }) {
  const nodo = useContext(CintaCtx)
  return nodo ? createPortal(children, nodo) : null
}

export const Grupo = ({ titulo, children, tip }) => (
  <div className="cinta-grupo" data-tip={tip}>
    <div className="cinta-items">{children}</div>
    {titulo && <div className="cinta-titulo">{titulo}</div>}
  </div>
)

// Botón grande con ícono y texto
export const BotonCinta = ({ icono, texto, onClick, activo, deshabilitado, tip, peligro, simbolo }) => (
  <button className={`cinta-boton ${activo ? 'on' : ''} ${peligro ? 'peligro' : ''}`} onClick={onClick} disabled={deshabilitado} data-tip={tip} aria-pressed={activo === undefined ? undefined : !!activo}>
    {simbolo ? <span className="simbolo">{simbolo}</span> : <Icono n={icono} size={20} />}
    <span>{texto}</span>
  </button>
)

// Grupo de opciones excluyentes (como un selector segmentado)
export const OpcionesCinta = ({ valor, onChange, opciones }) => opciones.map(([v, texto, simbolo, icono, tip]) => (
  <BotonCinta key={v} simbolo={simbolo} icono={icono} texto={texto} activo={valor === v} onClick={() => onChange(v)} tip={tip} />
))

// Casilla de la cinta: se prende y se apaga
export const InterruptorCinta = ({ icono, simbolo, texto, valor, onChange, tip, deshabilitado }) => (
  <BotonCinta icono={icono} simbolo={simbolo} texto={texto} activo={!!valor} onClick={() => onChange(!valor)} tip={tip} deshabilitado={deshabilitado} />
)

// Campo chico dentro de la cinta (número o lista)
export const CampoCinta = ({ etiqueta, children, tip }) => (
  <label className="cinta-campo" data-tip={tip}><span>{etiqueta}</span>{children}</label>
)

// Panel desplegable que baja desde la cinta (ajustes que no entran en ella)
export function Cajon({ titulo, abierto, onClose, children }) {
  const nodo = useContext(CintaCtx)
  const [pos, setPos] = useState({ top: 130, left: 0 })
  useLayoutEffect(() => {
    if (!abierto || !nodo) return
    const f = () => { const r = nodo.getBoundingClientRect(); setPos({ top: r.bottom, left: r.left }) }
    f()
    window.addEventListener('resize', f)
    return () => window.removeEventListener('resize', f)
  }, [abierto, nodo])
  useEffect(() => {
    if (!abierto) return
    const k = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [abierto, onClose])
  if (!abierto) return null
  return (
    <section className="panel-cinta" style={pos} aria-label={titulo}>
      <header><b>{titulo}</b><button className="chico" onClick={onClose}><Icono n="x" size={14} />Cerrar</button></header>
      <div className="cajon-cuerpo">{children}</div>
    </section>
  )
}

// Mosaico (tarjeta con título y acción opcional)
export const Mosaico = ({ titulo, accion, onAccion, children, className = '', style }) => (
  <section className={`mosaico ${className}`} style={style}>
    {(titulo || accion) && (
      <div className="mosaico-cab">
        {titulo && <h2>{titulo}</h2>}
        {accion && <button className="fantasma chico" onClick={onAccion}>{accion}<Icono n="flecha" size={14} /></button>}
      </div>
    )}
    {children}
  </section>
)
