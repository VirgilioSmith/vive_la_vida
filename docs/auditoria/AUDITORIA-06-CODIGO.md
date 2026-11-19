# Auditoría 06 · Código muerto, duplicado y complejidad innecesaria

Estado: **propuesta pendiente de autorización**. No se ha eliminado nada. Todas las cifras salen de análisis estático (ESLint + acorn sobre el AST, escáner CSS propio) y de mediciones en navegador; los scripts están en `docs/auditoria/herramientas-codigo/`.

## 1. Línea base (antes de cualquier cambio)
| Medida | Valor |
|---|---|
| `src/app.js` | 22.149 líneas · 2,4 MB · 726 KB gzip |
| `src/styles.css` | 55.411 líneas · 4,0 MB · 713 KB gzip |
| Reglas CSS | 24.508, con 38.293 `!important` y 305 prefijos de versión `.vNNN` distintos |
| Bloques comentados «V###» (capas de parche) en JS | 249 |
| Carga local (Playwright, sin red) | web: DOMContentLoaded 975 ms; móvil: 784 ms. Render de una vista: 15–33 ms |
| Dependencias | ninguna de npm; `vendor/supabase.js` (224 KB) es necesaria y está en uso |
| Imágenes de `assets/` | todas referenciadas (0 sin uso) |
| Red de seguridad nueva | `tests/regresion-visual.js`: 67 capturas (18 vistas × web/móvil × Claro/Black) con huella; 2 pasadas idénticas. Más `smoke`, `csp`, `detalles` y el resto de `tests/` |

Cinco capturas se excluyeron de la línea base por no ser deterministas (hora visible o animación de gráfico); se verifican con las pruebas funcionales, no con huella.

## 2. Hallazgos y propuesta
Clasificados por riesgo. Cada fase termina con: pruebas funcionales, regresión visual (67 huellas), conteo de líneas antes/después y commit propio, de modo que cualquier fase se revierte sola.

### Fase 1 · Sin cambio de comportamiento (riesgo bajo)
| ID | Qué se eliminaría | Evidencia | Líneas | Por qué es seguro / impacto |
|---|---|---|---|---|
| A1 | 176 variables y funciones declaradas y nunca leídas en `app.js` (9 funciones: `openPicker`, `v213ApplePayNote`, `v143CostOnlyChannel`, `recentListFor`…) | ESLint `no-unused-vars` | ≈210 | Nada las referencia. Donde la declaración llama a una función con efectos (p. ej. `var x = f()`), se conserva la llamada y solo se quita la variable. Impacto funcional: ninguno |
| A2 | 6 funciones originales sustituidas por una reasignación posterior que no las conserva: `v41WireServicePicker`, `banks` (×2), `personalForm`, `personal`, `payRecurring` | AST: declaración + `nombre = function` sin captura previa | ≈107 | La versión original jamás se ejecuta. Se revisa una por una que el reemplazo no la invoque indirectamente |
| A3 | 26 manejadores `case` de acciones sin ningún disparador (`executiveSnapshot`, `incomeProjection`, `savingRate`, `v31AutoMatch`, `benefitLedger`, `backup`…) | Ninguna aparición de `data-act="…"` ni `act:'…'` fuera del propio `case` | ≈59 | Son restos de pantallas ya quitadas. Se confirma cada una en ejecución (sin disparador en el DOM) antes de borrar. **Excepción:** las de copia/exportación cifrada (`v31EncryptedExport/Import`, `backup`) se te consultan aparte, porque son capacidades aunque hoy no tengan botón |
| A4 | 399 reglas CSS cuyas clases no existen en ningún JS/HTML | escáner CSS, descartando prefijos dinámicos | ≈1.531 (≈127 KB) | Un selector con una clase que nadie genera no puede aplicarse. Se verifica con las 67 huellas |
| A5 | 1 regla CSS idéntica repetida | escáner | 1 | trivial |

**Ahorro estimado Fase 1: ≈1.900 líneas en total (≈376 en `app.js`, un 1,7 %; ≈1.531 en `styles.css`, un 2,8 %), sin cambio visible ni funcional.** Es un ahorro modesto: lo grande está en las Fases 2 y 3.

