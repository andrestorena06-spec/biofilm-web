import { useEffect, useMemo, useRef, useState } from 'react'
import { BarChart, ExcluirChart } from './charts.jsx'
import { Campo, Check, EstiloDialog, MenuContextual, Modal, Num, Panel, Select, useMenuContextual } from './ui.jsx'
import { leerPlaca, hojasDe, MODO } from '../api.js'
import {
  CLASES, COLOR_CLASE, FILAS, aCSV, coloresPocillos, descargarBlob, descargarTexto, estiloDefecto,
  exportarSVG, fmt, nombreReplica, pocillos96,
} from '../utils.js'

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

