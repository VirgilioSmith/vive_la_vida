# Auditoría 09 · CPU en reposo y rendimiento (medido)

Medición con Playwright (Chromium, Supabase simulado) sobre `src/app.js`, `src/styles.css` y el módulo Score. Para cada vista se esperó a que terminara de cargar y se midió **8 s sin tocar nada** con `Performance.getMetrics` (tiempo de tareas, de script, diseños y recálculos de estilo) y con contadores de `setInterval`, `setTimeout` y `requestAnimationFrame` creados durante la medición.

## Resultado actual (web 1440×900 y móvil 390×844)
| Vista | CPU en 8 s | Script | Diseños / recálculos | Temporizadores nuevos |
|---|---|---|---|---|
| Resumen, Bancos, Préstamos, Suscripciones, Score, Wallet, Explorar, Ingresos, Egresos | 1–4 ms | 0–2 ms | 0 / 0 | 0 |
| Tarjetas (web) y Wallet (móvil), picos ocasionales | 41–90 ms en una de varias corridas, 1 ms en las demás | 0 ms | 0 / 0 | 0 |

Los picos ocasionales no tienen script, diseño ni estilo: son recolección de basura o pintura puntual, no un bucle. No hay animaciones CSS corriendo en reposo (`document.getAnimations()` vacío); las dos `infinite` existentes son del indicador de sincronización y solo giran mientras se sincroniza.

## Tabla problema → causa → solución
| # | Problema | Dónde | Causa | Solución | Estado |
|---|---|---|---|---|---|
| 1 | Bucle de reescritura de textos | `normalizeTitleBadges`, `stripCounterEyebrows` (V9xx) | Un temporizador que reescribía el DOM cada pocos ms sin límite: 2.941 ms de CPU cada 3 s | Eliminado en una auditoría anterior; 0 mutaciones por segundo en 21 vistas | Resuelto (medido) |
| 2 | `today()`, `isMobileViewport()`, formateadores de fecha recalculados miles de veces | `src/app.js` | Sin caché | Caché por día / por ancho; mostrar Resumen móvil con CPU 4× más lenta: 657 → 99 ms | Resuelto (medido) |
| 3 | Observador de DOM del origen predeterminado (V1243) recorría cada nodo añadido | `src/app.js` | `MutationObserver` sobre `body` que hacía `querySelectorAll('form')` por nodo en cada repintado | Solo inspecciona formularios y ventanas nuevas, agrupado en un único turno | Resuelto en esta entrega |
| 4 | Temporizadores | `setInterval` ×6 en `app.js` y 1 en `host.js` | Todos con intervalos largos (60 s, 5 min, 1 h; 5 s el del Score) | Todos comprueban `document.hidden` / `visibilityState` antes de trabajar; el del Score solo corre en la vista Score y compara una firma antes de enviar nada | Ya correcto |
| 5 | Suscripciones en tiempo real | `v10Channel` (un canal, creado una vez) | Un solo canal `finanzas360-relational-<uid>`; se elimina antes de recrear | Sin cambios necesarios | Ya correcto |
| 6 | Gráficos sin `destroy()` | — | La app dibuja SVG propio, no usa Chart.js | No aplica | — |
| 7 | CSS costoso | `styles.css`: 244 `backdrop-filter`, sombras grandes | Cristal en muchos contenedores; costo de GPU en iPhone, no de CPU, no medible en Chromium sin GPU | Sin cambios aún (cambiaría el aspecto). Propuesta: limitar a `blur ≤ 20px` en móvil y quitar el cristal de elementos que no se superponen a contenido | Pendiente de tu aprobación |
| 8 | Scroll/resize/input sin debounce | `app.js` | Los manejadores de `resize` y `input` ya usan `requestAnimationFrame` o temporizadores de agrupación | Sin cambios | Ya correcto |

## Prueba que puedes hacer (30 s)
1. Abre la app (web o PWA) y entra a Resumen. No toques nada.
2. En la consola de Safari (Mac → Desarrollar → tu iPhone) escribe: `viveIdleTest(30)`.
3. A los 30 s sale una tabla y un aviso: **`porcentajeOcupado` debe ser ≈ 0 %** y `tareasLargas` 0 o 1. Si pasa de 5 %, el reposo no está resuelto y dime en qué vista lo corriste.
4. Alternativa sin Mac: Ajustes de iOS → Batería → mira el consumo de la app tras 5 minutos abierta e inmóvil.

## Limitaciones de esta medición
Se hizo con Supabase simulado: no ejecuta la red real (reintentos, sincronización). Un 100 % de CPU en el iPhone con la red real podría venir de ahí o de la GPU (punto 7), y esas dos cosas no se miden en este entorno. La prueba de arriba es la forma de confirmarlo en tu teléfono.
