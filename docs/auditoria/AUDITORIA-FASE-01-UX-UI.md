# VIVE · FASE 01/10 — Auditoría integral UX/UI

Base: `main` tras `df9eaff`. Método: `tests/auditoria-fase01.js` (Playwright real) + `docs/auditoria/fase01/acento-hardcodeado.json` + lectura de CSS/JS.
Datos crudos: `docs/auditoria/fase01/datos.json` (PC 1440×900 y móvil 390×844, Claro y Black, 21 rutas) y `datos-acentos.json`.
Capturas de referencia: `docs/auditoria/fase01/pc/` y `docs/auditoria/fase01/movil/` (≈130 JPG: viewport y página completa en móvil; Claro, Black y acento).
No se modificó ningún dato financiero ni función; solo se añadieron el script, la documentación y las capturas.

## 0. Hallazgo de proceso (corrección de pruebas anteriores)
`tests/harness.js` define `window.__PALHEX`, pero **ninguna línea de `src/` lo lee**. Las pruebas previas que pasaban `palhex` (Egresos PC, Bancos, Liquid Material, Explorar móvil) **no probaban acentos reales**. El acento real se fija con `db.settings.paletteChoice='custom'` + `paletteHex`. En esta fase sí se probó así (ver §4). Acción de Fase 2: corregir el harness para que `PALHEX` use ese mecanismo y volver a ejecutar esas pruebas.

## 1. Arquitectura real de estilos
- 26 hojas enlazadas en `index.html`; `src/styles.css` pesa **4,1 MB, 26.688 reglas, 38.743 `!important` y 2.621 selectores con hack `#app#app`**. Es la capa efectiva por defecto de casi todo el producto.
- Capas encima (por orden de especificidad): `wallet-reference-fidelity.css` (629 `!important`), `bancos-pc-glass.css` (571), `wallet-mobile-top.css` (408), `card-fees-v1290.css` (280), `wallet-mobile-approved.css` (248), `movimientos-mobile.css` (190), `movimientos-desktop.css` (189), `desktop-legibility.css` (168), `wallet-glass.css` (137), `banks-desktop.css` (128), `banks-mobile-glass.css` (124), `liquid-material.css` (51), `expenses-pc-glass.css` (37, también Flujo/Ingresos), `explore-mobile-glass.css` (5).
- Los `*-glass`/`*-legibility` se pisan entre sí con `html body #app#app main.<mundo>-world #page#page …` + `!important`. Cada nuevo rediseño añade otra capa en vez de reemplazar la anterior.
- Archivos de la lista del encargo que **no existen**: `banks-mobile-glass.css` sí existe; `movimientos-*` existen; no hay `wallet-glass.css` móvil separado (Wallet móvil usa `wallet-mobile-top/approved.css`).
- Lógica de pantallas: `src/app.js` con un registro `pages={...}` sobrescrito varias veces (p. ej. `pages.expenses` se redefine 3 veces; en móvil conserva la versión previa).

## 2. Inventario de pantallas vigentes (todas auditadas con captura)
PC y móvil: Resumen/Inicio, Movimientos, Flujo, Ingresos, Egresos, Wallet, Bancos (Instituciones), Cuentas, Tarjetas, Préstamos, Certificados, Presupuestos, Categorías, Suscripciones, Entre personas, Patrimonio, Analítica avanzada, Ajustes/Personalización, Score (solo PC; con el experimento activo), Explorar (móvil), Buscar (móvil).
Notas: `mobilehub` y `mobilesearch` son rutas móviles; en PC `mobilehub` es accesible por `go()` pero sin la hoja `explore-mobile-glass.css` (cae en botones nativos con borde de 2 px; no es ruta de navegación PC, prioridad baja). En PC `score` no se capturó vacía: se esperó la carga del marco (2,5 s); **su captura queda pendiente de revisión visual** (el marco es un iframe, la sonda no entra en él).
Quedan fuera de estas capturas (requieren interacción y se auditarán en la Fase 2 con scripts de flujo): formularios de Registrar, modales de producto, selectores de institución, hojas inferiores móviles, estados vacíos, menús contextuales y acciones flotantes (solo se vieron los botones flotantes en las capturas móviles).