### Fase 2 · Verificación caso por caso (riesgo medio)
| ID | Qué | Evidencia | Líneas |
|---|---|---|---|
| B1 | 1.886 reglas CSS más con clases que no aparecen enteras en el código pero comparten prefijo con cadenas del JS (posibles nombres construidos) | escáner | ≈4.400 (≈310 KB) |
| B2 | Fusionar los 1.114 selectores definidos 2 o más veces (1.313 reglas sobrantes) respetando el orden de la cascada | escáner | por determinar |

B1 se haría en lotes pequeños: cada lote se elimina, se corre la regresión visual y las pruebas, y solo se conserva si todo es idéntico. B2 exige comprobar que la regla final conserva cada propiedad; el riesgo es de orden en la cascada.

### Fase 3 · Arquitectura (riesgo alto, mayor ahorro; solo con tu autorización expresa)
| ID | Qué | Evidencia |
|---|---|---|
| C1 | Aplanar las cadenas de envoltorios: 76 funciones reasignadas conservando la anterior, `render` envuelta 8 veces, `pages.cards` 4 veces, `pages.banks` 3 | AST |
| C2 | Reducir los 38.293 `!important` ordenando la cascada por capas (`@layer`) vista por vista | escáner |
| C3 | Unificar los 249 bloques «V###» en módulos por vista (un lugar por pantalla) | comentarios |

Es donde está la complejidad real y el mayor potencial de reducción, pero cada vista tiene que comprobarse con sus pruebas y huellas, vista por vista, y se haría una vista por commit. No doy una cifra de ahorro porque aún no está medida.

### Fase 4 · Rendimiento y peso (opcional)
- Minificar y comprimir en el despliegue: hoy se sirven 6,4 MB sin minificar (1,4 MB gzip). Reduciría la transferencia sin tocar el código fuente, pero añade un paso de compilación que hoy el proyecto no tiene. **No lo haría sin tu aprobación.**
- `docs/auditoria/evidencias*` pesa 6,5 MB de capturas históricas. No afecta a la app; podría comprimirse o moverse.

## 3. Lo que no se toca
Funcionalidad, datos, diseños aprobados, vistas protegidas y capacidades, aunque hoy no tengan botón (exportación cifrada, conciliación, etc.), salvo que lo autorices.

## 4. Qué necesito de ti
Autorización para **Fase 1** (A1 a A5). Indica además si las capacidades A3 de copia/exportación cifrada pueden eliminarse o deben conservarse. Las Fases 2 a 4 las propondría después con las cifras reales de la Fase 1.

## 5. Protocolo de verificación (cada commit)
1. `wc -l` de `app.js` y `styles.css` antes y después, anotado en el mensaje del commit.
2. `node tests/regresion-visual.js` (67 huellas idénticas) y `smoke`, `csp`, `detalles` más las pruebas de la vista tocada.
3. Si algo cambia, se revierte el lote y se investiga; no se arrastra una regresión a la fase siguiente.

## 6. Avance ejecutado
| Intervención | Resultado | Verificación |
|---|---|---|
| Bucle de reescritura de textos (`normalizeTitleBadges`, `stripCounterEyebrows`) y reordenado de botones de Wallet | Hilo principal en reposo: 2.941 ms por cada 3 s → 0 ms; 0 mutaciones por segundo en 21 vistas × web/móvil | `/tmp`-scripts de mutación en reposo; 64 capturas idénticas |
| Caché de `today()`, `isMobileViewport()`, formateadores de fecha | Mostrar Resumen móvil (CPU 4× más lenta): 657 → 99 ms | perfil de CPU antes/después |
| CSS: 112 reglas con clases que ningún código genera | −208 líneas | 64 capturas idénticas |
| Intento de 427 reglas: 1 selector `:is(...)` con clases vivas y muertas hacía falsa la regla | Se descartó el lote entero y se filtraron los selectores con `:is/:not/:has/:where` | bisección contra la línea base |

Lección: la «limpieza» de CSS por clases inexistentes es segura solo para selectores simples; los listados `:is()` requieren eliminar alternativas, no reglas. Pendiente (con tu autorización): variables/funciones JS sin uso (~210 líneas) y CSS dudoso (B1/B2).
