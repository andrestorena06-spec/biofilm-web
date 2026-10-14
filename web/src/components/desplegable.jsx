import { useEffect, useRef, useState } from 'react'

// Botón que abre un panel con opciones. Los cambios se aplican al instante; se cierra con un clic afuera o con Esc.
export function Desplegable({ etiqueta, resumen, children, ancho = 300 }) {
  const [abierto, setAbierto] = useState(false)
  const ref = useRef(null)
  useEffect(() => {
    if (!abierto) return
    const fuera = (e) => { if (ref.current && !ref.current.contains(e.target)) setAbierto(false) }
    const tecla = (e) => { if (e.key === 'Escape') setAbierto(false) }
    document.addEventListener('mousedown', fuera)
    document.addEventListener('keydown', tecla)
    return () => { document.removeEventListener('mousedown', fuera); document.removeEventListener('keydown', tecla) }
  }, [abierto])
  return (
    <div className="desplegable" ref={ref}>
      <button type="button" className={`desplegable-btn ${abierto ? 'abierto' : ''}`} onClick={() => setAbierto(!abierto)} aria-expanded={abierto}>
        <span>{etiqueta}</span>
        {resumen && <small>{resumen}</small>}
        <i aria-hidden>{abierto ? '▴' : '▾'}</i>
      </button>
      {abierto && <div className="desplegable-panel" style={{ width: ancho }}>{children}</div>}
    </div>
  )
}
