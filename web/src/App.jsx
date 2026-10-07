import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { analizar, ErrorRed, hojasDe, leerPlaca, ping } from './api.js'
import { PlacaTab, AnalisisTab } from './components/tabs.jsx'
import { ArchivoTab } from './components/archivo.jsx'
import { ExcluirTab, GraficoTab, DatosTab } from './components/tabs2.jsx'
import { CompararTab } from './components/comparar.jsx'
import { estiloDefecto, normalizarEstilo, paletaMuestras } from './utils.js'

const CLAVE = 'biofilm-react-v3'
const CLAVES_ANTERIORES = ['biofilm-react-v2', 'biofilm-react-v1']

const optsDef = () => ({
  excluir: { puntos: true, medias: true, errores: false, error: 'sd', banda: true, rotar: 45 },
  barras: {
    error: 'ic95', orden: 'lista', color: 'clase', puntos: true, medias: true, errores: true,
    lineas: true, valoresClase: false, rotar: 45, muestrasSel: null,
  },
  comparar: {
    metrica: 'razon', error: 'ic95', test: 'control', control: '', orden: 'lista', color: 'clase',
    puntos: true, medias: true, errores: true, lineas: true, valoresClase: false, rotar: 45,
    muestrasSel: null, placasSel: null,
  },
})
const deteccionDef = () => ({ metodo: 'hampel', usar: false, nsig: 3, min: 0.02, conf: '95' })

const nuevoId = () => Math.random().toString(36).slice(2, 10)
const placaVacia = (nombre) => ({
  id: nuevoId(), nombre, archivo: null, placa: null, config: [], exclManual: [], exclForzado: [], blancosUsados: null,
})

function cargarGuardado() {
  for (const k of [CLAVE, ...CLAVES_ANTERIORES]) {
    try {
      const v = JSON.parse(localStorage.getItem(k))
      if (v) return v
    } catch { /* clave dañada: se prueba la siguiente */ }
  }
  return {}
}

const PESTANAS = [
  ['archivo', 'Archivo', 'Placas, muestras y sesión'],
  ['placa', 'Placa', 'Configurar pocillos'],
  ['excluir', 'Excluir puntos', 'Control de calidad'],
  ['analisis', 'Análisis', 'ODc y mapa'],
  ['grafico', 'Gráfico', 'Barras y clasificación'],
  ['comparar', 'Comparar', 'Entre placas'],
  ['datos', 'Datos', 'Tablas y método'],
]

// Logo: una placa de 96 pocillos (8 filas × 12 columnas)
const LogoPlaca = () => (
  <svg viewBox="0 0 48 34" width="40" height="28" aria-hidden>
    <rect x="0.75" y="0.75" width="46.5" height="32.5" rx="4" fill="none" stroke="#ffe3c2" strokeOpacity=".85" strokeWidth="1.5" />
    {Array.from({ length: 8 }, (_, f) => Array.from({ length: 12 }, (_, c) => (
      <circle key={f + '-' + c} cx={5 + c * 3.45} cy={5.2 + f * 3.45} r="1.25"
        fill="#ffe3c2" fillOpacity={(f === 2 && c > 1 && c < 5) || (f === 4 && c > 6 && c < 10) ? 1 : 0.55} />
    )))}
  </svg>
)

// Estado de arranque: placas guardadas, o una placa con la configuración de versiones anteriores
function placasIniciales(g) {
  if (Array.isArray(g.placas) && g.placas.length) {
    return g.placas.map((p) => ({ exclManual: [], exclForzado: [], blancosUsados: null, config: [], ...p }))
  }
  if (g.config?.length) {
    return [{ ...placaVacia('Placa 1'), config: g.config, exclManual: g.exclManual || [], exclForzado: g.exclForzado || [], blancosUsados: g.blancosUsados ?? null }]
  }
  return []
}

