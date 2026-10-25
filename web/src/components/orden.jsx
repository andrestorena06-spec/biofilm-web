// Gráfico › Comparar placas: ¿se mantiene el orden de las cepas (o serotipos) de placa en placa?
// Es el control para decidir si se puede usar la placa como bloque en Estadística.
import { useState } from 'react'
import { Nota } from './tip.jsx'
import { Chip, pTxt } from './pruebas.jsx'
import { analizarOrden } from '../orden.js'
import { seroDe, serotiposDe } from '../serotipos.js'
import { fmt, paletaMuestras } from '../utils.js'

const SIN_MEDIO = '(sin medio)'
const f2 = (x) => (Number.isFinite(x) ? x.toFixed(2).replace('.', ',') : '–')

// fila de fichas con casillas (tildar = entra)
function Fichas({ etiqueta, tip, opciones, dentro, onClick }) {
  return (
    <div className="fila-sel">
      <span className="fila-sel-t">{etiqueta}{tip && <Nota>{tip}</Nota>}</span>
      <div className="fichas">
        {opciones.map((x) => (
          <button key={x.id} type="button" className={`ficha multi ${dentro(x.id) ? 'on' : ''}`} data-tip={x.tip} onClick={() => onClick(x.id)}>
            <i className="caja-ficha" aria-hidden>{dentro(x.id) ? '✓' : ''}</i>
            {x.color && <i className="punto" style={{ background: x.color }} />}
            {x.texto}{x.sub && <small>{x.sub}</small>}
          </button>
        ))}
      </div>
    </div>
  )
}

// perfiles: una línea por cepa a lo largo de las placas (puestos u OD)
function Perfiles({ R, colores, ver }) {
  const W = 900, H = 300, m = { l: 48, r: 14, t: 14, b: 84 }
  const nP = R.placas.length, k = R.unidades.length
  const x = (i) => m.l + (nP > 1 ? (i * (W - m.l - m.r)) / (nP - 1) : (W - m.l - m.r) / 2)
  const vals = ver === 'od' ? R.M : R.P
  const top = ver === 'od' ? Math.max(...R.M.flat()) * 1.08 : k + 0.5
  const bot = ver === 'od' ? Math.min(0, ...R.M.flat()) : 0.5
  // con puestos, el 1 va arriba
  const y = (v) => (ver === 'od' ? m.t + (H - m.t - m.b) * (1 - (v - bot) / (top - bot)) : m.t + (H - m.t - m.b) * ((v - bot) / (top - bot)))
  const ticks = ver === 'od' ? [0, 1, 2, 3, 4].map((i) => bot + (i * (top - bot)) / 4) : Array.from({ length: k }, (_, i) => i + 1)
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="perfiles-orden" role="img" aria-label="Perfiles de las cepas a lo largo de las placas">
      <rect width={W} height={H} fill="#fff" />
      {ticks.map((t) => <g key={t}><line x1={m.l} x2={W - m.r} y1={y(t)} y2={y(t)} stroke="#eee6da" /><text x={m.l - 6} y={y(t) + 4} textAnchor="end" fontSize="11" fill="#7a6a58">{ver === 'od' ? fmt(t, 2) : t}</text></g>)}
      <text transform={`translate(13 ${(m.t + H - m.b) / 2}) rotate(-90)`} textAnchor="middle" fontSize="11" fill="#7a6a58">{ver === 'od' ? 'OD media de la placa' : 'Puesto (1 = más biofilm)'}</text>
      {R.placas.map((p, i) => <text key={p.id} transform={`translate(${x(i)} ${H - m.b + 12}) rotate(35)`} fontSize="11" fill={i === R.iPeor && R.rhoMedio[i] < 0.4 ? '#c25e00' : '#5b6672'}>{p.nombre}</text>)}
      {R.unidades.map((u, j) => (
        <g key={u}>
          <polyline fill="none" stroke={colores[u]} strokeWidth="2" points={R.placas.map((_, i) => `${x(i)},${y(vals[i][j])}`).join(' ')} />
          {R.placas.map((p, i) => <circle key={p.id} cx={x(i)} cy={y(vals[i][j])} r="4.5" fill={colores[u]} stroke="#fff" strokeWidth="1"
            data-tip={`${u} · ${p.nombre}\nOD media = ${fmt(R.M[i][j], 3)}\npuesto ${R.P[i][j]} de ${k}`} />)}
        </g>
      ))}
    </svg>
  )
}

