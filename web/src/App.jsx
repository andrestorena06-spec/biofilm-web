import { useCallback, useEffect, useMemo, useState } from 'react'
import { analizar, ErrorRed, ping } from './api.js'
import { ArchivoTab, PlacaTab, AnalisisTab } from './components/tabs.jsx'
import { ExcluirTab, GraficoTab, DatosTab } from './components/tabs2.jsx'
import { estiloDefecto, normalizarEstilo } from './utils.js'

const CLAVE = 'biofilm-react-v2'

const optsDef = () => ({
  excluir: { puntos: true, medias: true, errores: false, error: 'sd', banda: true, rotar: 45 },
  barras: {
    error: 'ic95', orden: 'lista', color: 'clase', puntos: true, medias: true, errores: true,
    lineas: true, valoresClase: false, rotar: 45, muestrasSel: null,
  },
})
const deteccionDef = () => ({ metodo: 'hampel', usar: false, nsig: 3, min: 0.02, conf: '95' })

function cargarGuardado() {
  try {
    return JSON.parse(localStorage.getItem(CLAVE) || localStorage.getItem('biofilm-react-v1')) || {}
  } catch {
    return {}
  }
}

const PESTANAS = [
  ['archivo', 'Archivo', 'Cargar datos y muestras'],
  ['placa', 'Placa', 'Configurar pocillos'],
  ['excluir', 'Excluir puntos', 'Control de calidad'],
  ['analisis', 'Análisis', 'ODc y mapa'],
  ['grafico', 'Gráfico', 'Barras y clasificación'],
  ['datos', 'Datos', 'Tablas y método'],
]

// Logo: una placa de 96 pocillos (8 filas × 12 columnas)
const LogoPlaca = () => (
  <svg viewBox="0 0 48 34" width="40" height="28" aria-hidden>
    <rect x="0.75" y="0.75" width="46.5" height="32.5" rx="4" fill="none" stroke="#ffe3c2" strokeOpacity=".85" strokeWidth="1.5" />
    {Array.from({ length: 8 }, (_, f) => Array.from({ length: 12 }, (_, c) => (
      <circle key={f + '-' + c} cx={5 + c * 3.45} cy={5.2 + f * 3.45} r="1.25"
        fill="#ffe3c2" fillOpacity={(f === 2 && c > 1 && c < 5) || (f === 4 && c > 6 && c < 10) ? 1 : 0.4} />
    )))}
  </svg>
)

