import { useEffect, useMemo, useRef, useState } from 'react'
import { BarChart, ExcluirChart } from './charts.jsx'
import { Campo, Check, EstiloDialog, MenuContextual, Modal, Num, Panel, Select, useMenuContextual } from './ui.jsx'
import { leerPlaca, hojasDe, MODO } from '../api.js'
import {
  CLASES, COLOR_CLASE, FILAS, aCSV, coloresPocillos, descargarBlob, descargarTexto, estiloDefecto,
  exportarSVG, fmt, nombreReplica, pocillos96,
} from '../utils.js'

// ===============================================================
// ARCHIVO
// ===============================================================
export function ArchivoTab({ s }) {
  const [nueva, setNueva] = useState('')
  const [edit, setEdit] = useState(null)
  const [cargando, setCargando] = useState(false)
  const inputRef = useRef()
  const sesionRef = useRef()
  const layoutRef = useRef()

  async function abrir(file, hoja) {
    setCargando(true)
    try {
      let hojas = s.archivo?.hojas
      if (!hoja || file !== s.archivo?.file) {
        hojas = (await hojasDe(file)).hojas
        hoja = hojas[0]
      }
      const r = await leerPlaca(file, hoja)
      s.setArchivo({ file, nombre: file.name, hoja, hojas })
      s.setPlaca({ datos: r.datos, onda: r.onda, fecha: r.fecha, preview: r.preview })
      s.avisar(`Archivo leído: ${r.datos.length} pocillos con datos.`)
    } catch (e) {
      s.avisar(e.message, 'error')
    }
    setCargando(false)
  }

  const exportarLayout = () => {
    const filas = [...s.config].sort((a, b) => pocillos96().indexOf(a.Pocillo) - pocillos96().indexOf(b.Pocillo))
      .map((c) => ({ Pocillo: c.Pocillo, Muestra: c.Muestra, Replica: c.Replica, Blanco: c.EsBlanco ? 1 : 0 }))
    descargarTexto(aCSV(filas, ['Pocillo', 'Muestra', 'Replica', 'Blanco']), 'layout_placa.csv')
  }

  const importarLayout = async (file) => {
    const txt = (await file.text()).replace(/^﻿/, '')
    const lineas = txt.split(/\r?\n/).filter(Boolean)
    const sep = lineas[0].includes(';') ? ';' : ','
    const cab = lineas[0].split(sep).map((x) => x.trim().toLowerCase())
    const ix = (n) => cab.findIndex((c) => n.includes(c))
    const iP = ix(['pocillo', 'well']), iM = ix(['muestra', 'sample']), iR = ix(['replica', 'rep']), iB = ix(['blanco', 'blank', 'esblanco'])
    if (iP < 0 || iM < 0) return s.avisar("El layout necesita las columnas 'Pocillo' y 'Muestra'.", 'error')
    const disp = new Set(s.placa?.datos.map((d) => d.Pocillo))
    const cfg = []
    for (const l of lineas.slice(1)) {
      const c = l.split(sep).map((x) => x.trim().replace(/^"|"$/g, ''))
      const p = c[iP]?.toUpperCase().replace(/^([A-H])0+(\d)/, '$1$2')
      if (!p || !disp.has(p) || !c[iM] || cfg.some((x) => x.Pocillo === p)) continue
      cfg.push({ Pocillo: p, Muestra: c[iM], Replica: iR >= 0 ? Number(c[iR]) || 0 : 0,
        EsBlanco: iB >= 0 && ['1', 'true', 'si', 'sí', 'yes', 'x'].includes((c[iB] || '').toLowerCase()) })
    }
    const ordenados = cfg.sort((a, b) => pocillos96().indexOf(a.Pocillo) - pocillos96().indexOf(b.Pocillo))
    const cont = {}
    ordenados.forEach((c) => { cont[c.Muestra] = (cont[c.Muestra] || 0) + 1; if (!c.Replica) c.Replica = cont[c.Muestra] })
    s.setConfig(ordenados)
    s.setMuestras([...new Set([...s.muestras, ...ordenados.map((c) => c.Muestra)])])
    s.avisar(`Layout importado: ${ordenados.length} pocillos.`)
  }

  const guardarSesion = () => descargarBlob(new Blob([JSON.stringify(s.exportarSesion(), null, 1)], { type: 'application/json' }), 'sesion_biofilm.json')
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
  return (
    <div className="pagina">
      <div className="rejilla-2">
        <section className="tarjeta">
          <h2>Archivo del lector</h2>
          {MODO === 'web' && (
            <p className="ayuda aviso-privacidad">Los cálculos se hacen en tu navegador: el archivo y los resultados <b>no se envían a ningún servidor</b>.</p>
          )}
          <div className="dropzone" onClick={() => inputRef.current.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => { e.preventDefault(); e.dataTransfer.files[0] && abrir(e.dataTransfer.files[0]) }}>
            <strong>{cargando ? 'Leyendo…' : s.archivo ? s.archivo.nombre : 'Soltá el Excel acá o hacé clic para elegirlo'}</strong>
            <span>.xlsx · .xls · .csv · .txt</span>
          </div>
          <input ref={inputRef} type="file" hidden accept=".xlsx,.xls,.csv,.txt" onChange={(e) => e.target.files[0] && abrir(e.target.files[0])} />
          {s.archivo?.hojas?.length > 1 && (
            <Campo label="Hoja del Excel">
              <Select value={s.archivo.hoja} onChange={(h) => abrir(s.archivo.file, h)} opciones={s.archivo.hojas.map((h) => [h, h])} />
            </Campo>
          )}
          {p && (
            <dl className="datos">
              <dt>Pocillos con dato</dt><dd>{p.datos.length}</dd>
              <dt>Longitud de onda</dt><dd>{Number.isFinite(p.onda) ? `${p.onda} nm` : 'no encontrada'}</dd>
              <dt>Fecha de lectura</dt><dd>{p.fecha || 'no encontrada'}</dd>
              <dt>OD mín. / máx.</dt><dd>{fmt(Math.min(...p.datos.map((d) => d.OD)))} / {fmt(Math.max(...p.datos.map((d) => d.OD)))}</dd>
            </dl>
          )}
        </section>

        <section className="tarjeta">
          <h2>Muestras</h2>
          <div className="fila-ctrl">
            <input className="grande" placeholder="Nombre de la muestra y Enter (ej.: L100)" value={nueva}
              onChange={(e) => setNueva(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && agregar()} />
            <button className="primario" onClick={agregar}>Agregar</button>
          </div>
          <ul className="lista-muestras">
            {s.muestras.map((m, i) => {
              const n = s.config.filter((c) => c.Muestra === m).length
              return (
                <li key={m}>
                  <span><b>{m}</b>{n > 0 && <small> ({n} {n === 1 ? 'pocillo' : 'pocillos'})</small>}</span>
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
      </div>

      <div className="rejilla-2">
        <section className="tarjeta">
          <h2>Sesión</h2>
          <p className="ayuda">Guarda la configuración, muestras, exclusiones y ajustes. Para recuperarla, cargá primero el Excel y después la sesión.</p>
          <div className="fila-ctrl">
            <button onClick={guardarSesion}>Guardar sesión</button>
            <button onClick={() => sesionRef.current.click()}>Cargar sesión</button>
            <input ref={sesionRef} type="file" hidden accept=".json" onChange={(e) => e.target.files[0] && cargarSesion(e.target.files[0])} />
          </div>
        </section>
        <section className="tarjeta">
          <h2>Layout de la placa</h2>
          <p className="ayuda">CSV con las columnas Pocillo, Muestra y, opcionalmente, Replica y Blanco (1/0).</p>
          <div className="fila-ctrl">
            <button onClick={exportarLayout} disabled={!s.config.length}>Exportar CSV</button>
            <button onClick={() => layoutRef.current.click()} disabled={!p}>Importar CSV</button>
            <input ref={layoutRef} type="file" hidden accept=".csv,.txt" onChange={(e) => e.target.files[0] && importarLayout(e.target.files[0])} />
          </div>
        </section>
      </div>

      {p?.preview && (
        <section className="tarjeta">
          <h2>Vista previa del archivo</h2>
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

      {edit && (
        <Modal titulo="Modificar muestra" onClose={() => setEdit(null)}
          pie={<><button onClick={() => setEdit(null)}>Cancelar</button>
            <button className="primario" onClick={() => { s.renombrarMuestra(edit.viejo, edit.nuevo.trim()); setEdit(null) }}>Guardar</button></>}>
          <Campo label="Nuevo nombre"><input autoFocus value={edit.nuevo} onChange={(e) => setEdit({ ...edit, nuevo: e.target.value })} /></Campo>
          <p className="ayuda">El cambio también se aplica a los pocillos que ya usan esta muestra.</p>
        </Modal>
      )}
    </div>
  )
}

// ===============================================================
// PLACA
// ===============================================================
export function PlacaTab({ s }) {
  const [arr, setArr] = useState(null) // {f,c} inicio
  const [act, setAct] = useState(null)
  const [sel, setSel] = useState(null) // pocillos seleccionados para el modal
  const [muestra, setMuestra] = useState('')
  const [blanco, setBlanco] = useState(false)
  const [confirmar, setConfirmar] = useState(false)

  const disp = useMemo(() => new Set(s.placa?.datos.map((d) => d.Pocillo)), [s.placa])
  const cols = useMemo(() => coloresPocillos(s.config), [s.config])
  const cfgDe = (p) => s.config.find((c) => c.Pocillo === p)

  const rect = arr && act
    ? { f1: Math.min(arr.f, act.f), f2: Math.max(arr.f, act.f), c1: Math.min(arr.c, act.c), c2: Math.max(arr.c, act.c) }
    : null
  const enRect = (f, c) => rect && f >= rect.f1 && f <= rect.f2 && c >= rect.c1 && c <= rect.c2

  useEffect(() => {
    const up = () => {
      if (!arr) return
      if (rect) {
        const ids = []
        for (let f = rect.f1; f <= rect.f2; f++) for (let c = rect.c1; c <= rect.c2; c++) {
          const p = FILAS[f] + (c + 1)
          if (disp.has(p)) ids.push(p)
        }
        if (ids.length) {
          const info = ids.map(cfgDe).filter(Boolean)
          const nombres = [...new Set(info.map((i) => i.Muestra))]
          // si todos los pocillos ya tienen la MISMA muestra, se muestra seleccionada (como en un pocillo solo)
          const unica = info.length === ids.length && nombres.length === 1
          const estadosBlanco = [...new Set(info.map((i) => !!i.EsBlanco))]
          setSel(ids)
          setMuestra(unica ? nombres[0] : '')
          setBlanco(estadosBlanco.length === 0 ? false : estadosBlanco.length === 1 ? estadosBlanco[0] : null)
        }
      }
      setArr(null); setAct(null)
    }
    window.addEventListener('mouseup', up)
    return () => window.removeEventListener('mouseup', up)
  })

  const guardar = () => {
    const m = muestra.trim()
    if (!m) return s.avisar('Tenés que indicar una muestra.', 'error')
    const nombre = s.muestras.find((x) => x.toLowerCase() === m.toLowerCase()) || m
    if (!s.muestras.includes(nombre)) s.setMuestras([...s.muestras, nombre])
    let cfg = [...s.config]
    for (const p of sel) {
      const previo = cfg.find((c) => c.Pocillo === p)
      const otros = cfg.filter((c) => c.Pocillo !== p)
      let rep
      if (previo && previo.Muestra === nombre) rep = previo.Replica
      else {
        const ex = otros.filter((c) => c.Muestra === nombre).map((c) => c.Replica)
        rep = ex.length ? Math.max(...ex) + 1 : 1
      }
      // blanco === null: la selección era mixta y no se tocó; cada pocillo conserva su estado
      cfg = [...otros, { Pocillo: p, Muestra: nombre, Replica: rep, EsBlanco: blanco === null ? !!previo?.EsBlanco : blanco }]
    }
    s.setConfig(cfg)
    s.avisar(sel.length === 1 ? `${sel[0]} configurado como ${nombre}` : `${sel.length} pocillos configurados como ${nombre}`)
    setSel(null)
  }
  const quitar = () => { s.setConfig(s.config.filter((c) => !sel.includes(c.Pocillo))); setSel(null) }

  if (!s.placa) return <Vacio texto="Primero cargá el archivo del lector en la pestaña Archivo." />

  const resumen = [...new Set(s.config.map((c) => c.Muestra))].map((m) => {
    const g = s.config.filter((c) => c.Muestra === m)
    return { m, n: g.length, b: g.filter((c) => c.EsBlanco).length, reps: g.map((c) => c.Replica).sort((a, b) => a - b).join(', ') }
  })

  return (
    <div className="con-lateral lateral-der">
      <div className="principal">
        <h1>Placa de 96 pocillos</h1>
        <p className="ayuda">Hacé clic en un pocillo, o clic y arrastrá para seleccionar varios. Elegí una muestra de la lista o escribí una nueva; la réplica se asigna sola. Si es medio sin inocular, marcá «Definir como blanco».</p>
        <div className="placa-wrap">
          <table className="placa">
            <thead><tr><th />{Array.from({ length: 12 }, (_, i) => <th key={i}>{i + 1}</th>)}</tr></thead>
            <tbody>
              {FILAS.map((f, fi) => (
                <tr key={f}>
                  <th>{f}</th>
                  {Array.from({ length: 12 }, (_, ci) => {
                    const p = f + (ci + 1)
                    const c = cfgDe(p)
                    const ok = disp.has(p)
                    const enSel = ok && enRect(fi, ci)
                    return (
                      <td key={p}
                        onMouseDown={(e) => { if (e.button === 0 && ok) { e.preventDefault(); setArr({ f: fi, c: ci }); setAct({ f: fi, c: ci }) } }}
                        onMouseEnter={() => arr && setAct({ f: fi, c: ci })}>
                        <div className={`pocillo ${!ok ? 'sin-datos' : ''} ${enSel ? 'sel' : ''} ${c ? 'asig' : ''}`}
                          style={c && !enSel ? { background: cols[p] } : undefined}>
                          {!ok ? <><b>Sin datos</b><small>{p}</small></>
                            : c ? <><b>{nombreReplica(c.Muestra, c.Replica)}</b><small>{c.EsBlanco ? `${p} · blanco` : p}</small></>
                              : <><b>Libre</b><small>{p}</small></>}
                        </div>
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <Panel titulo="Configuración">
        <button className="peligro ancho" disabled={!s.config.length} onClick={() => setConfirmar(true)}>Limpiar configuración</button>
        {resumen.length === 0 ? <p className="ayuda">Todavía no hay pocillos configurados.</p> : (
          <>
            <h3>Pocillos configurados: {s.config.length}</h3>
            {resumen.map((r) => (
              <div key={r.m} className="resumen-m">
                <b>{r.m}</b>
                <span>{r.n} {r.n === 1 ? 'pocillo' : 'pocillos'}{r.b > 0 && ` (${r.b} blanco)`}</span>
                <span>Réplicas: {r.reps}</span>
              </div>
            ))}
          </>
        )}
      </Panel>

      {sel && (
        <Modal titulo={sel.length > 1 ? `Configurar ${sel.length} pocillos` : `Configurar pocillo ${sel[0]}`} onClose={() => setSel(null)}
          pie={<>
            <button onClick={() => setSel(null)}>Cancelar</button>
            {sel.some(cfgDe) && <button className="peligro" onClick={quitar}>Quitar</button>}
            <button className="primario" onClick={guardar}>Guardar</button></>}>
          {sel.length > 1 && <p><b>Pocillos:</b> {sel.join(', ')}</p>}
          {sel.length > 1 && (() => {
            const cnt = {}
            let libres = 0
            sel.forEach((p) => { const c = cfgDe(p); if (c) cnt[c.Muestra] = (cnt[c.Muestra] || 0) + 1; else libres++ })
            const partes = Object.entries(cnt).map(([m, n]) => `${m} (${n})`)
            if (libres) partes.push(`sin asignar (${libres})`)
            const varias = Object.keys(cnt).length > 1 || (Object.keys(cnt).length === 1 && libres > 0)
            return (
              <p className={varias ? 'aviso-sel' : 'ayuda'}>
                {varias ? 'La selección tiene distintas muestras: ' : 'Muestra actual de la selección: '}{partes.join(' · ')}.
                {varias && ' Elegí una para asignarla a todos los pocillos seleccionados.'}
              </p>
            )
          })()}
          <Campo label="Muestra">
            <input autoFocus value={muestra} placeholder="Elegí una muestra de la lista o escribí una nueva"
              onChange={(e) => setMuestra(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && guardar()} />
          </Campo>
          {(() => {
            const todas = [...new Set([...s.muestras, ...s.config.map((c) => c.Muestra)])]
            const existe = todas.some((m) => m.toLowerCase() === muestra.trim().toLowerCase())
            return (
              <>
                <div className="opciones-muestra" role="listbox">
                  {todas.map((m) => {
                    const n = s.config.filter((c) => c.Muestra === m).length
                    return (
                      <button key={m} role="option" aria-selected={m.toLowerCase() === muestra.trim().toLowerCase()}
                        className={m.toLowerCase() === muestra.trim().toLowerCase() ? 'on' : ''} onClick={() => setMuestra(m)}>
                        <span>{m}</span>{n > 0 && <small>{n} {n === 1 ? 'pocillo' : 'pocillos'}</small>}
                      </button>
                    )
                  })}
                </div>
                {muestra.trim() && !existe && <p className="ayuda">Se creará la muestra nueva «{muestra.trim()}».</p>}
              </>
            )
          })()}
          <label className="check">
            <input type="checkbox" checked={blanco === true} ref={(el) => { if (el) el.indeterminate = blanco === null }}
              onChange={() => setBlanco(blanco === true ? false : true)} />
            <span>Definir como blanco{blanco === null && <small>Mixto: algunos pocillos son blanco y otros no. Si no lo cambiás, cada uno conserva su estado.</small>}</span>
          </label>
          <p className="ayuda">{sel.length > 1 ? 'A cada pocillo se le asigna un número de réplica automático, en orden por filas.' : 'La réplica se asigna sola según cuántas veces uses esta muestra.'}</p>
        </Modal>
      )}
      {confirmar && (
        <Modal titulo="Limpiar configuración" onClose={() => setConfirmar(false)}
          pie={<><button onClick={() => setConfirmar(false)}>Cancelar</button>
            <button className="peligro" onClick={() => { s.setConfig([]); setConfirmar(false) }}>Sí, limpiar</button></>}>
          ¿Querés eliminar toda la configuración de los pocillos?
        </Modal>
      )}
    </div>
  )
}

export const Vacio = ({ texto }) => <div className="vacio">{texto}</div>

// ===============================================================
// ANÁLISIS (ODc + mapa)
// ===============================================================
export function AnalisisTab({ s }) {
  const [det, setDet] = useState(null)
  const a = s.analisis
  if (!a?.estado?.length || !s.placa) return <Vacio texto="Configurá los pocillos para ver el mapa de la placa." />
  const odc = a.odc.odc
  const finito = Number.isFinite(odc)
  const mapa = {}
  const datos = Object.fromEntries(s.placa.datos.map((d) => [d.Pocillo, d.OD]))
  const est = Object.fromEntries(a.estado.map((e) => [e.Pocillo, e]))
  const clasif = (od) => {
    if (!finito) return null
    return od <= odc ? CLASES[0] : od <= 2 * odc ? CLASES[1] : od <= 4 * odc ? CLASES[2] : CLASES[3]
  }
  const categoria = (p) => {
    const od = datos[p]
    if (!Number.isFinite(od)) return 'Sin datos'
    const e = est[p]
    if (!e) return 'Sin asignar'
    if (!e.Usado) return 'Excluido'
    if (e.EsBlanco) return 'Blanco'
    return clasif(od) || 'Sin clasificar'
  }
  const fondo = { ...COLOR_CLASE, 'Sin asignar': '#fff', 'Sin clasificar': '#fff', 'Sin datos': '#f4f6f9', Excluido: '#dfe3e8' }
  const blancos = a.blancos || []
  const usados = s.blancosUsados ?? blancos

  const refs = [
    ['No productor', finito ? `OD ≤ ${fmt(odc)}` : ''],
    ['Productor débil', finito ? `${fmt(odc)} < OD ≤ ${fmt(2 * odc)}` : ''],
    ['Productor moderado', finito ? `${fmt(2 * odc)} < OD ≤ ${fmt(4 * odc)}` : ''],
    ['Productor fuerte', finito ? `OD > ${fmt(4 * odc)}` : ''],
    ['Blanco', 'medio sin inocular'], ['Excluido', 'fuera del análisis'],
  ]

  const abrir = (p) => {
    if (!Number.isFinite(datos[p])) return
    setDet(p)
  }
  const dp = det && est[det]

  return (
    <div className="con-lateral">
      <Panel titulo="Punto de corte (ODc)">
        <div className="kpi"><span>Blancos aceptados</span><b>{a.odc.n}</b></div>
        <div className="kpi"><span>Media de blancos</span><b>{fmt(a.odc.media, 4)}</b></div>
        <div className="kpi"><span>Desv. estándar de blancos</span><b>{fmt(a.odc.sd, 4)}</b></div>
        <div className="kpi odc"><span>ODc = media + 3 × DE</span><b>{fmt(odc, 4)}</b></div>
        {!finito && <p className="ayuda">Se necesitan al menos 2 pocillos blanco aceptados para calcular el ODc.</p>}
        {blancos.length > 0 ? (
          <>
            <h3>Blancos usados para el ODc</h3>
            {blancos.map((b) => (
              <Check key={b} label={b} checked={usados.includes(b)}
                onChange={(v) => s.setBlancosUsados(v ? [...usados, b] : usados.filter((x) => x !== b))} />
            ))}
          </>
        ) : <p className="ayuda">No hay blancos definidos. Marcá «Definir como blanco» al configurar los pocillos del medio.</p>}
        <h3>Criterio de clasificación</h3>
        <div className="reglas">
          {refs.slice(0, 4).map(([c, t]) => (
            <div key={c}><i className="chip" style={{ background: COLOR_CLASE[c] }} /><b>{c}</b><span>{t}</span></div>
          ))}
          <small>Stepanović et al. (2000). Cada muestra se clasifica con la media de sus réplicas aceptadas.</small>
        </div>
      </Panel>
      <div className="principal">
        <h1>Mapa de la placa <span className="sub">· {s.ejeOD}</span></h1>
        <div className="mapa-wrap">
          <table className="placa mapa">
            <thead><tr><th />{Array.from({ length: 12 }, (_, i) => <th key={i}>{i + 1}</th>)}</tr></thead>
            <tbody>
              {FILAS.map((f) => (
                <tr key={f}><th>{f}</th>
                  {Array.from({ length: 12 }, (_, ci) => {
                    const p = f + (ci + 1)
                    const cat = categoria(p)
                    const e = est[p]
                    const oscuro = cat === CLASES[3]
                    return (
                      <td key={p} onClick={() => abrir(p)}>
                        <div className={`celda-mapa ${cat === 'Sin datos' ? 'sin-datos' : ''}`}
                          style={{ background: fondo[cat], color: oscuro ? '#fff' : '#1f2933',
                            border: cat === 'Excluido' ? '2px solid #c0392b' : '1px solid rgba(0,0,0,.12)' }}>
                          {Number.isFinite(datos[p]) && <b>{fmt(datos[p])}</b>}
                          {e && <><span>{e.Muestra}</span><small>R{e.Replica}</small></>}
                        </div>
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="leyenda">
          {refs.map(([c, t]) => (
            <span key={c}><i className="chip" style={{ background: fondo[c], border: c === 'Excluido' ? '2px solid #c0392b' : undefined }} /><b>{c}</b> {t}</span>
          ))}
        </div>
        <p className="ayuda">Hacé clic en un pocillo para ver cómo se calculó su clasificación y para excluirlo o incluirlo.</p>
      </div>

      {det && (
        <Modal titulo={dp ? `Pocillo ${det} – ${dp.Muestra} (réplica ${dp.Replica})` : `Pocillo ${det}`} onClose={() => setDet(null)}
          pie={<><button onClick={() => setDet(null)}>Cerrar</button>
            {dp && <button className="primario" onClick={() => { s.alternarPocillo(det); setDet(null) }}>
              {dp.Usado ? 'Excluir este pocillo' : dp.Manual ? 'Volver a incluir' : 'Conservar pese a Hampel'}</button>}</>}>
          <dl className="datos">
            <dt>OD</dt><dd>{fmt(datos[det])}</dd>
            <dt>Clasificación</dt><dd>{!dp ? 'Sin muestra asignada' : dp.EsBlanco ? 'Blanco (no se clasifica)' : finito ? clasif(datos[det]) : 'Sin ODc: faltan blancos'}</dd>
            {dp && <><dt>Estado</dt><dd>{dp.Usado ? 'Aceptado' : 'Excluido'}</dd></>}
          </dl>
          {dp && <p>{dp.Manual ? 'Excluido manualmente.' : dp.Motivo || 'Aceptado: dentro del límite de Hampel o con menos de 3 pocillos en su muestra.'}</p>}
        </Modal>
      )}
    </div>
  )
}

