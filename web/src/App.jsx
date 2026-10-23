import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ACEPTA_LIBRO } from './libro.js'
import { analizar, ErrorRed, hojasDe, leerPlaca, MODO, ping } from './api.js'
import { aArchivo, expNuevo, nombreArchivo, normalizarExp, placaVacia, renombrarMuestra as renMuestra } from './modelo.js'
import { listo as listoDe, TITULO_PASO } from './progreso.js'
import { PlacaTab, AnalisisTab } from './components/tabs.jsx'
import { ExcluirTab, DatosTab, MetodosTab } from './components/tabs2.jsx'
import { PlacasVista } from './components/placas.jsx'
import { GraficoPestana } from './components/graficos.jsx'
import { EstadisticaTab } from './components/estadistica.jsx'
import { Inicio } from './components/inicio.jsx'
import { Resumen } from './components/resumen.jsx'
import { EditarExperimento } from './components/editar.jsx'
import { GloboInfo } from './components/tip.jsx'
import { CintaCtx } from './components/cinta.jsx'
import { Icono, LogoPlaca } from './components/iconos.jsx'
import { Campo, MenuContextual, Modal, Select, useMenuContextual } from './components/ui.jsx'
import { descargarBlob, paletaMuestras } from './utils.js'

const CLAVE_VIEJA = 'biofilm-react-v3'            // guardado de la versión 2 (un solo trabajo)
const CLAVE_RECIENTES = 'biofilm-v3-recientes'
const CLAVE_TEMA = 'biofilm-v3-tema'
const CLAVE_MENU = 'biofilm-v3-menu-corto'
const CLAVE_CHROME = 'biofilm-v3-aviso-chrome'
const MAX_RECIENTES = 8
const leer = (k) => { try { return JSON.parse(localStorage.getItem(k)) } catch { return null } }

// pantallas: [título, vista, ícono]
const PASOS = {
  resumen: [TITULO_PASO.resumen, Resumen, 'resumen'],
  placas: [TITULO_PASO.placas, PlacasVista, 'placas'],
  pocillos: [TITULO_PASO.pocillos, PlacaTab, 'placa'],
  calidad: [TITULO_PASO.calidad, ExcluirTab, 'escudo'],
  odc: [TITULO_PASO.odc, AnalisisTab, 'umbral'],
  grafico: [TITULO_PASO.grafico, GraficoPestana, 'barras'],
  estadistica: [TITULO_PASO.estadistica, EstadisticaTab, 'sigma'],
  datos: [TITULO_PASO.datos, DatosTab, 'tabla'],
  metodos: [TITULO_PASO.metodos, MetodosTab, 'libro'],
}
const ORDEN = ['resumen', 'placas', 'pocillos', 'calidad', 'odc', 'grafico', 'estadistica', 'datos', 'metodos']
// los pasos que trabajan sobre la placa elegida van juntos en el menú
const GRUPOS = { placa: { titulo: 'Por placa', icono: 'placa', hijos: ['pocillos', 'calidad', 'odc'] } }
const grupoDe = (id) => Object.keys(GRUPOS).find((g) => GRUPOS[g].hijos.includes(id))
// pantallas que muestran la barra de placas (trabajan sobre la placa activa)
const CON_PLACAS = new Set(['pocillos', 'calidad', 'odc', 'grafico', 'datos', 'metodos'])

const esChrome = () => /Chrome\//.test(navigator.userAgent) && !/Edg\/|OPR\/|Brave/.test(navigator.userAgent)

// Recientes guardados; la primera vez se trae el trabajo guardado por la versión 2
function recientesIniciales() {
  const r = leer(CLAVE_RECIENTES)
  if (Array.isArray(r)) return r.filter((x) => x?.exp?.placas)
  const g = leer(CLAVE_VIEJA)
  if (g?.placas?.length) {
    try { const n = normalizarExp(g); return [{ fecha: g.fecha || new Date().toISOString(), exp: n.exp, tab: n.tab, activaId: n.activaId }] } catch { /* nada */ }
  }
  return []
}

