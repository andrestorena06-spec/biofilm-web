// Íconos de trazo (24 × 24), los mismos de Curvas de crecimiento más los propios de Biofilm
const P = {
  x: 'M6 6l12 12M18 6L6 18',
  subir: 'M12 16V4M7 9l5-5 5 5M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3',
  bajar: 'M12 4v12M7 11l5 5 5-5M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3',
  mas: 'M12 5v14M5 12h14',
  deshacer: 'M9 14L4 9l5-5M4 9h10.5a5.5 5.5 0 0 1 0 11H11',
  rehacer: 'M15 14l5-5-5-5M20 9H9.5a5.5 5.5 0 0 0 0 11H13',
  hamburguesa: 'M4 6h16M4 12h16M4 18h16',
  check: 'M5 12.5l4.5 4.5L19 7',
  flecha: 'M9 6l6 6-6 6',
  abajo: 'M6 9l6 6 6-6',
  sol: 'M12 4V2M12 22v-2M4 12H2M22 12h-2M5.6 5.6L4.2 4.2M19.8 19.8l-1.4-1.4M5.6 18.4l-1.4 1.4M19.8 4.2l-1.4 1.4M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10z',
  luna: 'M20 14.5A8.5 8.5 0 0 1 9.5 4 8.5 8.5 0 1 0 20 14.5z',
  archivo: 'M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8zM14 3v5h5',
  carpeta: 'M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z',
  guardar: 'M5 3h11l3 3v13a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zM7 3v5h8V3M7 21v-7h10v7',
  nuevo: 'M12 8v8M8 12h8M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z',
  resumen: 'M3 4h8v7H3zM13 4h8v4h-8zM13 10h8v10h-8zM3 13h8v7H3z',
  placa: 'M3 6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2zM8 9h.01M12 9h.01M16 9h.01M8 13h.01M12 13h.01M16 13h.01M8 17h.01',
  placas: 'M6 3h12a2 2 0 0 1 2 2v1M4 8h16a1 1 0 0 1 1 1v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9a1 1 0 0 1 1-1zM8 13h.01M12 13h.01M16 13h.01M8 17h.01M12 17h.01',
  escudo: 'M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6z M9 12l2 2 4-4',
  umbral: 'M4 20h16M7 20v-6M11 20V9M15 20v-4M19 20V6M3 12h18',
  barras: 'M4 20h16M6 20v-7M10 20V6M14 20v-9M18 20V9',
  sigma: 'M18 5H7l6 7-6 7h11',
  tabla: 'M3 5h18v14H3zM3 10h18M3 15h18M9 5v14',
  libro: 'M4 4.5A2.5 2.5 0 0 1 6.5 2H20v17H6.5A2.5 2.5 0 0 0 4 21.5zM4 21.5A2.5 2.5 0 0 0 6.5 24H20',
  borrar: 'M4 7h16M10 11v6M14 11v6M5 7l1 13h12l1-13M9 7V4h6v3',
  copiar: 'M8 8h12v12H8zM4 16V4h12',
  ojo: 'M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
  imprimir: 'M6 9V3h12v6M6 18H4v-7h16v7h-2M6 14h12v7H6z',
  info: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 11v6M12 7.5h.01',
  editar: 'M4 20h4L19 9l-4-4L4 16zM14 6l4 4',
  refrescar: 'M20 11a8 8 0 1 0-2.3 5.7M20 4v7h-7',
  imagen: 'M4 5h16v14H4zM4 16l4.5-4.5 3.5 3.5 2.5-2.5L20 18M15.5 9.5h.01',
  teclado: 'M3 6h18v12H3zM7 10h.01M11 10h.01M15 10h.01M7 14h10',
  filtro: 'M4 5h16l-6 7v6l-4 2v-8z',
  puntos: 'M7 15h.01M12 9h.01M17 13h.01M9 19h.01M15 6h.01',
  ordenar: 'M7 4v16M4 7l3-3 3 3M17 20V4M14 17l3 3 3-3',
  rotar: 'M4 18L18 4M18 4h-6M18 4v6M6 20h14',
  error: 'M12 4v16M8 4h8M8 20h8M6 12h12',
  matraz: 'M9 3h6M10 3v6L4.5 18.5A1.6 1.6 0 0 0 6 21h12a1.6 1.6 0 0 0 1.5-2.5L14 9V3M7.5 15h9',
  pegar: 'M9 4h6v3H9zM8 5H6a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V6a1 1 0 0 0-1-1h-2M9 12h6M9 16h4',
}
export const Icono = ({ n, size = 18, ancho = 1.8, style }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={ancho} strokeLinecap="round" strokeLinejoin="round" aria-hidden style={style}>
    <path d={P[n] || P.info} />
  </svg>
)

// Logo: una placa de 96 pocillos con algunos pocillos teñidos de cristal violeta
export const LogoPlaca = ({ size = 22 }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden>
    <rect width="24" height="24" rx="6" fill="#EF9F27" />
    {Array.from({ length: 4 }, (_, f) => Array.from({ length: 5 }, (_, c) => (
      <circle key={f + '-' + c} cx={5 + c * 3.5} cy={6 + f * 4} r="1.25"
        fill={(f === 1 && c > 0 && c < 4) || (f === 2 && c > 1) ? '#5B2A86' : '#412402'} fillOpacity={(f === 1 && c > 0 && c < 4) || (f === 2 && c > 1) ? 1 : 0.55} />
    )))}
  </svg>
)