## 3. Métricas medidas (sonda automática por pantalla)
- Desborde horizontal de página: **0 px** en las 21 rutas móviles y PC (−10 px = barra de scroll). Sin errores de consola.
- Texto < 11 px: Wallet móvil **44 nodos** (9,75–10,3 px), Tarjetas PC 12, Resumen PC 7, Préstamos PC 6, Bancos móvil 4, Bancos PC 3.
- Pesos tipográficos: **≈55 valores distintos** de `font-weight` (400, 450, 500, 550, 580, 600, 620, 640, 650, 660, 670, 690, 700, 710…900). No hay escala; negritas inconsistentes.
- Iconos (≤40 px): 12–36 px con ≥12 tamaños diferentes en una misma pantalla (Resumen PC: 12,13,14,15,16); trazos 1 px, 1,65, 1,8, 1,9, 2, 2,15, 2,3 y 2,5 px.
- Superficies blancas casi opacas: Categorías PC (buscador 420×44 y filas 633×74), Analítica avanzada PC (tablas 1226×213 y 1234×171), Presupuestos móvil (filas `details.v919-row` 363×72), Egresos móvil (bloque 131×131). En Black: **0** superficies claras.
- Bordes ≥ 2 px: solo `mobilehub` en PC (botones sin estilo).
- Dock móvil: ninguna pantalla deja contenido bajo el dock al final del scroll (`dockOverlap` < 0 en todas); sin embargo, en el primer viewport el contenido pasa por debajo del dock (esperado) y **los botones flotantes tapan contenido** en Inicio, Wallet, Patrimonio e Ingresos (visible en capturas).
- Acento: con `#e5484d` y `#16a34a`, solo 1–2 elementos violeta fijo por pantalla (Patrimonio: `<i>`; Egresos móvil: `<i>/<span>`; Buscar móvil: `rect`). Los botones primarios siguen el acento. **El sistema de acento es mayoritariamente correcto.** Excepciones en la matriz.

## 4. Matriz de problemas
Prioridad: P0 rompe lectura o uso; P1 visible y frecuente; P2 consistencia; P3 deuda técnica.

