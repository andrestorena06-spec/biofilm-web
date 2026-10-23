// Pestaña «Estadística».
// Orden: 1) en la cinta, qué se compara (placas, medios, cepas, a medida o concordancia) y cómo; 2) «Qué se compara»: fichas
// seleccionables con la cepa, el medio y las placas; 3) dos paneles que se actualizan juntos: a la izquierda los grupos que se
// comparan (cada valor y de dónde sale) y a la derecha el resultado de la prueba; 4) el resumen de todas las cepas (un clic
// pone esa cepa en los paneles); 5) los modelos con todas las cepas juntas y el diagnóstico de supuestos, plegados.
import { useMemo } from 'react'
import { Nota } from './tip.jsx'
import { Select, Vacio } from './ui.jsx'
import { BotonCinta, CampoCinta, Cinta, Grupo, OpcionesCinta } from './cinta.jsx'
import { Chip, DiagnosticoGlobal, Hip, MatrizP, NOMBRE_TEST, Tabla, diagnosticoGlobal, f, hipotesisGrupos, juntarDe, lecturaDe, pTxt } from './pruebas.jsx'
import { ComparadorLibre, GrupoModo, modoBase } from './seleccion.jsx'
import { ReproTab } from './repro.jsx'
import { armarComparacion } from '../comparacion.js'
import { analizar, anidada, parcelasDivididas, placaCepa } from '../decision.js'
import { desvio, marcaSig, media } from '../estadistica.js'
import { COLOR_CLASE, fmtTick, ticksBonitos } from '../utils.js'

const finito = Number.isFinite
const SIN_MEDIO = '(sin medio)'
const UNIDAD = { od: 'OD', ln: 'ln(OD)', odc: 'OD ÷ ODc' }

// Valores de cada cepa en cada placa: uno por placa (la OD media de sus pocillos aceptados) y uno por pocillo
function prepararDatos(s, D, variable) {
  const fx = (y, odc) => (variable === 'ln' ? (y > 0 ? Math.log(y) : NaN) : variable === 'odc' ? (odc > 0 ? y / odc : NaN) : y)
  const orden = [...new Set(s.placas.map((p) => p.medio).filter(Boolean))]
  const placas = [...D.conAnalisis].sort((a, b) => (a.medio ? orden.indexOf(a.medio) : 999) - (b.medio ? orden.indexOf(b.medio) : 999))
  const obsPlaca = [], obsPozo = [], fuera = []
  placas.forEach((p) => {
    const a = s.analisisMap[p.id], odc = a.odc?.odc, medio = p.medio || SIN_MEDIO
    a.resumen.forEach((r) => {
      const y = finito(r.Media) ? fx(r.Media, odc) : NaN
      if (finito(y)) obsPlaca.push({ cepa: r.Muestra, medio, placaId: p.id, placa: p.nombre, y, etq: p.nombre, clase: r.Clasificacion })
    })
    a.estado.forEach((e) => {
      if (e.EsBlanco) return
      if (!e.Usado) { fuera.push({ cepa: e.Muestra, placaId: p.id, etq: `${p.nombre} · ${e.Pocillo}`, od: e.OD, motivo: e.Manual ? 'excluido a mano' : 'valor atípico' }); return }
      const y = fx(e.OD, odc)
      if (finito(y)) obsPozo.push({ cepa: e.Muestra, medio, placaId: p.id, placa: p.nombre, y, etq: `${p.nombre} · ${e.Pocillo}` })
    })
  })
  const presentes = [...new Set(obsPlaca.map((x) => x.cepa))]
  const cepas = [...s.muestras.filter((m) => presentes.includes(m)), ...presentes.filter((m) => !s.muestras.includes(m))]
  const medios = orden.filter((m) => placas.some((p) => p.medio === m))
  return { placas, obsPlaca, obsPozo, fuera, cepas, medios }
}

