// Gráfico › Ver › Orden: ¿se mantiene el orden de las cepas (o serotipos) de placa en placa?
// Es el control para decidir si se puede usar la placa como bloque en Estadística.
import { forwardRef, useMemo, useRef, useState } from 'react'
import { BotonCinta, Cajon, Cinta, Grupo, OpcionesCinta } from './cinta.jsx'
import { Check, Vacio, tamDe } from './ui.jsx'
import { ExportDialog } from './exportar.jsx'
import { Nota } from './tip.jsx'
import { Chip, pTxt } from './pruebas.jsx'
import { useAncho } from './charts.jsx'
import { armarComparacion } from '../comparacion.js'
import { analizarOrden } from '../orden.js'
import { seroDe, serotiposDe } from '../serotipos.js'
import { FUENTE, fmt, medir, paletaMuestras } from '../utils.js'

const SIN_MEDIO = '(sin medio)'
const GRIS = '#cfc8bc'
const f2 = (x) => (Number.isFinite(x) ? x.toFixed(2).replace('.', ',') : '–')

// ---------------------------------------------------------------
// perfiles: una línea por cepa a lo largo de las placas (puestos u OD). Con una placa elegida,
// esa placa queda en color y el resto en gris.
// ---------------------------------------------------------------
const Perfiles = forwardRef(function Perfiles({ R, colores, ver, sel, onPlaca, tam }, svgRef) {
  const [wrap, Wmed] = useAncho()
  const W = tam ? tam.w : Wmed
  const nP = R.placas.length, k = R.unidades.length
  const largoEtq = Math.max(...R.placas.map((p) => medir(p.nombre, 11)))
  // leyenda en filas
  const items = R.unidades.map((u) => ({ u, w: 22 + medir(u, 12) + 14 }))
  const filasLey = []
  items.forEach((it) => { const f = filasLey[filasLey.length - 1]; if (f && f.w + it.w <= W - 40) { f.items.push(it); f.w += it.w } else filasLey.push({ items: [it], w: it.w }) })
  // los nombres de las placas van inclinados: el de la última necesita lugar a la derecha
  const m = { l: 56, r: Math.max(24, largoEtq * 0.85 + 8), t: 16, b: 24 + largoEtq * 0.6 + filasLey.length * 20 + 12 }
  const H = tam ? tam.h : Math.max(320, 250 + m.b)
  const x = (i) => m.l + (nP > 1 ? (i * (W - m.l - m.r)) / (nP - 1) : (W - m.l - m.r) / 2)
  const vals = ver === 'od' ? R.M : R.P
  const top = ver === 'od' ? Math.max(...R.M.flat()) * 1.08 : k + 0.5
  const bot = ver === 'od' ? Math.min(0, ...R.M.flat()) : 0.5
  const altoPlot = H - m.t - m.b
  // con puestos, el 1 va arriba
  const y = (v) => (ver === 'od' ? m.t + altoPlot * (1 - (v - bot) / (top - bot)) : m.t + altoPlot * ((v - bot) / (top - bot)))
  const ticks = ver === 'od' ? [0, 1, 2, 3, 4].map((i) => bot + (i * (top - bot)) / 4) : Array.from({ length: k }, (_, i) => i + 1)
  const iSel = sel ? R.placas.findIndex((p) => p.id === sel) : -1
  const conSel = iSel >= 0
  const yEje = H - m.b
  return (
    <div ref={wrap} className="chart-wrap">
      <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} width={W} height={H} fontFamily={FUENTE}>
        <rect width={W} height={H} fill="#fff" />
        {conSel && <rect x={x(iSel) - 18} y={m.t} width={36} height={altoPlot} fill="#fff3c4" />}
        {ticks.map((t) => <g key={t}><line x1={m.l} x2={W - m.r} y1={y(t)} y2={y(t)} stroke="#eee6da" /><text x={m.l - 8} y={y(t) + 4} textAnchor="end" style={{ fontSize: 12, fill: '#333' }}>{ver === 'od' ? fmt(t, 2) : t}</text></g>)}
        <line x1={m.l} x2={m.l} y1={m.t} y2={yEje} stroke="#444" />
        <text transform={`translate(16 ${m.t + altoPlot / 2}) rotate(-90)`} textAnchor="middle" style={{ fontSize: 13, fill: '#333' }}>{ver === 'od' ? 'OD media de la placa' : 'Puesto (1 = más biofilm)'}</text>
        {R.placas.map((p, i) => (
          <text key={p.id} transform={`translate(${x(i)} ${yEje + 14}) rotate(35)`} onClick={() => onPlaca?.(p.id)} style={{ fontSize: 11, cursor: 'pointer', fill: conSel ? (i === iSel ? '#2b2118' : '#a59a8c') : i === R.iPeor && R.rhoMedio[i] < 0.4 ? '#c25e00' : '#333', fontWeight: i === iSel ? 700 : 400 }}>{p.nombre}</text>
        ))}
        {/* líneas: en gris cuando hay una placa elegida */}
        {R.unidades.map((u, j) => (
          <polyline key={u} fill="none" stroke={conSel ? GRIS : colores[u]} strokeWidth={conSel ? 1.6 : 2.2} points={R.placas.map((_, i) => `${x(i)},${y(vals[i][j])}`).join(' ')} />
        ))}
        {R.unidades.map((u, j) => R.placas.map((p, i) => {
          const elegida = i === iSel
          return <circle key={u + p.id} cx={x(i)} cy={y(vals[i][j])} r={elegida ? 6.5 : conSel ? 3.6 : 4.8} fill={conSel && !elegida ? GRIS : colores[u]} stroke="#fff" strokeWidth={elegida ? 1.5 : 1}
            style={{ cursor: 'pointer' }} onClick={() => onPlaca?.(p.id)} data-tip={`${u} · ${p.nombre}\nOD media = ${fmt(R.M[i][j], 3)}\npuesto ${R.P[i][j]} de ${k}`} />
        }))}
        {/* nombres junto a los puntos de la placa elegida */}
        {conSel && R.unidades.map((u, j) => {
          const derecha = iSel < nP - 1 || nP === 1
          return <text key={'e' + u} x={x(iSel) + (derecha ? 10 : -10)} y={y(vals[iSel][j]) + 4} textAnchor={derecha ? 'start' : 'end'} paintOrder="stroke" stroke="#fff" strokeWidth="3"
            style={{ fontSize: 11.5, fontWeight: 600, fill: colores[u] }}>{u}</text>
        })}
        {/* leyenda */}
        {filasLey.map((f, r) => {
          let xx = (W - f.w) / 2
          return f.items.map((it) => { const g = <g key={it.u} transform={`translate(${xx},${H - 14 - (filasLey.length - 1 - r) * 20})`}><circle cx="6" cy="-4" r="5" fill={colores[it.u]} /><text x="16" style={{ fontSize: 12, fill: '#333' }}>{it.u}</text></g>; xx += it.w; return g })
        })}
      </svg>
    </div>
  )
})

