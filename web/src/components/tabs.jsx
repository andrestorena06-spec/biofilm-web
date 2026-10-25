import { useEffect, useMemo, useRef, useState } from 'react'
import { Nota } from './tip.jsx'
import { dDE, dMedia, dODc } from '../calculos.js'
import { Check, Campo, Modal, Vacio } from './ui.jsx'
import { BotonCinta, CampoCinta, Cinta, Grupo, InterruptorCinta } from './cinta.jsx'
import { GrupoBlanco } from './blanco.jsx'
import { CLASES, COLOR_CLASE, FILAS, aCSV, coloresPocillos, descargarTexto, fmt, nombreReplica, pocillos96 } from '../utils.js'

export { Vacio }

// Lee un layout en CSV (Pocillo, Muestra y opcionalmente Replica y Blanco)
async function leerLayout(file, avisar) {
  const txt = (await file.text()).replace(/^﻿/, '')
  const lineas = txt.split(/\r?\n/).filter(Boolean)
  if (!lineas.length) { avisar('El archivo está vacío.', 'error'); return null }
  const sep = lineas[0].includes(';') ? ';' : lineas[0].includes('\t') ? '\t' : ','
  const cab = lineas[0].split(sep).map((x) => x.trim().toLowerCase().replace(/^"|"$/g, ''))
  const ix = (n) => cab.findIndex((c) => n.includes(c))
  const iP = ix(['pocillo', 'well']), iM = ix(['muestra', 'sample']), iR = ix(['replica', 'réplica', 'rep']), iB = ix(['blanco', 'blank', 'esblanco'])
  if (iP < 0 || iM < 0) { avisar('El layout necesita las columnas «Pocillo» y «Muestra».', 'error'); return null }
  const validos = new Set(pocillos96())
  const cfg = []
  for (const l of lineas.slice(1)) {
    const c = l.split(sep).map((x) => x.trim().replace(/^"|"$/g, ''))
    const p = c[iP]?.toUpperCase().replace(/^([A-H])0+(\d)/, '$1$2')
    if (!p || !validos.has(p) || !c[iM] || cfg.some((x) => x.Pocillo === p)) continue
    cfg.push({ Pocillo: p, Muestra: c[iM], Replica: iR >= 0 ? Number(c[iR]) || 0 : 0,
      EsBlanco: iB >= 0 && ['1', 'true', 'si', 'sí', 'yes', 'x'].includes((c[iB] || '').toLowerCase()) })
  }
  if (!cfg.length) { avisar('Ningún pocillo válido (A1 a H12) con muestra en el layout.', 'error'); return null }
  const ord = cfg.sort((a, b) => pocillos96().indexOf(a.Pocillo) - pocillos96().indexOf(b.Pocillo))
  const cont = {}
  ord.forEach((c) => { cont[c.Muestra] = (cont[c.Muestra] || 0) + 1; if (!c.Replica) c.Replica = cont[c.Muestra] })
  return ord
}

