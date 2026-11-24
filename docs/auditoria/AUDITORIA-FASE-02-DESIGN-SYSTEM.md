# VIVE · FASE 02/10 — Design System universal y depuración

Base: `main` tras `ed5c898`. Todo lo siguiente se ejecutó con Playwright real salvo lo marcado como **no verificado**.

## 1. Design System (entregado)
- `src/vx-tokens.css`: tokens `--vx-*` (acento dinámico, texto, superficies Liquid Glass primaria/secundaria/elevada/navegación, materiales con blur distinto por nivel, dimensiones propias de PC y móvil, tipografía de 4 pesos, colores financieros semánticos, estados hover/focus/selected/disabled). Claro y Black son dos paletas independientes (Black = `#000` real, no inversión). El acento sale de Personalización; los semánticos (ingreso/egreso/advertencia) **no** cambian con el acento (probado con 4 acentos).
- `src/vx-components.css`: componentes `.vx-*` (vidrio, KPI, botones, segmentos, píldoras, campos con error/desactivado, iconos 16/20/24 con trazo único).
- `design-system.html`: página de pruebas visuales (colores, tipografía, KPI, tarjetas, Liquid Glass, botones, selectores, iconos, formularios, tema Claro/Black, selector de acento).
- `tests/design-system.js` (PC y móvil × Claro/Black × 4 acentos): tokens definidos, gutter por plataforma, semánticos invariantes, Black auténtico, pesos solo 400/500/600/700, iconos 16/20/24, sin desborde y **contraste AA medido en 520 textos por combinación → 0 fallos**.
- Capa de compatibilidad (§10 de `vx-tokens.css`): alias `--lg-*`, token `--vx-mute` que sustituye 80 grises literales de módulos antiguos y 7 «guardas de contraste» explícitas, a retirar cuando esos módulos migren.

## 2. Contraste real (WCAG 2.2 AA) de la aplicación
Método: `tests/lib-contraste.js` muestrea el fondo en píxeles de una captura con el texto transparente (incluye vidrio, desenfoque y degradados) y excluye textos ocluidos/recortados. Texto grande ≥24 px (o ≥18,66 px en negrita): 3:1; el resto 4,5:1.

| Contexto | Textos medidos | Fallos antes | Fallos ahora |
|---|---|---|---|
| PC Claro | 1.249 | 320 (25,6 %) | 161 (12,9 %) |
| PC Black | 1.245 | 176 (14,1 %) | 144 (11,6 %) |
| Móvil Claro | 569 | 147 (25,8 %) | 69 (12,1 %) |
| Móvil Black | 547 | 52 (9,5 %) | 49 (9,0 %) |
| PC Claro, acento rojo | 1.249 | — | 186 (14,9 %) |
| Móvil Claro, acento verde | 569 | — | 82 (14,4 %) |

Correcciones sistémicas: el acento «fuerte» pasa a ≥ 7:1 con blanco (sirve de relleno con texto blanco y de texto sobre vidrio claro), `--vx-mute`, `--muted` de Score, rellenos de pestañas/segmentos con `--vx-accent-strong`.
**Pendiente (no se declara cumplido):** AA no se cumple todavía en toda la app. Detalle por selector en `docs/auditoria/fase02/contraste-app.json` (campo `todos`). Mayores concentraciones: Préstamos PC (37), Bancos PC (36), Resumen PC (34), Certificados PC (29), Patrimonio PC (25), Ingresos móvil (25), Patrimonio móvil (24), Egresos móvil (22). Casos de mayor gravedad medidos antes de esta fase y aún abiertos: texto casi invisible en Black en el KPI «75 %» del Inicio móvil, el importe del hero de Préstamos móvil y el delta de Patrimonio (ratio ≈ 1:1); textos blancos sobre rellenos claros en KPI de Cuentas/Préstamos/Certificados PC.

## 3. Formularios, menús y modales (`tests/formularios.js`, `docs/auditoria/fase02/formularios.json`)
13 flujos abiertos desde sus acciones reales en PC y móvil: ingreso, gasto, transferencia, pago de tarjeta, cuenta, tarjeta, préstamo, presupuesto, categoría, certificado, recurrente, acuerdo entre personas, institución.
- Todos se abren, el foco queda dentro del modal, `Esc` los cierra, el envío vacío no guarda (campos inválidos o mensaje), sin errores de consola y **sin cambios en movimientos ni cuentas**.
- Hallazgo corregido: cuentas, tarjetas, certificados, recurrentes e instituciones tenían 1–2 campos sin etiqueta accesible; ahora `f02LabelOrphans` les asigna `aria-label` desde el rótulo visible (observador de `#modal-root`, sin temporizadores).
- Abiertos: el selector rápido móvil «Nuevo movimiento» reporta `scrollWidth > clientWidth` (por revisar); contraste dentro de modales con 2–6 fallos por formulario (incluidos en §2).
- No recorrido: Personalización (se audita como pantalla, no como formulario) y estados desactivados de formularios reales más allá de los validados.

## 4. Vive Score (iframe) — `tests/score-iframe.js`
El marco es accesible con `page.frames()`; se completa la calibración inicial y se mide Mi score y Centro de control en 1440, 820 y 390 px, Claro/Black. Se corrigió `--muted` (`#7a8493` → `#465163`): Claro pasó de 21/51 a 0/51 fallos en PC. Quedan 3 fallos en 820 Black y 1 en 390 Claro. Sin desborde ni errores.

