import { ACEPTA_LIBRO } from './libro.js'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { analizar, ErrorRed, hojasDe, leerPlaca, ping } from './api.js'
import { PlacaTab, AnalisisTab } from './components/tabs.jsx'
import { ArchivoTab } from './components/archivo.jsx'
import { ExcluirTab, GraficoTab, DatosTab } from './components/tabs2.jsx'
import { CompararTab } from './components/comparar.jsx'
import { GloboInfo } from './components/tip.jsx'
import { MenuContextual, Modal, useMenuContextual } from './components/ui.jsx'
import { estiloDefecto, normalizarEstilo, paletaMuestras } from './utils.js'

const CLAVE = 'biofilm-react-v3'
const MUESTRAS_DEF = ['L100A1', 'L100A1 Rug', 'L100A1 SCV', 'L101B2', 'L101B2 Rug', 'L201', 'L201 Rug', 'BHI', 'TSBye']

const optsDef = () => ({
  excluir: { puntos: true, medias: true, errores: false, error: 'sd', rotar: 45 },
  barras: {
    error: 'ic95', orden: 'lista', color: 'clase', puntos: true, medias: true, errores: true,
    lineas: true, valoresClase: false, rotar: 45, muestrasSel: null,
  },
  comparar: {
    error: 'sd', test: 'ninguno', control: '', rotar: 45,
    placasSel: null, ocultos: [],   // ocultos: "idPlaca|muestra" que no se muestran
    modo: 'placas',                 // 'placas' (una barra por placa) o 'medio' (las placas del mismo medio de cultivo, promediadas)
    // elementos del gráfico (cada uno se muestra u oculta por separado)
    barras: true, cajas: false, puntos: true, barrasError: true, valores: true, errores: false,
    puntosMedio: 'pocillos',        // en «por medio»: puntos y cajas con todos los pocillos, o un punto por placa
    blancos: true,                  // mostrar también los blancos
    testG: 'ninguno', controlG: '', controlM: '',   // por medio: prueba (muestra, anova o medio) y controles
  },
  archivo: { layoutBase: '', verOcultas: false },   // layoutBase: placa cuyo layout se copia a las nuevas; verOcultas: mostrar las placas ocultas
})
const deteccionDef = () => ({ metodo: 'q', usar: false, conf: '95', cvMax: 20 })
// sesiones guardadas con métodos que ya no existen (Hampel, Dixon general) pasan al test Q
const normDet = (d) => { const x = { ...deteccionDef(), ...d }; if (!['q', 'grubbs', 'cv'].includes(x.metodo)) x.metodo = 'q'; delete x.nsig; delete x.min; return x }

const nuevoId = () => Math.random().toString(36).slice(2, 10)
const MEDIOS_DEF = ['BHI', 'TSBye']
const placaVacia = (nombre) => ({
  id: nuevoId(), nombre, archivo: null, placa: null, config: [], exclManual: [], exclForzado: [], blancosUsados: null, medio: '',
})

