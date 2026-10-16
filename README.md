# Biofilm – análisis de placa de 96 pocillos (versión web)

Aplicación web para analizar lecturas de densidad óptica (OD) de placas de 96 pocillos y clasificar la
producción de biofilm según **Stepanović et al. (2000)**, *J Microbiol Methods* 40:175-179.

**Todo se calcula en tu navegador.** El archivo y los resultados no se envían a ningún servidor.

## Descargar y usar sin internet

[**Biofilm_un_solo_archivo.zip**](https://andrestorena06-spec.github.io/biofilm-web/Biofilm_un_solo_archivo.zip) (110 KB): descomprimir y hacer doble clic en `Biofilm.html`.
No requiere instalar nada (ni R ni Node.js) ni conexión a internet. Se abre en Edge, Chrome o Firefox.

## Qué hace
- **Varias placas a la vez**: cada Excel (o cada hoja con una placa) es una placa distinta, con una barra de placas
  arriba para cambiar de una a otra. Se puede copiar la distribución de muestras a todas las placas.
- **La sesión guarda los datos de todos los Excel**: para continuar otro día alcanza con cargar la sesión.
- **Comparar entre placas**: cada placa es una réplica biológica (n = número de placas). Valor `OD ÷ ODc` por placa,
  media ± error entre placas, prueba t de Welch contra un control con ajuste de Holm, ANOVA, matriz de
  consistencia de la clasificación y control de las placas (verificado contra R).
- **Reproducibilidad entre experimentos** (cada placa es una repetición): CV % entre experimentos, ANOVA de una vía o
  Kruskal-Wallis según Shapiro-Wilk, ANOVA de dos vías cepa × experimento, correlación de Pearson/Spearman entre pares
  e ICC(2,1) y ICC(3,1) con IC 95 %; resumen para copiar y descarga a Excel.
- Lee el archivo del lector (`.xlsx`, `.csv`, `.txt`), detecta la placa y la longitud de onda.
- Configuración de pocillos por arrastre, con muestras, réplicas automáticas y blancos.
- Detección de valores atípicos: test Q de Dixon, test de Grubbs y coeficiente de variación (%RSD) con límite.
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
npm run build:single   # genera web/dist-single/index.html (un solo archivo)
```

Los resultados de esta versión coinciden con los del motor de R de la versión de escritorio (se verificó con los mismos
datos, incluyendo el test Q de Dixon, el test de Grubbs y el criterio de CV).