// ---------------------------------------------------------------
// fichas seleccionables
// ---------------------------------------------------------------
function Fichas({ etiqueta, tip, opciones, activa, onClick, multi, extra }) {
  return (
    <div className="fila-sel">
      <span className="fila-sel-t">{etiqueta}{tip && <Nota>{tip}</Nota>}</span>
      <div className="fichas">
        {opciones.map((x) => (
          <button key={x.id} type="button" className={`ficha ${activa(x.id) ? 'on' : ''} ${multi ? 'multi' : ''}`} disabled={x.desactivada} data-tip={x.tip} onClick={() => onClick(x.id)}>
            {multi && <i className="caja-ficha" aria-hidden>{activa(x.id) ? '✓' : ''}</i>}
            {x.color && <i className="punto" style={{ background: x.color }} />}
            {x.texto}{x.sub && <small>{x.sub}</small>}
          </button>
        ))}
        {extra}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------
// gráfico de los grupos: cada punto es un valor que entra en la prueba (placa o pocillo), con la media ± DE y la letra
// ---------------------------------------------------------------
function Dispersion({ grupos, letras, colorDe, unidad }) {
  const vals = grupos.flatMap((g) => g.v)
  if (!vals.length) return null
  const W = 560, H = 270, m = { l: 50, r: 12, t: 22, b: 58 }
  const lo = Math.min(0, ...vals), hi = Math.max(...vals, 1e-9)
  const t = ticksBonitos(lo, hi * 1.08, 5)
  const y = (v) => m.t + (1 - (v - t.min) / (t.max - t.min)) * (H - m.t - m.b)
  const band = (W - m.l - m.r) / grupos.length
  const corto = (s, n) => (s.length > n ? s.slice(0, n - 1) + '…' : s)
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="dispersion" role="img" aria-label="Valores de cada grupo">
      <rect width={W} height={H} fill="#FFFDF9" rx="8" />
      {t.ticks.map((v) => (
        <g key={v}>
          <line x1={m.l} x2={W - m.r} y1={y(v)} y2={y(v)} stroke="#EFE3CF" />
          <text x={m.l - 6} y={y(v) + 4} textAnchor="end" fontSize="10.5" fill="#8A6A49">{fmtTick(v, t.paso)}</text>
        </g>
      ))}
      <text transform={`translate(13 ${(m.t + H - m.b) / 2}) rotate(-90)`} textAnchor="middle" fontSize="11" fill="#8A6A49">{unidad}</text>
      {grupos.map((g, i) => {
        const cx = m.l + band * (i + 0.5)
        const mu = g.v.length ? media(g.v) : NaN, sd = g.v.length > 1 ? desvio(g.v) : 0
        const paso = Math.min(band * 0.07, 7)
        return (
          <g key={g.nombre}>
            {i % 2 === 1 && <rect x={cx - band / 2} y={m.t} width={band} height={H - m.t - m.b} fill="#FBF3E6" opacity=".7" />}
            {finito(mu) && (
              <g data-tip={`${g.nombre}\nx̄ = ${f(mu, 4)}${g.v.length > 1 ? `\nDE = ${f(sd, 4)}` : ''}\nn = ${g.v.length}`}>
                {sd > 0 && <g stroke="#3A2005" strokeWidth="1.3"><line x1={cx} x2={cx} y1={y(mu - sd)} y2={y(mu + sd)} /><line x1={cx - 7} x2={cx + 7} y1={y(mu + sd)} y2={y(mu + sd)} /><line x1={cx - 7} x2={cx + 7} y1={y(mu - sd)} y2={y(mu - sd)} /></g>}
                <line x1={cx - Math.min(band * 0.32, 34)} x2={cx + Math.min(band * 0.32, 34)} y1={y(mu)} y2={y(mu)} stroke="#A8650F" strokeWidth="3" strokeLinecap="round" />
              </g>
            )}
            {g.det.map((d, k) => (
              <circle key={k} cx={cx + ((k % 5) - 2) * paso + 0.5 * paso * (Math.floor(k / 5) % 2)} cy={y(d.y)} r="4.2" fill={colorDe(d)} fillOpacity=".9" stroke="#fff" strokeWidth="1"
                data-tip={`${g.nombre}\n${d.etq}: ${f(d.y, 4)}`} />
            ))}
            {letras?.[g.nombre] && <text x={cx} y={m.t - 6} textAnchor="middle" fontSize="13" fontWeight="700" fill="#993C1D">{letras[g.nombre]}</text>}
            <text x={cx} y={H - m.b + 16} textAnchor="middle" fontSize="11.5" fontWeight="600" fill="#3A2005">{corto(g.nombre, Math.max(6, Math.floor(band / 6.5)))}</text>
            <text x={cx} y={H - m.b + 30} textAnchor="middle" fontSize="10.5" fill="#8A6A49">n = {g.v.length}</text>
          </g>
        )
      })}
      <line x1={m.l} x2={W - m.r} y1={H - m.b} y2={H - m.b} stroke="#B08A55" />
    </svg>
  )
}

// ---------------------------------------------------------------
// panel izquierdo: los grupos que se comparan
// ---------------------------------------------------------------
function PanelGrupos({ foco, unidad, nivelTxt, colorDe, fuera, comp, onCtrl }) {
  const { grupos, r } = foco
  const ctrl = foco.ctrl
  const letra = (g) => {
    if (!r?.ok) return '–'
    if (ctrl) {
      if (g.nombre === ctrl) return 'control'
      const p = r.pares.find((x) => x.a === g.nombre)
      return p && finito(p.pa) ? (p.pa < 0.05 ? `≠ ${marcaSig(p.pa)}` : '=') : '–'
    }
    return r.letras?.[g.nombre] || '–'
  }
  return (
    <section className="tarjeta panel-est">
      <div className="cabeza-tarjeta"><span className="etiqueta-seccion">Grupos que se comparan</span><span className="ayuda">{unidad} · {nivelTxt}</span></div>
      <h2 className="pregunta">{foco.pregunta}</h2>
      {comp === 'control' && grupos.length > 1 && (
        <label className="campo fila-control"><span>Grupo control</span>
          <Select value={ctrl || ''} onChange={onCtrl} opciones={grupos.filter((g) => g.v.length).map((g) => [g.nombre, g.nombre])} /></label>
      )}
      {grupos.some((g) => g.v.length) ? (
        <>
          <div className="figura"><Dispersion grupos={grupos} letras={ctrl ? null : r?.ok ? r.letras : null} colorDe={colorDe} unidad={unidad} /></div>
          <div className="tabla-scroll">
            <table className="tabla compacta">
              <thead><tr><th>Grupo</th><th className="num">n</th><th className="num">Media</th><th className="num">DE</th><th className="num">CV %</th><th>{ctrl ? 'Contra el control' : 'Letra'}</th></tr></thead>
              <tbody>
                {grupos.map((g) => {
                  const mu = g.v.length ? media(g.v) : NaN, sd = g.v.length > 1 ? desvio(g.v) : NaN
                  return (
                    <tr key={g.nombre} className={!g.v.length ? 'fuera' : ''}>
                      <td data-tip={g.v.length ? `${g.nombre}: valores que entran\n${g.det.map((d) => `${d.etq}: ${f(d.y, 4)}`).join('\n')}` : 'Sin datos con esta selección'}><b>{g.nombre}</b></td>
                      <td className="num">{g.v.length}</td>
                      <td className="num">{f(mu, 3)}</td>
                      <td className="num">{f(sd, 3)}</td>
                      <td className="num">{finito(sd) && mu ? f((100 * sd) / Math.abs(mu), 1) : '–'}</td>
                      <td><b>{letra(g)}</b></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <p className="ayuda nota-panel">
            {ctrl ? 'Cada grupo se compara con el control; «≠» difiere (p ajustado < 0,05), «=» no se distingue.' : 'Grupos con la misma letra no difieren (p ajustado ≥ 0,05).'}
            {fuera.length > 0 && <span data-tip={`Pocillos que no entran\n${fuera.map((x) => `${x.etq} (${x.cepa}): OD ${f(x.od, 3)} — ${x.motivo}`).join('\n')}`}> {fuera.length} {fuera.length === 1 ? 'pocillo excluido' : 'pocillos excluidos'} en esta selección (pasá el mouse).</span>}
          </p>
        </>
      ) : <Vacio texto="No hay datos con esta selección." />}
    </section>
  )
}

// ---------------------------------------------------------------
// panel derecho: el resultado de la prueba
// ---------------------------------------------------------------
function PanelResultado({ foco, alDesarrollo, extra }) {
  const { r, ctrl } = foco
  if (!r) return <section className="tarjeta panel-est"><Vacio texto="Elegí al menos 2 grupos con datos." /></section>
  if (!r.ok) return <section className="tarjeta panel-est"><div className="cabeza-tarjeta"><span className="etiqueta-seccion">Resultado</span></div><Vacio titulo="No se puede hacer la prueba" texto={r.motivo} /></section>
  const p = r.global.p, sig = p < 0.05
  const dunnett = r.pares[0]?.metodo === 'Dunnett'
  const hip = hipotesisGrupos(r.tipo, foco.sujeto, foco.factor, r.grupos, ctrl, dunnett)
  const sw = r.sw, lev = r.lev
  return (
    <section className="tarjeta panel-est">
      <div className="cabeza-tarjeta"><span className="etiqueta-seccion">Resultado de la estadística</span><span className="ayuda">α = 0,05</span></div>
      <div className={`veredicto ${sig ? 'dif' : 'ok'}`}>
        <b>{sig ? 'Hay diferencias' : 'No hay diferencia clara'}</b>
        <span>{NOMBRE_TEST[r.tipo]} · {r.global.est} = {f(r.global.valor, 3)}{r.global.df2 ? ` (${r.global.df1}; ${f(r.global.df2, 1)} gl)` : ` (${r.global.df1} gl)`} · p = {pTxt(p)} {sig ? marcaSig(p) : ''}</span>
      </div>
      <p className="lectura">{lecturaDe(r, ctrl)}</p>
      <Hip titulo="Hipótesis" items={hip.slice(0, 1)} />

      <h4>Cómo se eligió la prueba</h4>
      <div className="indicadores">
        <div className="ind" data-tip={sw ? `Normalidad de los residuos (Shapiro-Wilk)\nW = ${f(sw.W, 3)}, p = ${pTxt(sw.p)}\nCon menos de 8 datos tiene poco poder: no decide` : 'Hacen falta al menos 3 datos con variación'}>
          <small>Normalidad</small>{sw ? <Chip tipo={sw.p < 0.05 ? 'alerta' : 'ok'}>{sw.p < 0.05 ? 'No normal' : 'Normal'} · p {pTxt(sw.p)}</Chip> : <Chip tipo="neutro">sin datos</Chip>}
        </div>
        <div className="ind" data-tip={lev ? `Igualdad de varianzas (Levene, Brown-Forsythe)\nF = ${f(lev.F, 3)}, p = ${pTxt(lev.p)}\nmayor DE / menor DE = ${f(lev.razonSD, 2)}` : 'Levene necesita 3 o más datos por grupo'}>
          <small>Varianzas</small>{lev ? <Chip tipo={lev.p < 0.05 ? 'alerta' : 'ok'}>{lev.p < 0.05 ? 'Distintas' : 'Parecidas'} · p {pTxt(lev.p)}</Chip> : <Chip tipo="neutro">no calculable</Chip>}
        </div>
        <div className="ind" data-tip={r.razon}><small>Prueba</small><Chip tipo="prueba">{NOMBRE_TEST[r.tipo]}</Chip></div>
      </div>
      <p className="razon-test">{r.razon}{dunnett && ` Contra el control se usó la prueba de Dunnett (p ajustado exacto).`}</p>

      {r.pares.length > 0 && (
        <>
          <h4>{ctrl ? `Cada grupo contra «${ctrl}»` : 'Comparaciones de a pares'} <small className="ayuda">· p ajustado por {r.pares[0]?.metodo || 'Holm'}</small></h4>
          <div className="tabla-scroll">
            <table className="tabla compacta">
              <thead><tr><th>Par</th><th className="num">Diferencia</th><th className="num">p ajustado</th><th>Resultado</th></tr></thead>
              <tbody>
                {r.pares.map((x) => (
                  <tr key={x.a + '|' + x.b}>
                    <td data-tip={`${x.a}: x̄ = ${f(x.ma, 4)}\n${x.b}: x̄ = ${f(x.mb, 4)}\n${r.tipo === 'kw' ? 'z de Dunn' : 't'} = ${f(x.est, 3)}${finito(x.df) ? ` · gl = ${f(x.df, 1)}` : ''}\np sin ajustar = ${pTxt(x.p)}`}>{x.a} vs {x.b}</td>
                    <td className="num">{f(x.dif, 3)}</td>
                    <td className="num">{pTxt(x.pa)}</td>
                    <td className={finito(x.pa) && x.pa < 0.05 ? 'dif-txt' : 'tenue'}>{!finito(x.pa) ? 'faltan datos' : x.pa < 0.05 ? `distintos ${marcaSig(x.pa)}` : 'sin diferencia'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!ctrl && r.grupos.length > 3 && <MatrizP r={r} />}
        </>
      )}

      <details className="plegable">
        <summary>Tabla de la prueba global{r.tipo === 'anova' ? ' (ANOVA)' : ''}</summary>
        <Tabla cols={['Prueba', 'Estadístico', 'gl', 'p']} filas={[[r.global.nombre, `${r.global.est} = ${f(r.global.valor, 3)}`, r.global.df2 ? `${r.global.df1}; ${f(r.global.df2, 2)}` : r.global.df1, pTxt(p)]]} />
        {r.tipo === 'anova' && r.global.tabla && (
          <Tabla cols={['Fuente', 'Suma de cuadrados', 'gl', 'Cuadrado medio', 'F', 'p']}
            filas={[['Entre grupos', f(r.global.tabla.ssb, 6), r.global.tabla.df1, f(r.global.tabla.msb, 6), f(r.global.tabla.F, 3), pTxt(r.global.tabla.p)],
              ['Dentro (error)', f(r.global.tabla.ssw, 6), r.global.tabla.df2, f(r.global.tabla.msw, 6), '', ''], ['Total', f(r.global.tabla.sst, 6), r.global.tabla.df1 + r.global.tabla.df2, '', '', '']]} />
        )}
      </details>
      {extra}
      <button className="chico" onClick={alDesarrollo}>Ver el cálculo paso a paso<Nota>Abre «Métodos» con esta misma comparación desarrollada: residuos, Levene, la prueba y los pares.</Nota></button>
    </section>
  )
}

// ---------------------------------------------------------------
// resumen de todas las cepas: valores por placa (agrupadas por medio) y el resultado de cada una
// ---------------------------------------------------------------
function ResumenTodas({ titulo, nota, placas, apagadas, filas, conMedia, medios, colResultado }) {
  const grupos = []
  placas.forEach((p) => { const md = p.medio || SIN_MEDIO; const g = grupos.find((x) => x.medio === md); if (g) g.placas.push(p); else grupos.push({ medio: md, placas: [p] }) })
  const dosFilas = grupos.length > 1 || conMedia
  return (
    <section className="tarjeta resumen-todas">
      <div className="cabeza-tarjeta"><span className="etiqueta-seccion">{titulo}</span>{nota && <span className="ayuda">{nota}</span>}</div>
      <div className="tabla-scroll">
        <table className="tabla compacta matriz-clase">
          <thead>
            {dosFilas && (
              <tr><th rowSpan={2}>Muestra</th>
                {grupos.map((g) => <th key={g.medio} colSpan={g.placas.length + (conMedia && medios.includes(g.medio) ? 1 : 0)} className="grupo-medio">{g.medio}</th>)}
                <th rowSpan={2} className="col-resultado">{colResultado}</th></tr>
            )}
            <tr>
              {!dosFilas && <th>Muestra</th>}
              {grupos.flatMap((g) => [
                ...g.placas.map((p) => <th key={p.id} className={`num ${apagadas.includes(p.id) ? 'apagada' : ''}`} data-tip={apagadas.includes(p.id) ? `${p.nombre}\nNo entra en la prueba (destildada arriba)` : p.nombre}>{p.nombre}</th>),
                ...(conMedia && medios.includes(g.medio) ? [<th key={'m' + g.medio} className="num col-media">Media</th>] : []),
              ])}
              {!dosFilas && <th className="col-resultado">{colResultado}</th>}
            </tr>
          </thead>
          <tbody>
            {filas.map((fi) => (
              <tr key={fi.cepa} className={`${fi.elegida ? 'elegida' : ''} ${fi.onClick ? 'fila-clic' : ''} ${fi.apagada ? 'fuera' : ''}`} onClick={fi.onClick} data-tip={fi.onClick && !fi.elegida ? `Ver ${fi.cepa} en los paneles` : undefined}>
                <td><b>{fi.cepa}</b></td>
                {grupos.flatMap((g) => [
                  ...g.placas.map((p) => {
                    const c = fi.celdas[p.id]
                    return c ? <td key={p.id} className={`num celda-clase ${apagadas.includes(p.id) ? 'apagada' : ''}`} style={{ '--clase': COLOR_CLASE[c.clase] || 'transparent' }} data-tip={c.tip}>{f(c.v, 3)}</td>
                      : <td key={p.id} className="num tenue">—</td>
                  }),
                  ...(conMedia && medios.includes(g.medio) ? [(() => { const c = fi.medias?.[g.medio]; return <td key={'m' + g.medio} className="num col-media" data-tip={c?.tip}>{c ? f(c.v, 3) : '—'}</td> })()] : []),
                ])}
                <td className={`col-resultado ${fi.res.nivel || ''}`} data-tip={fi.res.tip}>{fi.res.texto}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="leyenda-clases">
        {Object.entries(COLOR_CLASE).filter(([k]) => k.startsWith('No') || k.startsWith('Productor')).map(([k, col]) => <span key={k}><i className="punto" style={{ background: col }} />{k}</span>)}
      </div>
    </section>
  )
}

const resultadoTxt = (r) => {
  if (!r) return { texto: '—', nivel: 'na', tip: 'Sin datos' }
  if (!r.ok) return { texto: '—', nivel: 'na', tip: r.motivo }
  const p = r.global.p, sig = p < 0.05
  const orden = [...r.grupos].sort((a, z) => media(z.v) - media(a.v))
  return {
    texto: <><b>{sig ? (orden.length === 2 ? `${orden[0].nombre} > ${orden[1].nombre}` : 'difieren') : 'sin dif.'}</b> <small>p {pTxt(p)}{sig ? ` ${marcaSig(p)}` : ''}</small></>,
    nivel: sig ? 'dif' : 'ok',
    tip: `${NOMBRE_TEST[r.tipo]}: ${r.global.est} = ${f(r.global.valor, 3)} · p = ${pTxt(p)}\n${r.grupos.map((g) => `${g.nombre}: x̄ = ${f(media(g.v), 3)} (n ${g.v.length})`).join('\n')}`,
  }
}

// ===============================================================
// PÁGINA
// ===============================================================
export function EstadisticaTab({ s }) {
  const o = s.opts.comparar
  const setO = (k, v) => s.setOpts((x) => ({ ...x, comparar: { ...x.comparar, [k]: v } }))
  const setVarios = (c) => s.setOpts((x) => ({ ...x, comparar: { ...x.comparar, ...c } }))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const D = useMemo(() => armarComparacion(s), [s.placas, s.analisisMap, s.muestras, o])
  const variable = UNIDAD[o.variable] ? o.variable : 'od'
  const X = useMemo(() => prepararDatos(s, D, variable), [D, variable]) // eslint-disable-line react-hooks/exhaustive-deps
  const modo = modoBase(o)
  const irDesarrollo = () => { s.irA('metodos'); setTimeout(() => document.getElementById('m-estadistica')?.scrollIntoView({ block: 'start' }), 120) }
  const grupoModo = <GrupoModo o={o} setO={setO} />
  const sinAnalisis = s.placas.filter((p) => !p.oculta && !s.analisisMap[p.id]?.resumen?.length)

  if (!D.conAnalisis.length) return <><Cinta>{grupoModo}</Cinta><Vacio titulo="Todavía no hay placas analizadas" texto="Cargá las placas y configurá sus pocillos para compararlas." accion={<button className="primario" onClick={() => s.irA('placas')}>Ir a Placas</button>} /></>
  if (modo === 'concordancia') return <ReproTab s={s} D={D} o={o} setO={setO} grupoModo={grupoModo} />

  // ---- opciones de la prueba ----
  const libres = (o.libres || []).filter((c) => c.grupos.length >= 2)
  const usaPlacaLibre = modo === 'libre' && libres.some((c) => c.grupos.some((g) => g.placa))
  const nivel = modo === 'placas' || usaPlacaLibre ? 'pocillo' : o.nivel === 'pocillo' ? 'pocillo' : 'placa'
  const obsN = nivel === 'placa' ? X.obsPlaca : X.obsPozo
  const forzado = o.prueba || 'auto', comp = o.comp || 'pares', ajuste = o.ajuste === 'lsd' ? 'lsd' : 'holm'
  const unidad = UNIDAD[variable]
  const nivelTxt = nivel === 'placa' ? 'cada punto es una placa (OD media de sus pocillos)' : 'cada punto es un pocillo'

  // ---- qué se compara ----
  const juntar = juntarDe(o)
  const medioSel = X.medios.includes(o.selMedio) ? o.selMedio : X.medios[0]
  const cepaSel = X.cepas.includes(o.selCepa) ? o.selCepa : X.cepas[0]
  const fueraPl = o.ePlacasFuera || []
  const enAlcance = (p) => ((modo === 'placas' || modo === 'cepas') && !juntar ? p.medio === medioSel : modo === 'medios' ? !!p.medio : true)
  const placasAlc = X.placas.filter(enAlcance)
  const placasUsadas = placasAlc.filter((p) => !fueraPl.includes(p.id))
  const mediosIn = X.medios.filter((m) => !(o.eMediosFuera || []).includes(m))
  const cepasIn = X.cepas.filter((c) => !(o.eCepasFuera || []).includes(c))
  const usada = (x) => placasUsadas.some((p) => p.id === x.placaId)
  const nombrePl = (p) => (juntar && p.medio ? `${p.nombre} · ${p.medio}` : p.nombre)
  const conDet = (nombre, d, extra = {}) => ({ nombre, det: d, v: d.map((x) => x.y), ...extra })
  const gruposDe = (c) => {
    if (modo === 'medios') return mediosIn.map((m) => conDet(m, obsN.filter((x) => x.cepa === c && x.medio === m && usada(x))))
    if (modo === 'placas') return placasUsadas.map((p) => conDet(nombrePl(p), X.obsPozo.filter((x) => x.cepa === c && x.placaId === p.id), { placaId: p.id })).filter((g) => g.v.length)
    return cepasIn.map((cc) => conDet(cc, obsN.filter((x) => x.cepa === cc && usada(x))))
  }
  const ctrlKey = { medios: 'ctrlMedio', cepas: 'ctrlCepa', placas: 'ctrlPlaca', libre: 'ctrlLibre' }[modo]
  const ctrlDe = (gs) => (comp === 'control' && gs.length > 1 ? (gs.some((g) => g.nombre === o[ctrlKey]) ? o[ctrlKey] : gs[0].nombre) : null)
  const analizarG = (gs) => { const c = gs.filter((g) => g.v.length); return c.length ? { r: analizar(c, forzado, ctrlDe(c), ajuste), ctrl: ctrlDe(c) } : { r: null, ctrl: null } }

  // grupos a medida
  const nombreG = (g) => [g.cepa || null, g.medio || null, g.placa ? (X.placas.find((p) => p.id === g.placa)?.nombre || g.placa) : null].filter(Boolean).join(' · ') || 'Todos los datos'
  const gruposLibre = (c) => c.grupos.map((g) => conDet(nombreG(g), obsN.filter((x) => (!g.cepa || x.cepa === g.cepa) && (!g.medio || x.medio === g.medio) && (!g.placa || x.placaId === g.placa))))
  const iLibre = Math.min(Math.max(0, o.selLibre || 0), Math.max(0, libres.length - 1))

  // ---- foco (lo que muestran los dos paneles) ----
  let foco
  if (modo === 'medios') foco = { pregunta: `¿Cambia la producción de biofilm de ${cepaSel} según el medio?`, sujeto: `la producción de biofilm de «${cepaSel}»`, factor: 'los medios de cultivo', grupos: gruposDe(cepaSel) }
  else if (modo === 'placas') foco = { pregunta: `¿${cepaSel} da lo mismo en todas las placas${juntar ? '' : ` de ${medioSel}`}?`, sujeto: `la producción de biofilm de «${cepaSel}»`, factor: 'las placas', grupos: gruposDe(cepaSel) }
  else if (modo === 'cepas') foco = { pregunta: `¿Difieren las cepas${juntar ? ' (todos los medios juntos)' : ` en ${medioSel}`}?`, sujeto: `la producción de biofilm${juntar ? '' : ` en ${medioSel}`}`, factor: 'las cepas', grupos: gruposDe() }
  else foco = libres.length ? (() => { const gs = gruposLibre(libres[iLibre]); return { pregunta: `¿Difieren ${gs.map((g) => g.nombre).join(', ')}?`, sujeto: 'la OD de los grupos', factor: 'los grupos', grupos: gs } })() : null
  if (foco) Object.assign(foco, analizarG(foco.grupos))

  // pocillos excluidos que tocan a la selección
  const fueraFoco = !foco ? [] : X.fuera.filter((x) => (modo === 'cepas' ? cepasIn.includes(x.cepa) : modo === 'libre' ? true : x.cepa === cepaSel) && (modo === 'libre' || placasUsadas.some((p) => p.id === x.placaId)))
  const colorDe = (d) => D.colores[d.placaId] || D.colorBase[d.placaId] || '#5B8FD9'

  // ---- resumen de todas las cepas ----
  const valorCelda = (c, p) => {
    const fuente = modo === 'placas' ? X.obsPozo : obsN
    const v = fuente.filter((x) => x.cepa === c && x.placaId === p.id)
    if (!v.length) return null
    const clase = X.obsPlaca.find((x) => x.cepa === c && x.placaId === p.id)?.clase
    const pozos = X.obsPozo.filter((x) => x.cepa === c && x.placaId === p.id)
    return { v: media(v.map((x) => x.y)), clase, tip: `${c} · ${p.nombre}${p.medio ? ` (${p.medio})` : ''}\n${nivel === 'placa' && modo !== 'placas' ? 'Valor de la placa' : `Media de ${v.length} pocillos`}: ${f(media(v.map((x) => x.y)), 4)}\nPocillos: ${pozos.map((x) => f(x.y, 3)).join(' · ')}${clase ? `\n${clase}` : ''}` }
  }
  const celdasDe = (c) => Object.fromEntries(placasAlc.map((p) => [p.id, valorCelda(c, p)]).filter(([, v]) => v))
  let resumen = null
  if (modo === 'medios' || modo === 'placas') {
    const filas = X.cepas.map((c) => {
      const gs = gruposDe(c)
      const { r } = analizarG(gs)
      const medias = modo === 'medios' ? Object.fromEntries(gs.filter((g) => g.v.length).map((g) => [g.nombre, { v: media(g.v), tip: `Media de ${c} en ${g.nombre}\n${g.det.map((d) => `${d.etq}: ${f(d.y, 3)}`).join('\n')}` }])) : null
      return { cepa: c, celdas: celdasDe(c), medias, res: resultadoTxt(r), elegida: c === cepaSel, onClick: c === cepaSel ? undefined : () => setO('selCepa', c) }
    })
    resumen = <ResumenTodas titulo={modo === 'medios' ? 'Todas las cepas · entre medios' : `Todas las cepas · entre placas${juntar ? '' : ` de ${medioSel}`}`} nota="Clic en una cepa para verla arriba"
      placas={placasAlc} apagadas={fueraPl} filas={filas} conMedia={modo === 'medios'} medios={mediosIn} colResultado={modo === 'medios' ? 'Entre medios' : 'Entre placas'} />
  } else if (modo === 'cepas') {
    const r = foco.r
    const filas = X.cepas.map((c) => {
      const dentro = cepasIn.includes(c)
      const g = foco.grupos.find((x) => x.nombre === c)
      const res = !dentro ? { texto: <span className="tenue">no entra</span>, nivel: 'na', tip: 'Destildada en «Cepas»' }
        : !r?.ok || !g?.v.length ? { texto: '—', nivel: 'na' }
          : foco.ctrl ? (c === foco.ctrl ? { texto: <b>control</b>, nivel: 'na' } : (() => { const p = r.pares.find((x) => x.a === c); return p && finito(p.pa) ? { texto: <><b>{p.pa < 0.05 ? '≠ control' : '= control'}</b> <small>p {pTxt(p.pa)}</small></>, nivel: p.pa < 0.05 ? 'dif' : 'ok' } : { texto: '—', nivel: 'na' } })())
            : { texto: <><b>{r.letras?.[c] || '—'}</b> <small>x̄ {f(media(g.v), 3)}</small></>, nivel: r.global.p < 0.05 ? 'dif' : 'ok', tip: 'Las cepas que comparten una letra no difieren (p ajustado ≥ 0,05)' }
      return { cepa: c, celdas: celdasDe(c), res, apagada: !dentro }
    })
    resumen = <ResumenTodas titulo={`Todas las cepas${juntar ? ' · todos los medios' : ` · ${medioSel}`}`} nota="Las letras corresponden a la comparación de arriba"
      placas={placasAlc} apagadas={fueraPl} filas={filas} conMedia={false} medios={[]} colResultado={foco.ctrl ? 'Contra el control' : 'Letra'} />
  } else if (libres.length) {
    resumen = (
      <section className="tarjeta resumen-todas">
        <div className="cabeza-tarjeta"><span className="etiqueta-seccion">Todas las comparaciones a medida</span><span className="ayuda">Clic en una para verla arriba</span></div>
        <div className="tabla-scroll"><table className="tabla compacta">
          <thead><tr><th>Comparación</th><th>Grupos</th><th className="col-resultado">Resultado</th></tr></thead>
          <tbody>{libres.map((c, i) => { const gs = gruposLibre(c); const { r } = analizarG(gs); const res = resultadoTxt(r); return (
            <tr key={i} className={`${i === iLibre ? 'elegida' : 'fila-clic'}`} onClick={() => setO('selLibre', i)}><td><b>ANOVA {i + 1}</b></td><td>{gs.map((g) => g.nombre).join(' vs ')}</td><td className={`col-resultado ${res.nivel}`} data-tip={res.tip}>{res.texto}</td></tr>) })}</tbody>
        </table></div>
      </section>
    )
  }

  // ---- análisis con todas las cepas juntas y supuestos ----
  const pocillosUsados = X.obsPozo.filter((x) => usada(x))
  let modelos = null
  if (modo === 'medios') {
    const sp = parcelasDivididas(X.obsPlaca.filter((x) => usada(x) && mediosIn.includes(x.medio)))
    if (sp) modelos = <><h4>Efecto del medio con todas las cepas juntas <Nota>ANOVA de parcelas divididas: cada placa tiene un solo medio, así que el medio se prueba contra la variación entre placas del mismo medio; la cepa y la interacción cepa × medio, contra la variación dentro de las placas (modelo mixto con la placa como bloque).</Nota></h4>
      <Tabla cols={['Fuente', 'Suma de cuadrados', 'gl', 'Cuadrado medio', 'F', 'p', 'Se prueba contra']} filas={sp.filas.map((x) => [x.nombre, f(x.ss, 5), x.df, f(x.ms, 5), f(x.F, 3), pTxt(x.p), x.error])} /></>
  } else if (modo === 'placas' && juntar) {
    const pc = placaCepa(pocillosUsados)
    if (pc) modelos = <><h4>Todas las cepas: placa, cepa y cepa × placa <Nota>Modelos anidados sobre los pocillos. Cepa × placa responde si las cepas conservan su orden en todas las placas.</Nota></h4>
      <Tabla cols={['Fuente', 'Suma de cuadrados', 'gl', 'Cuadrado medio', 'F', 'p', 'Se prueba contra']} filas={pc.filas.map((x) => [x.nombre, f(x.ss, 5), x.df, f(x.ms, 5), f(x.F, 3), pTxt(x.p), x.error])} /></>
  }
  const an = modo === 'placas' && juntar ? anidada(pocillosUsados.filter((x) => x.cepa === cepaSel)) : null
  const extraResultado = an && (
    <details className="plegable">
      <summary>Medio y placa dentro del medio ({cepaSel})</summary>
      <p className="ayuda">Las placas de distinto medio mezclan el efecto de la placa y el del medio. Este modelo los separa: el medio se prueba contra la variación entre placas del mismo medio.</p>
      <Tabla cols={['Fuente', 'gl', 'F', 'p', 'Se prueba contra']} filas={an.filas.map((x) => [x.nombre, x.df, f(x.F, 3), pTxt(x.p), x.error])} />
    </details>
  )

  // ---- fichas de selección ----
  const fichaPlaca = (p) => ({ id: p.id, texto: p.nombre, sub: p.medio, color: D.colores[p.id] || D.colorBase[p.id], tip: `${p.nombre}${p.medio ? ` · ${p.medio}` : ''}\nClic para ${fueraPl.includes(p.id) ? 'incluirla' : 'sacarla'} de la prueba` })
  const alternarPlaca = (id) => setO('ePlacasFuera', fueraPl.includes(id) ? fueraPl.filter((x) => x !== id) : [...fueraPl, id])
  const alternar = (k, lista) => (id) => setO(k, (o[k] || []).includes(id) ? (o[k] || []).filter((x) => x !== id) : [...(o[k] || []), id])
  const alcance = (todosTxt) => [...X.medios.map((m) => ({ id: m, texto: m, tip: `Solo las placas de ${m}` })), { id: '__todos', texto: todosTxt, tip: 'Las placas de todos los medios juntas' }]
  const elegirAlcance = (id) => (id === '__todos' ? setO('juntar', true) : setVarios({ juntar: false, selMedio: id }))
  const alcanceActivo = (id) => (juntar ? id === '__todos' : id === medioSel)
  const fichasCepa = <Fichas etiqueta="Cepa" tip="La cepa que se analiza en los paneles" opciones={X.cepas.map((c) => ({ id: c, texto: c }))} activa={(id) => id === cepaSel} onClick={(id) => setO('selCepa', id)} />
  const fichasPlacas = <Fichas etiqueta="Placas" tip="Cada placa es una réplica biológica; destildá las que no querés que entren" multi opciones={placasAlc.map(fichaPlaca)} activa={(id) => !fueraPl.includes(id)} onClick={alternarPlaca} />
  const sinMedio = X.placas.filter((p) => !p.medio)

  return (
    <div className="est-pag">
      <Cinta>
        {grupoModo}
        <Grupo titulo="Datos">
          <OpcionesCinta valor={variable} onChange={(v) => setO('variable', v)} opciones={[
            ['od', 'OD', 'OD', null, 'OD tal cual'], ['ln', 'ln(OD)', 'ln', null, 'Logaritmo natural de la OD\nEstabiliza la varianza cuando la DE crece con la media'], ['odc', 'OD ÷ ODc', '÷', null, 'Cada OD dividida por el ODc de su placa\nReduce las diferencias de fondo entre placas'],
          ]} />
        </Grupo>
        {modo !== 'placas' && !usaPlacaLibre && (
          <Grupo titulo="Réplica">
            <OpcionesCinta valor={nivel} onChange={(v) => setO('nivel', v)} opciones={[
              ['placa', 'Placa', null, 'placas', 'Un valor por placa (OD media de sus pocillos)\nEs la réplica biológica: la opción correcta para concluir'],
              ['pocillo', 'Pocillos', null, 'puntos', 'Cada pocillo cuenta como réplica\nDa más datos, pero los pocillos de una placa no son independientes: los p salen demasiado chicos'],
            ]} />
          </Grupo>
        )}
        <Grupo titulo="Prueba">
          <CampoCinta etiqueta="Prueba global" tip={'Automática: Kruskal-Wallis si los residuos no son normales (con 8 o más datos), ANOVA de Welch si las varianzas son distintas (Levene) y, si no, ANOVA clásico'}>
            <Select value={o.prueba || 'auto'} onChange={(v) => setO('prueba', v)} opciones={[['auto', 'Automática'], ['anova', 'ANOVA clásico'], ['welch', 'ANOVA de Welch'], ['kw', 'Kruskal-Wallis']]} />
          </CampoCinta>
          <OpcionesCinta valor={comp} onChange={(v) => setO('comp', v)} opciones={[
            ['pares', 'Todos los pares', null, 'copiar', 'Compara todos los grupos de a pares'],
            ['control', 'Contra control', null, 'flecha', 'Compara cada grupo con uno de referencia (Dunnett con ANOVA clásico)'],
          ]} />
          <CampoCinta etiqueta="Ajuste" tip={'Holm: controla el error de todas las comparaciones (recomendado)\nLSD de Fisher: sin ajuste; solo con ANOVA clásico significativo y pocos grupos'}>
            <Select value={ajuste} onChange={(v) => setO('ajuste', v)} opciones={[['holm', 'Holm / Dunnett'], ['lsd', 'LSD de Fisher']]} />
          </CampoCinta>
        </Grupo>
        <Grupo titulo="Desarrollo"><BotonCinta icono="libro" texto="Ver los cálculos" onClick={irDesarrollo} tip="La comparación de los paneles desarrollada paso a paso (pestaña «Métodos»)" /></Grupo>
      </Cinta>

      <section className="tarjeta est-seleccion">
        <div className="cabeza-tarjeta"><span className="etiqueta-seccion">Qué se compara</span>
          <span className="ayuda">{{ medios: 'Una cepa entre medios de cultivo', placas: 'Una cepa entre placas (réplicas)', cepas: 'Las cepas entre sí', libre: 'Grupos armados a mano' }[modo]}</span></div>
        {modo === 'medios' && <>
          {fichasCepa}
          <Fichas etiqueta="Medios" tip="Los medios que se comparan (al menos 2)" multi opciones={X.medios.map((m) => ({ id: m, texto: m }))} activa={(id) => mediosIn.includes(id)} onClick={alternar('eMediosFuera')} />
          {fichasPlacas}
        </>}
        {modo === 'placas' && <>
          {fichasCepa}
          <Fichas etiqueta="Medio" tip="Para la reproducibilidad conviene comparar placas del mismo medio" opciones={alcance('Todas las placas')} activa={alcanceActivo} onClick={elegirAlcance} />
          {fichasPlacas}
        </>}
        {modo === 'cepas' && <>
          <Fichas etiqueta="Medio" tip="Las cepas se comparan dentro de un medio, o con todos los medios juntos" opciones={alcance('Todos juntos')} activa={alcanceActivo} onClick={elegirAlcance} />
          <Fichas etiqueta="Cepas" tip="Las cepas que se comparan" multi opciones={X.cepas.map((c) => ({ id: c, texto: c }))} activa={(id) => cepasIn.includes(id)} onClick={alternar('eCepasFuera')}
            extra={<><button className="fantasma chico" onClick={() => setO('eCepasFuera', [])}>Todas</button><button className="fantasma chico" onClick={() => setO('eCepasFuera', X.cepas)}>Ninguna</button></>} />
          {fichasPlacas}
        </>}
        {modo === 'libre' && <>
          <ComparadorLibre o={o} setO={setO} cepas={X.cepas.map((c) => ({ id: c, nombre: c }))} medios={X.medios.map((m) => ({ id: m, nombre: m }))} placas={X.placas.map((p) => ({ id: p.id, nombre: p.nombre }))} />
          {libres.length > 1 && <Fichas etiqueta="Ver" opciones={libres.map((c, i) => ({ id: i, texto: `ANOVA ${i + 1}` }))} activa={(id) => id === iLibre} onClick={(id) => setO('selLibre', id)} />}
        </>}
        {(sinAnalisis.length > 0 || (modo !== 'libre' && sinMedio.length > 0 && modo === 'medios')) && (
          <p className="aviso-sel">
            {sinAnalisis.length > 0 && <>{sinAnalisis.map((p) => `«${p.nombre}»`).join(', ')} todavía no {sinAnalisis.length === 1 ? 'entra' : 'entran'}: {sinAnalisis.some((p) => !p.placa) ? 'faltan datos o ' : ''}falta configurar los pocillos. </>}
            {modo === 'medios' && sinMedio.length > 0 && <>{sinMedio.map((p) => `«${p.nombre}»`).join(', ')} no {sinMedio.length === 1 ? 'tiene' : 'tienen'} medio: no {sinMedio.length === 1 ? 'entra' : 'entran'} al comparar medios.</>}
          </p>
        )}
      </section>

      {foco ? (
        <div className="est-paneles">
          <PanelGrupos foco={foco} unidad={unidad} nivelTxt={nivelTxt} colorDe={colorDe} fuera={fueraFoco} comp={comp} onCtrl={(v) => setO(ctrlKey, v)} />
          <PanelResultado foco={foco} alDesarrollo={irDesarrollo} extra={extraResultado} />
        </div>
      ) : <Vacio titulo="Todavía no hay comparaciones" texto="Agregá una con las plantillas de arriba («Cepa vs cepa», «Una cepa entre medios»…)." />}

      {resumen}

      <details className="tarjeta plegable avanzado">
        <summary>Más análisis: modelos con todas las cepas y supuestos</summary>
        {modelos}
        <DiagnosticoGlobal d={diagnosticoGlobal(pocillosUsados)} unidad={unidad} />
        {!modelos && <p className="ayuda">Los modelos con todas las cepas juntas aparecen al comparar medios o placas de todos los medios.</p>}
      </details>
    </div>
  )
}
