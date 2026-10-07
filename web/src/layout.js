import { anchoMax, medir } from './utils.js'

// Calcula márgenes midiendo el texto real, para que nada quede cortado
// sin importar el tamaño de fuente. Todo en píxeles.
export function calcularLayout({
  W, etiquetas, ang, est, yLabels, derecha = 16, titulo = false, extraAbajo = 0, altoPlot = 340, tituloX = false, fijoH = 0, anchoTituloY = 0,
}) {
  const e = est.nombresX
  const a = (ang * Math.PI) / 180
  const wEt = etiquetas.map((t) => medir(t, e.size, e.bold, e.italic))
  const maxW = Math.max(0, ...wEt)
  const alto = e.size * 1.25
  const altoEtiquetas = ang > 0 ? maxW * Math.sin(a) + alto * Math.cos(a) : alto
  const wTick = anchoMax(yLabels, est.numerosY.size, est.numerosY.bold, est.numerosY.italic)
  const tituloEje = est.leyendaY.size * 1.3
  const izqBase = 14 + tituloEje + 10 + wTick + 8

  let left = izqBase
  const n = Math.max(etiquetas.length, 1)
  for (let i = 0; i < 3; i++) {
    const plotW = Math.max(W - left - derecha, 50)
    const band = plotW / n
    // la primera etiqueta rotada se extiende hacia la izquierda
    const sobra = ang > 0 ? wEt[0] * Math.cos(a) + (alto * Math.sin(a)) / 2 - band / 2 + 6
      : wEt[0] / 2 - band / 2 + 6
    left = Math.max(izqBase, sobra)
  }
  const altoTitulo = titulo ? est.titulo.size * 1.5 + 12 : 0
  const top = 14 + altoTitulo
  const altoLeyX = tituloX ? est.leyendaX.size * 1.5 + 6 : 0
  const bottom = 10 + altoEtiquetas + 12 + altoLeyX + extraAbajo
  const plotW = Math.max(W - left - derecha, 50)
  // con alto fijo (ajuste de proporción) el área del gráfico ocupa lo que sobra
  // (nunca más bajo que la leyenda del eje Y, para que el texto no se corte)
  if (fijoH) altoPlot = Math.max(90, anchoTituloY + 24, fijoH - top - bottom)
  return {
    left, right: derecha, top, bottom, plotW, plotH: altoPlot, H: top + altoPlot + bottom,
    band: plotW / n, altoEtiquetas, altoLeyX, altoTitulo,
  }
}

export const estiloTexto = (s) => {
  const dec = [s.underline && 'underline', s.strike && 'line-through'].filter(Boolean).join(' ')
  return {
    fontSize: s.size,
    fill: s.color,
    fontWeight: s.bold ? 700 : 400,
    fontStyle: s.italic ? 'italic' : 'normal',
    textDecoration: dec || 'none',
  }
}