export default function App() {
  const g = useMemo(cargarGuardado, [])
  const [tab, setTab] = useState('archivo')
  const [placas, setPlacas] = useState(() => placasIniciales(g))
  const [activaId, setActivaId] = useState(() => g.activaId || null)
  const [muestras, setMuestras] = useState(g.muestras || ['L100A1', 'L100A1 Rug', 'L100A1 SCV', 'L101B2', 'L101B2 Rug', 'L201', 'L201 Rug', 'BHI', 'TSBye'])
  const [deteccion, setDeteccion] = useState(() => ({ ...deteccionDef(), ...(g.hampel || {}), ...(g.deteccion || {}) }))
  const [opts, setOpts] = useState(() => ({
    excluir: { ...optsDef().excluir, ...(g.opts?.excluir || {}) },
    barras: { ...optsDef().barras, ...(g.opts?.barras || {}) },
    comparar: { ...optsDef().comparar, ...(g.opts?.comparar || {}) },
  }))
  const [estilos, setEstilos] = useState(() => ({
    barras: normalizarEstilo(g.estilos?.barras), excluir: normalizarEstilo(g.estilos?.excluir), comparar: normalizarEstilo(g.estilos?.comparar),
  }))
  const [analisisMap, setAnalisisMap] = useState({})
  const [avisos, setAvisos] = useState([])
  const [motor, setMotor] = useState(true)
  const archivosRef = useRef({})        // id de placa -> File (solo mientras la pestaña está abierta)
  const inputPlacas = useRef()

  const activa = placas.find((p) => p.id === activaId) || placas[0] || null
  useEffect(() => { if (activa && activa.id !== activaId) setActivaId(activa.id) }, [activa, activaId])

  useEffect(() => { ping().then(setMotor) }, [])

  // Todo el trabajo (incluidos los datos de cada Excel) se guarda en el navegador
  useEffect(() => {
    try {
      localStorage.setItem(CLAVE, JSON.stringify({ placas, activaId, muestras, deteccion, opts, estilos }))
    } catch { /* sin almacenamiento o sin espacio */ }
  }, [placas, activaId, muestras, deteccion, opts, estilos])

  const avisar = useCallback((texto, tipo = 'ok') => {
    const id = Math.random()
    setAvisos((a) => [...a, { id, texto, tipo }])
    setTimeout(() => setAvisos((a) => a.filter((x) => x.id !== id)), 4200)
  }, [])

  const actualizar = useCallback((id, cambios) => {
    setPlacas((ps) => ps.map((p) => (p.id === id ? { ...p, ...(typeof cambios === 'function' ? cambios(p) : cambios) } : p)))
  }, [])

  // ---------------------------------------------------------------
  // Análisis de cada placa (en R o en el navegador, según el modo)
  // ---------------------------------------------------------------
  const versiones = useRef({})
  const claves = useRef({})
  useEffect(() => {
    const t = setTimeout(() => {
      placas.forEach((p) => {
        if (!p.placa || !p.config.length) {
          if (claves.current[p.id] !== 'vacia') {
            claves.current[p.id] = 'vacia'
            setAnalisisMap((m) => ({ ...m, [p.id]: null }))
          }
          return
        }
        const clave = JSON.stringify([p.config, p.exclManual, p.exclForzado, p.blancosUsados, deteccion, p.placa.datos.length, p.placa.datos[0]?.OD, p.placa.datos[95]?.OD])
        if (claves.current[p.id] === clave) return
        const v = (versiones.current[p.id] || 0) + 1
        versiones.current[p.id] = v
        analizar({
          datos: p.placa.datos, config: p.config, excl_manual: p.exclManual, excl_forzado: p.exclForzado,
          deteccion: { metodo: deteccion.metodo, usar: deteccion.usar, nsig: Number(deteccion.nsig) || 3, min: Number(deteccion.min) || 0.02, conf: deteccion.conf },
          blancos_usados: p.blancosUsados,
        }).then((r) => {
          if (versiones.current[p.id] !== v) return
          claves.current[p.id] = clave
          setAnalisisMap((m) => ({ ...m, [p.id]: r }))
          setMotor(true)
        }).catch((e) => {
          if (e.name === 'AbortError') return
          if (e instanceof ErrorRed) setMotor(false)
          avisar(`${p.nombre}: ${e.message}`, 'error')
        })
      })
    }, 120)
    return () => clearTimeout(t)
  }, [placas, deteccion, avisar])

  const analisis = activa ? analisisMap[activa.id] || null : null

  const ordenMuestras = useMemo(() => {
    const pres = [...new Set((analisis?.estado || []).map((e) => e.Muestra))]
    return [...muestras.filter((m) => pres.includes(m)), ...pres.filter((m) => !muestras.includes(m))]
  }, [analisis, muestras])

  const ejeOD = Number.isFinite(activa?.placa?.onda) ? `DO a ${activa.placa.onda} nm` : 'Densidad óptica (OD)'

  // ---------------------------------------------------------------
  // Placas: agregar, quitar, renombrar, copiar configuración
  // ---------------------------------------------------------------
  const nombreUnico = (base, existentes) => {
    let n = base, i = 2
    while (existentes.includes(n)) n = `${base} (${i++})`
    return n
  }

  // Cada archivo se agrega como una placa; cada hoja de Excel que contenga una placa también.
  const agregarPlacas = async (files, idDestino = null) => {
    const nuevas = []
    const errores = []
    for (const file of Array.from(files)) {
      try {
        const { hojas } = await hojasDe(file)
        const lecturas = []
        for (const hoja of hojas) {
          try {
            lecturas.push({ hoja, r: await leerPlaca(file, hoja) })
          } catch (e) {
            if (hojas.length === 1) throw e
          }
        }
        if (!lecturas.length) throw new Error('No encontré una placa (filas A a H con valores numéricos) en ninguna hoja.')
        const base = file.name.replace(/\.[^.]+$/, '')
        lecturas.forEach(({ hoja, r }) => nuevas.push({
          file, hoja, hojas, r, nombre: lecturas.length > 1 ? `${base} · ${hoja}` : base,
        }))
      } catch (e) {
        errores.push(`${file.name}: ${e.message}`)
      }
    }
    errores.forEach((m) => avisar(m, 'error'))
    if (!nuevas.length) return

    const armar = (n, base) => ({
      ...base,
      archivo: { nombre: n.file.name, hoja: n.hoja, hojas: n.hojas },
      placa: { datos: n.r.datos, onda: n.r.onda, fecha: n.r.fecha, preview: n.r.preview },
    })
    const existentes = placas.map((p) => p.nombre)
    const creadas = []
    let primeraActiva = null
    let restantes = nuevas
    if (idDestino) {
      const n = nuevas[0]
      archivosRef.current[idDestino] = n.file
      setPlacas((ps) => ps.map((p) => (p.id === idDestino ? armar(n, p) : p)))
      primeraActiva = idDestino
      restantes = nuevas.slice(1)
    }
    restantes.forEach((n) => {
      const nombre = nombreUnico(n.nombre, [...existentes, ...creadas.map((c) => c.nombre)])
      const p = armar(n, placaVacia(nombre))
      archivosRef.current[p.id] = n.file
      creadas.push(p)
      if (!primeraActiva) primeraActiva = p.id
    })
    if (creadas.length) setPlacas((ps) => [...ps, ...creadas])
    setActivaId(primeraActiva)
    avisar(nuevas.length === 1 ? `Placa agregada: ${nuevas[0].r.datos.length} pocillos con datos.` : `${nuevas.length} placas agregadas.`)
  }

  const cambiarHoja = async (id, hoja) => {
    const file = archivosRef.current[id]
    if (!file) return avisar('Para cambiar de hoja hay que volver a cargar el archivo.', 'error')
    try {
      const r = await leerPlaca(file, hoja)
      actualizar(id, (p) => ({ archivo: { ...p.archivo, hoja }, placa: { datos: r.datos, onda: r.onda, fecha: r.fecha, preview: r.preview } }))
    } catch (e) {
      avisar(e.message, 'error')
    }
  }

  const quitarPlaca = (id) => {
    const p = placas.find((x) => x.id === id)
    if (p && p.config.length && !window.confirm(`Se quitará la placa «${p.nombre}» con su configuración. ¿Continuar?`)) return
    delete archivosRef.current[id]
    setPlacas((ps) => ps.filter((x) => x.id !== id))
    if (opts.comparar.placasSel) setOpts((o) => ({ ...o, comparar: { ...o.comparar, placasSel: o.comparar.placasSel.filter((x) => x !== id) } }))
  }

  const renombrarPlaca = (id, nombre) => {
    if (!nombre) return avisar('El nombre no puede estar vacío.', 'error')
    if (placas.some((p) => p.id !== id && p.nombre.toLowerCase() === nombre.toLowerCase())) return avisar(`Ya hay una placa llamada «${nombre}».`, 'error')
    actualizar(id, { nombre })
  }

  // Copia la distribución de muestras de la placa activa a las demás (solo pocillos con datos)
  const copiarConfig = () => {
    if (!activa) return
    const otras = placas.filter((p) => p.id !== activa.id)
    if (!otras.some((p) => p.placa)) return avisar('Las demás placas no tienen datos cargados.', 'error')
    if (otras.some((p) => p.config.length) && !window.confirm('Las demás placas ya tienen configuración. Se va a reemplazar. ¿Continuar?')) return
    setPlacas((ps) => ps.map((p) => {
      if (p.id === activa.id || !p.placa) return p
      const disp = new Set(p.placa.datos.map((d) => d.Pocillo))
      return { ...p, config: activa.config.filter((c) => disp.has(c.Pocillo)).map((c) => ({ ...c })), exclManual: [], exclForzado: [], blancosUsados: activa.blancosUsados }
    }))
    avisar('Configuración copiada a las demás placas.')
  }

  // ---------------------------------------------------------------
  // Exclusión de pocillos (placa activa)
  // ---------------------------------------------------------------
  const alternarPocillo = (p) => {
    const r = analisis?.estado?.find((e) => e.Pocillo === p)
    if (!r || !activa) return
    const { exclManual, exclForzado } = activa
    const uniq = (a) => [...new Set(a)]
    if (r.Usado) {
      actualizar(activa.id, {
        exclForzado: r.Forzado ? exclForzado.filter((x) => x !== p) : exclForzado,
        exclManual: uniq([...exclManual, p]),
      })
    } else if (r.Manual) {
      actualizar(activa.id, {
        exclManual: exclManual.filter((x) => x !== p),
        exclForzado: r.Sospechoso && deteccion.usar && !r.Forzado ? uniq([...exclForzado, p]) : exclForzado,
      })
    } else if (r.AutoExcl) {
      actualizar(activa.id, { exclForzado: uniq([...exclForzado, p]) })
    }
  }

  // ---------------------------------------------------------------
  // Sesión: guarda todas las placas con los datos de sus Excel
  // ---------------------------------------------------------------
  const exportarSesion = () => ({ version: 3, activaId: activa?.id || null, placas, muestras, deteccion, opts, estilos })
  const importarSesion = (x) => {
    if (Array.isArray(x?.placas)) {
      setPlacas(placasIniciales({ placas: x.placas }))
      setActivaId(x.activaId || x.placas[0]?.id || null)
      if (x.muestras) setMuestras(x.muestras)
      setDeteccion({ ...deteccionDef(), ...(x.hampel || {}), ...(x.deteccion || {}) })
      if (x.opts) setOpts({ excluir: { ...optsDef().excluir, ...x.opts.excluir }, barras: { ...optsDef().barras, ...x.opts.barras }, comparar: { ...optsDef().comparar, ...x.opts.comparar } })
      if (x.estilos) setEstilos({ barras: normalizarEstilo(x.estilos.barras), excluir: normalizarEstilo(x.estilos.excluir), comparar: normalizarEstilo(x.estilos.comparar) })
      claves.current = {}
      return
    }
    // Sesión de versiones anteriores (una sola placa, sin los datos del Excel)
    if (!x?.config) throw new Error('inválida')
    const destino = activa?.id
    const cambios = { config: x.config, exclManual: x.exclManual || [], exclForzado: x.exclForzado || [], blancosUsados: x.blancosUsados ?? null }
    if (destino) actualizar(destino, cambios)
    else { const p = { ...placaVacia('Placa 1'), ...cambios }; setPlacas([p]); setActivaId(p.id) }
    if (x.muestras) setMuestras(x.muestras)
    setDeteccion({ ...deteccionDef(), ...(x.hampel || {}), ...(x.deteccion || {}) })
    if (x.opts) setOpts({ excluir: { ...optsDef().excluir, ...x.opts.excluir }, barras: { ...optsDef().barras, ...x.opts.barras }, comparar: optsDef().comparar })
    if (x.estilos) setEstilos((e) => ({ ...e, barras: normalizarEstilo(x.estilos.barras), excluir: normalizarEstilo(x.estilos.excluir) }))
    avisar('Sesión antigua: no traía los datos del Excel; cargá el archivo de la placa.', 'error')
  }

  const s = {
    // placas
    placas, activaId: activa?.id || null, a: activa, setActiva: setActivaId, analisisMap,
    agregarPlacas, quitarPlaca, renombrarPlaca, cambiarHoja, copiarConfig, tieneArchivo: (id) => !!archivosRef.current[id],
    // datos de la placa activa (así las pestañas existentes funcionan sin cambios)
    archivo: activa?.archivo || null, placa: activa?.placa || null,
    config: activa?.config || [], setConfig: (c) => activa && actualizar(activa.id, { config: c }),
    blancosUsados: activa?.blancosUsados ?? null, setBlancosUsados: (b) => activa && actualizar(activa.id, { blancosUsados: b }),
    analisis, ordenMuestras, ejeOD,
    // globales
    muestras, setMuestras, deteccion, setDeteccion, opts, setOpts, estilos, setEstilos, avisar, alternarPocillo,
    restablecerExclusiones: () => { if (activa) { actualizar(activa.id, { exclManual: [], exclForzado: [] }); avisar('Exclusiones restablecidas en esta placa.') } },
    borrarMuestra: (m) => {
      const n = placas.reduce((a, p) => a + p.config.filter((c) => c.Muestra === m).length, 0)
      if (n > 0 && !window.confirm(`La muestra '${m}' está asignada a ${n} pocillo(s) en total. Si la borrás, esos pocillos quedan sin asignar. ¿Continuar?`)) return
      setMuestras(muestras.filter((x) => x !== m))
      setPlacas((ps) => ps.map((p) => ({ ...p, config: p.config.filter((c) => c.Muestra !== m) })))
    },
    renombrarMuestra: (viejo, nuevo) => {
      if (!nuevo) return avisar('El nombre no puede estar vacío.', 'error')
      if (muestras.some((m) => m !== viejo && m.toLowerCase() === nuevo.toLowerCase())) return avisar(`Ya existe una muestra llamada '${nuevo}'.`, 'error')
      setMuestras(muestras.map((m) => (m === viejo ? nuevo : m)))
      setPlacas((ps) => ps.map((p) => ({ ...p, config: p.config.map((c) => (c.Muestra === viejo ? { ...c, Muestra: nuevo } : c)) })))
    },
    exportarSesion, importarSesion,
  }

  const Vista = { archivo: ArchivoTab, placa: PlacaTab, excluir: ExcluirTab, analisis: AnalisisTab, grafico: GraficoTab, comparar: CompararTab, datos: DatosTab }[tab]
  const colores = paletaMuestras(placas.map((p) => p.id))

  return (
    <div className="app">
      <nav className="barra">
        <div className="marca">
          <div className="logo"><LogoPlaca /></div>
          <div><b>Biofilm</b><small>Placa de 96 pocillos</small></div>
        </div>
        {PESTANAS.map(([id, t, d], i) => (
          <button key={id} className={`nav ${tab === id ? 'activa' : ''}`} onClick={() => setTab(id)}>
            <span className="num">{i + 1}</span>
            <span><b>{t}</b><small>{d}</small></span>
          </button>
        ))}
        <div className="pie-nav">
          {analisis?.odc && Number.isFinite(analisis.odc.odc) && <div className="chip-odc">ODc = {analisis.odc.odc.toFixed(4)}</div>}
          <small>{activa ? activa.nombre : 'Sin placas'}</small>
        </div>
      </nav>
      <main className="contenido">
        {!motor && <div className="banner">No se pudo conectar con el motor de cálculo (R). Abrí la aplicación con <b>abrir_biofilm_web.bat</b>.</div>}
        <div className="barra-placas">
          {placas.map((p) => (
            <div key={p.id} role="tab" tabIndex={0} aria-selected={p.id === activa?.id}
              className={`chip-placa ${p.id === activa?.id ? 'activa' : ''}`}
              onClick={() => setActivaId(p.id)} title="Clic para ver esta placa · doble clic para renombrar"
              onDoubleClick={() => { const n = window.prompt('Nombre de la placa', p.nombre); if (n !== null) renombrarPlaca(p.id, n.trim()) }}>
              <i className="punto-placa" style={{ background: colores[p.id] }} />
              <span className="nombre-placa">{p.nombre}</span>
              {analisisMap[p.id] && Number.isFinite(analisisMap[p.id].odc?.odc) && <small>ODc {analisisMap[p.id].odc.odc.toFixed(3)}</small>}
              {!p.placa && <small className="sin-datos-placa">sin datos</small>}
              <button className="x-placa" aria-label={`Quitar ${p.nombre}`} onClick={(e) => { e.stopPropagation(); quitarPlaca(p.id) }}>×</button>
            </div>
          ))}
          <button className="agregar-placa" onClick={() => inputPlacas.current.click()}>+ Agregar placa</button>
          <input ref={inputPlacas} type="file" multiple hidden accept=".xlsx,.xls,.csv,.txt"
            onChange={(e) => { agregarPlacas(e.target.files); e.target.value = '' }} />
        </div>
        <Vista s={s} />
      </main>
      <div className="toasts">{avisos.map((a) => <div key={a.id} className={`toast ${a.tipo}`}>{a.texto}</div>)}</div>
    </div>
  )
}
