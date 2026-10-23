import { useMemo, useState } from 'react'
import { Nota } from './tip.jsx'
import { Check, Num, Vacio } from './ui.jsx'
import { BotonCinta, Cajon, CampoCinta, Cinta, Grupo, OpcionesCinta } from './cinta.jsx'
import { excelDe } from '../api.js'
import { descargarBlob } from '../utils.js'
import { nivelIcc, reproducibilidad } from '../reproducibilidad.js'

const finito = Number.isFinite
const pTxt = (p) => (p === null || p === undefined || !finito(p) ? '–' : p < 0.0001 ? '< 0,0001' : p.toFixed(4).replace('.', ','))
// «p = 0,0123» o «p < 0,0001»
const pEq = (p) => (finito(p) && p < 0.0001 ? 'p\u00a0<\u00a00,0001' : `p\u00a0=\u00a0${pTxt(p)}`)
const n3 = (x) => (finito(x) ? x.toFixed(3).replace('.', ',') : '–')
const n1 = (x) => (finito(x) ? x.toFixed(1).replace('.', ',') : '–')
const n2 = (x) => (finito(x) ? x.toFixed(2).replace('.', ',') : '–')
const fuerza = (r) => (!finito(r) ? '' : Math.abs(r) >= 0.9 ? 'muy fuerte' : Math.abs(r) >= 0.7 ? 'fuerte' : Math.abs(r) >= 0.5 ? 'moderada' : 'débil')
const Ok = ({ ok, children }) => <span className={ok === null ? '' : ok ? 'eval-ok' : 'eval-mal'}>{children}</span>

