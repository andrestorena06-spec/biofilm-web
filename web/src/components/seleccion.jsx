import { Desplegable } from './desplegable.jsx'
import { Select } from './ui.jsx'
import { Check } from './ui.jsx'
import { Nota } from './tip.jsx'
import { PanelPruebas, juntarDe } from './pruebas.jsx'

const MODOS = [
  ['cepas', 'Cepas', 'Compara cepas entre sí (por ejemplo L100A1 con L100A1 Rug y L100A1 SCV).'],
  ['medios', 'Medios', 'Compara el crecimiento de cada cepa entre los medios de cultivo.'],
  ['placas', 'Placas', 'Compara una cepa entre las placas (réplicas): ¿se reproduce el resultado?'],
  ['concordancia', 'Concordancia', '¿Las placas ordenan igual a las cepas? ICC, correlaciones y CV.'],
]
export const modoBase = (o) => (o.objetivo === 'placastodas' ? 'placas' : ['cepas', 'medios', 'placas', 'concordancia'].includes(o.objetivo) ? o.objetivo : 'medios')

export function SelectorModo({ o, setO }) {
  const modo = modoBase(o)
  return (
    <div className="seg seg-modo">
      {MODOS.map(([id, t, d]) => <button key={id} type="button" className={modo === id ? 'on' : ''} data-tip={`${t}\n${d}`} onClick={() => setO('objetivo', id)}>{t}</button>)}
    </div>
  )
}

// Lista de elementos con selección múltiple (undefined = todos)
function Multi({ titulo, tip, todos, sel, onSel, comparado, colores }) {
  const activos = sel ? todos.filter((x) => sel.includes(x.id)) : todos
  const resumen = activos.length === todos.length ? 'todas' : activos.length === 0 ? 'ninguna' : activos.length <= 2 ? activos.map((x) => x.nombre).join(', ') : `${activos.length} de ${todos.length}`
  const poner = (ids) => onSel(ids.length === todos.length ? undefined : ids)
  return (
    <div className={`multi ${comparado ? 'comparado' : ''}`}>
      <span className="multi-t">{titulo}{comparado && <em> · se comparan</em>}<Nota>{tip}</Nota></span>
      <Desplegable etiqueta={`${activos.length}/${todos.length}`} resumen={resumen} ancho={280}>
        <div className="fila-ctrl" style={{ margin: '0 0 6px' }}>
          <button className="chico" onClick={() => poner(todos.map((x) => x.id))}>Todas</button>
          <button className="chico" onClick={() => onSel([])}>Ninguna</button>
        </div>
        <div className="lista-check">
          {todos.map((x) => (
            <Check key={x.id} label={<>{colores && colores[x.id] && <i className="punto-placa" style={{ background: colores[x.id] }} />} {x.nombre}{x.sub && <small className="medio-placa">{x.sub}</small>}</>}
              checked={activos.some((a) => a.id === x.id)} onChange={(v) => poner(v ? todos.filter((t) => t.id === x.id || activos.some((a) => a.id === t.id)).map((t) => t.id) : activos.filter((a) => a.id !== x.id).map((a) => a.id))} />
          ))}
        </div>
      </Desplegable>
    </div>
  )
}

// Cada comparación es un ANOVA aparte entre los elementos que elijas (p. ej. L100A1 vs L100A1 Rug, y por otro lado L100A1 vs L100A1 SCV)
function Comparaciones({ pool, sets, onSets, nombreFactor }) {
  const nombre = (id) => pool.find((x) => x.id === id)?.nombre || id
  const ids = pool.map((x) => x.id)
  const actuales = (sets || []).map((S) => S.filter((x) => ids.includes(x)))
  const cambiar = (i, S) => onSets(actuales.map((x, k) => (k === i ? S : x)))
  return (
    <div className="comparaciones">
      <span className="multi-t">ANOVAs a realizar<Nota>{'Cada comparación es un ANOVA separado entre los elementos que elijas. Con dos elementos equivale a una prueba t. Al ser pruebas separadas, el error no se ajusta entre ellas: para controlar el error de todas contra un mismo control usá un solo ANOVA con «Contra un control».'}</Nota></span>
      <div className="comp-lista">
        {!sets && <span className="comp-chip" data-tip={`Un solo ANOVA con todas las ${nombreFactor} seleccionadas`}>Todas juntas (un ANOVA)</span>}
        {actuales.map((S, i) => (
          <span key={i} className="comp-chip">
            <Desplegable etiqueta={`ANOVA ${i + 1}`} resumen={S.map(nombre).join(' vs ') || '(vacío)'} ancho={260}>
              <div className="lista-check">
                {pool.map((x) => <Check key={x.id} label={x.nombre} checked={S.includes(x.id)} onChange={(v) => cambiar(i, v ? [...S, x.id] : S.filter((y) => y !== x.id))} />)}
              </div>
              <button className="chico" onClick={() => onSets(actuales.filter((_, k) => k !== i))}>Quitar este ANOVA</button>
            </Desplegable>
          </span>
        ))}
        <button className="chico" onClick={() => onSets([...actuales, ids.slice(0, 2)])} disabled={ids.length < 2}>+ Agregar ANOVA</button>
        {sets && <button className="chico" onClick={() => onSets(undefined)}>Todas juntas</button>}
        {ids.length > 2 && (
          <span className="comp-ctrl" data-tip={'Crea un ANOVA por cada par: el elemento que elijas contra cada uno de los demás'}>
            <Select value="" onChange={(c) => c && onSets(ids.filter((x) => x !== c).map((x) => [c, x]))} opciones={[['', 'Un ANOVA por par con…'], ...pool.map((x) => [x.id, x.nombre])]} />
          </span>
        )}
      </div>
    </div>
  )
}

