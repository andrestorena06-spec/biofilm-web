// Datos del experimento: nombre, condiciones y notas; muestras y medios (agregar, ordenar, renombrar en todo el experimento o quitar)
import { useState } from 'react'
import { Icono } from './iconos.jsx'
import { Campo, Modal } from './ui.jsx'
import { renombrarMedio, renombrarMuestra, usosMedio, usosMuestra } from '../modelo.js'
import { paletaMuestras } from '../utils.js'
import { SEROTIPOS_SUG } from '../serotipos.js'

// Lista editable: cada fila conserva su nombre original para aplicar el renombre al guardar
// conSerotipo: cada muestra lleva su serotipo (para comparar serotipos en Estadística y agrupar en Gráfico)
function ListaNombres({ titulo, ayuda, filas, setFilas, usos, colores, placeholder, conSerotipo }) {
  const [nueva, setNueva] = useState('')
  const mover = (i, d) => { const f = [...filas]; const j = i + d; if (j < 0 || j >= f.length) return; [f[i], f[j]] = [f[j], f[i]]; setFilas(f) }
  const agregar = () => {
    const n = nueva.trim()
    if (!n || filas.some((x) => x.nombre.trim().toLowerCase() === n.toLowerCase())) return
    setFilas([...filas, { orig: null, nombre: n, quitar: false, sero: '' }])
    setNueva('')
  }
  return (
    <>
      <h3>{titulo}</h3>
      <p className="ayuda" style={{ marginTop: -4 }}>{ayuda}</p>
      <div className="lista-cepas-edit">
        {filas.map((f, i) => {
          const u = f.orig ? usos(f.orig) : 0
          return (
            <div key={(f.orig || '') + '|' + i} className={`fila ${f.quitar ? 'tachada' : ''}`}>
              {colores && <i className="punto" style={{ background: colores[f.orig] || 'var(--tenue)' }} />}
              <input value={f.nombre} disabled={f.quitar} onChange={(e) => setFilas(filas.map((x, k) => (k === i ? { ...x, nombre: e.target.value } : x)))} style={{ flex: 1 }} />
              {conSerotipo && <input value={f.sero || ''} disabled={f.quitar} list="sugerencias-serotipo" placeholder="serotipo" aria-label="Serotipo"
                data-tip={'Serotipo de la cepa (ej.: 1/2a, 1/2b, 4b)\nSirve para comparar serotipos en Estadística y para agrupar por serotipo en Gráfico › Comparar placas.\nDejalo vacío en los blancos o si no lo sabés.'}
                onChange={(e) => setFilas(filas.map((x, k) => (k === i ? { ...x, sero: e.target.value } : x)))} style={{ width: 78 }} />}
              <small className="ayuda" style={{ minWidth: 92 }}>{u ? `${u} ${usos.unidad}${u > 1 ? 's' : ''}` : 'sin usar'}</small>
              <button className="fantasma icono" aria-label="Subir" onClick={() => mover(i, -1)} disabled={i === 0} data-tip="Subir (orden en los gráficos)"><Icono n="abajo" size={15} style={{ transform: 'rotate(180deg)' }} /></button>
              <button className="fantasma icono" aria-label="Bajar" onClick={() => mover(i, 1)} disabled={i === filas.length - 1} data-tip="Bajar"><Icono n="abajo" size={15} /></button>
              <button className="fantasma icono" aria-label={f.quitar ? 'No quitar' : 'Quitar'} disabled={u > 0}
                data-tip={u > 0 ? 'Está en uso: no se puede quitar' : f.quitar ? 'No quitar' : 'Quitar de la lista'}
                onClick={() => setFilas(filas.map((x, k) => (k === i ? { ...x, quitar: !x.quitar } : x)))}><Icono n={f.quitar ? 'refrescar' : 'borrar'} size={15} /></button>
            </div>
          )
        })}
      </div>
      <div className="fila" style={{ marginTop: 8 }}>
        <input value={nueva} placeholder={placeholder} onChange={(e) => setNueva(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') agregar() }} style={{ flex: 1, maxWidth: 300 }} />
        <button onClick={agregar}><Icono n="mas" size={15} />Agregar</button>
      </div>
    </>
  )
}

export function EditarExperimento({ s, onClose }) {
  const { exp, upd, avisar } = s
  const [info, setInfo] = useState({ ...exp.info })
  const [muestras, setMuestras] = useState(exp.muestras.map((m) => ({ orig: m, nombre: m, quitar: false, sero: exp.serotipos?.[m] || '' })))
  const [medios, setMedios] = useState(exp.medios.map((m) => ({ orig: m, nombre: m, quitar: false })))
  const set = (k, v) => setInfo({ ...info, [k]: v })
  const usosM = Object.assign((m) => usosMuestra(exp, m), { unidad: 'pocillo' })
  const usosMd = Object.assign((m) => usosMedio(exp, m), { unidad: 'placa' })

  const repetido = (filas) => {
    const n = filas.filter((f) => !f.quitar).map((f) => f.nombre.trim().toLowerCase())
    return n.find((x, i) => !x || n.indexOf(x) !== i)
  }
  const guardar = () => {
    if (repetido(muestras) !== undefined) return avisar('Hay muestras con el mismo nombre o vacías.', 'error')
    if (repetido(medios) !== undefined) return avisar('Hay medios con el mismo nombre o vacíos.', 'error')
    upd((e) => {
      let x = { ...e, info: { ...e.info, ...info, nombre: info.nombre.trim() || e.info.nombre } }
      // renombres en dos pasos (nombre temporal) para permitir intercambiar dos nombres
      const ren = (filas, fn) => {
        const cambios = filas.filter((f) => f.orig && !f.quitar && f.nombre.trim() !== f.orig)
        cambios.forEach((f, i) => { x = fn(x, f.orig, `\u0000${i}`) })
        cambios.forEach((f, i) => { x = fn(x, `\u0000${i}`, f.nombre.trim()) })
      }
      ren(muestras, renombrarMuestra)
      ren(medios, renombrarMedio)
      x.muestras = muestras.filter((f) => !f.quitar).map((f) => f.nombre.trim())
      x.serotipos = Object.fromEntries(muestras.filter((f) => !f.quitar && (f.sero || '').trim()).map((f) => [f.nombre.trim(), f.sero.trim()]))
      x.medios = medios.filter((f) => !f.quitar).map((f) => f.nombre.trim())
      return x
    })
    avisar('Datos del experimento actualizados.')
    onClose()
  }
  return (
    <Modal titulo="Datos del experimento" onClose={onClose} ancho={760}
      pie={<><button onClick={onClose}>Cancelar</button><button className="primario" onClick={guardar}>Guardar cambios</button></>}>
      <div className="grilla-form">
        <Campo label="Nombre del experimento" style={{ gridColumn: '1 / -1' }}><input value={info.nombre} onChange={(e) => set('nombre', e.target.value)} /></Campo>
        <Campo label="Fecha"><input type="date" value={info.fecha || ''} onChange={(e) => set('fecha', e.target.value)} /></Campo>
        <Campo label="Organismo"><input value={info.organismo || ''} placeholder="Ej.: Listeria monocytogenes" onChange={(e) => set('organismo', e.target.value)} /></Campo>
        <Campo label="Responsable"><input value={info.responsable || ''} onChange={(e) => set('responsable', e.target.value)} /></Campo>
        <Campo label="Equipo (lector)"><input value={info.equipo || ''} placeholder="Ej.: Tecan Infinite M200" onChange={(e) => set('equipo', e.target.value)} /></Campo>
        <Campo label="Incubación"><input value={info.incubacion || ''} placeholder="Ej.: 48 h, estática" onChange={(e) => set('incubacion', e.target.value)} /></Campo>
        <Campo label="Temperatura (°C)"><input inputMode="decimal" value={info.temperatura ?? ''} placeholder="Ej.: 37" onChange={(e) => set('temperatura', e.target.value)} /></Campo>
        <Campo label="Tinción"><input value={info.tincion || ''} onChange={(e) => set('tincion', e.target.value)} /></Campo>
        <Campo label="Notas" style={{ gridColumn: '1 / -1' }}><textarea rows={3} value={info.notas || ''} placeholder="Inóculo, lavados, solubilización (etanol, ácido acético)…" onChange={(e) => set('notas', e.target.value)} /></Campo>
      </div>
      <div className="dos-columnas-editar">
        <div>
          <ListaNombres titulo="Muestras (cepas) y serotipo" ayuda="Al renombrar, el cambio se aplica en los pocillos de todas las placas, los gráficos y la estadística. El orden es el de los gráficos. El serotipo permite comparar serotipos."
            filas={muestras} setFilas={setMuestras} usos={usosM} colores={paletaMuestras(exp.muestras)} placeholder="Agregar muestra…" conSerotipo />
          <datalist id="sugerencias-serotipo">{SEROTIPOS_SUG.map((x) => <option key={x} value={x} />)}</datalist>
        </div>
        <div>
          <ListaNombres titulo="Medios de cultivo" ayuda="El medio de cada placa se elige en «Pocillos». Al renombrar, cambia en todas las placas."
            filas={medios} setFilas={setMedios} usos={usosMd} placeholder="Agregar medio (ej.: LB)…" />
        </div>
      </div>
    </Modal>
  )
}
