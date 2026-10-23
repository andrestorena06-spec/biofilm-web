import { Select } from './ui.jsx'
import { Nota } from './tip.jsx'
import { Grupo, OpcionesCinta } from './cinta.jsx'

const MODOS = [
  ['libre', 'A medida', 'editar', 'Armás vos cada comparación: cepa contra cepa, una cepa entre medios, entre placas (réplicas)…'],
  ['cepas', 'Cepas', 'puntos', 'Compara cepas entre sí (por ejemplo L100A1 con L100A1 Rug y L100A1 SCV).'],
  ['medios', 'Medios', 'matraz', 'Compara el crecimiento de cada cepa entre los medios de cultivo.'],
  ['placas', 'Placas', 'placas', 'Compara una cepa entre las placas (réplicas): ¿se reproduce el resultado?'],
  ['concordancia', 'Concordancia', 'copiar', '¿Las placas ordenan igual a las cepas? ICC, correlaciones y CV.'],
]
export const modoBase = (o) => (o.objetivo === 'placastodas' ? 'placas' : ['libre', 'cepas', 'medios', 'placas', 'concordancia'].includes(o.objetivo) ? o.objetivo : 'medios')

// «¿Qué comparar?» en la cinta de herramientas
export function GrupoModo({ o, setO }) {
  const modo = modoBase(o)
  return (
    <Grupo titulo="Qué comparar">
      <OpcionesCinta valor={modo} onChange={(v) => setO('objetivo', v)} opciones={MODOS.map(([id, t, ic, d]) => [id, t, null, ic, `${t}\n${d}`])} />
    </Grupo>
  )
}

// Comparador a medida: cada ANOVA es una lista de grupos; cada grupo se define con cepa, medio y placa (cualquiera = sin fijar)
const GRUPO0 = { cepa: '', medio: '', placa: '' }
export function ComparadorLibre({ o, setO, cepas, medios, placas }) {
  const libres = o.libres || []
  const poner = (v) => setO('libres', v)
  const c1 = cepas[0]?.id || '', c2 = cepas[1]?.id || c1, m1 = medios[0]?.id || '', m2 = medios[1]?.id || m1, p1 = placas[0]?.id || '', p2 = placas[1]?.id || p1
  const plantillas = [
    ['Cepa vs cepa', 'Compara dos cepas entre sí (con los datos de todas las placas).', [{ ...GRUPO0, cepa: c1 }, { ...GRUPO0, cepa: c2 }]],
    ['Una cepa entre medios', 'Compara una cepa en BHI contra la misma cepa en TSBye (un valor por placa).', [{ ...GRUPO0, cepa: c1, medio: m1 }, { ...GRUPO0, cepa: c1, medio: m2 }]],
    ['Una cepa entre réplicas', 'Compara una cepa entre dos placas (sus pocillos): ¿se reproduce el resultado?', [{ ...GRUPO0, cepa: c1, placa: p1 }, { ...GRUPO0, cepa: c1, placa: p2 }]],
    ['Réplica vs réplica', 'Compara dos placas completas, con todas sus cepas.', [{ ...GRUPO0, placa: p1 }, { ...GRUPO0, placa: p2 }]],
  ]
  const cambiarG = (i, k, v) => poner(libres.map((c, a) => (a === i ? { ...c, grupos: c.grupos.map((g, b) => (b === k ? v : g)) } : c)))
  const sel = (lista, vacio) => [['', vacio], ...lista.map((x) => [x.id, x.nombre])]
  return (
    <div className="comparador">
      <div className="comp-plantillas">
        <span className="multi-t">Agregar una comparación<Nota>{'Cada comparación es un ANOVA aparte entre grupos. Un grupo se define con una cepa, un medio y/o una placa; lo que dejes en «cualquiera» junta todos los datos. Con dos grupos equivale a una prueba t. Al ser pruebas separadas, el error no se ajusta entre ellas.'}</Nota></span>
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
                <Select value={g.cepa} onChange={(v) => cambiarG(i, k, { ...g, cepa: v })} opciones={sel(cepas, 'cepa: cualquiera')} />
                <Select value={g.medio} onChange={(v) => cambiarG(i, k, { ...g, medio: v })} opciones={sel(medios, 'medio: cualquiera')} />
                <Select value={g.placa} onChange={(v) => cambiarG(i, k, { ...g, placa: v })} opciones={sel(placas, 'placa: cualquiera')} />
              </div>
            ))}
            <button className="chico" onClick={() => poner(libres.map((x, a) => (a === i ? { ...x, grupos: [...x.grupos, { ...GRUPO0 }] } : x)))}>+ grupo</button>
          </div>
        </div>
      ))}
    </div>
  )
}