// ===============================================================
// POCILLOS: qué muestra hay en cada pocillo, medio de la placa y layout
// ===============================================================
export function PlacaTab({ s }) {
  const [arr, setArr] = useState(null) // {f,c} inicio del arrastre
  const [act, setAct] = useState(null)
  const [sel, setSel] = useState(null) // pocillos seleccionados para la ventana
  const [muestra, setMuestra] = useState('')
  const [blanco, setBlanco] = useState(false)
  const [confirmar, setConfirmar] = useState(false)
  const [medioNuevo, setMedioNuevo] = useState(null)
  const layoutRef = useRef()
  const aTodas = useRef(false)

  // sin datos todavía: se pueden configurar los 96 pocillos de antemano
  const disp = useMemo(() => new Set(s.placa ? s.placa.datos.map((d) => d.Pocillo) : pocillos96()), [s.placa])
  const cols = useMemo(() => coloresPocillos(s.config), [s.config])
  const cfgDe = (p) => s.config.find((c) => c.Pocillo === p)
  const rect = arr && act ? { f1: Math.min(arr.f, act.f), f2: Math.max(arr.f, act.f), c1: Math.min(arr.c, act.c), c2: Math.max(arr.c, act.c) } : null
  const enRect = (f, c) => rect && f >= rect.f1 && f <= rect.f2 && c >= rect.c1 && c <= rect.c2

  // abre la ventana de configuración para un rectángulo de pocillos (arrastre, un toque o una fila/columna completa)
  const abrirRect = (r) => {
    const ids = []
    for (let f = r.f1; f <= r.f2; f++) for (let c = r.c1; c <= r.c2; c++) { const p = FILAS[f] + (c + 1); if (disp.has(p)) ids.push(p) }
    if (!ids.length) return
    const info = ids.map(cfgDe).filter(Boolean)
    const nombres = [...new Set(info.map((i) => i.Muestra))]
    const estadosBlanco = [...new Set(info.map((i) => !!i.EsBlanco))]
    setSel(ids)
    setMuestra(info.length === ids.length && nombres.length === 1 ? nombres[0] : '')
    setBlanco(estadosBlanco.length === 0 ? false : estadosBlanco.length === 1 ? estadosBlanco[0] : null)
  }
  useEffect(() => {
    const up = () => { if (!arr) return; if (rect) abrirRect(rect); setArr(null); setAct(null) }
    const cancelar = () => { setArr(null); setAct(null) }
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', cancelar)
    return () => { window.removeEventListener('pointerup', up); window.removeEventListener('pointercancel', cancelar) }
  })

  const guardar = (elegida) => {
    const m = (typeof elegida === 'string' ? elegida : muestra).trim()
    if (!m) return s.avisar('Tenés que indicar una muestra.', 'error')
    const nombre = s.muestras.find((x) => x.toLowerCase() === m.toLowerCase()) || m
    if (!s.muestras.includes(nombre)) s.setMuestras((ms) => [...ms, nombre])
    let cfg = [...s.config]
    for (const p of sel) {
      const previo = cfg.find((c) => c.Pocillo === p)
      const otros = cfg.filter((c) => c.Pocillo !== p)
      let rep
      if (previo && previo.Muestra === nombre) rep = previo.Replica
      else { const ex = otros.filter((c) => c.Muestra === nombre).map((c) => c.Replica); rep = ex.length ? Math.max(...ex) + 1 : 1 }
      // blanco === null: la selección era mixta y no se tocó; cada pocillo conserva su estado
      cfg = [...otros, { Pocillo: p, Muestra: nombre, Replica: rep, EsBlanco: blanco === null ? !!previo?.EsBlanco : blanco }]
    }
    s.setConfig(cfg)
    s.avisar(sel.length === 1 ? `${sel[0]} configurado como ${nombre}` : `${sel.length} pocillos configurados como ${nombre}`)
    setSel(null)
  }
  const quitar = () => { s.setConfig(s.config.filter((c) => !sel.includes(c.Pocillo))); setSel(null) }

  const exportarLayout = () => {
    const filas = [...s.config].sort((a, b) => pocillos96().indexOf(a.Pocillo) - pocillos96().indexOf(b.Pocillo))
      .map((c) => ({ Pocillo: c.Pocillo, Muestra: c.Muestra, Replica: c.Replica, Blanco: c.EsBlanco ? 1 : 0 }))
    descargarTexto(aCSV(filas, ['Pocillo', 'Muestra', 'Replica', 'Blanco']), `layout_${s.a.nombre.replace(/[^\w\- ]+/g, '_')}.csv`)
  }
  const importarLayout = async (file) => { const cfg = await leerLayout(file, s.avisar); if (cfg) s.aplicarLayout(cfg, aTodas.current) }
  const ponerMedio = (v) => (v === '__otro' ? setMedioNuevo('') : s.setMedio(s.a.id, v))

  const resumen = [...new Set(s.config.map((c) => c.Muestra))].map((m) => {
    const g = s.config.filter((c) => c.Muestra === m)
    return { m, n: g.length, b: g.filter((c) => c.EsBlanco).length, pocillos: g.map((c) => c.Pocillo).join(', ') }
  })
  const otrasConLayout = s.placas.filter((x) => x.id !== s.activaId && x.config.length > 0)

  return (
    <div>
      <Cinta>
        <Grupo titulo="Medio de cultivo">
          <CampoCinta etiqueta={`Medio de «${s.a.nombre}»`} tip="Las placas con el mismo medio se agrupan solas en el gráfico de comparación y en la estadística">
            <select value={s.a.medio || ''} onChange={(e) => ponerMedio(e.target.value)}>
              <option value="">(sin indicar)</option>
              {s.medios.map((m) => <option key={m} value={m}>{m}</option>)}
              <option value="__otro">Otro medio…</option>
            </select>
          </CampoCinta>
        </Grupo>
        <Grupo titulo="Layout">
          <BotonCinta icono="bajar" texto="Exportar CSV" onClick={exportarLayout} deshabilitado={!s.config.length} tip="Descarga la distribución de muestras (Pocillo, Muestra, Replica, Blanco)" />
          <BotonCinta icono="subir" texto="Importar CSV" onClick={() => { aTodas.current = false; layoutRef.current.click() }} tip="CSV con las columnas Pocillo y Muestra (y opcionalmente Replica y Blanco 1/0)" />
          {s.placas.length > 1 && <BotonCinta icono="placas" texto="CSV en todas" onClick={() => { aTodas.current = true; layoutRef.current.click() }} tip="Aplica el CSV a todas las placas (solo en los pocillos con datos de cada una)" />}
          {s.placas.length > 1 && <BotonCinta icono="copiar" texto="Copiar a las demás" onClick={s.copiarConfig} deshabilitado={!s.config.length} tip="Copia este layout a todas las demás placas (Ctrl + Z para deshacer)" />}
          {otrasConLayout.length > 0 && (
            <CampoCinta etiqueta="Usar el layout de" tip="Reemplaza el layout de esta placa por el de otra">
              <select value="" onChange={(e) => e.target.value && s.copiarLayoutDe(e.target.value, s.activaId)}>
                <option value="">Elegí una placa…</option>
                {otrasConLayout.map((x) => <option key={x.id} value={x.id}>{x.nombre} ({x.config.length})</option>)}
              </select>
            </CampoCinta>
          )}
          <input ref={layoutRef} type="file" hidden accept=".csv,.txt" onChange={(e) => { e.target.files[0] && importarLayout(e.target.files[0]); e.target.value = '' }} />
        </Grupo>
        <Grupo titulo="Pocillos">
          <BotonCinta icono="borrar" texto="Limpiar" peligro onClick={() => setConfirmar(true)} deshabilitado={!s.config.length} tip="Quita la configuración de todos los pocillos de esta placa" />
        </Grupo>
      </Cinta>

      {!s.placa && <p className="aviso-caja info">Esta placa todavía no tiene datos. Podés dejar lista la configuración de los pocillos; al cargar el Excel o escribir las OD en «Placas» se procesan solos.</p>}
      <section className="tarjeta">
        <div className="cabeza-tarjeta">
          <span className="etiqueta-seccion">Placa de 96 pocillos · {s.config.length} configurados</span>
          <span className="ayuda">Clic en un pocillo, o clic y arrastrá para elegir varios; clic en un número o una letra elige la columna o la fila entera.
            <Nota>Elegí una muestra de la lista o escribí una nueva y apretá Enter: la réplica se asigna sola. Los pocillos de medio sin inocular se marcan como «blanco» (sirven para el ODc).</Nota></span>
        </div>
        <div className="placa-wrap">
          <table className="placa">
            <thead><tr><th />{Array.from({ length: 12 }, (_, i) => <th key={i} className="enc-sel" onClick={() => abrirRect({ f1: 0, f2: 7, c1: i, c2: i })} data-tip={`Columna ${i + 1} completa`}>{i + 1}</th>)}</tr></thead>
            <tbody>
              {FILAS.map((f, fi) => (
                <tr key={f}>
                  <th className="enc-sel" onClick={() => abrirRect({ f1: fi, f2: fi, c1: 0, c2: 11 })} data-tip={`Fila ${f} completa`}>{f}</th>
                  {Array.from({ length: 12 }, (_, ci) => {
                    const p = f + (ci + 1)
                    const c = cfgDe(p)
                    const ok = disp.has(p)
                    const enSel = ok && enRect(fi, ci)
                    return (
                      <td key={p}
                        onPointerDown={(e) => { if (e.button === 0 && ok) { if (e.pointerType === 'mouse') e.preventDefault(); setArr({ f: fi, c: ci }); setAct({ f: fi, c: ci }) } }}
                        onPointerEnter={(e) => e.pointerType === 'mouse' && arr && setAct({ f: fi, c: ci })}>
                        <div className={`pocillo ${!ok ? 'sin-datos' : ''} ${enSel ? 'sel' : ''} ${c ? 'asig' : ''} ${c?.EsBlanco ? 'blanco' : ''}`}
                          style={c && !enSel ? { background: cols[p] } : undefined}>
                          {!ok ? <><b>—</b><small>{p}</small></>
                            : c ? <><b>{nombreReplica(c.Muestra, c.Replica)}</b><small>{c.EsBlanco ? `${p} · blanco` : p}</small></>
                              : <><b className="tenue">libre</b><small>{p}</small></>}
                        </div>
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {resumen.length > 0 && (
          <div className="leyenda-cepas">
            {resumen.map((r) => (
              <span key={r.m} data-tip={`${r.m}\n${r.n} ${r.n === 1 ? 'pocillo' : 'pocillos'}${r.b ? ` (${r.b} blanco)` : ''}: ${r.pocillos}`}>
                <i className="punto" style={{ background: cols[s.config.find((c) => c.Muestra === r.m)?.Pocillo] }} />{r.m} <small>× {r.n}{r.b ? ' · blanco' : ''}</small>
              </span>
            ))}
          </div>
        )}
      </section>

      {sel && (
        <Modal titulo={sel.length > 1 ? `Configurar ${sel.length} pocillos` : `Configurar el pocillo ${sel[0]}`} onClose={() => setSel(null)}
          pie={<>
            <button onClick={() => setSel(null)}>Cancelar</button>
            {sel.some(cfgDe) && <button className="peligro" onClick={quitar}>Quitar</button>}
            <button className="primario" onClick={guardar}>Guardar</button></>}>
          <div onKeyDown={(e) => {
            // Enter: guarda la muestra elegida y cierra la ventana (también sobre una opción de la lista)
            if (e.key !== 'Enter' || e.nativeEvent.isComposing) return
            const t = e.target
            if (t.tagName === 'BUTTON' && t.getAttribute('role') !== 'option') return
            e.preventDefault()
            guardar(t.getAttribute('role') === 'option' ? t.dataset.muestra : undefined)
          }}>
            {sel.length > 1 && (() => {
              const cnt = {}
              let libres = 0
              sel.forEach((p) => { const c = cfgDe(p); if (c) cnt[c.Muestra] = (cnt[c.Muestra] || 0) + 1; else libres++ })
              const partes = Object.entries(cnt).map(([m, n]) => `${m} (${n})`)
              if (libres) partes.push(`sin asignar (${libres})`)
              const varias = Object.keys(cnt).length > 1 || (Object.keys(cnt).length === 1 && libres > 0)
              return <p className={varias ? 'aviso-sel' : 'ayuda'} data-tip={`Pocillos elegidos\n${sel.join(', ')}`}>{varias ? 'La selección tiene distintas muestras: ' : 'Muestra actual: '}{partes.join(' · ')}.{varias && ' La que elijas se asigna a todos.'}</p>
            })()}
            <Campo label="Muestra">
              <input autoFocus value={muestra} placeholder="Elegí una muestra de la lista o escribí una nueva" onChange={(e) => setMuestra(e.target.value)} />
            </Campo>
            {(() => {
              const todas = [...new Set([...s.muestras, ...s.config.map((c) => c.Muestra)])]
              const existe = todas.some((m) => m.toLowerCase() === muestra.trim().toLowerCase())
              return (
                <>
                  <div className="opciones-muestra" role="listbox">
                    {todas.map((m) => {
                      const n = s.config.filter((c) => c.Muestra === m).length
                      const on = m.toLowerCase() === muestra.trim().toLowerCase()
                      return (
                        <button key={m} role="option" data-muestra={m} aria-selected={on} className={on ? 'on' : ''} onClick={() => setMuestra(m)}>
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
              <input type="checkbox" checked={blanco === true} ref={(el) => { if (el) el.indeterminate = blanco === null }} onChange={() => setBlanco(blanco !== true)} />
              <span>Es un blanco (medio sin inocular)<small>{blanco === null ? 'Mixto: algunos pocillos son blanco y otros no; si no lo tocás, cada uno conserva su estado.' : 'Los blancos dan el punto de corte (ODc).'}</small></span>
            </label>
            <p className="ayuda">Enter guarda y cierra. {sel.length > 1 ? 'Cada pocillo recibe un número de réplica, en orden por filas.' : 'La réplica se asigna sola.'}</p>
          </div>
        </Modal>
      )}
      {confirmar && (
        <Modal titulo="Limpiar la configuración" onClose={() => setConfirmar(false)} ancho={440}
          pie={<><button onClick={() => setConfirmar(false)}>Cancelar</button>
            <button className="peligro" onClick={() => { s.setConfig([]); setConfirmar(false); s.avisar('Configuración borrada (Ctrl + Z para deshacer).') }}>Sí, limpiar</button></>}>
          Se quita la muestra de los {s.config.length} pocillos configurados de «{s.a.nombre}».
        </Modal>
      )}
      {medioNuevo !== null && (
        <Modal titulo="Otro medio de cultivo" onClose={() => setMedioNuevo(null)} ancho={420}
          pie={<><button onClick={() => setMedioNuevo(null)}>Cancelar</button><button className="primario" onClick={() => { if (medioNuevo.trim()) s.setMedio(s.a.id, medioNuevo.trim()); setMedioNuevo(null) }}>Guardar</button></>}>
          <Campo label="Nombre del medio (por ejemplo LB, TSB, M9…)"><input autoFocus value={medioNuevo} onChange={(e) => setMedioNuevo(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && medioNuevo.trim()) { s.setMedio(s.a.id, medioNuevo.trim()); setMedioNuevo(null) } }} /></Campo>
        </Modal>
      )}
    </div>
  )
}

// ===============================================================
// ODc Y MAPA: punto de corte con los blancos y clasificación de cada pocillo
// ===============================================================
export function AnalisisTab({ s }) {
  const [det, setDet] = useState(null)
  const a = s.analisis
  if (!s.placa) return <Vacio titulo="Esta placa no tiene datos" texto="Cargá el Excel o escribí las OD en «Placas»." accion={<button className="primario" onClick={() => s.irA('placas')}>Ir a Placas</button>} />
  if (!a?.estado?.length) return <Vacio titulo="Faltan los pocillos" texto="Indicá qué muestra hay en cada pocillo para ver el mapa." accion={<button className="primario" onClick={() => s.irA('pocillos')}>Ir a Pocillos</button>} />
  // «Restar blanco»: el mapa muestra la OD corregida (OD leída − media de los blancos). El ODc se calcula con la OD leída,
  // así que en OD corregida los límites de clase quedan en k × ODc − blanco (la clasificación de cada pocillo no cambia)
  const corr = !!a.blanco?.restado
  const resta = corr ? a.odc.resta : 0
  const odc = a.odc.odc
  const finito = Number.isFinite(odc)
  const [u1, u2, u3] = [odc - resta, 2 * odc - resta, 4 * odc - resta]
  const datos = Object.fromEntries(s.placa.datos.map((d) => [d.Pocillo, d.OD - resta]))
  const est = Object.fromEntries(a.estado.map((e) => [e.Pocillo, e]))
  const clasif = (od) => (!finito ? null : od <= u1 ? CLASES[0] : od <= u2 ? CLASES[1] : od <= u3 ? CLASES[2] : CLASES[3])
  const nomOD = corr ? 'OD corr.' : 'OD'
  const categoria = (p) => {
    const od = datos[p]
    if (!Number.isFinite(od)) return 'Sin datos'
    const e = est[p]
    if (!e) return 'Sin asignar'
    if (!e.Usado) return 'Excluido'
    if (e.EsBlanco) return 'Blanco'
    return clasif(od) || 'Sin clasificar'
  }
  const blancos = a.blancos || []
  const usados = s.blancosUsados ?? blancos
  // los blancos del ODc, siempre con la OD leída
  const odBl = (s.analisisLeido || a).estado.filter((r) => r.EsBlanco && r.Usado && usados.includes(r.Muestra)).map((r) => r.OD)
  const refs = [
    ['No productor', finito ? `${nomOD} ≤ ${fmt(u1)}` : ''],
    ['Productor débil', finito ? `${fmt(u1)} < ${nomOD} ≤ ${fmt(u2)}` : ''],
    ['Productor moderado', finito ? `${fmt(u2)} < ${nomOD} ≤ ${fmt(u3)}` : ''],
    ['Productor fuerte', finito ? `${nomOD} > ${fmt(u3)}` : ''],
    ['Blanco', 'medio sin inocular'], ['Excluido', 'fuera del análisis'], ['Sin asignar', 'pocillo libre'],
  ]
  const dp = det && est[det]

  return (
    <div>
      <Cinta>
        {blancos.length > 0 && (
          <Grupo titulo="Blancos para el ODc">
            {blancos.map((b) => <InterruptorCinta key={b} icono="matraz" texto={b} valor={usados.includes(b)} tip={`Usar los pocillos de «${b}» para el punto de corte`}
              onChange={(v) => { const n = v ? [...usados, b] : usados.filter((x) => x !== b); if (!n.length) return s.avisar('Tiene que quedar al menos un blanco.', 'error'); s.setBlancosUsados(n) }} />)}
          </Grupo>
        )}
        <GrupoBlanco s={s} />
      </Cinta>

      <div className="grid-kpi">
        <div className="kpi" data-tip={`Blancos aceptados\nPocillos de ${usados.join(', ') || 'blanco'} que no están excluidos`}><small>Blancos aceptados</small><b>{a.odc.n}</b></div>
        <div className="kpi" data-tip={`Media de blancos\n${dMedia(odBl)}${corr ? '\nEs lo que se resta a cada OD (Restar blanco)' : ''}`}><small>{corr ? 'Media de los blancos · se resta' : 'Media de los blancos'}</small><b>{fmt(a.odc.media, 4)}</b></div>
        <div className="kpi" data-tip={dDE(odBl)}><small>DE de los blancos</small><b>{fmt(a.odc.sd, 4)}</b></div>
        <div className="kpi destacado" data-tip={a.odc.n > 1 ? dODc(odBl) : 'Punto de corte (ODc)\nHacen falta al menos 2 blancos aceptados'}><small>ODc = media + 3 × DE</small><b>{fmt(odc, 4)}</b></div>
        {corr && finito && <div className="kpi" data-tip={`Punto de corte en OD corregida\nODc − blanco = ${fmt(odc, 4)} − ${fmt(resta, 4)} = ${fmt(u1, 4)} (= 3 × DE)\nLímites de clase en OD corregida: ${fmt(u1)} · ${fmt(u2)} · ${fmt(u3)}\n(k × ODc − blanco: la clasificación es la misma que con la OD leída)`}><small>ODc − blanco</small><b>{fmt(u1, 4)}</b></div>}
      </div>
      {s.restarBlanco && !corr && a.odc.n === 0 && <p className="aviso-caja">Esta placa no tiene blancos aceptados: no se le puede restar el blanco y queda con la OD leída.</p>}
      {!blancos.length && <p className="aviso-caja">No hay blancos en esta placa: marcá «Es un blanco» al configurar los pocillos del medio sin inocular.</p>}
      {blancos.length > 0 && !finito && <p className="aviso-caja">Hacen falta al menos 2 pocillos de blanco aceptados para calcular el ODc.</p>}

      <section className="tarjeta">
        <div className="cabeza-tarjeta">
          <span className="etiqueta-seccion">Mapa de la placa · {corr ? s.ejeOD : s.ejeODLeida}</span>
          <span className="ayuda">Clic en un pocillo para ver su clasificación y excluirlo o incluirlo
            <Nota>Stepanović et al. (2000): cada muestra se clasifica con la media de sus réplicas aceptadas; acá se colorea cada pocillo con su propia OD.</Nota></span>
        </div>
        <div className="placa-wrap">
          <table className="placa mapa">
            <thead><tr><th />{Array.from({ length: 12 }, (_, i) => <th key={i}>{i + 1}</th>)}</tr></thead>
            <tbody>
              {FILAS.map((f) => (
                <tr key={f}><th>{f}</th>
                  {Array.from({ length: 12 }, (_, ci) => {
                    const p = f + (ci + 1)
                    const cat = categoria(p)
                    const e = est[p]
                    return (
                      <td key={p} onClick={() => Number.isFinite(datos[p]) && setDet(p)}>
                        <div className={`celda-mapa cat-${CLASES.indexOf(cat)} ${cat === 'Sin datos' ? 'sin-datos' : ''} ${cat === 'Excluido' ? 'excluido' : ''} ${cat === 'Sin asignar' || cat === 'Sin clasificar' ? 'libre' : ''}`}
                          style={COLOR_CLASE[cat] && cat !== 'Excluido' ? { background: COLOR_CLASE[cat] } : undefined}
                          data-tip={Number.isFinite(datos[p]) ? `${p}${e ? ` · ${e.Muestra} R${e.Replica}` : ''}\n${corr ? `OD corregida = ${fmt(datos[p], 4)} (leída ${fmt(datos[p] + resta, 4)} − blanco ${fmt(resta, 4)})` : `OD = ${fmt(datos[p], 4)}`}\n${cat}` : undefined}>
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
        <div className="leyenda-cepas">
          {refs.map(([c, t]) => (
            <span key={c}><i className={`punto ${c === 'Excluido' ? 'excluido' : c === 'Sin asignar' ? 'libre' : ''}`} style={COLOR_CLASE[c] && c !== 'Excluido' ? { background: COLOR_CLASE[c] } : undefined} /><b>{c}</b> {t}</span>
          ))}
        </div>
      </section>

      {det && (
        <Modal titulo={dp ? `Pocillo ${det} · ${dp.Muestra} (réplica ${dp.Replica})` : `Pocillo ${det}`} onClose={() => setDet(null)} ancho={460}
          pie={<><button onClick={() => setDet(null)}>Cerrar</button>
            {dp && <button className="primario" onClick={() => { s.alternarPocillo(det); setDet(null) }}>
              {dp.Usado ? 'Excluir este pocillo' : dp.Manual ? 'Volver a incluir' : 'Conservar pese al test'}</button>}</>}>
          <dl className="datos">
            {corr
              ? <><dt>OD corregida</dt><dd>{fmt(datos[det], 4)}</dd><dt>OD leída</dt><dd>{fmt(datos[det] + resta, 4)} (blanco {fmt(resta, 4)})</dd></>
              : <><dt>OD</dt><dd>{fmt(datos[det], 4)}</dd></>}
            <dt>Clasificación</dt><dd>{!dp ? 'Sin muestra asignada' : dp.EsBlanco ? 'Blanco (no se clasifica)' : finito ? clasif(datos[det]) : 'Sin ODc: faltan blancos'}</dd>
            {dp && <><dt>Estado</dt><dd>{dp.Usado ? 'Aceptado' : 'Excluido'}</dd></>}
          </dl>
          {dp && <p className="ayuda">{dp.Manual ? 'Excluido a mano.' : dp.Motivo || 'Aceptado: el test de valores atípicos no lo marcó (o su muestra tiene menos de 3 pocillos).'}</p>}
          {!dp && <p className="ayuda">Para analizarlo, asignale una muestra en «Pocillos».</p>}
        </Modal>
      )}
    </div>
  )
}