export default function App() {
  const [tema, setTema] = useState(() => leer(CLAVE_TEMA) || 'claro')
  const [menuCorto, setMenuCorto] = useState(() => leer(CLAVE_MENU) || false)
  const [menuMovil, setMenuMovil] = useState(false)
  const [gruposCerrados, setGruposCerrados] = useState([])
  const [recientes, setRecientes] = useState(recientesIniciales)
  const [exp, setExp] = useState(null)
  const [tab, setTab] = useState('resumen')
  const [enArchivo, setEnArchivo] = useState(true)
  const [activaId, setActivaId] = useState(null)
  const [editar, setEditar] = useState(false)
  const [avisoChrome, setAvisoChrome] = useState(() => !esChrome() && !leer(CLAVE_CHROME))
  const [nodoCinta, setNodoCinta] = useState(null)
  const [analisisMap, setAnalisisMap] = useState({})
  const [avisos, setAvisos] = useState([])
  const [motor, setMotor] = useState(true)
  const [menu, abrirMenu, cerrarMenu] = useMenuContextual()
  const [menuPlaca, setMenuPlaca] = useState(null)
  const [renombrar, setRenombrar] = useState(null)        // { id, nombre }
  const [placaNueva, setPlacaNueva] = useState(null)      // { nombre, medio }
  const archivosRef = useRef({})        // id de placa -> File (solo mientras la pestaña está abierta)
  const arrastrada = useRef(null)
  const [arrastrandoSobre, setArrastrandoSobre] = useState(null)
  const inputPlacas = useRef()
  const inputSesion = useRef()

  useEffect(() => {
    document.documentElement.dataset.tema = tema
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', tema === 'oscuro' ? '#150C01' : '#3A2003')
    try { localStorage.setItem(CLAVE_TEMA, JSON.stringify(tema)) } catch { /* sin almacenamiento */ }
  }, [tema])
  useEffect(() => { try { localStorage.setItem(CLAVE_MENU, JSON.stringify(menuCorto)) } catch { /* nada */ } }, [menuCorto])
  useEffect(() => { ping().then(setMotor) }, [])

  const avisar = useCallback((texto, tipo = 'ok') => {
    const id = Math.random()
    setAvisos((a) => [...a, { id, texto, tipo }])
    setTimeout(() => setAvisos((a) => a.filter((x) => x.id !== id)), 4500)
  }, [])

  // ---------- guardado automático en «Recientes» (máximo 8; si no hay lugar se guardan menos) ----------
  useEffect(() => {
    if (!exp) return
    const t = setTimeout(() => setRecientes((rs) => {
      const nuevo = [{ fecha: new Date().toISOString(), exp, tab, activaId }, ...rs.filter((r) => r.exp?.id !== exp.id)].slice(0, MAX_RECIENTES)
      for (let n = nuevo.length; n > 0; n--) {
        try { localStorage.setItem(CLAVE_RECIENTES, JSON.stringify(nuevo.slice(0, n))); return nuevo.slice(0, n) } catch { /* sin espacio */ }
      }
      return nuevo
    }), 600)
    return () => clearTimeout(t)
  }, [exp, tab, activaId])
  const borrarReciente = (r) => setRecientes((rs) => {
    const n = rs.filter((x) => x.exp?.id !== r.exp?.id)
    try { localStorage.setItem(CLAVE_RECIENTES, JSON.stringify(n)) } catch { /* nada */ }
    return n
  })

  // ---------- deshacer / rehacer (los cambios seguidos, a menos de 0,7 s, cuentan como uno) ----------
  const expRef = useRef(null)
  expRef.current = exp
  const hist = useRef({ pasado: [], futuro: [], ultimo: 0 })
  const [, setNHist] = useState(0)
  const upd = useCallback((patch) => {
    const h = hist.current, ahora = Date.now()
    if (expRef.current && ahora - h.ultimo > 700) { h.pasado.push(expRef.current); if (h.pasado.length > 80) h.pasado.shift() }
    h.ultimo = ahora
    h.futuro = []
    setNHist((n) => n + 1)
    setExp((e) => (e ? { ...e, ...(typeof patch === 'function' ? patch(e) : patch) } : e))
  }, [])
  const deshacer = useCallback(() => {
    const h = hist.current
    if (!h.pasado.length) return
    h.futuro.push(expRef.current); h.ultimo = 0
    setExp(h.pasado.pop()); setNHist((n) => n + 1)
  }, [])
  const rehacer = useCallback(() => {
    const h = hist.current
    if (!h.futuro.length) return
    h.pasado.push(expRef.current); h.ultimo = 0
    setExp(h.futuro.pop()); setNHist((n) => n + 1)
  }, [])

  // ---------- abrir, crear y guardar ----------
  const abrir = (n, aviso) => {
    hist.current = { pasado: [], futuro: [], ultimo: 0 }
    archivosRef.current = {}
    setAnalisisMap({}); claves.current = {}
    setExp(n.exp); setTab(n.tab || 'resumen'); setActivaId(n.activaId || n.exp.placas[0]?.id || null); setEnArchivo(false); setMenuMovil(false)
    if (aviso) avisar(aviso)
    ;(n.avisos || []).forEach((a) => avisar(a, 'error'))
  }
  const nuevo = (archivos) => {
    abrir({ exp: expNuevo(), tab: 'placas', activaId: null }, 'Experimento nuevo: cargá el Excel de cada placa.')
    if (archivos?.length) setTimeout(() => agregarPlacasRef.current(archivos), 0)
  }
  const guardar = useCallback(() => {
    const e = expRef.current
    if (!e) return
    descargarBlob(new Blob([JSON.stringify(aArchivo(e, tab, activaId))], { type: 'application/json' }), nombreArchivo(e))
  }, [tab, activaId])
  const cargarSesion = async (file) => {
    try { abrir(normalizarExp(JSON.parse(await file.text())), `«${file.name}» abierto.`) } catch (e) { avisar(`No se pudo abrir «${file.name}»: ${e.message}`, 'error') }
  }
  const abrirReciente = (r) => { try { abrir({ ...normalizarExp(r.exp), tab: r.tab, activaId: r.activaId }, `«${r.exp.info?.nombre || 'Experimento'}» abierto.`) } catch (e) { avisar(e.message, 'error') } }

  useEffect(() => {
    const k = (ev) => {
      if (!(ev.ctrlKey || ev.metaKey)) return
      const t = ev.key.toLowerCase()
      if (t === 's') { ev.preventDefault(); guardar(); return }
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)) return
      if (t === 'z' && !ev.shiftKey) { ev.preventDefault(); deshacer() }
      else if (t === 'y' || (t === 'z' && ev.shiftKey)) { ev.preventDefault(); rehacer() }
    }
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [deshacer, rehacer, guardar])

  // ---------- estado derivado ----------
  const placas = exp?.placas || []
  const activa = placas.find((p) => p.id === activaId) || placas.find((p) => !p.oculta) || placas[0] || null
  useEffect(() => { if (activa && activa.id !== activaId) setActivaId(activa.id) }, [activa, activaId])
  const setPlacas = useCallback((f) => upd((e) => ({ placas: typeof f === 'function' ? f(e.placas) : f })), [upd])
  const actualizar = useCallback((id, cambios) => setPlacas((ps) => ps.map((p) => (p.id === id ? { ...p, ...(typeof cambios === 'function' ? cambios(p) : cambios) } : p))), [setPlacas])

  // ---------- análisis de cada placa (en R o en el navegador, según el modo) ----------
  const versiones = useRef({})
  const claves = useRef({})
  const deteccion = exp?.deteccion
  useEffect(() => {
    if (!exp) return
    const t = setTimeout(() => {
      placas.forEach((p) => {
        if (!p.placa || !p.config.length) {
          if (claves.current[p.id] !== 'vacia') { claves.current[p.id] = 'vacia'; setAnalisisMap((m) => ({ ...m, [p.id]: null })) }
          return
        }
        const clave = JSON.stringify([p.config, p.exclManual, p.exclForzado, p.blancosUsados, deteccion, p.placa.datos])
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
  }, [placas, deteccion, avisar]) // eslint-disable-line react-hooks/exhaustive-deps

  const analisis = activa ? analisisMap[activa.id] || null : null
  const muestras = exp?.muestras || []
  const ordenMuestras = useMemo(() => {
    const pres = [...new Set((analisis?.estado || []).map((e) => e.Muestra))]
    return [...muestras.filter((m) => pres.includes(m)), ...pres.filter((m) => !muestras.includes(m))]
  }, [analisis, muestras])
  const ejeOD = Number.isFinite(activa?.placa?.onda) ? `DO a ${activa.placa.onda} nm` : 'Densidad óptica (OD)'

  // ---------- placas: agregar, quitar, renombrar, copiar configuración ----------
  const nombreUnico = (base, existentes) => {
    let n = base, i = 2
    while (existentes.includes(n)) n = `${base} (${i++})`
    return n
  }
  // Cada archivo se agrega como una placa; cada hoja de Excel que contenga una placa también.
  const agregarPlacas = async (files, idDestino = null) => {
    const nuevas = [], errores = []
    for (const file of Array.from(files)) {
      try {
        const { hojas } = await hojasDe(file)
        const lecturas = []
        for (const hoja of hojas) {
          try { lecturas.push({ hoja, r: await leerPlaca(file, hoja) }) } catch (e) { if (hojas.length === 1) throw e }
        }
        if (!lecturas.length) throw new Error('No encontré una placa (filas A a H con valores numéricos) en ninguna hoja.')
        const base = file.name.replace(/\.[^.]+$/, '')
        lecturas.forEach(({ hoja, r }) => nuevas.push({ file, hoja, hojas, r, nombre: lecturas.length > 1 ? `${base} · ${hoja}` : base }))
      } catch (e) {
        errores.push(`${file.name}: ${e.message}`)
      }
    }
    errores.forEach((m) => avisar(m, 'error'))
    if (!nuevas.length) return
    const e = expRef.current
    const origen = e.placas.find((p) => p.id === e.opts.archivo.layoutBase && p.config.length) || null
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
    const existentes = e.placas.map((p) => p.nombre)
    const creadas = []
    let primeraActiva = null, restantes = nuevas
    // las placas creadas de antemano (sin datos) reciben los archivos en orden; conservan su nombre, medio y configuración
    const vacias = idDestino ? [e.placas.find((p) => p.id === idDestino)].filter(Boolean) : e.placas.filter((p) => !p.placa)
    const asignados = nuevas.slice(0, vacias.length).map((n, i) => [vacias[i], n])
    if (asignados.length) {
      asignados.forEach(([p, n]) => { archivosRef.current[p.id] = n.file })
      primeraActiva = asignados[0][0].id
      restantes = nuevas.slice(asignados.length)
    }
    restantes.forEach((n) => {
      const p = armar(n, placaVacia(nombreUnico(n.nombre, [...existentes, ...creadas.map((c) => c.nombre)])))
      archivosRef.current[p.id] = n.file
      creadas.push(p)
      if (!primeraActiva) primeraActiva = p.id
    })
    setPlacas((ps) => [...ps.map((p) => { const par = asignados.find(([v]) => v.id === p.id); return par ? armar(par[1], p) : p }), ...creadas])
    setActivaId(primeraActiva)
    avisar((nuevas.length === 1 ? `Placa agregada: ${nuevas[0].r.datos.length} pocillos con datos.` : `${nuevas.length} placas agregadas.`)
      + (origen ? ` Se copió el layout de «${origen.nombre}».` : ''))
  }
  const agregarPlacasRef = useRef(agregarPlacas)
  agregarPlacasRef.current = agregarPlacas

  // Placa sin Excel: se deja lista de antemano (nombre, medio y pocillos); los datos se cargan después o se escriben a mano
  const crearPlacaVacia = ({ nombre: n, medio }) => {
    const sug = nombreUnico(`Placa ${placas.length + 1}`, placas.map((p) => p.nombre))
    const nombre = (n || '').trim() || sug
    if (placas.some((p) => p.nombre.toLowerCase() === nombre.toLowerCase())) return avisar(`Ya hay una placa llamada «${nombre}».`, 'error')
    const p = { ...placaVacia(nombre), medio: medio || '' }
    const origen = placas.find((x) => x.id === exp.opts.archivo.layoutBase && x.config.length)
    if (origen) { p.config = origen.config.map((c) => ({ ...c })); p.blancosUsados = origen.blancosUsados }
    setPlacas((ps) => [...ps, p])
    setActivaId(p.id)
    setPlacaNueva(null)
    avisar(`Placa «${nombre}» creada sin datos: cargá el Excel o escribí las OD a mano en «Placas».`)
  }
  const cambiarHoja = async (id, hoja) => {
    const file = archivosRef.current[id]
    if (!file) return avisar('Para cambiar de hoja hay que volver a cargar el archivo.', 'error')
    try {
      const r = await leerPlaca(file, hoja)
      actualizar(id, (p) => ({ archivo: { ...p.archivo, hoja }, placa: { datos: r.datos, onda: r.onda, fecha: r.fecha, preview: r.preview } }))
    } catch (e) { avisar(e.message, 'error') }
  }
  const quitarPlaca = (id) => {
    const p = placas.find((x) => x.id === id)
    if (!p) return
    delete archivosRef.current[id]
    upd((e) => ({
      placas: e.placas.filter((x) => x.id !== id),
      opts: { ...e.opts, comparar: { ...e.opts.comparar, placasFuera: (e.opts.comparar.placasFuera || []).filter((x) => x !== id),
        ePlacasFuera: e.opts.comparar.ePlacasFuera ? e.opts.comparar.ePlacasFuera.filter((x) => x !== id) : e.opts.comparar.ePlacasFuera },
      archivo: { ...e.opts.archivo, layoutBase: e.opts.archivo.layoutBase === id ? '' : e.opts.archivo.layoutBase } },
    }))
    avisar(`Placa «${p.nombre}» quitada (Ctrl + Z para deshacer).`)
  }
  const copiarLayoutDe = (idOrigen, idDestino) => {
    const o = placas.find((p) => p.id === idOrigen), d = placas.find((p) => p.id === idDestino)
    if (!o || !d || !o.config.length) return avisar('La placa elegida no tiene layout.', 'error')
    const disp = d.placa ? new Set(d.placa.datos.map((x) => x.Pocillo)) : null
    const cfg = o.config.filter((c) => !disp || disp.has(c.Pocillo)).map((c) => ({ ...c }))
    actualizar(idDestino, { config: cfg, exclManual: [], exclForzado: [], blancosUsados: o.blancosUsados })
    avisar(`Layout de «${o.nombre}» copiado a «${d.nombre}» (${cfg.length} pocillos).`)
  }
  const ocultarPlaca = (id, v) => {
    actualizar(id, { oculta: v })
    if (v) {
      if (activaId === id) { const otra = placas.find((p) => p.id !== id && !p.oculta); if (otra) setActivaId(otra.id) }
      avisar('Placa oculta: queda fuera de los cálculos. Se ve con «Ver ocultas».')
    }
  }
  const renombrarPlaca = (id, nombre) => {
    if (!nombre) return avisar('El nombre no puede estar vacío.', 'error')
    if (placas.some((p) => p.id !== id && p.nombre.toLowerCase() === nombre.toLowerCase())) return avisar(`Ya hay una placa llamada «${nombre}».`, 'error')
    actualizar(id, { nombre })
  }
  const reordenarPlacas = (idMovida, idDestino) => {
    if (idMovida === idDestino) return
    setPlacas((ps) => {
      const mov = ps.find((p) => p.id === idMovida)
      if (!mov) return ps
      const sin = ps.filter((p) => p.id !== idMovida)
      const i = sin.findIndex((p) => p.id === idDestino)
      sin.splice(ps.findIndex((p) => p.id === idMovida) < ps.findIndex((p) => p.id === idDestino) ? i + 1 : i, 0, mov)
      return sin
    })
  }
  // Aplica un layout leído de un CSV a la placa activa o a todas (solo pocillos con datos en cada una)
  const aplicarLayout = (cfgCrudo, aTodas) => {
    const destinos = aTodas ? placas : activa ? [activa] : []
    if (!destinos.length) return avisar('No hay placas para aplicar el layout.', 'error')
    const orden = 'ABCDEFGH'
    const clave = (p) => orden.indexOf(p[0]) * 100 + Number(p.slice(1))
    upd((e) => ({
      placas: e.placas.map((p) => {
        if (!destinos.some((d) => d.id === p.id)) return p
        const disp = p.placa ? new Set(p.placa.datos.map((d) => d.Pocillo)) : null
        const cfg = cfgCrudo.filter((c) => !disp || disp.has(c.Pocillo)).map((c) => ({ ...c })).sort((a, b) => clave(a.Pocillo) - clave(b.Pocillo))
        return { ...p, config: cfg, exclManual: [], exclForzado: [] }
      }),
      muestras: [...new Set([...e.muestras, ...cfgCrudo.map((c) => c.Muestra)])],
    }))
    avisar(aTodas ? `Layout aplicado a ${destinos.length} ${destinos.length === 1 ? 'placa' : 'placas'}.` : `Layout importado en «${activa.nombre}».`)
  }
  const copiarConfig = () => {
    if (!activa) return
    const otras = placas.filter((p) => p.id !== activa.id)
    if (!otras.length) return avisar('No hay otras placas.', 'error')
    setPlacas((ps) => ps.map((p) => {
      if (p.id === activa.id) return p
      const disp = p.placa ? new Set(p.placa.datos.map((d) => d.Pocillo)) : null
      return { ...p, config: activa.config.filter((c) => !disp || disp.has(c.Pocillo)).map((c) => ({ ...c })), exclManual: [], exclForzado: [], blancosUsados: activa.blancosUsados }
    }))
    avisar(`Layout copiado a ${otras.length} ${otras.length === 1 ? 'placa' : 'placas'} (Ctrl + Z para deshacer).`)
  }
  // OD escritas o pegadas a mano: { A1: 0.523, ... }
  const ponerDatosManual = (id, valores, onda) => {
    const datos = Object.entries(valores).filter(([, v]) => Number.isFinite(v)).map(([Pocillo, OD]) => ({ Pocillo, OD }))
      .sort((a, b) => 'ABCDEFGH'.indexOf(a.Pocillo[0]) * 100 + Number(a.Pocillo.slice(1)) - ('ABCDEFGH'.indexOf(b.Pocillo[0]) * 100 + Number(b.Pocillo.slice(1))))
    actualizar(id, (p) => ({
      placa: datos.length ? { datos, onda: Number.isFinite(onda) ? onda : p.placa?.onda ?? null, fecha: p.placa?.fecha || new Date().toLocaleDateString('es'), preview: null, manual: true } : null,
      archivo: datos.length ? { nombre: 'Cargada a mano', hoja: null, hojas: [] } : null,
    }))
  }

  // ---------- exclusión de pocillos (placa activa) ----------
  const alternarPocillo = (p) => {
    const r = analisis?.estado?.find((e) => e.Pocillo === p)
    if (!r || !activa) return
    const { exclManual, exclForzado } = activa
    const uniq = (a) => [...new Set(a)]
    if (r.Usado) actualizar(activa.id, { exclForzado: r.Forzado ? exclForzado.filter((x) => x !== p) : exclForzado, exclManual: uniq([...exclManual, p]) })
    else if (r.Manual) actualizar(activa.id, { exclManual: exclManual.filter((x) => x !== p), exclForzado: r.Sospechoso && deteccion.usar && !r.Forzado ? uniq([...exclForzado, p]) : exclForzado })
    else if (r.AutoExcl) actualizar(activa.id, { exclForzado: uniq([...exclForzado, p]) })
  }

  const irA = (p) => { setTab(p); setEnArchivo(false); setMenuMovil(false); document.querySelector('.principal')?.scrollTo(0, 0) }
  const listo = (id) => listoDe(id, exp, analisisMap)
  const setOpts = (o) => upd((e) => ({ opts: typeof o === 'function' ? o(e.opts) : o }))

  const s = exp && {
    exp, upd, info: exp.info, avisar, irA, guardar, listo, abrirEditar: () => setEditar(true), tema,
    // placas
    placas, activaId: activa?.id || null, a: activa, setActiva: setActivaId, analisisMap, setPlacas,
    agregarPlacas, nuevaPlacaVacia: () => setPlacaNueva({ nombre: '', medio: '' }), quitarPlaca, renombrarPlaca, pedirRenombre: (p) => setRenombrar({ id: p.id, nombre: p.nombre }),
    cambiarHoja, copiarConfig, copiarLayoutDe, reordenarPlacas, aplicarLayout, ocultarPlaca, ponerDatosManual,
    medios: exp.medios, setMedio: (id, medio) => {
      const m = (medio || '').trim()
      upd((e) => {
        const existe = e.medios.find((x) => x.toLowerCase() === m.toLowerCase())
        return { medios: m && !existe ? [...e.medios, m] : e.medios, placas: e.placas.map((p) => (p.id === id ? { ...p, medio: m ? existe || m : '' } : p)) }
      })
    },
    tieneArchivo: (id) => !!archivosRef.current[id],
    // datos de la placa activa
    archivo: activa?.archivo || null, placa: activa?.placa || null,
    config: activa?.config || [], setConfig: (c) => activa && actualizar(activa.id, { config: c }),
    blancosUsados: activa?.blancosUsados ?? null, setBlancosUsados: (b) => activa && actualizar(activa.id, { blancosUsados: b }),
    analisis, ordenMuestras, ejeOD,
    // globales
    muestras, setMuestras: (m) => upd((e) => ({ muestras: typeof m === 'function' ? m(e.muestras) : m })),
    deteccion: exp.deteccion, setDeteccion: (d) => upd({ deteccion: d }),
    opts: exp.opts, setOpts, estilos: exp.estilos, setEstilos: (x) => upd((e) => ({ estilos: typeof x === 'function' ? x(e.estilos) : x })),
    alternarPocillo,
    restablecerExclusiones: () => { if (activa) { actualizar(activa.id, { exclManual: [], exclForzado: [] }); avisar('Exclusiones restablecidas en esta placa.') } },
    renombrarMuestra: (viejo, nuevo) => {
      if (!nuevo) return avisar('El nombre no puede estar vacío.', 'error')
      if (muestras.some((m) => m !== viejo && m.toLowerCase() === nuevo.toLowerCase())) return avisar(`Ya existe una muestra llamada «${nuevo}».`, 'error')
      upd((e) => renMuestra(e, viejo, nuevo))
    },
  }

  // ---------- barra de estado ----------
  const estado = (() => {
    if (!exp) return 'Sin experimento abierto · los experimentos se guardan solos en «Recientes»'
    const vis = placas.filter((p) => !p.oculta)
    const an = vis.map((p) => analisisMap[p.id]).filter((a) => a?.resumen?.length)
    const cepas = new Set(an.flatMap((a) => a.resumen.map((r) => r.Muestra)))
    const p = [`${vis.length} ${vis.length === 1 ? 'placa' : 'placas'}`, `${cepas.size} ${cepas.size === 1 ? 'muestra analizada' : 'muestras analizadas'}`]
    const medios = [...new Set(vis.map((x) => x.medio).filter(Boolean))]
    if (medios.length) p.push(medios.join(' y '))
    if (analisis && Number.isFinite(analisis.odc?.odc)) p.push(`ODc de ${activa.nombre} = ${analisis.odc.odc.toFixed(3)}`)
    p.push(MODO === 'web' ? 'cálculos en este equipo' : 'motor R')
    p.push('guardado automático en «Recientes»')
    return p.join(' · ')
  })()

  const pasos = ORDEN
  const Vista = exp && !enArchivo ? PASOS[tab][1] : null
  const colores = paletaMuestras(placas.map((p) => p.id))
  const verPlacas = Vista && CON_PLACAS.has(tab) && !(tab === 'grafico' && exp.opts.comparar.vistaG === 'comparar')

  return (
    <CintaCtx.Provider value={nodoCinta}>
      <div className="app">
        <header className="barra-titulo">
          <button className="titulo-boton solo-movil" onClick={() => setMenuMovil(!menuMovil)} aria-label="Menú"><Icono n={menuMovil ? 'x' : 'hamburguesa'} size={18} /></button>
          <LogoPlaca /><b>Biofilm</b>
          {exp && <button className="titulo-exp" onClick={() => setEditar(true)} data-tip={'Datos del experimento\nNombre, fecha, condiciones, notas, muestras y medios'}>{exp.info.nombre}</button>}
          <span className="espacio" />
          {exp && <>
            <button className="titulo-boton" onClick={deshacer} disabled={!hist.current.pasado.length} aria-label="Deshacer" data-tip="Deshacer (Ctrl + Z)"><Icono n="deshacer" size={16} /></button>
            <button className="titulo-boton" onClick={rehacer} disabled={!hist.current.futuro.length} aria-label="Rehacer" data-tip="Rehacer (Ctrl + Y)"><Icono n="rehacer" size={16} /></button>
            <button className="titulo-boton solo-compu" onClick={guardar} aria-label="Guardar" data-tip={'Guardar (Ctrl + S)\nDescarga la sesión completa (.biofilm.json) con los datos de todas las placas'}><Icono n="guardar" size={16} /></button>
          </>}
          <button className="titulo-boton" onClick={() => setTema(tema === 'oscuro' ? 'claro' : 'oscuro')} aria-label="Tema" data-tip="Cambiar entre tema claro y oscuro">
            <Icono n={tema === 'oscuro' ? 'sol' : 'luna'} size={15} />
          </button>
        </header>
        <div className="cuerpo-app">
          {menuMovil && <div className="velo-menu solo-movil" onClick={() => setMenuMovil(false)} />}
          <nav className={`menu-lateral ${menuCorto ? 'corto' : ''} ${menuMovil ? 'abierto' : ''}`}>
            <button className={`item-menu archivo ${enArchivo || !exp ? 'on' : ''}`} onClick={() => { setEnArchivo(true); setMenuMovil(false) }} data-tip={menuCorto ? 'Archivo' : undefined}>
              <span className="ico"><Icono n="carpeta" size={18} /></span><span className="txt">Archivo</span>
            </button>
            {exp && <div className="sep-menu" />}
            {exp && (() => {
              const item = (id, sub) => (
                <button key={id} className={`item-menu ${sub ? 'sub' : ''} ${!enArchivo && tab === id ? 'on' : ''}`} onClick={() => irA(id)} data-tip={menuCorto ? PASOS[id][0] : undefined}>
                  <span className="ico"><Icono n={PASOS[id][2]} size={sub ? 16 : 18} />{listo(id) && <i className="hecho" aria-label="listo"><Icono n="check" size={9} ancho={4} /></i>}</span>
                  <span className="txt">{PASOS[id][0]}</span>
                </button>
              )
              const hechos = new Set()
              return pasos.map((id) => {
                const g = grupoDe(id)
                if (!g) return item(id, false)
                if (hechos.has(g)) return null
                hechos.add(g)
                const hijos = GRUPOS[g].hijos
                const activo = !enArchivo && hijos.includes(tab)
                const abierto = !gruposCerrados.includes(g)
                return (
                  <div key={g} className={`grupo-menu ${activo ? 'activo' : ''}`}>
                    <div className="fila-grupo">
                      <button className="item-menu cabeza" onClick={() => { setGruposCerrados((c) => c.filter((x) => x !== g)); if (!activo) irA(hijos[0]) }} data-tip={menuCorto ? GRUPOS[g].titulo : 'Pasos que se hacen en cada placa'}>
                        <span className="ico"><Icono n={GRUPOS[g].icono} size={18} />{hijos.every((h) => listo(h)) && <i className="hecho" aria-label="listo"><Icono n="check" size={9} ancho={4} /></i>}</span>
                        <span className="txt">{GRUPOS[g].titulo}</span>
                      </button>
                      <button className="plegar-grupo txt" onClick={() => setGruposCerrados((c) => (c.includes(g) ? c.filter((x) => x !== g) : [...c, g]))} aria-expanded={abierto} aria-label={abierto ? 'Plegar' : 'Desplegar'}>
                        <Icono n="abajo" size={16} style={{ transform: abierto ? 'none' : 'rotate(-90deg)', transition: 'transform .15s' }} />
                      </button>
                    </div>
                    {abierto && <div className="submenu">{hijos.map((h) => item(h, true))}</div>}
                  </div>
                )
              })
            })()}
            <span className="espacio" />
            <button className="item-menu plegar" onClick={() => setMenuCorto(!menuCorto)} data-tip={menuCorto ? 'Mostrar los nombres' : 'Solo íconos'}>
              <span className="ico"><Icono n="flecha" size={16} style={{ transform: menuCorto ? 'none' : 'rotate(180deg)' }} /></span><span className="txt">Contraer</span>
            </button>
          </nav>
          <div className="zona-trabajo">
            <div className="cinta" ref={setNodoCinta} />
            <main className="principal">
              {Vista && (() => {
                const i = pasos.indexOf(tab), g = grupoDe(tab)
                const ant = pasos[i - 1], sig = pasos[i + 1]
                return (
                  <nav className="migas no-imprimir" aria-label="Ubicación">
                    <span className="ruta">{g && <span>{GRUPOS[g].titulo}</span>}<b>{PASOS[tab][0]}</b>{g && activa && <em className="placa-migas">· {activa.nombre}</em>}</span>
                    <span className="paso-n">paso {i + 1} de {pasos.length}</span>
                    <span className="espacio" />
                    {ant && <button className="fantasma chico" onClick={() => irA(ant)} data-tip={`Anterior: ${PASOS[ant][0]}`}><Icono n="flecha" size={13} style={{ transform: 'rotate(180deg)' }} />{PASOS[ant][0]}</button>}
                    {sig && <button className="chico" onClick={() => irA(sig)} data-tip={`Siguiente: ${PASOS[sig][0]}`}>{PASOS[sig][0]}<Icono n="flecha" size={13} /></button>}
                  </nav>
                )
              })()}
              <div className="pagina">
                {avisoChrome && (
                  <div className="aviso-caja info fila">
                    <span style={{ flex: 1 }}>El programa está pensado para <b>Google Chrome</b> (por ejemplo, el cuadro «Guardar como» para elegir la carpeta). En otros navegadores las descargas van directo a la carpeta de descargas.</span>
                    <button className="chico" onClick={() => { setAvisoChrome(false); try { localStorage.setItem(CLAVE_CHROME, 'true') } catch { /* nada */ } }}>Entendido</button>
                  </div>
                )}
                {!motor && <div className="aviso-caja error">No se pudo conectar con el motor de cálculo (R). Abrí la aplicación con <b>abrir_biofilm_web.bat</b>.</div>}
                {verPlacas && (
                  <div className="barra-placas" role="tablist" aria-label="Placas">
                    {placas.filter((p) => !p.oculta || exp.opts.archivo.verOcultas).map((p) => {
                      const an = analisisMap[p.id]
                      return (
                        <div key={p.id} role="tab" tabIndex={0} aria-selected={p.id === activa?.id}
                          className={`chip-placa ${p.id === activa?.id ? 'activa' : ''} ${arrastrandoSobre === p.id ? 'sobre' : ''} ${p.oculta ? 'oculta' : ''}`}
                          onContextMenu={(e) => { setMenuPlaca(p.id); abrirMenu(e) }}
                          draggable
                          onDragStart={(e) => { arrastrada.current = p.id; e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', p.id) }}
                          onDragOver={(e) => { if (arrastrada.current) { e.preventDefault(); setArrastrandoSobre(p.id) } }}
                          onDragLeave={() => setArrastrandoSobre((v) => (v === p.id ? null : v))}
                          onDrop={(e) => { e.preventDefault(); if (arrastrada.current) reordenarPlacas(arrastrada.current, p.id); arrastrada.current = null; setArrastrandoSobre(null) }}
                          onDragEnd={() => { arrastrada.current = null; setArrastrandoSobre(null) }}
                          onClick={() => setActivaId(p.id)} onKeyDown={(e) => e.key === 'Enter' && setActivaId(p.id)}
                          onDoubleClick={() => setRenombrar({ id: p.id, nombre: p.nombre })}
                          data-tip={`${p.nombre}${p.medio ? ` · ${p.medio}` : ''}\n${p.placa ? `${p.placa.datos.length} pocillos con datos · ${p.config.length} configurados` : 'Sin datos todavía'}${an && Number.isFinite(an.odc?.odc) ? `\nODc = ${an.odc.odc.toFixed(4)}` : ''}\nClic: ver esta placa · arrastrar: cambiar el orden · doble clic: renombrar · clic derecho: más opciones`}>
                          <i className="punto-placa" style={{ background: colores[p.id] }} />
                          <span className="nombre-placa">{p.nombre}</span>
                          {p.medio && <small className="medio-placa">{p.medio}</small>}
                          {!p.placa && <small className="sin-datos-placa">sin datos</small>}
                          {p.oculta && <small className="sin-datos-placa">oculta</small>}
                        </div>
                      )
                    })}
                    {placas.some((p) => p.oculta) && (
                      <button className={`agregar-placa ${exp.opts.archivo.verOcultas ? 'on' : ''}`} onClick={() => setOpts((o) => ({ ...o, archivo: { ...o.archivo, verOcultas: !o.archivo.verOcultas } }))}
                        data-tip="Las placas ocultas quedan fuera de los cálculos, la comparación y el informe">
                        {exp.opts.archivo.verOcultas ? 'Esconder ocultas' : `Ver ocultas (${placas.filter((p) => p.oculta).length})`}
                      </button>
                    )}
                    <button className="agregar-placa" onClick={() => inputPlacas.current.click()} data-tip={'Agregar placas\nUno o varios Excel: cada archivo (o cada hoja con una placa) es una placa'}><Icono n="mas" size={14} />Placa</button>
                  </div>
                )}
                {exp && verPlacas && !placas.length && <div className="vacio"><b>Todavía no hay placas</b><div>Cargá el Excel de cada lectura en «Placas».</div><div style={{ marginTop: 12 }}><button className="primario" onClick={() => irA('placas')}>Ir a Placas</button></div></div>}
                {enArchivo || !exp
                  ? <Inicio exp={exp} recientes={recientes} onNuevo={nuevo} onAbrir={() => inputSesion.current.click()} onAbrirArchivo={cargarSesion}
                    onAbrirReciente={abrirReciente} onBorrarReciente={borrarReciente} onGuardar={guardar} onVolver={() => setEnArchivo(false)} />
                  : (!verPlacas || placas.length > 0) && <Vista s={s} key={tab} />}
              </div>
            </main>
          </div>
        </div>
        <footer className="barra-estado">{estado}</footer>
        <input ref={inputPlacas} type="file" multiple hidden accept={ACEPTA_LIBRO} onChange={(e) => { agregarPlacas(e.target.files); e.target.value = '' }} />
        <input ref={inputSesion} type="file" hidden accept=".json" onChange={(e) => { if (e.target.files[0]) cargarSesion(e.target.files[0]); e.target.value = '' }} />
        <MenuContextual menu={menu} items={(() => {
          const p = placas.find((x) => x.id === menuPlaca)
          if (!p) return []
          return [
            [p.oculta ? 'Mostrar placa (volver a los cálculos)' : 'Ocultar placa (queda fuera de los cálculos)', () => { cerrarMenu(); ocultarPlaca(p.id, !p.oculta) }],
            ['Renombrar…', () => { cerrarMenu(); setRenombrar({ id: p.id, nombre: p.nombre }) }],
            ['Quitar placa', () => { cerrarMenu(); quitarPlaca(p.id) }],
          ]
        })()} />
        {renombrar && (
          <Modal titulo="Renombrar placa" onClose={() => setRenombrar(null)} ancho={420}
            pie={<><button onClick={() => setRenombrar(null)}>Cancelar</button><button className="primario" onClick={() => { renombrarPlaca(renombrar.id, renombrar.nombre.trim()); setRenombrar(null) }}>Guardar</button></>}>
            <Campo label="Nombre de la placa"><input autoFocus value={renombrar.nombre} onChange={(e) => setRenombrar({ ...renombrar, nombre: e.target.value })}
              onKeyDown={(e) => { if (e.key === 'Enter') { renombrarPlaca(renombrar.id, renombrar.nombre.trim()); setRenombrar(null) } }} /></Campo>
            <p className="ayuda">Este nombre aparece en la barra de placas, en los gráficos y en las comparaciones.</p>
          </Modal>
        )}
        {placaNueva && exp && (
          <Modal titulo="Placa sin Excel" onClose={() => setPlacaNueva(null)} ancho={460}
            pie={<><button onClick={() => setPlacaNueva(null)}>Cancelar</button><button className="primario" onClick={() => crearPlacaVacia(placaNueva)}>Crear placa</button></>}>
            <p className="ayuda" style={{ marginTop: 0 }}>Queda lista con su nombre, medio y pocillos; los datos se cargan después desde el Excel o se escriben a mano.</p>
            <Campo label="Nombre"><input autoFocus value={placaNueva.nombre} placeholder={`Placa ${placas.length + 1}`} onChange={(e) => setPlacaNueva({ ...placaNueva, nombre: e.target.value })}
              onKeyDown={(e) => e.key === 'Enter' && crearPlacaVacia(placaNueva)} /></Campo>
            <Campo label="Medio de cultivo"><Select value={placaNueva.medio} onChange={(v) => setPlacaNueva({ ...placaNueva, medio: v })} opciones={[['', '(sin indicar)'], ...exp.medios.map((m) => [m, m])]} /></Campo>
          </Modal>
        )}
        {editar && s && <EditarExperimento s={s} onClose={() => setEditar(false)} />}
        <GloboInfo />
        <div className="toasts">{avisos.map((a) => <div key={a.id} className={`toast ${a.tipo}`}>{a.texto}</div>)}</div>
      </div>
    </CintaCtx.Provider>
  )
}