// Barra horizontal debajo de las placas: qué grupos se comparan y con qué datos. Las hipótesis de abajo se arman con esta selección.
export function BarraSeleccion({ s, D, o, setO }) {
  const modo = modoBase(o)
  const juntar = juntarDe(o)
  const cepasTodas = D.muestras.filter((m) => !D.esBlanco.has(m) && D.placasSel.some((p) => s.analisisMap[p.id].resumen.some((r) => r.Muestra === m))).map((m) => ({ id: m, nombre: m }))
  const mediosTodos = D.mediosPres.map((m) => ({ id: m, nombre: m }))
  const placasTodas = D.placasSel.map((p) => ({ id: p.id, nombre: p.nombre, sub: p.medio || '' }))
  const nomsC = (o.eCepas ? cepasTodas.filter((x) => o.eCepas.includes(x.id)) : cepasTodas).map((x) => x.nombre)
  const nomsM = (o.eMedios ? mediosTodos.filter((x) => o.eMedios.includes(x.id)) : mediosTodos).map((x) => x.nombre)
  const nomsP = (o.ePlacas ? placasTodas.filter((x) => o.ePlacas.includes(x.id)) : placasTodas).map((x) => x.nombre)
  const lista = (a) => (a.length ? a.join(', ') : '(ninguno)')
  const puedeJuntar = modo === 'cepas' || modo === 'placas'
  const frase = {
    cepas: `Se comparan las cepas ${lista(nomsC)} ${juntar ? `con los datos de ${lista(nomsM)} juntos` : `dentro de cada medio (${lista(nomsM)})`}, con las placas ${lista(nomsP)}.`,
    medios: `Se compara la OD de cada cepa (${lista(nomsC)}) entre los medios ${lista(nomsM)}, con las placas ${lista(nomsP)}.`,
    placas: `Se compara cada cepa (${lista(nomsC)}) entre las placas ${lista(nomsP)}${juntar ? ', sin separar por medio' : ', solo entre placas del mismo medio'}.`,
    concordancia: '',
  }[modo]
  return (
    <section className="barra-seleccion">
      <div className="barra-fila">
        <div className="barra-modo">
          <span className="multi-t">¿Qué comparar?<Nota>Elegí qué grupos se enfrentan; los otros dos paneles filtran los datos que se usan. Debajo se formulan las hipótesis con tu selección.</Nota></span>
          <SelectorModo o={o} setO={setO} />
        </div>
        {modo !== 'concordancia' && (
          <>
            <Multi titulo="Cepas" tip="Cepas o muestras incluidas." todos={cepasTodas} sel={o.eCepas} onSel={(v) => setO('eCepas', v)} comparado={modo === 'cepas'} />
            <Multi titulo="Medios" tip="Medios de cultivo incluidos (el medio se define en cada placa, pestaña «Placa»)." todos={mediosTodos} sel={o.eMedios} onSel={(v) => setO('eMedios', v)} comparado={modo === 'medios'} />
            <Multi titulo="Placas" tip="Placas incluidas: cada una es una réplica biológica. Se pueden ocultar placas en «Gráfico › Comparar»." todos={placasTodas} sel={o.ePlacas} onSel={(v) => setO('ePlacas', v)} comparado={modo === 'placas'} />
            {puedeJuntar && <Check label="Separar por medio" checked={!juntar} onChange={(v) => setO('juntar', !v)} ayuda={modo === 'cepas' ? 'Activado: las cepas se comparan dentro de cada medio. Desactivado: se juntan los datos de todos los medios.' : 'Activado: solo se comparan placas del mismo medio. Desactivado: se comparan todas las placas, aunque tengan distinto medio.'} />}
          </>
        )}
      </div>
      {modo !== 'concordancia' && (
        <>
          {(() => {
            const pool = { cepas: cepasTodas, medios: mediosTodos, placas: placasTodas }[modo].filter((x) => ({ cepas: nomsC, medios: nomsM, placas: nomsP })[modo].includes(x.nombre))
            return <Comparaciones pool={pool} nombreFactor={modo} sets={o.sets && o.sets[modo]} onSets={(v) => setO('sets', { ...(o.sets || {}), [modo]: v })} />
          })()}
          <PanelPruebas o={o} setO={setO} D={D} sinObjetivos horizontal />
          {frase && <p className="frase-sel">{frase}</p>}
        </>
      )}
    </section>
  )
}