| ID | Pantalla | Componente | Problema | Causa | Solución precisa | Pri. | Archivo | Prueba |
|---|---|---|---|---|---|---|---|---|
| F01-01 | Todas | Hojas de estilo | 38.743 `!important` y 2.621 hacks `#app#app`; cada capa nueva pisa a la anterior | Rediseños apilados sobre `styles.css` | Fase 2: tokens únicos (`--vx-*`) y retirar reglas heredadas de los módulos ya rediseñados; reglas sin `!important` salvo `hidden`/estado | P3 | `src/styles.css` + capas | `tests/liquid-material.js` ampliado: contar `!important` por hoja con tope |
| F01-02 | Todas | Tipografía | ≈55 pesos de fuente distintos | Valores sueltos por módulo (650, 670, 750…) | Escala de 4 pesos (400/500/600/700) con tokens y sustitución en capas nuevas | P2 | `styles.css`, `*-glass.css` | Sonda `weights`: ≤ 5 valores por pantalla |
| F01-03 | Todas | Iconos | 12–36 px y trazos 1–2,5 px mezclados | Cada pantalla define su tamaño y trazo | Tres tamaños (16/20/24) y trazo único 1,75 px en `svg.icon` | P2 | `styles.css`, `desktop-legibility.css` | Sonda `iconSizes` ≤ 3 tamaños, `iconStrokes` = 1 valor |
| F01-04 | Wallet móvil / Tarjetas | Texto secundario | 44 nodos de 9,75–10,3 px | `font-size:10px` en `small`/`span` del carrusel y detalle | Mínimo 11,5 px (12 px en importes) | P1 | `wallet-mobile-top.css`, `wallet-mobile-approved.css` | `tinyTotal` = 0 |
| F01-05 | Tarjetas PC | Etiquetas de KPI | 12 nodos de 10 px y línea sobre «LÍMITE DE CONSUMO» | `font-size:10px` + borde superior de hero | Subir a 11,5 px; quitar la línea del encabezado interno | P1 | `card-fees-v1290.css`, `styles.css` | `tinyTotal` = 0 en `cards` |
| F01-06 | Tarjetas PC | Rejilla de tarjetas | Solo ocupa la mitad izquierda; hero índigo opaco distinto al resto de cristal | Grid de 2 columnas fijas; hero con degradado propio | Rejilla auto-fill y hero con material `--vx-glass-strong` del acento | P1 | `wallet-glass.css`, `card-fees-v1290.css` | Captura `cards-light` y ancho ocupado ≥ 90 % |
| F01-07 | Resumen PC | Etiquetas y botones | Botones de 10 px (`ff-black-btn`, `ff-activity-foot`) | Reglas de componentes `ff-*` | 11,5 px | P1 | `styles.css` | `tinyTotal` = 0 en `overview` |
| F01-08 | Resumen PC | Fecha | «November 2026» en inglés, control nativo distinto al resto | `<input type=month>` sin formato local | Etiqueta local «noviembre de 2026» con input superpuesto (patrón de Explorar) | P1 | `app.js` (`monthFilter`), `styles.css` | Texto en español en todas las pantallas |
| F01-09 | Inicio móvil | Selector de mes | «Noviembre De 2026» (capitalización incorrecta) | `text-transform:capitalize` | «Noviembre de 2026» (solo primera letra) | P2 | `styles.css` | Test de texto |
| F01-10 | Inicio móvil | Tarjetas inferiores | «Próximo mes · estimación» cortado por botón flotante y dock | Contenido sin reserva lateral/inferior | Padding inferior = alto de dock + botones; texto con `overflow-wrap` | P1 | `home-mobile.css` | `dockOverlap` y captura |
| F01-11 | Móvil global | Botones flotantes | Historial y «+» tapan contenido (Inicio, Wallet, Patrimonio, Ingresos) | Posición fija sobre el contenido sin margen derecho | Reservar 72 px de margen derecho o auto-ocultar al hacer scroll | P1 | `styles.css` (floating) | Sonda: ningún texto bajo el rect del botón |
| F01-12 | Patrimonio móvil | Tarjeta Activos | «RD$2,075,052.8 / 4» parte el importe en dos líneas | Ancho de celda insuficiente y sin `white-space:nowrap`/reducción | Importe con `clamp()` y `nowrap`; Activos/Pasivos en columna si no cabe | P0 | `patrimony-vision.css`, `styles.css` | `clipped` y partición de importe |
| F01-13 | Patrimonio móvil | Gráfica de evolución | Meses del eje X fuera del ancho; curva cortada a la derecha | SVG con ancho fijo mayor que el contenedor | `viewBox` responsive y `max-width:100%` | P0 | `app.js` (gráfica), `patrimony-vision.css` | `clipped` = 0, captura |
| F01-14 | Patrimonio móvil | Selector de cierre | Input de fecha nativo en inglés y de estilo distinto | Control nativo | Mismo patrón de selector de período | P1 | `app.js` | Texto en español |
| F01-15 | Ingresos móvil | Estructura | Diseño antiguo: píldora «Ingresos / Ingresos recurrentes» (navegación redundante), dos botones de gráfico y botón blanco opaco de 120 px | Fase de Ingresos PC no se llevó al móvil | Aplicar vista única del PC al móvil, sin píldora secundaria; un solo botón de gráfico en cristal | P0 | `app.js` (`vIncomePc`), `expenses-pc-glass.css` | `income` móvil sin `.vinc-tabs`; captura |
| F01-16 | Ingresos móvil | Tabla de movimientos | Columnas «Importe» y «Acción» fuera del viewport | Tabla de ancho fijo en contenedor sin scroll | Convertir a lista de tarjetas (importe a la derecha) | P0 | `styles.css` (`table.right`) | `clipped` = 0 en `income` |
| F01-17 | Egresos / Flujo móvil | Vista | Sin rediseño móvil (usa versión previa); bloque 131×131 opaco | `pages.expenses` conserva la previa en móvil | Versión móvil de Egresos/Flujo con el mismo motor (`vExpModel`) | P1 | `app.js`, nueva hoja móvil | Capturas y tests de Flujo móvil |
| F01-18 | Categorías PC | Buscador y filas | Superficies blancas opacas (420×44, 633×74) | `background:#fff` en `v1170-*` | `--vx-glass` translúcido con borde 1 px | P1 | `styles.css` (`v1170`, `v920`) | `opaqueTotal` = 0 |
| F01-19 | Analítica avanzada PC | Tablas | Contenedores `table-wrap` blancos opacos 1226×213 | Fondo sólido en `.matrix-scroll` / `.v12-table-scroller` | Fondo cristal, cabecera sticky legible | P1 | `styles.css` | `opaqueTotal` = 0 |
| F01-20 | Analítica avanzada móvil | Vista | Casi sin contenido propio (5 textos) y sin dock-overlap medible | Ruta no adaptada | Definir vista móvil o redirigir a Explorar | P1 | `app.js` | Captura móvil con contenido |
| F01-21 | Presupuestos móvil | Filas | `details.v919-row` casi opacas | Fondo blanco heredado | `--vx-glass` | P2 | `styles.css` | `opaqueTotal` = 0 |
| F01-22 | Suscripciones móvil | Calendario | Tira de días y etiquetas fuera del viewport | Scroll horizontal de la tira (parte puede ser intencional) | Mostrar 7 días ajustados o indicar scroll con borde difuminado | P2 | `styles.css` | `clipped` y captura |
| F01-23 | Cuentas / Préstamos / Certificados móvil | Píldora de módulo | Etiqueta «Certificados» queda fuera de la fila | Switch de 4 píldoras más ancho que el viewport | Distribuir en cuadrícula o `flex:1` con texto corto | P1 | `banks-mobile.css` | `clipped` = 0 |
| F01-24 | Wallet PC | Acción | Botón «Añadir tarjeta» fuera del contenedor | Fila de acciones con `overflow` y ancho fijo | Permitir salto de línea (`flex-wrap`) | P2 | `wallet-glass.css` | `clipped` = 0 |
| F01-25 | Móvil global | Bordes superiores | Cabeceras de tarjetas con línea de luz de 1 px dispar (hero de Tarjetas, Ingresos) | Pseudo-elementos `::before` distintos por hero | Un solo reflejo (`--vx-highlight`) | P2 | `liquid-material.css` | Revisión visual + `thick` = 0 |
| F01-26 | Móvil Wallet | Carrusel | Tarjetas consolidadas y detalle comparten jerarquía débil; botones circulares de 80 px con texto 14 px | Diseño aprobado previo | Reducir a 64 px y alinear texto | P2 | `wallet-mobile-approved.css` | Captura |
| F01-27 | PC `mobilehub` | Ruta móvil en PC | Botones con borde 2 px nativo (sin hoja) | `explore-mobile-glass.css` solo `max-width:790px` | Redirigir `mobilehub` a Resumen en PC | P3 | `app.js` | `go('mobilehub')` en PC |
| F01-28 | Score PC | Iframe | La sonda no entra al marco; su legibilidad y modos no están medidos | Contenido en `iframe` | Prueba específica dentro del marco (`frameOf`) en Fase 2 | P2 | `src/vive-score/*` | Nueva prueba con medidas dentro del marco |
| F01-29 | Todas | Pruebas de acento | `PALHEX` sin efecto (ver §0) | Harness desconectado | Conectar `PALHEX` a `paletteChoice/paletteHex` | P1 | `tests/harness.js` | Re-ejecutar pruebas con acento y comprobar color primario |
| F01-30 | Patrimonio / Egresos móvil / Buscar móvil | Acento | 1–2 elementos violeta fijo (`<i>`, `<span>`, `rect`) | Colores literales en SVG/barras | Sustituir por `var(--lg-accent)` | P2 | `styles.css`, `patrimony-vision.css` | `acento-hardcodeado.json` = 0 |
| F01-31 | Todas | Encabezados | Títulos de página heterogéneos: h1 solo en 7 de 21 pantallas PC; el resto usa títulos ad hoc | Cada módulo crea su propio encabezado | Cabecera común `VxPageHead` (título + período + acciones) | P2 | `app.js` | `h1` = 1 por pantalla |
| F01-32 | Inicio móvil | Estructura | Contenedores anidados «PANORAMA FINANCIERO» → «TU POSICIÓN» y espacios muertos | Doble marco de cristal | Quitar el marco exterior o el título duplicado | P2 | `home-mobile.css` | Captura |

## 5. Lo que NO se pudo verificar en esta fase (honesto)
- Contraste WCAG numérico por par texto/fondo: no medido (solo inspección visual).
- Formularios, modales, hojas inferiores, estados vacíos y menús: no recorridos en esta fase.
- Iconos «de otro estilo» se detectaron por tamaño/trazo, no por forma.
- Tabletas, iPhone real, PWA instalada y la matriz de 11 resoluciones: pendientes.
- `flujos-ingresos.js` sigue sin completarse por tiempo en este entorno (también antes de estos cambios).

## 6. Cómo reproducir
```bash
node tests/auditoria-fase01.js                 # captura y mide todo (≈5 min)
ONLY_ACC=1 node tests/auditoria-fase01.js      # solo acentos
```