export function OrdenTab({ s, grupoVer }) {
  const svg = useRef()
  const [cajon, setCajon] = useState(null)   // 'medios' | 'placas' | 'cepas' | 'serotipos'
  const [exp, setExp] = useState(false)
  const [sel, setSel] = useState(null)       // placa resaltada
  const o = s.opts.comparar
  const setO = (k, v) => s.setOpts((x) => ({ ...x, comparar: { ...x.comparar, [k]: v } }))
  const D = useMemo(() => armarComparacion(s), [s.placas, s.analisisMap, s.muestras, o, s.opts.barras?.escala]) // eslint-disable-line react-hooks/exhaustive-deps
  if (!D.conAnalisis.length) return <><Cinta>{grupoVer}</Cinta><Vacio titulo="Todavía no hay placas para ordenar" texto="Cargá al menos dos placas y configurá sus pocillos." accion={<button className="primario" onClick={() => s.irA('placas')}>Ir a Placas</button>} /></>

  // placas con análisis, ordenadas por medio; cepas sin blancos, en el orden de la lista
  const ordenM = [...new Set(s.placas.map((p) => p.medio || SIN_MEDIO))]
  const todas = [...D.conAnalisis].sort((a, b) => ordenM.indexOf(a.medio || SIN_MEDIO) - ordenM.indexOf(b.medio || SIN_MEDIO))
  const medios = [...new Set(todas.map((p) => p.medio || SIN_MEDIO))]
  const fueraM = o.ordenMediosFuera || [], fueraP = o.ordenPlacasFuera || [], fueraC = o.ordenCepasFuera || [], fueraS = o.ordenSeroFuera || []
  const enMedio = todas.filter((p) => !fueraM.includes(p.medio || SIN_MEDIO))
  const placas = enMedio.filter((p) => !fueraP.includes(p.id))
  const presentes = new Set(todas.flatMap((p) => s.analisisMap[p.id].resumen.map((r) => r.Muestra)))
  const cepasTodas = [...s.muestras.filter((m) => presentes.has(m)), ...[...presentes].filter((m) => !s.muestras.includes(m))]
  const seros = serotiposDe(s.exp, cepasTodas)
  const cepas = cepasTodas.filter((c) => !fueraC.includes(c) && !(seroDe(s.exp, c) && fueraS.includes(seroDe(s.exp, c))))
  const porSero = o.ordenUnidad === 'serotipo' && seros.length > 0
  const unidades = porSero ? seros.filter((sr) => !fueraS.includes(sr) && cepas.some((c) => seroDe(s.exp, c) === sr)) : cepas
  const unidadDe = (c) => (porSero ? seroDe(s.exp, c) : c)
  const ver = o.ordenVer === 'od' ? 'od' : 'puestos'
  const nom = porSero ? 'serotipos' : 'cepas'

  // valores de cada placa: media de la cepa (o del serotipo: promedio de sus cepas) y sus pocillos
  const filas = placas.map((p) => {
    const a = s.analisisMap[p.id]
    const res = a.resumen.filter((r) => cepas.includes(r.Muestra) && Number.isFinite(r.Media))
    const prom = (campo) => Object.fromEntries(unidades.map((u) => { const v = res.filter((r) => unidadDe(r.Muestra) === u).map((r) => r[campo] ?? r.Media); return [u, v.length ? v.reduce((x, y) => x + y, 0) / v.length : NaN] }))
    return { id: p.id, nombre: p.nombre, medio: p.medio || SIN_MEDIO, valores: prom('Media'), valoresLeidos: prom('MediaLeida'),
      pozos: a.estado.filter((e) => e.Usado && !e.EsBlanco && cepas.includes(e.Muestra) && unidadDe(e.Muestra)).map((e) => ({ unidad: unidadDe(e.Muestra), y: e.OD })) }
  })
  const R = analizarOrden(filas, unidades)
  const paletaS = paletaMuestras(seros)
  const colores = porSero ? paletaS : paletaMuestras(s.muestras)
  const selV = R.ok && R.placas.some((p) => p.id === sel) ? sel : null
  const elegir = (id) => setSel(selV === id ? null : id)

  const titulo = { ok: 'El orden se mantiene: se puede usar la placa como bloque', medio: 'El orden se parece, pero cambia en algunas placas: bloque con cautela', no: 'El orden cambia entre placas: no conviene usar la placa como bloque' }
  const clase = { ok: 'ok', medio: 'mixto', no: 'dif' }
  const grafico = (ref, tam) => <Perfiles ref={ref} R={R} colores={colores} ver={ver} sel={selV} onPlaca={tam ? undefined : elegir} tam={tam} />

  // cajón de selección (tildar = entra)
  const lista = (k, fuera, opciones) => (
    <>
      <div className="fila" style={{ marginBottom: 8 }}>
        <button className="chico" onClick={() => setO(k, [])}>Todas</button>
        <button className="chico" onClick={() => setO(k, opciones.map((x) => x.id))}>Ninguna</button>
      </div>
      <div className="lista-check columnas">
        {opciones.map((x) => <Check key={x.id} label={<>{x.color && <i className="punto" style={{ background: x.color }} />} {x.texto}{x.sub && <small className="medio-placa">{x.sub}</small>}</>}
          checked={!fuera.includes(x.id)} onChange={(v) => setO(k, v ? fuera.filter((y) => y !== x.id) : [...fuera, x.id])} />)}
      </div>
    </>
  )
  const boton = (id, icono, texto, n, total, tip) => <BotonCinta icono={icono} texto={`${texto} ${n}/${total}`} activo={cajon === id} onClick={() => setCajon(cajon === id ? null : id)} tip={tip} />

  return (
    <div>
      <Cinta>
        {grupoVer}
        {seros.length > 0 && (
          <Grupo titulo="Ordenar">
            <OpcionesCinta valor={porSero ? 'serotipo' : 'cepa'} onChange={(v) => setO('ordenUnidad', v)} opciones={[
              ['cepa', 'Cepas', null, 'puntos', 'El orden de las cepas en cada placa'],
              ['serotipo', 'Serotipos', null, 'etiqueta', 'El orden de los serotipos en cada placa (cada serotipo es el promedio de sus cepas)'],
            ]} />
          </Grupo>
        )}
        <Grupo titulo="Datos">
          {medios.length > 1 && boton('medios', 'matraz', 'Medios', medios.length - fueraM.filter((m) => medios.includes(m)).length, medios.length, 'Elegir qué medios entran')}
          {boton('placas', 'placas', 'Placas', placas.length, enMedio.length, 'Elegir qué placas entran')}
          {boton('cepas', 'filtro', 'Cepas', cepas.length, cepasTodas.length, 'Elegir qué cepas entran')}
          {seros.length > 0 && boton('serotipos', 'etiqueta', 'Serotipos', seros.length - fueraS.filter((x) => seros.includes(x)).length, seros.length, 'Elegir qué serotipos entran')}
        </Grupo>
        <Grupo titulo="Mostrar">
          <OpcionesCinta valor={ver} onChange={(v) => setO('ordenVer', v)} opciones={[
            ['puestos', 'Puestos', '1·2', null, 'Puesto de cada cepa en cada placa (1 = más biofilm): muestra si el orden se mantiene'],
            ['od', 'OD', 'OD', null, 'OD media de cada cepa en cada placa: muestra si el efecto de la placa suma o multiplica'],
          ]} />
        </Grupo>
        <Grupo titulo="Imagen">
          <BotonCinta icono="imagen" texto="Guardar imagen" onClick={() => setExp(true)} deshabilitado={!R.ok} tip="PNG o SVG con el tamaño y la resolución que elijas" />
        </Grupo>
      </Cinta>
      <Cajon titulo="Medios que entran" abierto={cajon === 'medios'} onClose={() => setCajon(null)}>{lista('ordenMediosFuera', fueraM, medios.map((m) => ({ id: m, texto: m })))}</Cajon>
      <Cajon titulo="Placas que entran" abierto={cajon === 'placas'} onClose={() => setCajon(null)}>{lista('ordenPlacasFuera', fueraP, enMedio.map((p) => ({ id: p.id, texto: p.nombre, sub: p.medio, color: D.colores[p.id] || D.colorBase[p.id] })))}</Cajon>
      <Cajon titulo="Cepas que entran" abierto={cajon === 'cepas'} onClose={() => setCajon(null)}>{lista('ordenCepasFuera', fueraC, cepasTodas.map((c) => ({ id: c, texto: c, sub: seroDe(s.exp, c) || undefined, color: paletaMuestras(s.muestras)[c] })))}</Cajon>
      <Cajon titulo="Serotipos que entran" abierto={cajon === 'serotipos'} onClose={() => setCajon(null)}>{lista('ordenSeroFuera', fueraS, seros.map((x) => ({ id: x, texto: x, color: paletaS[x] })))}</Cajon>

      <section className="tarjeta">
        <div className="cabeza-tarjeta">
          <span className="etiqueta-seccion">{ver === 'od' ? 'OD' : 'Puesto'} de cada {porSero ? 'serotipo' : 'cepa'} en cada placa · {R.placas.length} {R.placas.length === 1 ? 'placa' : 'placas'} · {unidades.length} {nom}</span>
          <span className="ayuda">Clic en una placa (en la tabla o en el gráfico) para resaltarla
            <Nota>{'Antes de usar la placa como bloque en Estadística: el modelo en bloques supone que una placa más teñida sube a todas las cepas sin cambiar su ORDEN. Si las líneas se cruzan mucho, el orden cambia de placa en placa.'}</Nota>
            {selV && <button className="chico" style={{ marginLeft: 8 }} onClick={() => setSel(null)}>Quitar resaltado</button>}</span>
        </div>
        {R.ok ? <div className="figura">{grafico(svg)}</div> : <Vacio texto={R.motivo} />}
      </section>

      {R.ok && (
        <>
          <section className="tarjeta">
            <div className={`veredicto ${clase[R.nivel]}`}>
              <b>{titulo[R.nivel]}</b>
              <span>W de Kendall = {f2(R.kw.W)} (p {pTxt(R.kw.p)}) con {R.placas.length} placas y {R.unidades.length} {nom}</span>
            </div>
            {R.mejoraSinPeor && <p className="lectura">La placa <b>{R.placas[R.iPeor].nombre}</b> es la que menos se parece a las demás (correlación media {f2(R.rhoMedio[R.iPeor])}). Sin ella, W sube a {f2(R.sinPeor.W)}: revisala (pocillos asignados, columnas corridas, tinción). <button className="chico" onClick={() => setSel(R.placas[R.iPeor].id)}>Resaltarla</button></p>}
            {R.multiplica && <p className="lectura">El efecto de la placa <b>multiplica</b> (las {nom} altas suben más que las bajas): para el modelo en bloques conviene ln(OD) o Friedman, que solo mira el orden.</p>}
            {R.porMedio.length > 1 && R.nivel !== 'ok' && R.porMedio.some((x) => x.W >= 0.7) && <p className="lectura">Dentro de {R.porMedio.filter((x) => x.W >= 0.7).map((x) => x.medio).join(' y ')} el orden se mantiene bien: conviene comparar por medio.</p>}
            <div className="indicadores">
              <div className="ind" data-tip={'W de Kendall: 0 = el orden de las placas no tiene nada en común, 1 = todas ordenan igual.\nRegla práctica: ≥ 0,7 buena, 0,5–0,7 moderada, < 0,5 pobre.\nEl p es el de Friedman: si es < 0,05, el orden se repite más de lo esperable por azar.'}>
                <small>Concordancia del orden</small><Chip tipo={R.nivel === 'ok' ? 'ok' : 'alerta'}>W {f2(R.kw.W)} · p {pTxt(R.kw.p)}</Chip></div>
              {R.porMedio.length > 1 && R.porMedio.map((x) => (
                <div key={x.medio} className="ind" data-tip={x.n < 2 ? 'Hace falta más de una placa' : `${x.medio}: ${x.n} placas`}>
                  <small>{x.medio}</small>{Number.isFinite(x.W) ? <Chip tipo={x.W >= 0.7 && x.p < 0.05 ? 'ok' : 'alerta'}>W {f2(x.W)} · p {pTxt(x.p)}</Chip> : <Chip tipo="neutro">1 placa</Chip>}</div>
              ))}
              {R.inter && <div className="ind" data-tip={`Interacción ${porSero ? 'serotipo' : 'cepa'} × placa con los pocillos: ¿el orden cambia más de lo que explica la variación entre pocillos?\nF = ${f2(R.inter.F)}, p = ${pTxt(R.inter.p)}\nLo que cambia el orden equivale al ${Math.round(R.inter.pct)} % de lo que separa a las ${nom} (menos de ~15 %: cambio chico).`}>
                <small>Cambios de orden</small><Chip tipo={R.inter.p < 0.05 && R.inter.pct > 15 ? 'alerta' : 'ok'}>{Math.round(R.inter.pct)} % · p {pTxt(R.inter.p)}</Chip></div>}
              {R.adOD && <div className="ind" data-tip={`No aditividad de Tukey: ¿una placa más teñida suma lo mismo a todas (aditivo) o multiplica?\nEn OD: F = ${f2(R.adOD.F)}, p = ${pTxt(R.adOD.p)}${R.adLn ? `\nEn logaritmo: F = ${f2(R.adLn.F)}, p = ${pTxt(R.adLn.p)}` : ''}\np < 0,05 en OD: el efecto multiplica; si en logaritmo desaparece, conviene ln(OD).`}>
                <small>Efecto de la placa</small><Chip tipo={R.adOD.p < 0.05 ? 'alerta' : 'ok'}>{R.adOD.p < 0.05 ? 'multiplica' : 'suma'} · p {pTxt(R.adOD.p)}</Chip></div>}
            </div>
          </section>

          <section className="tarjeta">
            <div className="cabeza-tarjeta"><span className="etiqueta-seccion">Puesto de cada {porSero ? 'serotipo' : 'cepa'} en cada placa</span><span className="ayuda">1 = más biofilm · clic en una placa para resaltarla</span></div>
            <div className="tabla-scroll">
              <table className={`tabla compacta tabla-puestos ${selV ? 'con-sel' : ''}`}>
                <thead><tr><th>Placa</th>{R.unidades.map((u) => <th key={u} className="num"><i className="punto" style={{ background: colores[u] }} /> {u}</th>)}<th className="num" data-tip="Correlación de Spearman media con las otras placas (1 = mismo orden)">Parecido</th></tr></thead>
                <tbody>{R.placas.map((p, i) => (
                  <tr key={p.id} className={`fila-clic ${p.id === selV ? 'elegida' : ''} ${i === R.iPeor && R.rhoMedio[i] < 0.4 ? 'placa-rara' : ''}`} onClick={() => elegir(p.id)}>
                    <td><b>{p.nombre}</b> <small className="tenue">{p.medio}</small></td>
                    {R.unidades.map((u, j) => <td key={u} className="num" style={{ '--puesto': (R.P[i][j] - 1) / Math.max(1, R.unidades.length - 1) }} data-tip={`${u} · ${p.nombre}\nOD media = ${fmt(R.M[i][j], 3)}`}><b>{Number.isInteger(R.P[i][j]) ? R.P[i][j] : f2(R.P[i][j])}</b> <small>{fmt(R.M[i][j], 2)}</small></td>)}
                    <td className="num">{f2(R.rhoMedio[i])}</td>
                  </tr>))}</tbody>
              </table>
            </div>
            {R.sueltas.length > 0 && <p className="ayuda">No entran (les falta alguna de las {nom} elegidas): {R.sueltas.map((p) => p.nombre).join(', ')}.</p>}
            <p className="ayuda">«Parecido»: correlación media con las otras placas; la placa en naranja es la que menos se parece.</p>
          </section>
        </>
      )}
      {exp && svg.current && <ExportDialog nombre="orden_entre_placas" size0={tamDe(svg.current)} onClose={() => setExp(false)} render={(ref, tam) => grafico(ref, tam)} />}
    </div>
  )
}
