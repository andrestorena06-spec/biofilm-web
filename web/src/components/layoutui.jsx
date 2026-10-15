import { useRef, useState } from 'react'
import { Nota } from './tip.jsx'
import { Campo } from './ui.jsx'
import { aCSV, descargarTexto, pocillos96 } from '../utils.js'

// Medio de cultivo y layout de la placa activa (menú «Placa»):
//  - medio de cultivo de la placa (las placas con el mismo medio se agrupan solas en «Comparar»)
//  - exportar / importar el layout en CSV, copiarlo de otra placa que ya lo tenga, o de a todas las placas
export function PanelLayoutMedio({ s }) {
  const layoutRef = useRef()
  const destinoLayout = useRef(false)   // true = el CSV va a todas las placas
  const [origen, setOrigen] = useState('')
  const act = s.a
  const hayDatos = !!act   // también sin Excel: la configuración se puede dejar lista de antemano

  const exportarLayout = () => {
    const filas = [...s.config].sort((a, b) => pocillos96().indexOf(a.Pocillo) - pocillos96().indexOf(b.Pocillo))
      .map((c) => ({ Pocillo: c.Pocillo, Muestra: c.Muestra, Replica: c.Replica, Blanco: c.EsBlanco ? 1 : 0 }))
    descargarTexto(aCSV(filas, ['Pocillo', 'Muestra', 'Replica', 'Blanco']), 'layout_placa.csv')
  }

  const importarLayout = async (file, aTodas) => {
    const txt = (await file.text()).replace(/^﻿/, '')
    const lineas = txt.split(/\r?\n/).filter(Boolean)
    if (!lineas.length) return s.avisar('El archivo está vacío.', 'error')
    const sep = lineas[0].includes(';') ? ';' : lineas[0].includes('\t') ? '\t' : ','
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

  const medioOtro = () => {
    const n = window.prompt('Nombre del medio de cultivo (por ejemplo LB, TSB, M9…)')
    if (n && n.trim()) s.setMedio(act.id, n.trim())
  }

  return (
    <>
      <h3>Placa</h3>
      <Campo label="Nombre de la placa">
        <input key={act?.id} defaultValue={act?.nombre || ''} disabled={!act}
          onBlur={(e) => { const v = e.target.value.trim(); if (act && v !== act.nombre) s.renombrarPlaca(act.id, v) }}
          onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()} />
      </Campo>      <h3>Medio de cultivo</h3>
      <Campo label="Medio usado en esta placa">
        <select value={act?.medio || ''} disabled={!act} onChange={(e) => (e.target.value === '__otro' ? medioOtro() : s.setMedio(act.id, e.target.value))}>
          <option value="">(sin indicar)</option>
          {s.medios.map((m) => <option key={m} value={m}>{m}</option>)}
          <option value="__otro">Otro medio…</option>
        </select>
      </Campo>
      <p className="ayuda"><Nota titulo="Ayuda">En «Comparar», las placas con el mismo medio se agrupan solas y se promedian.</Nota></p>

      <h3>Layout de la placa</h3>
      <div className="fila-ctrl">
        <button onClick={exportarLayout} disabled={!s.config.length}>Exportar CSV</button>
        <button onClick={() => { destinoLayout.current = false; layoutRef.current.click() }} disabled={!hayDatos}>Importar CSV</button>
        {s.placas.length > 1 && (
          <button onClick={() => { destinoLayout.current = true; layoutRef.current.click() }} disabled={!s.placas.length}>Importar CSV en todas</button>
        )}
        <input ref={layoutRef} type="file" hidden accept=".csv,.txt"
          onChange={(e) => { e.target.files[0] && importarLayout(e.target.files[0], destinoLayout.current); e.target.value = '' }} />
      </div>
      {s.placas.length > 1 && (
        <>
          <Campo label="Usar el layout de otra placa">
            <div className="fila-ctrl" style={{ margin: 0 }}>
              <select value={origen} onChange={(e) => setOrigen(e.target.value)} style={{ flex: 1, minWidth: 0 }}>
                <option value="">Elegí una placa con layout…</option>
                {s.placas.filter((x) => x.id !== s.activaId && x.config.length > 0).map((x) => (
                  <option key={x.id} value={x.id}>{x.nombre} ({x.config.length} pocillos)</option>
                ))}
              </select>
              <button className="primario" disabled={!origen || !hayDatos} onClick={() => { s.copiarLayoutDe(origen, s.activaId); setOrigen('') }}>Aplicar</button>
            </div>
          </Campo>
          <button className="ancho" disabled={!s.config.length} onClick={() => s.copiarConfig()}>Copiar este layout a las demás placas</button>
          <Campo label="Placas nuevas: copiarles el layout de">
            <select value={s.opts.archivo.layoutBase} onChange={(e) => s.setOpts({ ...s.opts, archivo: { ...s.opts.archivo, layoutBase: e.target.value } })}>
              <option value="">(ninguna)</option>
              {s.placas.filter((x) => x.config.length > 0).map((x) => <option key={x.id} value={x.id}>{x.nombre}</option>)}
            </select>
          </Campo>
        </>
      )}
      <p className="ayuda"><Nota titulo="Ayuda">CSV con las columnas Pocillo, Muestra y, opcionalmente, Replica y Blanco (1/0). Después de copiar un layout, los cambios afectan solo a la placa activa.</Nota></p>
      <hr />
    </>
  )
}