export default function App() {
  const g = useMemo(cargarGuardado, [])
  const [tab, setTab] = useState('archivo')
  const [archivo, setArchivo] = useState(null)
  const [placa, setPlaca] = useState(null)
  const [muestras, setMuestras] = useState(g.muestras || ['L100A1', 'L100A1 Rug', 'L100A1 SCV', 'L101B2', 'L101B2 Rug', 'L201', 'L201 Rug', 'BHI', 'TSBye'])
  const [config, setConfig] = useState(g.config || [])
  const [exclManual, setExclManual] = useState(g.exclManual || [])
  const [exclForzado, setExclForzado] = useState(g.exclForzado || [])
  const [deteccion, setDeteccion] = useState(() => ({ ...deteccionDef(), ...(g.hampel || {}), ...(g.deteccion || {}) }))
  const [blancosUsados, setBlancosUsados] = useState(g.blancosUsados ?? null)
  const [opts, setOpts] = useState(() => ({ excluir: { ...optsDef().excluir, ...(g.opts?.excluir || {}) }, barras: { ...optsDef().barras, ...(g.opts?.barras || {}) } }))
  const [estilos, setEstilos] = useState(() => ({ barras: normalizarEstilo(g.estilos?.barras), excluir: normalizarEstilo(g.estilos?.excluir) }))
  const [analisis, setAnalisis] = useState(null)
  const [avisos, setAvisos] = useState([])
  const [motor, setMotor] = useState(true)

  useEffect(() => { ping().then(setMotor) }, [])

  useEffect(() => {
    try {
      localStorage.setItem(CLAVE, JSON.stringify({ muestras, config, exclManual, exclForzado, deteccion, blancosUsados, opts, estilos }))
    } catch { /* sin almacenamiento */ }
  }, [muestras, config, exclManual, exclForzado, deteccion, blancosUsados, opts, estilos])

  const avisar = useCallback((texto, tipo = 'ok') => {
    const id = Math.random()
    setAvisos((a) => [...a, { id, texto, tipo }])
    setTimeout(() => setAvisos((a) => a.filter((x) => x.id !== id)), 3800)
  }, [])

  // Cálculo en R (con una pequeña espera para no saturarlo al tipear)
  useEffect(() => {
    if (!placa || !config.length) {
      setAnalisis(null)
      return
    }
    const ctl = new AbortController()
    const t = setTimeout(() => {
      analizar({
        datos: placa.datos, config, excl_manual: exclManual, excl_forzado: exclForzado,
        deteccion: { metodo: deteccion.metodo, usar: deteccion.usar, nsig: Number(deteccion.nsig) || 3, min: Number(deteccion.min) || 0.02, conf: deteccion.conf },
        blancos_usados: blancosUsados,
      }, ctl.signal).then((r) => { setAnalisis(r); setMotor(true) }).catch((e) => {
        if (e.name === 'AbortError') return
        // el aviso de "sin conexión" solo aparece si de verdad no hay conexión con R
        if (e instanceof ErrorRed) setMotor(false)
        avisar(e.message, 'error')
      })
    }, 120)
    return () => { clearTimeout(t); ctl.abort() }
  }, [placa, config, exclManual, exclForzado, deteccion, blancosUsados, avisar])

  const ordenMuestras = useMemo(() => {
    const pres = [...new Set((analisis?.estado || []).map((e) => e.Muestra))]
    return [...muestras.filter((m) => pres.includes(m)), ...pres.filter((m) => !muestras.includes(m))]
  }, [analisis, muestras])

  const ejeOD = Number.isFinite(placa?.onda) ? `DO a ${placa.onda} nm` : 'Densidad óptica (OD)'

  const alternarPocillo = (p) => {
    const r = analisis?.estado?.find((e) => e.Pocillo === p)
    if (!r) return
    if (r.Usado) {
      if (r.Forzado) setExclForzado(exclForzado.filter((x) => x !== p))
      setExclManual([...new Set([...exclManual, p])])
    } else if (r.Manual) {
      setExclManual(exclManual.filter((x) => x !== p))
      if (r.Sospechoso && deteccion.usar && !r.Forzado) setExclForzado([...new Set([...exclForzado, p])])
    } else if (r.AutoExcl) {
      setExclForzado([...new Set([...exclForzado, p])])
    }
  }

  const s = {
    archivo, setArchivo, placa, setPlaca,
    muestras, setMuestras, config, setConfig, deteccion, setDeteccion, blancosUsados, setBlancosUsados,
    opts, setOpts, estilos, setEstilos, analisis, ordenMuestras, ejeOD, avisar, alternarPocillo,
    restablecerExclusiones: () => { setExclManual([]); setExclForzado([]); avisar('Exclusiones restablecidas.') },
    borrarMuestra: (m) => {
      const n = config.filter((c) => c.Muestra === m).length
      if (n > 0 && !window.confirm(`La muestra '${m}' está asignada a ${n} pocillo(s). Si la borrás, esos pocillos quedan sin asignar. ¿Continuar?`)) return
      setMuestras(muestras.filter((x) => x !== m))
      setConfig(config.filter((c) => c.Muestra !== m))
    },
    renombrarMuestra: (viejo, nuevo) => {
      if (!nuevo) return avisar('El nombre no puede estar vacío.', 'error')
      if (muestras.some((m) => m !== viejo && m.toLowerCase() === nuevo.toLowerCase())) return avisar(`Ya existe una muestra llamada '${nuevo}'.`, 'error')
      setMuestras(muestras.map((m) => (m === viejo ? nuevo : m)))
      setConfig(config.map((c) => (c.Muestra === viejo ? { ...c, Muestra: nuevo } : c)))
    },
    exportarSesion: () => ({ version: 2, archivo: archivo?.nombre, muestras, config, exclManual, exclForzado, deteccion, blancosUsados, opts, estilos }),
    importarSesion: (x) => {
      if (!x?.config) throw new Error('inválida')
      setConfig(x.config); setMuestras(x.muestras || muestras); setExclManual(x.exclManual || []); setExclForzado(x.exclForzado || [])
      setDeteccion({ ...deteccionDef(), ...(x.hampel || {}), ...(x.deteccion || {}) })
      setBlancosUsados(x.blancosUsados ?? null)
      if (x.opts) setOpts({ excluir: { ...optsDef().excluir, ...x.opts.excluir }, barras: { ...optsDef().barras, ...x.opts.barras } })
      if (x.estilos) setEstilos({ barras: normalizarEstilo(x.estilos.barras), excluir: normalizarEstilo(x.estilos.excluir) })
    },
  }

  const Vista = { archivo: ArchivoTab, placa: PlacaTab, excluir: ExcluirTab, analisis: AnalisisTab, grafico: GraficoTab, datos: DatosTab }[tab]

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
          <small>{archivo ? archivo.nombre : 'Sin archivo'}</small>
        </div>
      </nav>
      <main className="contenido">
        {!motor && <div className="banner">No se pudo conectar con el motor de cálculo (R). Abrí la aplicación con <b>abrir_biofilm_web.bat</b>.</div>}
        <Vista s={s} />
      </main>
      <div className="toasts">{avisos.map((a) => <div key={a.id} className={`toast ${a.tipo}`}>{a.texto}</div>)}</div>
    </div>
  )
}