## 5. Responsive — `tests/responsive-dispositivos.js`
Perfiles emulados: iPhone SE, Android 360, iPhone 15, iPhone Pro Max, iPad mini, iPad 820, iPad horizontal, iPad Pro 12.9, portátil. Se detectó y corrigió desborde de página en **Flujo** (KPI a 820 px) y **Bancos PC** (rejilla de 3 columnas fijas a 820 px, causada por mi regla). Resultado: sin desborde horizontal en ningún perfil. Abierto: botón «Añadir tarjeta» de Wallet queda fuera del contenedor en PC (1280–1024).
**No verificado (requiere hardware o acceso externo):** iPhone o iPad físico, PWA realmente instalada (modo standalone, safe areas reales, Dynamic Island), Safari iOS real. Solo hay emulación de viewport en Chromium.

## 6. Depuración de código obsoleto
Método verificable, sin asumir por nombres:
1. CSS: con `postcss` se descartaron reglas cuyos selectores usan clases/ids que **no aparecen en ningún JS/HTML del proyecto** (ni como prefijo/sufijo de nombres dinámicos); se respetan `:not()/:is()` y keyframes. Resultado: **1.172 reglas completas y 98 selectores sueltos eliminados**, 4.596.630 → 4.423.804 bytes (−172.826 B). Entre ellas: pestañas secundarias de Ingresos, dona y filas de Wallet retiradas, `vBanksPc-overview-foot`, etc.
2. JS: con `acorn` se eliminaron **11 funciones sin ningún consumidor** (en `app.js`, también revisando otros JS, `index.html` y pruebas), por rondas hasta punto fijo: `loanCurves`, `v732HomeKpi`, `v389BenefitsKPIsUnused`, `v30RecoveryContent`, `loanKpis`, `v1278Gallery`, `buildChips`, `displaySource`, `loanStat`, `v42KindLabel`, `v42ScopeLabel` (9.490 B).
3. Prueba de que no cambió lo visible: `tests/huella-visual.js` (hash de geometría y estilos de todos los elementos visibles) en 84 combinaciones (21 rutas × PC/móvil × Claro/Black): **0 diferencias** antes/después; dos corridas sin cambios dan el mismo hash (determinista). Además pasan las pruebas de regresión listadas abajo.
**Límite honesto:** gran parte del «diseño viejo» no está oculto con `display:none` sino sustituido mediante cadenas `X = function(){ …previo… }` en `app.js`; el original sigue ejecutándose a través del envoltorio, por lo que no es código muerto y no se elimina sin reescribir el módulo. Esa refactorización por módulo (Ingresos móvil, Egresos móvil, Resumen, Wallet, Préstamos) queda para las fases 03+ y está en el backlog. Los otros ~3,9 MB de `styles.css` siguen cargándose porque sus clases sí existen en JS.

## 7. Ingresos → Trabajo formal / Joseo (PC)
- Los KPI «Trabajo formal» y «Trabajo informal · Joseo» son ahora botones que abren su vista completa (la existente `formal(m)`/`informal(m)` del módulo V55: empleo, bruto/neto, ISR/AFP/SFS, préstamos de nómina, frecuencia, depósitos, incrementos, configuración, cobro anticipado; actividades, negocios, cobros, programación, histórico y edición de fuentes). Una sola implementación; no se duplica debajo del resumen.
- Flecha «← Volver a Ingresos» (cristal, discreta), `history.pushState` + `popstate`: la flecha y el botón Atrás del navegador regresan realmente a Ingresos; Mes|Año|Histórico se conserva dentro del detalle y al volver; al salir por otra pestaña el detalle no queda pegado; los movimientos no cambian.
- `tests/ingresos-detalle.js` pasa (3 períodos × 2 vistas + Atrás + salida por otra pestaña).
- **Móvil:** se mantiene la pantalla anterior, donde «Ingresos recurrentes» ya ofrece las pestañas Formal/Informal con su detalle completo; no se rediseñó (pendiente F01-15/16).
- Las secciones «Resumen | Trabajo formal | Joseo | Evolución | Historial» como pestañas no existen en la versión actual (se retiraron la barra secundaria a petición previa); el acceso a las vistas completas es por los KPI.

## 8. Regresiones
Pasan: smoke, nómina (8 escenarios), Egresos PC, Flujo/Ingresos PC, Ingresos detalle, Explorar móvil, Bancos PC/móvil/Patrimonio, Liquid Material, Design System, Vive Score (39) y reglas (12), Movimientos móvil (150), Presupuesto (18), Categorías (24).
Fallos previos y ajenos a esta fase: `tests/prestamos.js` P3-390 (falla igual sin mis cambios), `tests/flujos-ingresos.js` (se corta por tiempo también antes), 2 de `tests/suscripciones.js`.
Por corrección de mis pruebas anteriores: el harness `PALHEX` nunca cambió el acento real; `design-system.js`, `contraste-app.js` y `auditoria-fase01.js` usan `paletteChoice/paletteHex`.

## 9. Backlog para la Fase 03
1. Contraste restante (§2) empezando por los casos ≈ 1:1 en Black.
2. Migrar módulos a `.vx-*` y retirar las guardas §10 y la capa de alias.
3. Refactor de las cadenas de sustitución por módulo (Ingresos/Egresos/Flujo móvil primero).
4. Consolidar los ≈55 pesos tipográficos heredados en la escala de 4.
5. Tamaños de texto < 11 px (Wallet móvil, Tarjetas PC) y botones flotantes que tapan contenido.
6. Pruebas en dispositivo físico y PWA instalada.
