import { useEffect, useRef, useState } from 'react'
import { Icono } from './iconos.jsx'

// Ventana: título arriba, cuerpo con desplazamiento y botones abajo. Se cierra con Esc o con un clic afuera.
export function Modal({ titulo, children, pie, onClose, ancho = 520 }) {
  useEffect(() => {
    const f = (e) => e.key === 'Escape' && onClose && onClose()
    window.addEventListener('keydown', f)
    return () => window.removeEventListener('keydown', f)
  }, [onClose])
  return (
    <div className="velo" onMouseDown={(e) => e.target === e.currentTarget && onClose && onClose()}>
      <div className="modal" style={{ maxWidth: ancho }} role="dialog" aria-modal="true">
        <header><b>{titulo}</b>{onClose && <button className="fantasma icono" aria-label="Cerrar" onClick={onClose}><Icono n="x" /></button>}</header>
        <div className="cuerpo">{children}</div>
        {pie && <footer>{pie}</footer>}
      </div>
    </div>
  )
}

export const Check = ({ label, checked, onChange, ayuda }) => (
  <label className="check">
    <input type="checkbox" checked={!!checked} onChange={(e) => onChange(e.target.checked)} />
    <span>{label}{ayuda && <small>{ayuda}</small>}</span>
  </label>
)

export const Campo = ({ label, children, style }) => (
  <div className="campo" style={style}><label>{label}</label>{children}</div>
)

export const Select = ({ value, onChange, opciones, style }) => (
  <select value={value} onChange={(e) => onChange(e.target.value)} style={style}>
    {opciones.map(([v, t]) => <option key={v} value={v}>{t}</option>)}
  </select>
)

// Número con texto libre: acepta coma o punto decimal, vacío y valores a medio escribir («0,» o «0,0»).
// Solo avisa cuando lo escrito es un número; al salir del campo se ajusta al mínimo y al máximo.
export const aNumero = (t) => { const s = String(t ?? '').trim().replace(',', '.'); return s === '' ? NaN : Number(s) }
const aTexto = (v) => (v === '' || v === null || v === undefined || Number.isNaN(v) ? '' : String(v).replace('.', ','))
export function Num({ value, onChange, min, max, placeholder, style, ancho }) {
  const [txt, setTxt] = useState(aTexto(value))
  const ultimo = useRef(value)
  useEffect(() => { if (value !== ultimo.current) { setTxt(aTexto(value)); ultimo.current = value } }, [value])
  const acotar = (n) => (Number.isFinite(min) && n < min ? min : Number.isFinite(max) && n > max ? max : n)
  return (
    <input className="num" inputMode="decimal" value={txt} placeholder={placeholder} style={{ width: ancho, ...style }}
      onChange={(e) => {
        const t = e.target.value
        setTxt(t)
        if (t.trim() === '') { ultimo.current = ''; onChange(''); return }
        const n = aNumero(t)
        if (Number.isFinite(n)) { ultimo.current = n; onChange(n) }
      }}
      onBlur={() => {
        const n = aNumero(txt)
        if (!Number.isFinite(n)) { setTxt(aTexto(value)); return }
        const a = acotar(n)
        setTxt(aTexto(a))
        if (a !== value) { ultimo.current = a; onChange(a) }
      }} />
  )
}

// Selector segmentado (opciones excluyentes)
export const Seg = ({ value, onChange, opciones }) => (
  <div className="seg">
    {opciones.map(([v, t, tip]) => <button key={v} type="button" className={value === v ? 'on' : ''} data-tip={tip} onClick={() => onChange(v)}>{t}</button>)}
  </div>
)

// ---- Menú contextual (clic derecho sobre un gráfico o una placa) ----
export function useMenuContextual() {
  const [menu, setMenu] = useState(null)
  useEffect(() => {
    if (!menu) return
    const cerrar = () => setMenu(null)
    const tecla = (e) => e.key === 'Escape' && cerrar()
    window.addEventListener('click', cerrar)
    window.addEventListener('scroll', cerrar, true)
    window.addEventListener('keydown', tecla)
    return () => {
      window.removeEventListener('click', cerrar)
      window.removeEventListener('scroll', cerrar, true)
      window.removeEventListener('keydown', tecla)
    }
  }, [menu])
  const abrir = (e) => {
    e.preventDefault()
    setMenu({ x: Math.min(e.clientX, window.innerWidth - 240), y: Math.min(e.clientY, window.innerHeight - 160) })
  }
  return [menu, abrir, () => setMenu(null)]
}

export function MenuContextual({ menu, items }) {
  if (!menu) return null
  return (
    <div className="menu-contextual" style={{ left: menu.x, top: menu.y }}>
      {items.map(([t, f]) => <button key={t} onClick={f}>{t}</button>)}
    </div>
  )
}