function cargarGuardado() {
  try {
    return JSON.parse(localStorage.getItem(CLAVE)) || {}
  } catch {
    return {}
  }
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

function placasIniciales(g) {
  if (Array.isArray(g.placas) && g.placas.length) {
    return g.placas.map((p) => ({ exclManual: [], exclForzado: [], blancosUsados: null, config: [], medio: '', ...p }))
  }
  return []
}

const optsDe = (x) => {
  const d = optsDef()
  return Object.fromEntries(Object.keys(d).map((k) => [k, { ...d[k], ...(x.opts?.[k] || {}) }]))
}
const esChrome = () => /Chrome\//.test(navigator.userAgent) && !/Edg\/|OPR\/|Brave/.test(navigator.userAgent)
const estilosDe = (x) => ({
  barras: normalizarEstilo(x.estilos?.barras), excluir: normalizarEstilo(x.estilos?.excluir), comparar: normalizarEstilo(x.estilos?.comparar),
})

export default function App() {
  const g = useMemo(cargarGuardado, [])
  // Si hay un trabajo anterior con placas, no se carga solo: se le pregunta a la persona
  const [pendiente, setPendiente] = useState(() => !!(g.placas && g.placas.length))
  const gi = pendiente ? {} : g
  const [tab, setTab] = useState(gi.tab || 'archivo')
  const [avisoChrome, setAvisoChrome] = useState(() => !esChrome())
  const [menu, abrirMenu, cerrarMenu] = useMenuContextual()
  const [menuPlaca, setMenuPlaca] = useState(null)
  const [placas, setPlacas] = useState(() => placasIniciales(gi))
  const [activaId, setActivaId] = useState(() => gi.activaId || null)
  const [muestras, setMuestras] = useState(gi.muestras || MUESTRAS_DEF)
  const [medios, setMedios] = useState(gi.medios || MEDIOS_DEF)
  const [deteccion, setDeteccion] = useState(() => normDet(gi.deteccion || {}))
  const [opts, setOpts] = useState(() => optsDe(gi))
  const [estilos, setEstilos] = useState(() => estilosDe(gi))
  const [analisisMap, setAnalisisMap] = useState({})
  const [avisos, setAvisos] = useState([])
  const [motor, setMotor] = useState(true)
  const archivosRef = useRef({})        // id de placa -> File (solo mientras la pestaña está abierta)
  const arrastrada = useRef(null)       // placa que se está arrastrando en la barra de placas
  const [arrastrandoSobre, setArrastrandoSobre] = useState(null)
  const inputPlacas = useRef()

  const activa = placas.find((p) => p.id === activaId) || placas[0] || null
  useEffect(() => { if (activa && activa.id !== activaId) setActivaId(activa.id) }, [activa, activaId])

  useEffect(() => { ping().then(setMotor) }, [])

  // Todo el trabajo (incluidos los datos de cada Excel) se guarda en el navegador
  // (mientras se espera la decisión sobre el trabajo anterior no se guarda nada, para no pisarlo)
  useEffect(() => {
    if (pendiente) return
    try {
      localStorage.setItem(CLAVE, JSON.stringify({ fecha: new Date().toISOString(), tab, placas, activaId, muestras, medios, deteccion, opts, estilos }))
    } catch { /* sin almacenamiento o sin espacio */ }
  }, [pendiente, tab, placas, activaId, muestras, medios, deteccion, opts, estilos])

  const continuarAnterior = () => {
    if (g.tab) setTab(g.tab)
    setMedios(g.medios || MEDIOS_DEF)
    setPlacas(placasIniciales(g))
    setActivaId(g.activaId || null)
    setMuestras(g.muestras || MUESTRAS_DEF)
    setDeteccion(normDet(g.deteccion || {}))
    setOpts(optsDe(g))
    setEstilos(estilosDe(g))
    setPendiente(false)
  }
  const empezarDeCero = () => {
    try { localStorage.removeItem(CLAVE) } catch { /* sin almacenamiento */ }
    setPendiente(false)
  }

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
          deteccion: { metodo: deteccion.metodo, usar: deteccion.usar, conf: deteccion.conf, cvMax: Number(deteccion.cvMax) || 20 },
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

    // si se eligió una placa «base», las placas nuevas sin layout lo copian de ella (solo pocillos con datos)
    const origen = placas.find((p) => p.id === opts.archivo.layoutBase && p.config.length) || null
    const armar = (n, base) => {
      const disp = new Set(n.r.datos.map((d) => d.Pocillo))
      const hereda = origen && !base.config.length && origen.id !== base.id
      return {
        ...base,
        archivo: { nombre: n.file.name, hoja: n.hoja, hojas: n.hojas },
        placa: { datos: n.r.datos, onda: n.r.onda, fecha: n.r.fecha, preview: n.r.preview },
        ...(hereda ? { config: origen.config.filter((c) => disp.has(c.Pocillo)).map((c) => ({ ...c })), blancosUsados: origen.blancosUsados } : {}),
      }
    }
    const existentes = placas.map((p) => p.nombre)
    const creadas = []
    let primeraActiva = null
    let restantes = nuevas
    // las placas creadas de antemano (sin Excel) reciben los archivos en orden; conservan su nombre, medio y configuración
    const vacias = idDestino ? [placas.find((p) => p.id === idDestino)].filter(Boolean) : placas.filter((p) => !p.placa)
    const asignados = nuevas.slice(0, vacias.length).map((n, i) => [vacias[i], n])
    if (asignados.length) {
      asignados.forEach(([p, n]) => { archivosRef.current[p.id] = n.file })
      setPlacas((ps) => ps.map((p) => {
        const par = asignados.find(([v]) => v.id === p.id)
        return par ? armar(par[1], p) : p
      }))
      primeraActiva = asignados[0][0].id
      restantes = nuevas.slice(asignados.length)
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
    avisar((nuevas.length === 1 ? `Placa agregada: ${nuevas[0].r.datos.length} pocillos con datos.` : `${nuevas.length} placas agregadas.`)
      + (origen ? ` Se copió el layout de «${origen.nombre}».` : ''))
  }

  // Placa sin Excel: se deja lista de antemano (nombre, medio y configuración de pocillos); el Excel se carga después
  const nuevaPlacaVacia = () => {
    const sug = nombreUnico(`Placa ${placas.length + 1}`, placas.map((p) => p.nombre))
    const n = window.prompt('Nombre de la placa nueva (sin Excel por ahora)', sug)
    if (n === null) return
    const nombre = n.trim() || sug
    if (placas.some((p) => p.nombre.toLowerCase() === nombre.toLowerCase())) return avisar(`Ya hay una placa llamada «${nombre}».`, 'error')
    const p = placaVacia(nombre)
    const origen = placas.find((x) => x.id === opts.archivo.layoutBase && x.config.length)
    if (origen) { p.config = origen.config.map((c) => ({ ...c })); p.blancosUsados = origen.blancosUsados }
    setPlacas((ps) => [...ps, p])
    setActivaId(p.id)
    setTab('placa')
    avisar(`Placa «${nombre}» creada sin Excel. Configurá los pocillos y el medio; después cargá el archivo.`)
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
    setOpts((o) => ({
      ...o,
      comparar: {
        ...o.comparar,
        placasSel: o.comparar.placasSel ? o.comparar.placasSel.filter((x) => x !== id) : o.comparar.placasSel,
      },
      archivo: { ...o.archivo, layoutBase: o.archivo.layoutBase === id ? '' : o.archivo.layoutBase },
    }))
  }

  // Copia el layout (muestras, réplicas y blancos) de una placa que ya lo tiene a otra placa, solo en los pocillos con datos
  const copiarLayoutDe = (idOrigen, idDestino) => {
    const o = placas.find((p) => p.id === idOrigen)
    const d = placas.find((p) => p.id === idDestino)
    if (!o || !d || !o.config.length) return avisar('La placa elegida no tiene layout.', 'error')
    if (d.config.length && !window.confirm(`«${d.nombre}» ya tiene un layout. Se va a reemplazar. ¿Continuar?`)) return
    const disp = d.placa ? new Set(d.placa.datos.map((x) => x.Pocillo)) : null
    const cfg = o.config.filter((c) => !disp || disp.has(c.Pocillo)).map((c) => ({ ...c }))
    actualizar(idDestino, { config: cfg, exclManual: [], exclForzado: [], blancosUsados: o.blancosUsados })
    avisar(`Layout de «${o.nombre}» copiado a «${d.nombre}» (${cfg.length} pocillos).`)
  }

  // Una placa oculta queda fuera de los cálculos (comparación, informe); se ve con «Ver placas ocultas» y se puede volver a mostrar
  const ocultarPlaca = (id, v) => {
    actualizar(id, { oculta: v })
    if (v) {
      if (activaId === id) {
        const otra = placas.find((p) => p.id !== id && !p.oculta)
        if (otra) setActivaId(otra.id)
      }
      avisar('Placa oculta: queda fuera de los cálculos. Se ve con «Ver placas ocultas».')
    }
  }

  const renombrarPlaca = (id, nombre) => {
    if (!nombre) return avisar('El nombre no puede estar vacío.', 'error')
    if (placas.some((p) => p.id !== id && p.nombre.toLowerCase() === nombre.toLowerCase())) return avisar(`Ya hay una placa llamada «${nombre}».`, 'error')
    actualizar(id, { nombre })
  }

  // Cambia el orden de las pestañas de placas (arrastrando una sobre otra)
  const reordenarPlacas = (idMovida, idDestino) => {
    if (idMovida === idDestino) return
    setPlacas((ps) => {
      const mov = ps.find((p) => p.id === idMovida)
      if (!mov) return ps
      const sin = ps.filter((p) => p.id !== idMovida)
      const i = sin.findIndex((p) => p.id === idDestino)
      const posOriginal = ps.findIndex((p) => p.id === idMovida)
      const posDestino = ps.findIndex((p) => p.id === idDestino)
      // si se arrastra hacia la derecha queda después del destino; hacia la izquierda, antes
      sin.splice(posOriginal < posDestino ? i + 1 : i, 0, mov)
      return sin
    })
  }

  // Aplica un layout leído de un CSV a la placa activa o a todas (solo pocillos con datos en cada una).
  // No queda enlazado: los cambios posteriores en la pestaña Placa afectan solo a la placa activa.
  const aplicarLayout = (cfgCrudo, aTodas) => {
    const destinos = aTodas ? placas : activa ? [activa] : []
    if (!destinos.length) return avisar('No hay placas para aplicar el layout.', 'error')
    const orden = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H']
    const clave = (p) => orden.indexOf(p[0]) * 100 + Number(p.slice(1))
    let omitidos = 0
    setPlacas((ps) => ps.map((p) => {
      if (!destinos.some((d) => d.id === p.id)) return p
      const disp = p.placa ? new Set(p.placa.datos.map((d) => d.Pocillo)) : null   // sin Excel todavía: se aceptan todos los pocillos
      const cfg = cfgCrudo.filter((c) => !disp || disp.has(c.Pocillo)).map((c) => ({ ...c })).sort((a, b) => clave(a.Pocillo) - clave(b.Pocillo))
      omitidos += cfgCrudo.length - cfg.length
      return { ...p, config: cfg, exclManual: [], exclForzado: [] }
    }))
    setMuestras((m) => [...new Set([...m, ...cfgCrudo.map((c) => c.Muestra)])])
    avisar(aTodas ? `Layout aplicado a ${destinos.length} ${destinos.length === 1 ? 'placa' : 'placas'}.` : `Layout importado en «${activa.nombre}».`)
  }

  // Copia la distribución de muestras de la placa activa a las demás (solo pocillos con datos)
  const copiarConfig = () => {
    if (!activa) return
    const otras = placas.filter((p) => p.id !== activa.id)
    if (!otras.length) return avisar('No hay otras placas.', 'error')
    if (otras.some((p) => p.config.length) && !window.confirm('Las demás placas ya tienen configuración. Se va a reemplazar. ¿Continuar?')) return
    setPlacas((ps) => ps.map((p) => {
      if (p.id === activa.id) return p
      const disp = p.placa ? new Set(p.placa.datos.map((d) => d.Pocillo)) : null
      return { ...p, config: activa.config.filter((c) => !disp || disp.has(c.Pocillo)).map((c) => ({ ...c })), exclManual: [], exclForzado: [], blancosUsados: activa.blancosUsados }
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
  // La sesión guarda TODO: datos de cada Excel, layouts, exclusiones, grupos de comparación, ajustes, estilos y la pestaña abierta
  const exportarSesion = () => ({ version: 4, fecha: new Date().toISOString(), tab, activaId: activa?.id || null, placas, muestras, medios, deteccion, opts, estilos })
  const importarSesion = (x) => {
    if (Array.isArray(x?.placas)) {
      archivosRef.current = {}
      setPlacas(placasIniciales({ placas: x.placas }))
      setActivaId(x.activaId || x.placas[0]?.id || null)
      setMuestras(x.muestras || MUESTRAS_DEF)
      setMedios(x.medios || MEDIOS_DEF)
      setDeteccion(normDet(x.deteccion || {}))
      setOpts(optsDe(x))
      setEstilos(estilosDe(x))
      if (x.tab) setTab(x.tab)
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
    setDeteccion(normDet(x.deteccion || {}))
    if (x.opts) setOpts({ excluir: { ...optsDef().excluir, ...x.opts.excluir }, barras: { ...optsDef().barras, ...x.opts.barras }, comparar: optsDef().comparar })
    if (x.estilos) setEstilos((e) => ({ ...e, barras: normalizarEstilo(x.estilos.barras), excluir: normalizarEstilo(x.estilos.excluir) }))
    avisar('Sesión antigua: no traía los datos del Excel; cargá el archivo de la placa.', 'error')
  }

  const s = {
    // placas
    placas, activaId: activa?.id || null, a: activa, setActiva: setActivaId, analisisMap,
    agregarPlacas, nuevaPlacaVacia, quitarPlaca, renombrarPlaca, cambiarHoja, copiarConfig, copiarLayoutDe, reordenarPlacas, aplicarLayout,
    medios, setMedio: (id, medio) => {
      const m = (medio || '').trim()
      if (m && !medios.some((x) => x.toLowerCase() === m.toLowerCase())) setMedios((x) => [...x, m])
      actualizar(id, { medio: m ? medios.find((x) => x.toLowerCase() === m.toLowerCase()) || m : '' })
    },
    tieneArchivo: (id) => !!archivosRef.current[id],
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
        {avisoChrome && (
          <div className="banner banner-chrome">
            Este programa está pensado para <b>Google Chrome</b> (por ejemplo, el cuadro «Guardar como» para elegir la carpeta). Abrilo con Chrome para que todo funcione igual.
            <button className="chico" onClick={() => setAvisoChrome(false)}>Entendido</button>
          </div>
        )}
        {!motor && <div className="banner">No se pudo conectar con el motor de cálculo (R). Abrí la aplicación con <b>abrir_biofilm_web.bat</b>.</div>}
        <div className="barra-placas">
          {placas.filter((p) => !p.oculta || opts.archivo.verOcultas).map((p) => (
            <div key={p.id} role="tab" tabIndex={0} aria-selected={p.id === activa?.id}
              className={`chip-placa ${p.id === activa?.id ? 'activa' : ''} ${arrastrandoSobre === p.id ? 'sobre' : ''} ${p.oculta ? 'oculta' : ''}`}
              onContextMenu={(e) => { setMenuPlaca(p.id); abrirMenu(e) }}
              draggable
              onDragStart={(e) => { arrastrada.current = p.id; e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', p.id) }}
              onDragOver={(e) => { if (arrastrada.current) { e.preventDefault(); setArrastrandoSobre(p.id) } }}
              onDragLeave={() => setArrastrandoSobre((v) => (v === p.id ? null : v))}
              onDrop={(e) => { e.preventDefault(); if (arrastrada.current) reordenarPlacas(arrastrada.current, p.id); arrastrada.current = null; setArrastrandoSobre(null) }}
              onDragEnd={() => { arrastrada.current = null; setArrastrandoSobre(null) }}
              onClick={() => setActivaId(p.id)} title="Clic para ver esta placa · arrastrá para cambiar el orden · doble clic para renombrar · clic derecho: ocultar, renombrar o quitar"
              onDoubleClick={() => { const n = window.prompt('Nombre de la placa', p.nombre); if (n !== null) renombrarPlaca(p.id, n.trim()) }}>
              <i className="punto-placa" style={{ background: colores[p.id] }} />
              <span className="nombre-placa">{p.nombre}</span>
              {p.medio && <small className="medio-placa">{p.medio}</small>}
              {analisisMap[p.id] && Number.isFinite(analisisMap[p.id].odc?.odc) && <small>ODc {analisisMap[p.id].odc.odc.toFixed(3)}</small>}
              {!p.placa && <small className="sin-datos-placa">sin datos</small>}
              {p.oculta && <small className="sin-datos-placa">oculta</small>}
              <button className="x-placa" aria-label={`Quitar ${p.nombre}`} onClick={(e) => { e.stopPropagation(); quitarPlaca(p.id) }}>×</button>
            </div>
          ))}
          {placas.some((p) => p.oculta) && (
            <button className={`agregar-placa ver-ocultas ${opts.archivo.verOcultas ? 'on' : ''}`}
              onClick={() => setOpts((o) => ({ ...o, archivo: { ...o.archivo, verOcultas: !o.archivo.verOcultas } }))}
              title="Las placas ocultas quedan fuera de los cálculos, la comparación y el informe">
              {opts.archivo.verOcultas ? 'Esconder placas ocultas' : `Ver placas ocultas (${placas.filter((p) => p.oculta).length})`}
            </button>
          )}
          <button className="agregar-placa" onClick={() => inputPlacas.current.click()}>+ Agregar placa</button>
          <button className="agregar-placa" onClick={nuevaPlacaVacia} title="Crear una placa sin Excel para dejar lista su configuración, nombre y medio">+ Placa sin Excel</button>
          <input ref={inputPlacas} type="file" multiple hidden accept={ACEPTA_LIBRO}
            onChange={(e) => { agregarPlacas(e.target.files); e.target.value = '' }} />
        </div>
        <Vista s={s} />
        <MenuContextual menu={menu} items={(() => {
          const p = placas.find((x) => x.id === menuPlaca)
          if (!p) return []
          return [
            [p.oculta ? 'Mostrar placa (volver a los cálculos)' : 'Ocultar placa (queda fuera de los cálculos)', () => { cerrarMenu(); ocultarPlaca(p.id, !p.oculta) }],
            ['Renombrar…', () => { cerrarMenu(); const n = window.prompt('Nombre de la placa', p.nombre); if (n !== null) renombrarPlaca(p.id, n.trim()) }],
            ['Quitar placa…', () => { cerrarMenu(); quitarPlaca(p.id) }],
          ]
        })()} />
      </main>
      {pendiente && (
        <Modal titulo="Encontré trabajo anterior" ancho={540}
          pie={<>
            <button onClick={empezarDeCero}>Empezar de cero</button>
            <button className="primario" onClick={continuarAnterior}>Continuar con lo anterior</button>
          </>}>
          <p>
            En este navegador quedó guardado un trabajo
            {g.fecha ? <> del <b>{new Date(g.fecha).toLocaleString('es', { dateStyle: 'medium', timeStyle: 'short' })}</b></> : ''}:
          </p>
          <ul className="resumen-guardado">
            {g.placas.map((p) => (
              <li key={p.id}><b>{p.nombre}</b> <small>{p.placa ? `${p.placa.datos.length} pocillos` : 'sin datos'} · {p.config?.length || 0} configurados</small></li>
            ))}
          </ul>
          <p className="ayuda">«Continuar con lo anterior» recupera todo tal como lo dejaste. «Empezar de cero» borra ese trabajo guardado del navegador y arranca vacío (si querés conservarlo antes, cargá un archivo de sesión que hayas descargado).</p>
        </Modal>
      )}
      <GloboInfo />
      <div className="toasts">{avisos.map((a) => <div key={a.id} className={`toast ${a.tipo}`}>{a.texto}</div>)}</div>
    </div>
  )
}
