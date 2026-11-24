# VIVE · FASE 03/10 — Motor universal Premium Liquid Glass

## Nota sobre el «Protocolo Maestro de Corrección Acumulativa»
No recibí ese protocolo en esta conversación, así que no pude aplicarlo literalmente. Lo interpreté como «antes de avanzar, corregir lo heredado de las fases 01 y 02 que afecte al material» y así lo hice (ver §4). Si existe un documento, pásalo y lo contrasto.

## 1. Motor (una sola política): `src/vx-material.css` (se carga al final)
Tres niveles, sobre los tokens de la Fase 02:
- **Ambiental:** fondo de la app (gradientes + acento), sin filtros.
- **Contenido** (tarjetas, importes, gráficos, filas, productos): vidrio translúcido **sin `backdrop-filter`**. El fondo ambiental es un degradado suave; desenfocarlo no aporta nada visible y sí cuesta rendimiento y legibilidad.
- **Interacción** (rail de navegación, dock móvil, pestañas/segmentos, filtros, modales, botones flotantes, selector de período): `backdrop-filter` real (`blur` 10–30 px + `saturate`), con `-webkit-` y `@supports not` como respaldo.
Reglas: ningún blur anidado, ningún blur por fila, sin animaciones permanentes.
Fallbacks accesibles: `@supports not (backdrop-filter)` (vidrio más opaco), `prefers-reduced-transparency` y `prefers-contrast: more` (vidrio sólido, sin filtros), `prefers-reduced-motion` (sin transiciones/animaciones). No se añadieron observadores, temporizadores ni eventos nuevos.
Compartido por Wallet, Bancos, Flujo, Ingresos, Egresos, etc.: no hay motor por módulo; las reglas de contenido/interacción son universales (se aplican por contenedor, no por pantalla).

## 2. Rendimiento medido (`tests/material-liquido.js`, 20 rutas × PC/móvil × Claro/Black)
| | Capas con blur por ruta (máx.) | Blur anidados | Superficies grandes opacas | Listas con filtro por fila | Área filtrada (× viewport) |
|---|---|---|---|---|---|
| PC antes → después | 21 → 3 | 42 → 0 | 22 → 0 | 0 → 0 | 1,15 → 0,10 |
| Móvil antes → después | 44 → 6 | 16 → 0 | 16 → 0 | 2 → 0 | 6,72 → 0,18 |
(Detalle en `docs/auditoria/fase03/material-antes.json` y `material-despues.json`.)

## 3. Preferencias del sistema (`tests/material-accesibilidad.js`)
Emulación de `reducedMotion: reduce` (transiciones ≈ 0 ms) y `contrast: more` (0 elementos con `backdrop-filter`, vidrio sólido) en Claro y Black: pasa.

## 4. Pendientes heredados corregidos en esta fase
- Superficies blancas opacas (Fase 01/F01-18/19/21): `v421-meter/net`, `v1170-card`, `v919-row`, tablas de Analítica, `v105-capacity-rest`, `v36-month-net`, `v318-chart-content` → vidrio translúcido (0 opacas medidas).
- Black: rectángulos `#000` sólidos detrás de textos en el Inicio móvil (`v421-*`, `v239-*`) → transparentes; selector de período claro-sobre-Black → cristal coherente.
- «Noviembre De 2026» → «Noviembre de 2026» (F01-09).
- Contraste: textos invisibles (≈1:1) en el KPI «75 %» del Inicio móvil en Black, textos sobre héroes de color, botón «Registrar pago», grises heredados, etiquetas en Black. Contraste global medido: PC Claro 161→154 fallos, PC Black 144→131, móvil Black 49→44, móvil Claro 69→69 (sobre ≈1.250/1.240/570/540 textos).
- Formularios (Fase 02): `tests/formularios.js` sigue pasando (13 flujos, sin cambios de datos).
- Trabajo formal / Joseo: `tests/ingresos-detalle.js` sigue pasando.

## 5. Lo que NO está resuelto (no se declara cerrado)
- **Contraste AA completo:** persiste un 9–12 % de textos bajo el umbral (PC Claro 154/1.249; PC Black 131/1.232; móvil Claro 69/569; móvil Black 44/539). Un experimento para que el acento «fuerte» sea legible como texto en Black empeoró los resultados (131→203) y se revirtió: el mismo token se usa como relleno con texto blanco. Hace falta separar «acento de relleno» y «acento de texto» en los 221 usos de `color:var(--v424-accent-strong)`; queda para la Fase 04.
- Hay **tamaños < 11 px**, el botón «Añadir tarjeta» de Wallet queda fuera del contenedor en PC y los botones flotantes tapan contenido (F01-04/11/24), sin tocar.
- El gris del panel exterior del Inicio móvil en Black es más claro que «negro auténtico» (panel de cristal de un módulo antiguo, no migrado).
- Verificación visual solo en Chromium emulado; sin iPhone/iPad físico ni PWA instalada ni Safari real (el `backdrop-filter` de Safari se comporta distinto).

## 6. Regresiones (todas ejecutadas tras los cambios)
Pasan: smoke, nómina, Egresos/Flujo/Ingresos PC, Ingresos detalle, Explorar móvil, Bancos PC/móvil/Patrimonio, Liquid Material (layout idéntico en 22 rutas), Design System, formularios, Vive Score (39 + 12), Movimientos móvil (150), Presupuesto (18), Categorías (24), material-liquido, material-accesibilidad, Score en iframe (0 fallos de contraste en PC Claro/Black), responsive en 9 perfiles (sin desborde).
Fallo previo y ajeno: `tests/prestamos.js` P3-390 (falla igual sin estos cambios). `tests/flujos-ingresos.js` se corta por tiempo en este entorno.
