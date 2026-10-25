// ============================================================
// Grupos de «Estadística › A medida». Cada campo (cepa, medio, placa, serotipo) es una lista: el grupo junta
// todo lo elegido y una lista vacía es «cualquiera». Las sesiones anteriores guardaban un solo valor (texto).
// ============================================================
export const listaDe = (v) => (Array.isArray(v) ? v.filter(Boolean) : v ? [v] : [])

// el grupo usa placas elegidas a mano: los pocillos pasan a ser la réplica
export const usaPlaca = (g) => listaDe(g.placa).length > 0

// ¿el dato x ({ cepa, medio, placaId }) entra en el grupo?
export const dentroDeGrupo = (g, x, seroDe) => {
  const c = listaDe(g.cepa), m = listaDe(g.medio), p = listaDe(g.placa), sr = listaDe(g.serotipo)
  return (!c.length || c.includes(x.cepa)) && (!m.length || m.includes(x.medio))
    && (!p.length || p.includes(x.placaId)) && (!sr.length || sr.includes(seroDe(x.cepa)))
}

// nombre del grupo para tablas y gráficos (con muchas elegidas se abrevia)
const juntar = (l) => (l.length <= 3 ? l.join(' + ') : `${l.slice(0, 2).join(' + ')} y ${l.length - 2} más`)
export const nombreGrupo = (g, nombrePlaca) => {
  const sr = listaDe(g.serotipo), c = listaDe(g.cepa), m = listaDe(g.medio), p = listaDe(g.placa).map(nombrePlaca)
  return [sr.length ? `serotipo ${juntar(sr)}` : null, c.length ? juntar(c) : null, m.length ? juntar(m) : null, p.length ? juntar(p) : null]
    .filter(Boolean).join(' · ') || 'Todos los datos'
}
