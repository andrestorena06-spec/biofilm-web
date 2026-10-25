import { useEffect, useRef, useState } from 'react'
import { Nota } from './tip.jsx'
import { Grupo, OpcionesCinta } from './cinta.jsx'
import { Icono } from './iconos.jsx'
import { listaDe } from '../grupolibre.js'

const MODOS = [
  ['libre', 'A medida', 'editar', 'Armás vos cada comparación: cepa contra cepa, una cepa entre medios, entre placas (réplicas)…'],
  ['cepas', 'Cepas', 'puntos', 'Compara cepas entre sí (por ejemplo L100A1 con L100A1 Rug y L100A1 SCV).'],
  ['serotipos', 'Serotipos', 'etiqueta', 'Compara los serotipos entre sí: las cepas de cada serotipo juntas (el serotipo de cada cepa se carga en «Datos del experimento»).'],
  ['medios', 'Medios', 'matraz', 'Compara el crecimiento de cada cepa entre los medios de cultivo.'],
  ['placas', 'Placas', 'placas', 'Compara una cepa entre las placas (réplicas): ¿se reproduce el resultado?'],
  ['concordancia', 'Concordancia', 'copiar', '¿Las placas ordenan igual a las cepas? ICC, correlaciones y CV.'],
]
export const modoBase = (o) => (o.objetivo === 'placastodas' ? 'placas' : ['libre', 'cepas', 'serotipos', 'medios', 'placas', 'concordancia'].includes(o.objetivo) ? o.objetivo : 'medios')

// «¿Qué comparar?» en la cinta de herramientas
export function GrupoModo({ o, setO }) {
  const modo = modoBase(o)
  return (
    <Grupo titulo="Qué comparar">
      <OpcionesCinta valor={modo} onChange={(v) => setO('objetivo', v)} opciones={MODOS.map(([id, t, ic, d]) => [id, t, null, ic, `${t}\n${d}`])} />
    </Grupo>
  )
}

// Lista desplegable con casillas: se tildan y destildan varias; sin ninguna tildada es «cualquiera»
function SelectMulti({ etiqueta, plural, valor, opciones, onChange }) {
  const [abierto, setAbierto] = useState(false)
  const ref = useRef(null)
  useEffect(() => {
    if (!abierto) return
    const fuera = (e) => { if (ref.current && !ref.current.contains(e.target)) setAbierto(false) }
    const tecla = (e) => { if (e.key === 'Escape') setAbierto(false) }
    document.addEventListener('mousedown', fuera)
    document.addEventListener('keydown', tecla)
    return () => { document.removeEventListener('mousedown', fuera); document.removeEventListener('keydown', tecla) }
  }, [abierto])
  const elegidas = opciones.filter((x) => valor.includes(x.id))
  const texto = !elegidas.length ? 'cualquiera' : elegidas.length <= 2 ? elegidas.map((x) => x.nombre).join(' + ') : `${elegidas.length} ${plural}`
  // se guarda en el orden de la lista
  const poner = (ids) => onChange(opciones.filter((x) => ids.includes(x.id)).map((x) => x.id))
  return (
    <div className="multi-sel" ref={ref}>
      <button type="button" className={`multi-sel-boton ${elegidas.length ? 'on' : ''}`} aria-expanded={abierto} onClick={() => setAbierto(!abierto)}
        data-tip={elegidas.length > 2 ? elegidas.map((x) => x.nombre).join('\n') : undefined}>
        <span className="multi-sel-t">{etiqueta}</span><span className="multi-sel-v">{texto}</span><Icono n="abajo" size={13} />
      </button>
      {abierto && (
        <div className="multi-sel-lista">
          <div className="multi-sel-acc">
            <button type="button" className="fantasma chico" onClick={() => poner(opciones.map((x) => x.id))}>Marcar todo</button>
            <button type="button" className="fantasma chico" onClick={() => poner([])}>Limpiar</button>
          </div>
          {opciones.map((x) => (
            <label key={x.id}>
              <input type="checkbox" checked={valor.includes(x.id)} onChange={(e) => poner(e.target.checked ? [...valor, x.id] : valor.filter((v) => v !== x.id))} />
              {x.nombre}
            </label>
          ))}
        </div>
      )}
    </div>
  )
}