// Rango del eje Y (clic derecho sobre el gráfico). Un extremo vacío queda automático.
export function RangoDialog({ est, onGuardar, onClose }) {
  const [mn, setMn] = useState(est?.rango && Number.isFinite(est.rango.min) ? est.rango.min : '')
  const [mx, setMx] = useState(est?.rango && Number.isFinite(est.rango.max) ? est.rango.max : '')
  const a = mn === '' ? null : mn, b = mx === '' ? null : mx
  const mal = a !== null && b !== null && !(b > a)
  const aplicar = () => { if (mal) return; const r = { ...(est || {}) }; if (a === null && b === null) delete r.rango; else r.rango = { min: a, max: b }; onGuardar(r) }
  return (
    <Modal titulo="Rango del eje Y" onClose={onClose} ancho={400}
      pie={<><button onClick={() => { const r = { ...(est || {}) }; delete r.rango; onGuardar(r) }}>Automático</button><button className="primario" disabled={mal} onClick={aplicar}>Aplicar</button></>}>
      <div className="fila" onKeyDown={(e) => e.key === 'Enter' && aplicar()}>
        <Campo label="Mínimo"><Num value={mn} placeholder="automático" onChange={setMn} /></Campo>
        <Campo label="Máximo"><Num value={mx} placeholder="automático" onChange={setMx} /></Campo>
      </div>
      {mal && <p className="aviso-sel">El máximo debe ser mayor que el mínimo.</p>}
      <p className="ayuda">Dejá un campo vacío para que ese extremo se ajuste solo. Los valores fuera del rango se apoyan en el borde del gráfico.</p>
    </Modal>
  )
}

// ---------------------------------------------------------------
// Ventana de estilo de texto: cada texto del gráfico se configura por separado
// ---------------------------------------------------------------
function BloqueEstilo({ titulo, v, onChange, conTexto, placeholder }) {
  const set = (k, x) => onChange({ ...v, [k]: x })
  const deco = [v.underline && 'underline', v.strike && 'line-through'].filter(Boolean).join(' ')
  return (
    <div className="bloque-estilo">
      <h4>{titulo}</h4>
      {conTexto && (
        <Campo label="Texto">
          <input value={v.texto || ''} placeholder={placeholder} onChange={(e) => set('texto', e.target.value)} />
        </Campo>
      )}
      <div className="fila fin">
        <Campo label="Tamaño (px)"><Num value={v.size} min={6} max={60} ancho={70} onChange={(x) => set('size', x === '' ? 12 : x)} /></Campo>
        <Campo label="Color"><input type="color" value={v.color} onChange={(e) => set('color', e.target.value)} /></Campo>
        <Campo label="Estilo">
          <div className="seg">
            <button data-tip="Negrita" className={v.bold ? 'on' : ''} onClick={() => set('bold', !v.bold)}><b>N</b></button>
            <button data-tip="Cursiva" className={v.italic ? 'on' : ''} onClick={() => set('italic', !v.italic)}><i>C</i></button>
            <button data-tip="Subrayado" className={v.underline ? 'on' : ''} onClick={() => set('underline', !v.underline)}><u>S</u></button>
            <button data-tip="Tachado" className={v.strike ? 'on' : ''} onClick={() => set('strike', !v.strike)}><s>T</s></button>
          </div>
        </Campo>
        <div className="muestra-estilo" style={{ fontSize: Math.min(v.size, 26), color: v.color, textDecoration: deco || 'none',
          fontWeight: v.bold ? 700 : 400, fontStyle: v.italic ? 'italic' : 'normal' }}>Abc 0.123</div>
      </div>
    </div>
  )
}

export function EstiloDialog({ estilo, conClases, ejeDefecto, onGuardar, onClose }) {
  const [e, setE] = useState(estilo)
  const up = (k) => (v) => setE({ ...e, [k]: v })
  return (
    <Modal titulo="Estilo de texto del gráfico" onClose={onClose} ancho={640}
      pie={<><button onClick={onClose}>Cancelar</button><button className="primario" onClick={() => onGuardar(e)}>Aplicar</button></>}>
      <p className="ayuda">Cada texto tiene su propio formato. Si dejás el texto vacío se usa el automático.</p>
      <BloqueEstilo titulo="Título del gráfico" v={e.titulo} onChange={up('titulo')} conTexto placeholder="(sin título)" />
      <BloqueEstilo titulo="Leyenda del eje Y" v={e.leyendaY} onChange={up('leyendaY')} conTexto placeholder={ejeDefecto} />
      <BloqueEstilo titulo="Leyenda del eje X" v={e.leyendaX} onChange={up('leyendaX')} conTexto placeholder="(sin leyenda)" />
      <BloqueEstilo titulo="Etiquetas del eje X (nombres de las muestras)" v={e.nombresX} onChange={up('nombresX')} />
      <BloqueEstilo titulo="Números del eje Y" v={e.numerosY} onChange={up('numerosY')} />
      <BloqueEstilo titulo="Valor medio (y error) sobre cada muestra" v={e.valores} onChange={up('valores')} />
      {conClases && <BloqueEstilo titulo="Marcaciones de clasificación" v={e.clases} onChange={up('clases')} />}
    </Modal>
  )
}

// Aviso cuando no hay nada para mostrar
export const Vacio = ({ texto, titulo, accion }) => (
  <div className="vacio">
    {titulo && <b>{titulo}</b>}
    <div>{texto}</div>
    {accion && <div style={{ marginTop: 14 }}>{accion}</div>}
  </div>
)

// Tamaño (en unidades de figura) del gráfico que se ve en pantalla: punto de partida de «Guardar imagen»
export const tamDe = (svg) => ({ w: svg.viewBox.baseVal.width, h: svg.viewBox.baseVal.height })