export function OrdenPlacas({ s, D }) {
  const [ver, setVer] = useState('puestos')
  const o = s.opts.comparar
  const setO = (k, v) => s.setOpts((x) => ({ ...x, comparar: { ...x.comparar, [k]: v } }))
  const alternar = (k) => (id) => setO(k, (o[k] || []).includes(id) ? (o[k] || []).filter((x) => x !== id) : [...(o[k] || []), id])

  // placas con análisis, ordenadas por medio; cepas sin blancos, en el orden de la lista
  const ordenM = [...new Set(s.placas.map((p) => p.medio || SIN_MEDIO))]
  const todas = [...D.conAnalisis].sort((a, b) => ordenM.indexOf(a.medio || SIN_MEDIO) - ordenM.indexOf(b.medio || SIN_MEDIO))
  const medios = [...new Set(todas.map((p) => p.medio || SIN_MEDIO))]
  const enMedio = todas.filter((p) => !(o.ordenMediosFuera || []).includes(p.medio || SIN_MEDIO))
  const placas = enMedio.filter((p) => !(o.ordenPlacasFuera || []).includes(p.id))
  const presentes = new Set(todas.flatMap((p) => s.analisisMap[p.id].resumen.map((r) => r.Muestra)))
  const cepasTodas = [...s.muestras.filter((m) => presentes.has(m)), ...[...presentes].filter((m) => !s.muestras.includes(m))]
  const seros = serotiposDe(s.exp, cepasTodas)
  const cepas = cepasTodas.filter((c) => !(o.ordenCepasFuera || []).includes(c) && !(seroDe(s.exp, c) && (o.ordenSeroFuera || []).includes(seroDe(s.exp, c))))
  const porSero = o.ordenUnidad === 'serotipo' && seros.length > 0
  const unidades = porSero ? seros.filter((sr) => !(o.ordenSeroFuera || []).includes(sr) && cepas.some((c) => seroDe(s.exp, c) === sr)) : cepas
  const unidadDe = (c) => (porSero ? seroDe(s.exp, c) : c)

  // valores de cada placa: media de la cepa (o del serotipo: promedio de sus cepas) y sus pocillos
  const filas = placas.map((p) => {
    const a = s.analisisMap[p.id]
    const res = a.resumen.filter((r) => cepas.includes(r.Muestra) && Number.isFinite(r.Media))
    const prom = (campo) => Object.fromEntries(unidades.map((u) => { const v = res.filter((r) => unidadDe(r.Muestra) === u).map((r) => r[campo] ?? r.Media); return [u, v.length ? v.reduce((x, y) => x + y, 0) / v.length : NaN] }))
    return { id: p.id, nombre: p.nombre, medio: p.medio || SIN_MEDIO, valores: prom('Media'), valoresLeidos: prom('MediaLeida'),
      pozos: a.estado.filter((e) => e.Usado && !e.EsBlanco && cepas.includes(e.Muestra) && unidadDe(e.Muestra)).map((e) => ({ unidad: unidadDe(e.Muestra), y: e.OD })) }
  })
  const R = analizarOrden(filas, unidades)
  const colores = porSero ? Object.fromEntries(seros.map((sr, i) => [sr, paletaMuestras(seros)[sr] || ['#c0392b', '#2980b9', '#27ae60'][i % 3]])) : paletaMuestras(s.muestras)

  const titulo = { ok: 'El orden se mantiene: se puede usar la placa como bloque', medio: 'El orden se parece, pero cambia en algunas placas: bloque con cautela', no: 'El orden cambia entre placas: no conviene usar la placa como bloque' }
  const clase = { ok: 'ok', medio: 'mixto', no: 'dif' }
  const nom = porSero ? 'serotipos' : 'cepas'

  return (
    <section className="tarjeta orden-placas">
      <div className="cabeza-tarjeta">
        <span className="etiqueta-seccion">¿Se mantiene el orden entre placas?</span>
        <span className="ayuda">Antes de usar la placa como bloque<Nota>{'En Estadística, «Placa como bloque» saca del ruido la diferencia entre placas (una placa más teñida sube a todas las cepas). Eso solo vale si el ORDEN de las cepas se repite de placa en placa. Acá se mira con los puestos, la W de Kendall, la correlación entre placas y la interacción cepa × placa de los pocillos.'}</Nota></span>
      </div>
      {seros.length > 0 && (
        <Fichas etiqueta="Ordenar" opciones={[{ id: 'cepa', texto: 'Cepas' }, { id: 'serotipo', texto: 'Serotipos' }]} dentro={(id) => (id === 'serotipo') === porSero} onClick={(id) => setO('ordenUnidad', id)} />
      )}
      {medios.length > 1 && <Fichas etiqueta="Medios" opciones={medios.map((m) => ({ id: m, texto: m }))} dentro={(id) => !(o.ordenMediosFuera || []).includes(id)} onClick={alternar('ordenMediosFuera')} />}
      <Fichas etiqueta="Placas" opciones={enMedio.map((p) => ({ id: p.id, texto: p.nombre, sub: p.medio, color: D.colores[p.id] || D.colorBase[p.id] }))} dentro={(id) => !(o.ordenPlacasFuera || []).includes(id)} onClick={alternar('ordenPlacasFuera')} />
      <Fichas etiqueta="Cepas" opciones={cepasTodas.map((c) => ({ id: c, texto: c, sub: seroDe(s.exp, c) || undefined }))} dentro={(id) => !(o.ordenCepasFuera || []).includes(id)} onClick={alternar('ordenCepasFuera')} />
      {seros.length > 0 && <Fichas etiqueta="Serotipos" opciones={seros.map((sr) => ({ id: sr, texto: sr }))} dentro={(id) => !(o.ordenSeroFuera || []).includes(id)} onClick={alternar('ordenSeroFuera')} />}

      {!R.ok ? <p className="aviso-sel">{R.motivo}</p> : (
        <>
          <div className={`veredicto ${clase[R.nivel]}`}>
            <b>{titulo[R.nivel]}</b>
            <span>W de Kendall = {f2(R.kw.W)} (p {pTxt(R.kw.p)}) con {R.placas.length} placas y {R.unidades.length} {nom}</span>
          </div>
          {R.mejoraSinPeor && <p className="lectura">La placa <b>{R.placas[R.iPeor].nombre}</b> es la que menos se parece a las demás (correlación media {f2(R.rhoMedio[R.iPeor])}). Sin ella, W sube a {f2(R.sinPeor.W)}: revisala (pocillos asignados, columnas corridas, tinción).</p>}
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

          <div className="fila" style={{ gap: 6, margin: '8px 0 4px' }}>
            <button className={`chico ${ver === 'puestos' ? 'primario' : ''}`} onClick={() => setVer('puestos')}>Puestos</button>
            <button className={`chico ${ver === 'od' ? 'primario' : ''}`} onClick={() => setVer('od')}>OD</button>
          </div>
          <div className="figura"><Perfiles R={R} colores={colores} ver={ver} /></div>

          <div className="tabla-scroll">
            <table className="tabla compacta tabla-puestos">
              <thead><tr><th>Placa</th>{R.unidades.map((u) => <th key={u} className="num">{u}</th>)}<th className="num" data-tip="Correlación de Spearman media con las otras placas (1 = mismo orden)">Parecido</th></tr></thead>
              <tbody>{R.placas.map((p, i) => (
                <tr key={p.id} className={i === R.iPeor && R.rhoMedio[i] < 0.4 ? 'placa-rara' : ''}>
                  <td><b>{p.nombre}</b> <small className="tenue">{p.medio}</small></td>
                  {R.unidades.map((u, j) => <td key={u} className="num" style={{ '--puesto': (R.P[i][j] - 1) / Math.max(1, R.unidades.length - 1) }} data-tip={`${u} · ${p.nombre}\nOD media = ${fmt(R.M[i][j], 3)}`}><b>{Number.isInteger(R.P[i][j]) ? R.P[i][j] : f2(R.P[i][j])}</b> <small>{fmt(R.M[i][j], 2)}</small></td>)}
                  <td className="num">{f2(R.rhoMedio[i])}</td>
                </tr>))}</tbody>
            </table>
          </div>
          {R.sueltas.length > 0 && <p className="ayuda">No entran (les falta alguna de las {nom} elegidas): {R.sueltas.map((p) => p.nombre).join(', ')}.</p>}
          <p className="ayuda">Puesto 1 = la que más biofilm formó en esa placa. «Parecido»: correlación media con las otras placas; la placa en naranja es la que menos se parece.</p>
        </>
      )}
    </section>
  )
}
