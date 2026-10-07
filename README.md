# Biofilm – análisis de placa de 96 pocillos (versión web)

Aplicación web para analizar lecturas de densidad óptica (OD) de placas de 96 pocillos y clasificar la
producción de biofilm según **Stepanović et al. (2000)**, *J Microbiol Methods* 40:175-179.

**Todo se calcula en tu navegador.** El archivo y los resultados no se envían a ningún servidor.

## Qué hace
- Lee el archivo del lector (`.xlsx`, `.csv`, `.txt`), detecta la placa y la longitud de onda.
- Configuración de pocillos por arrastre, con muestras, réplicas automáticas y blancos.
- Detección de valores atípicos: filtro de Hampel (mediana y MAD), test Q de Dixon y test de Dixon general.
- Punto de corte `ODc = media(blancos) + 3 × DE(blancos)` y clasificación: no productor, débil, moderado, fuerte.
- Gráficos de barras y de exclusión de puntos con promedio y error (SD, SEM, IC 95 %), textos editables con clic derecho,
  descarga de imagen con ajuste visual de proporción (PNG, JPG, SVG).
- Tablas con filtros por columna, columnas movibles y descarga a Excel.
- Descripción de todos los cálculos en la pestaña *Datos › Método*.

## Limitaciones
- No lee archivos `.xls` antiguos: guardalos como `.xlsx` o `.csv`.
- La configuración (muestras, pocillos, ajustes) se guarda en el navegador de cada persona; para llevarla a otra
  computadora usá *Guardar sesión* en la pestaña Archivo.

## Estructura
- `docs/` – sitio ya compilado (es lo que publica GitHub Pages).
- `web/` – código fuente (React + Vite). Para recompilar:

```bash
cd web
npm install
npm run build:web      # genera web/dist-web (copiar su contenido a docs/)
```

Los resultados de esta versión coinciden con los del motor de R de la versión de escritorio (se verificó con los mismos
datos, incluyendo los tests de Hampel, Q y Dixon).