// Comparador a medida: cada ANOVA es una lista de grupos; cada grupo se define con una o varias cepas, medios, placas
// y serotipos (lista vacía = cualquiera). Las sesiones anteriores guardaban un solo valor por campo: listaDe() los convierte.
const GRUPO0 = { cepa: [], medio: [], placa: [], serotipo: [] }
const uno = (v) => (v ? [v] : [])
export function ComparadorLibre({ o, setO, cepas, medios, placas, serotipos = [] }) {
  const libres = o.libres || []
  const poner = (v) => setO('libres', v)
  const c1 = cepas[0]?.id || '', c2 = cepas[1]?.id || c1, m1 = medios[0]?.id || '', m2 = medios[1]?.id || m1, p1 = placas[0]?.id || '', p2 = placas[1]?.id || p1
  const s1 = serotipos[0]?.id || '', s2 = serotipos[1]?.id || s1
  const plantillas = [
    ['Cepa vs cepa', 'Compara dos cepas entre sí (con los datos de todas las placas).', [{ ...GRUPO0, cepa: uno(c1) }, { ...GRUPO0, cepa: uno(c2) }]],
    ['Una cepa entre medios', 'Compara una cepa en BHI contra la misma cepa en TSBye (un valor por placa).', [{ ...GRUPO0, cepa: uno(c1), medio: uno(m1) }, { ...GRUPO0, cepa: uno(c1), medio: uno(m2) }]],
    ['Una cepa entre réplicas', 'Compara una cepa entre dos placas (sus pocillos): ¿se reproduce el resultado?', [{ ...GRUPO0, cepa: uno(c1), placa: uno(p1) }, { ...GRUPO0, cepa: uno(c1), placa: uno(p2) }]],
    ['Réplica vs réplica', 'Compara dos placas completas, con todas sus cepas.', [{ ...GRUPO0, placa: uno(p1) }, { ...GRUPO0, placa: uno(p2) }]],
    ...(serotipos.length >= 2 ? [['Serotipo vs serotipo', 'Compara las cepas de dos serotipos (un valor por placa y cepa).', [{ ...GRUPO0, serotipo: uno(s1) }, { ...GRUPO0, serotipo: uno(s2) }]]] : []),
  ]
  const cambiarG = (i, k, v) => poner(libres.map((c, a) => (a === i ? { ...c, grupos: c.grupos.map((g, b) => (b === k ? v : g)) } : c)))
  return (
    <div className="comparador">
      <div className="comp-plantillas">
        <span className="multi-t">Agregar una comparación<Nota>{'Cada comparación es un ANOVA aparte entre grupos. Un grupo se define con una o varias cepas, medios, placas o serotipos (tildá y destildá en cada lista); lo que dejes en «cualquiera» junta todos los datos. Si elegís varias cepas, el grupo las junta. Con dos grupos equivale a una prueba t. Al ser pruebas separadas, el error no se ajusta entre ellas.'}</Nota></span>
        <div className="comp-lista">
          {plantillas.map(([t, d, g]) => <button key={t} className="chico" data-tip={`${t}\n${d}`} onClick={() => poner([...libres, { grupos: g }])}>+ {t}</button>)}
          <button className="chico" data-tip={'Grupos vacíos para definirlos a mano'} onClick={() => poner([...libres, { grupos: [{ ...GRUPO0 }, { ...GRUPO0 }] }])}>+ En blanco</button>
          {libres.length > 0 && <button className="chico" onClick={() => poner([])}>Borrar todas</button>}
        </div>
      </div>
      {libres.map((c, i) => (
        <div key={i} className="comp-card">
          <div className="comp-card-cab">
            <b>ANOVA {i + 1}</b>
            <button className="chico" onClick={() => poner(libres.filter((_, a) => a !== i))}>Quitar</button>
          </div>
          <div className="comp-grupos">
            {c.grupos.map((g, k) => (
              <div key={k} className="comp-grupo">
                <span className="comp-grupo-t">Grupo {k + 1}{c.grupos.length > 2 && <button className="icono-x" aria-label="Quitar grupo" onClick={() => poner(libres.map((x, a) => (a === i ? { ...x, grupos: x.grupos.filter((_, b) => b !== k) } : x)))}>×</button>}</span>
                <SelectMulti etiqueta="Cepas" plural="cepas" valor={listaDe(g.cepa)} opciones={cepas} onChange={(v) => cambiarG(i, k, { ...g, cepa: v })} />
                <SelectMulti etiqueta="Medios" plural="medios" valor={listaDe(g.medio)} opciones={medios} onChange={(v) => cambiarG(i, k, { ...g, medio: v })} />
                <SelectMulti etiqueta="Placas" plural="placas" valor={listaDe(g.placa)} opciones={placas} onChange={(v) => cambiarG(i, k, { ...g, placa: v })} />
                {serotipos.length > 0 && <SelectMulti etiqueta="Serotipos" plural="serotipos" valor={listaDe(g.serotipo)} opciones={serotipos} onChange={(v) => cambiarG(i, k, { ...g, serotipo: v })} />}
              </div>
            ))}
            <button className="chico" onClick={() => poner(libres.map((x, a) => (a === i ? { ...x, grupos: [...x.grupos, { ...GRUPO0 }] } : x)))}>+ grupo</button>
          </div>
        </div>
      ))}
    </div>
  )
}