// ===============================================================
// REPRODUCIBILIDAD ENTRE EXPERIMENTOS: cada placa es una repetición del experimento
// ===============================================================
export function ReproTab({ s, D, o, setO, grupoModo }) {
  const [copiado, setCopiado] = useState(false)
  const [cajon, setCajon] = useState(null)
  const { conAnalisis, placasSel, colores, colorBase, esBlanco } = D
  const variable = o.reproVar === 'odc' ? 'odc' : 'od'
  const cvBueno = finito(Number(o.reproCvBueno)) ? Number(o.reproCvBueno) : 20
  const cvMax = finito(Number(o.reproCvMax)) ? Number(o.reproCvMax) : 30
  // cepas: todas las muestras que no son blanco, en el orden de la lista de muestras
  const todas = D.muestras.filter((m) => !esBlanco.has(m) && placasSel.some((p) => s.analisisMap[p.id].resumen.some((r) => r.Muestra === m)))
  const fuera = new Set(o.reproFuera || [])
  const cepas = todas.filter((m) => !fuera.has(m))
  const exps = placasSel.map((p) => ({ id: p.id, nombre: p.nombre }))

  const R = useMemo(() => {
    if (exps.length < 2 || !cepas.length) return null
    const valores = (e, c) => {
      const a = s.analisisMap[e.id]
      const odc = a.odc?.odc
      return a.estado.filter((x) => x.Muestra === c && x.Usado && !x.EsBlanco && finito(x.OD))
        .map((x) => (variable === 'odc' ? (finito(odc) && odc > 0 ? x.OD / odc : NaN) : x.OD)).filter(finito)
    }
    return reproducibilidad(exps, cepas, valores)
  }, [s.analisisMap, exps.map((e) => e.id).join(), cepas.join(), variable]) // eslint-disable-line react-hooks/exhaustive-deps

  const nomVar = variable === 'odc' ? 'OD ÷ ODc' : 'OD'
  const evalCv = (cv) => (!finito(cv) ? '–' : cv <= cvBueno ? 'Buena' : cv <= cvMax ? 'Aceptable' : 'Alta variabilidad')

  // texto de resumen (para copiar)
  const resumen = useMemo(() => {
    if (!R) return []
    const out = []
    const cvs = R.variab.filter((v) => finito(v.cv))
    if (cvs.length) {
      const malos = cvs.filter((v) => v.cv > cvMax)
      out.push(`Variabilidad entre los ${exps.length} experimentos (${nomVar}): CV de ${n1(Math.min(...cvs.map((v) => v.cv)))} % a ${n1(Math.max(...cvs.map((v) => v.cv)))} %. ${malos.length ? `Superan el ${cvMax} %: ${malos.map((v) => v.cepa).join(', ')}.` : `Todas las cepas quedan en ${cvMax} % o menos.`}`)
    }
    const conP = R.porCepa.filter((c) => (c.usarKw ? c.kw : c.anova))
    if (conP.length) {
      const dif = conP.filter((c) => (c.usarKw ? c.kw.p : c.anova.p) < 0.05)
      out.push(`Comparación de los experimentos para cada cepa (ANOVA de una vía o Kruskal-Wallis según la normalidad): ${dif.length ? `hay diferencias significativas en ${dif.map((c) => c.cepa).join(', ')} (p < 0,05)` : 'no hay diferencias significativas entre experimentos en ninguna cepa (p ≥ 0,05)'}.`)
    }
    if (R.dos) {
      const [fa, fb, fab] = R.dos.filas
      out.push(`ANOVA de dos vías (cepa × experimento): efecto de la cepa ${pEq(fa.p)}, del experimento ${pEq(fb.p)}, interacción ${pEq(fab.p)}. ${fab.p >= 0.05 ? 'La interacción no es significativa: el efecto de la cepa se mantiene en los experimentos.' : 'La interacción es significativa: las diferencias entre cepas no son iguales en todos los experimentos.'}`)
    }
    const prs = R.pares.filter((x) => x.pearson || x.spearman)
    if (prs.length) {
      out.push(`Correlación entre experimentos: ${prs.map((x) => { const c = elegirCorr(x, R); return `${x.a.nombre} vs ${x.b.nombre} ${c.nombre} = ${n2(c.res.r)} (${pEq(c.res.p)})` }).join('; ')}.`)
    }
    if (R.icc) out.push(`Concordancia global: ICC(2,1) de acuerdo absoluto = ${n2(R.icc.icc2)} (IC 95 %: ${n2(R.icc.ic2[0])} a ${n2(R.icc.ic2[1])}), ${nivelIcc(R.icc.icc2).toLowerCase()}; ICC(3,1) de consistencia = ${n2(R.icc.icc3)}.`)
    return out
  }, [R, cvMax, nomVar, exps.length])

  const descargar = () => {
    if (!R) return
    const hojas = []
    hojas.push({ nombre: 'Variabilidad', columnas: ['Cepa', ...exps.map((e) => e.nombre), 'n', 'Media', 'DE', 'CV_pct', 'Evaluacion'],
      filas: R.variab.map((v) => ({ Cepa: v.cepa, ...Object.fromEntries(exps.map((e, i) => [e.nombre, finito(v.porExp[i]) ? v.porExp[i] : null])), n: v.n, Media: v.media, DE: finito(v.sd) ? v.sd : null, CV_pct: finito(v.cv) ? v.cv : null, Evaluacion: evalCv(v.cv) })) })
    hojas.push({ nombre: 'Entre experimentos', columnas: ['Cepa', 'Pocillos', 'Shapiro_W', 'Shapiro_p', 'ANOVA_F', 'ANOVA_gl', 'ANOVA_p', 'Kruskal_H', 'Kruskal_gl', 'Kruskal_p', 'Prueba', 'p'],
      filas: R.porCepa.map((c) => ({ Cepa: c.cepa, Pocillos: c.n, Shapiro_W: c.sw?.W ?? null, Shapiro_p: c.sw?.p ?? null, ANOVA_F: c.anova?.F ?? null, ANOVA_gl: c.anova ? `${c.anova.df1}; ${c.anova.df2}` : null, ANOVA_p: c.anova?.p ?? null,
        Kruskal_H: c.kw?.H ?? null, Kruskal_gl: c.kw?.df ?? null, Kruskal_p: c.kw?.p ?? null, Prueba: c.usarKw ? 'Kruskal-Wallis' : 'ANOVA', p: (c.usarKw ? c.kw?.p : c.anova?.p) ?? null })) })
    if (R.dos) hojas.push({ nombre: 'ANOVA dos vias', columnas: ['Fuente', 'SC', 'gl', 'CM', 'F', 'p'],
      filas: R.dos.filas.map((f) => ({ Fuente: { A: 'Cepa', B: 'Experimento', AB: 'Cepa x Experimento', Residual: 'Residual' }[f.nombre], SC: f.ss, gl: f.df, CM: finito(f.ms) ? f.ms : null, F: finito(f.F) ? f.F : null, p: finito(f.p) ? f.p : null })) })
    hojas.push({ nombre: 'Correlacion', columnas: ['Experimento_1', 'Experimento_2', 'n_cepas', 'Pearson_r', 'Pearson_p', 'Spearman_rho', 'Spearman_p'],
      filas: R.pares.map((x) => ({ Experimento_1: x.a.nombre, Experimento_2: x.b.nombre, n_cepas: x.n, Pearson_r: x.pearson?.r ?? null, Pearson_p: x.pearson?.p ?? null, Spearman_rho: x.spearman?.r ?? null, Spearman_p: x.spearman?.p ?? null })) })
    if (R.icc) hojas.push({ nombre: 'ICC', columnas: ['Tipo', 'ICC', 'IC95_inf', 'IC95_sup', 'Concordancia'],
      filas: [
        { Tipo: 'ICC(2,1) acuerdo absoluto', ICC: R.icc.icc2, IC95_inf: R.icc.ic2[0], IC95_sup: R.icc.ic2[1], Concordancia: nivelIcc(R.icc.icc2) },
        { Tipo: 'ICC(3,1) consistencia', ICC: R.icc.icc3, IC95_inf: R.icc.ic3[0], IC95_sup: R.icc.ic3[1], Concordancia: nivelIcc(R.icc.icc3) },
      ] })
    hojas.push({ nombre: 'Resumen', columnas: ['Resumen'], filas: resumen.map((t) => ({ Resumen: t })) })
    excelDe(hojas).then((b) => descargarBlob(b, 'reproducibilidad_biofilm.xlsx'))
  }

  return (
    <div className="repro">
      <Cinta>
        {grupoModo}
        <Grupo titulo="Variable">
          <OpcionesCinta valor={variable} onChange={(v) => setO('reproVar', v)} opciones={[
            ['od', 'OD', 'OD', null, 'OD\nLa densidad óptica de cada pocillo'],
            ['odc', 'OD ÷ ODc', '÷', null, 'OD ÷ ODc de su placa\nCorrige las diferencias de fondo entre días: suele ser la mejor medida para comparar experimentos'],
          ]} />
        </Grupo>
        <Grupo titulo="CV entre placas" tip={'Límites del CV entre experimentos\nEn biofilm (cristal violeta) un CV menor que 20–30 % suele considerarse aceptable'}>
          <CampoCinta etiqueta="Bueno hasta (%)"><Num value={cvBueno} min={1} max={100} ancho={56} onChange={(v) => setO('reproCvBueno', v === '' ? 20 : v)} /></CampoCinta>
          <CampoCinta etiqueta="Aceptable hasta (%)"><Num value={cvMax} min={1} max={200} ancho={56} onChange={(v) => setO('reproCvMax', v === '' ? 30 : v)} /></CampoCinta>
        </Grupo>
        <Grupo titulo="Datos">
          <BotonCinta icono="placas" texto={`Placas ${placasSel.length}/${conAnalisis.length}`} activo={cajon === 'placas'} onClick={() => setCajon(cajon === 'placas' ? null : 'placas')} tip="Cada placa es una repetición independiente del experimento" />
          <BotonCinta icono="filtro" texto={`Cepas ${cepas.length}/${todas.length}`} activo={cajon === 'cepas'} onClick={() => setCajon(cajon === 'cepas' ? null : 'cepas')} tip="Cepas o condiciones que entran en el análisis" />
        </Grupo>
        <Grupo titulo="Exportar">
          <BotonCinta icono="tabla" texto="Excel" onClick={descargar} deshabilitado={!R} tip="Todas las tablas de la concordancia y el resumen" />
        </Grupo>
      </Cinta>
      <Cajon titulo="Placas (experimentos)" abierto={cajon === 'placas'} onClose={() => setCajon(null)}>
        <div className="fila" style={{ marginBottom: 8 }}>
          <button className="chico" onClick={() => setO('placasFuera', [])}>Todas</button>
          <button className="chico" onClick={() => setO('placasFuera', conAnalisis.map((x) => x.id))}>Ninguna</button>
        </div>
        <div className="lista-check columnas">
          {conAnalisis.map((p) => (
            <Check key={p.id} label={<><i className="punto" style={{ background: colores[p.id] || colorBase[p.id] }} /> {p.nombre}{p.medio && <small className="medio-placa">{p.medio}</small>}</>}
              checked={placasSel.some((x) => x.id === p.id)}
              onChange={(v) => setO('placasFuera', v ? (o.placasFuera || []).filter((x) => x !== p.id) : [...(o.placasFuera || []), p.id])} />
          ))}
        </div>
      </Cajon>
      <Cajon titulo="Cepas o condiciones" abierto={cajon === 'cepas'} onClose={() => setCajon(null)}>
        <div className="lista-check columnas">
          {todas.map((m) => <Check key={m} label={m} checked={!fuera.has(m)} onChange={(v) => setO('reproFuera', v ? [...fuera].filter((x) => x !== m) : [...fuera, m])} />)}
        </div>
      </Cajon>

      <div className="principal-repro">
        <p className="ayuda" style={{ marginTop: 0 }}>{exps.length} {exps.length === 1 ? 'experimento' : 'experimentos'} (placas) · {cepas.length} {cepas.length === 1 ? 'cepa' : 'cepas'} · {nomVar}</p>
        {!R ? <Vacio texto="Elegí al menos dos placas (experimentos) y una cepa." /> : (
          <>
            <section className="resultado-test">
              <div className="titulo-fila"><h2>Resumen</h2>
                <button className="chico" onClick={() => { navigator.clipboard?.writeText(resumen.join('\n')); setCopiado(true); setTimeout(() => setCopiado(false), 1500) }}>{copiado ? 'Copiado' : 'Copiar'}</button>
              </div>
              <ul className="resumen-repro">{resumen.map((t, i) => <li key={i}>{t}</li>)}</ul>
            </section>

            <section className="resultado-test">
              <h2>1. Variabilidad entre experimentos <Nota>{'Cada experimento aporta un valor por cepa: la media de sus pocillos aceptados.\nCV % = DE ÷ media × 100, con la DE entre experimentos.'}</Nota></h2>
              <div className="tabla-scroll">
                <table className="tabla">
                  <thead><tr><th>Cepa</th>{exps.map((e) => <th key={e.id}>{e.nombre}</th>)}<th>Media</th><th>DE</th><th>CV %</th><th>Evaluación</th></tr></thead>
                  <tbody>
                    {R.variab.map((v) => (
                      <tr key={v.cepa}>
                        <td><b>{v.cepa}</b></td>{v.porExp.map((x, i) => <td key={i}>{n3(x)}</td>)}
                        <td>{n3(v.media)}</td><td>{n3(v.sd)}</td><td>{n1(v.cv)}</td>
                        <td><Ok ok={finito(v.cv) ? v.cv <= cvMax : null}>{evalCv(v.cv)}</Ok></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="resultado-test">
              <h2>2. ¿Difieren los experimentos? <Nota>{'Para cada cepa se comparan los pocillos de los distintos experimentos (factor: experimento).\nSi los residuos no son normales (Shapiro-Wilk p < 0,05) o algún experimento tiene menos de 3 pocillos, se usa Kruskal-Wallis; si no, el ANOVA de una vía.\np ≥ 0,05: no hay diferencias significativas entre repeticiones (es lo deseable).'}</Nota></h2>
              <div className="tabla-scroll">
                <table className="tabla">
                  <thead><tr><th>Cepa</th><th>Pocillos</th><th>Shapiro-Wilk</th><th>ANOVA</th><th>Kruskal-Wallis</th><th>Prueba a usar</th><th>Resultado</th></tr></thead>
                  <tbody>
                    {R.porCepa.map((c) => {
                      const p = c.usarKw ? c.kw?.p : c.anova?.p
                      return (
                        <tr key={c.cepa}>
                          <td><b>{c.cepa}</b></td><td>{c.n}</td>
                          <td>{c.sw ? `W = ${n3(c.sw.W)} · ${pEq(c.sw.p)}` : '–'}</td>
                          <td>{c.anova ? `F(${c.anova.df1}; ${c.anova.df2}) = ${n2(c.anova.F)} · ${pEq(c.anova.p)}` : '–'}</td>
                          <td>{c.kw ? `H(${c.kw.df}) = ${n2(c.kw.H)} · ${pEq(c.kw.p)}` : '–'}</td>
                          <td>{c.k < 2 ? '–' : c.usarKw ? 'Kruskal-Wallis' : 'ANOVA'}</td>
                          <td>{finito(p) ? <Ok ok={p >= 0.05}>{p >= 0.05 ? 'Sin diferencias entre experimentos' : 'Los experimentos difieren'}</Ok> : 'No se puede calcular'}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
              {R.dos && (
                <>
                  <h3>ANOVA de dos vías: cepa × experimento <Nota>{'Con todos los pocillos. Sumas de cuadrados tipo II (como car::Anova de R).\nLa interacción responde si el efecto de la cepa se mantiene en todos los experimentos: p ≥ 0,05 en la interacción = el patrón entre cepas se repite.'}</Nota></h3>
                  <div className="tabla-scroll">
                    <table className="tabla">
                      <thead><tr><th>Fuente</th><th>SC</th><th>gl</th><th>CM</th><th>F</th><th>p</th><th>Lectura</th></tr></thead>
                      <tbody>
                        {R.dos.filas.map((f) => (
                          <tr key={f.nombre}>
                            <td><b>{{ A: 'Cepa', B: 'Experimento', AB: 'Cepa × experimento', Residual: 'Residual' }[f.nombre]}</b></td>
                            <td>{n3(f.ss)}</td><td>{f.df}</td><td>{n3(f.ms)}</td><td>{n2(f.F)}</td><td>{pTxt(f.p)}</td>
                            <td>{f.nombre === 'A' ? (f.p < 0.05 ? 'Las cepas difieren' : 'Las cepas no difieren')
                              : f.nombre === 'B' ? <Ok ok={f.p >= 0.05}>{f.p < 0.05 ? 'Hay diferencias de nivel entre experimentos' : 'Sin diferencias entre experimentos'}</Ok>
                                : f.nombre === 'AB' ? <Ok ok={f.p >= 0.05}>{f.p < 0.05 ? 'El efecto de la cepa cambia según el experimento' : 'El efecto de la cepa se mantiene'}</Ok> : ''}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </section>

            <section className="resultado-test">
              <h2>3. ¿Se relacionan los experimentos? <Nota>{'Se comparan los experimentos de a pares con la media de cada cepa.\nr cercano a 1: las cepas mantienen el mismo orden (las que forman más biofilm siguen formando más).\nPearson si las medias de los dos experimentos son normales (Shapiro-Wilk); si no, Spearman. Hacen falta 3 o más cepas.'}</Nota></h2>
              <div className="tabla-scroll">
                <table className="tabla">
                  <thead><tr><th>Experimentos</th><th>Cepas</th><th>Pearson r</th><th>p</th><th>Spearman ρ</th><th>p</th><th>Recomendado</th><th>Lectura</th></tr></thead>
                  <tbody>
                    {R.pares.map((x) => {
                      const c = elegirCorr(x, R)
                      return (
                        <tr key={x.a.id + x.b.id}>
                          <td><b>{x.a.nombre} vs {x.b.nombre}</b></td><td>{x.n}</td>
                          <td>{n2(x.pearson?.r)}</td><td>{pTxt(x.pearson?.p)}</td><td>{n2(x.spearman?.r)}</td><td>{pTxt(x.spearman?.p)}</td>
                          <td>{c.res ? c.nombre : '–'}</td>
                          <td>{c.res ? <Ok ok={c.res.r >= 0.7}>{`Correlación ${fuerza(c.res.r)}${c.res.r < 0 ? ' (inversa)' : ''}`}</Ok> : 'Hacen falta 3 o más cepas'}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="resultado-test">
              <h2>4. Concordancia global (ICC) <Nota>{'Coeficiente de correlación intraclase con la media de cada cepa en cada experimento (solo las cepas que están en todos).\nICC(2,1), acuerdo absoluto: los experimentos dan los mismos valores (es el que se reporta para reproducibilidad).\nICC(3,1), consistencia: mantienen el mismo patrón aunque cambie el nivel.\n< 0,5 pobre · 0,5–0,75 moderada · 0,75–0,9 buena · > 0,9 excelente (Koo y Li, 2016).'}</Nota></h2>
              {R.icc ? (
                <div className="tabla-scroll">
                  <table className="tabla">
                    <thead><tr><th>Tipo</th><th>ICC</th><th>IC 95 %</th><th>Concordancia</th></tr></thead>
                    <tbody>
                      <tr><td><b>ICC(2,1) acuerdo absoluto</b></td><td>{n2(R.icc.icc2)}</td><td>{n2(R.icc.ic2[0])} a {n2(R.icc.ic2[1])}</td><td><Ok ok={R.icc.icc2 >= 0.75}>{nivelIcc(R.icc.icc2)}</Ok></td></tr>
                      <tr><td><b>ICC(3,1) consistencia</b></td><td>{n2(R.icc.icc3)}</td><td>{n2(R.icc.ic3[0])} a {n2(R.icc.ic3[1])}</td><td><Ok ok={R.icc.icc3 >= 0.75}>{nivelIcc(R.icc.icc3)}</Ok></td></tr>
                    </tbody>
                  </table>
                </div>
              ) : <p>Hacen falta al menos 2 cepas presentes en todos los experimentos.</p>}
              {R.icc && <p className="ayuda">{R.icc.n} cepas × {R.icc.k} experimentos · F({R.icc.df1}; {R.icc.df2}) = {n2(R.icc.F)}, {pEq(R.icc.p)}{R.completas.length < cepas.length ? ` · no entran las cepas que faltan en algún experimento (${cepas.filter((c) => !R.completas.includes(c)).join(', ')})` : ''}</p>}
            </section>
            <p className="ayuda">Cálculos verificados contra scipy, statsmodels y pingouin (equivalentes a aov, car::Anova, shapiro.test, kruskal.test, cor.test y psych::ICC de R). Detalle en «Métodos».</p>
          </>
        )}
      </div>
    </div>
  )
}

// Pearson si las medias de los dos experimentos parecen normales (Shapiro-Wilk p ≥ 0,05); si no, Spearman
export function elegirCorr(x, R) {
  const swA = R.normalExp[R.expsIdx[x.a.id]], swB = R.normalExp[R.expsIdx[x.b.id]]
  const normal = swA && swB && swA.p >= 0.05 && swB.p >= 0.05
  return normal && x.pearson ? { nombre: 'Pearson', res: x.pearson } : x.spearman ? { nombre: 'Spearman', res: x.spearman } : { nombre: 'Pearson', res: x.pearson }
}
