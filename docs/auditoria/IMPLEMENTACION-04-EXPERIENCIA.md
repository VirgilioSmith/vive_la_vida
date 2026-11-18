# IMPLEMENTACION-04-EXPERIENCIA · mejoras de experiencia

Fuentes: [AUDITORIA-02-EXPERIENCIA](AUDITORIA-02-EXPERIENCIA.md), [IMPLEMENTACION-03-TECNICA](IMPLEMENTACION-03-TECNICA.md). Método: medir antes → corregir con el mínimo cambio → medir después → capturas reales → pruebas. Sin rediseños: no se añadieron componentes nuevos salvo el aviso de conexión (no existía) y una línea de pista bajo las tablas con desplazamiento. Prueba nueva: `node tests/experiencia-04.js` (falla si una mejora se pierde).

## 1. Resultados medidos (arnés Playwright, 26 pantallas × móvil 390 px y escritorio 1440 px)
| Mejora | Métrica | Antes | Después |
|---|---|---|---|
| UX-04 texto mínimo | Textos de interfaz de menos de 11 px (móvil) | **1 178 de 2 817 (41,8 %)** | **25 de 2 820 (0,9 %)** |
| UX-04 texto mínimo | Ídem, escritorio | **1 797 de 4 493 (40,0 %)** | **13 de 4 493 (0,3 %)** |
| UX-06 objetivos táctiles (WCAG 2.5.8) | Controles menores de 24×24 px (móvil / escritorio) | **66 / 193** | **0 / 0** |
| UX-09 estado de conexión | Aviso accesible sin red | no existía | `role="status"`, aparece al perder la red y se oculta con aviso «Conexión restablecida» |
| UX-07 tablas con desplazamiento horizontal | Indicación de que hay más columnas | ninguna | línea «Desliza para ver más columnas →» solo cuando hay desbordamiento |
| H-14 datos locales | Copia local del documento financiero tras cerrar sesión | **44 843 caracteres permanecían** | **0 claves** |
| Regresión corregida | Puntos de paginación del wallet en Black | cajas de 24 px visibles (introducidas por la corrección de WCAG 2.5.8 de la fase 03) | punto de 7 px como antes, con área táctil de 24 px |

## 2. Detalle de cada mejora
### UX-04 · Texto de 8–10 px
* **Causa raíz**: 69 tamaños de fuente definidos por capas heredadas; el 41 % de los textos estaba por debajo de 11 px.
* **Corrección** (`src/styles.css`): suelo de 11 px generado a partir de los datos. Se recorrieron las 26 pantallas en dos anchos, se obtuvo cada selector con texto menor de 11 px y solo se emitió una regla cuando **todos** los elementos que el selector alcanzaba eran menores de 11 px (558 de 571 candidatos), más 5 grupos de ajustes manuales. Así no se reduce ningún texto mayor.
* **Verificación visual**: capturas antes/después (`docs/auditoria/evidencias-04/`). Sin desbordes: `tests/auditoria-recorrido.js` 0 de 54; `tests/pantallas-sin-scroll.js` correcto a 390, 768 y 1440 px.
* **Residual**: 0,9 % y 0,3 %. Son sobre todo las caras de las tarjetas del wallet (texto decorativo sobre la imagen de la tarjeta, que no se tocó por ser una referencia visual aprobada) y reglas heredadas con mayor especificidad. La prueba exige ≤ 1 %.

### UX-06 · Objetivos táctiles de 24 px
* **Causa raíz**: botones de enlace y encabezados `summary` de 13–20 px de alto y un campo de mes de 14 px.
* **Corrección**: `min-height: 24px` en los 7 casos medidos (`button.vive-mobile-brand`, `.v922-movement-open`, `.v9-ledger-detail`, `.linkish`, botones sin clase, `summary`, campos de fecha y mes).

### UX-09 · Aviso de conexión
* **Causa raíz**: no había indicador visible de estado de red, aunque el guardado local y la sincronización sí funcionan sin red.
* **Corrección** (`src/app.js`): un único par de eventos `online`/`offline`; el aviso se coloca sobre la barra inferior en móvil y abajo en escritorio, con colores propios del modo Claro y Black. Prueba: `experiencia-04.js` UX-09 (aparece con `role=status` y se oculta al reconectar).

### UX-07 · Tablas con desplazamiento horizontal
* **Corrección**: la rutina de ajustes que ya observaba el DOM (`v377RuntimePolish`) añade una línea de pista bajo `.table-wrap` solo cuando `scrollWidth > clientWidth`; se retira si deja de desbordar. No se añadió ningún observador nuevo.

### H-14 · Datos financieros en el dispositivo
* **Corrección** (`src/app.js`, `f33Logout`): tras comprobar que no hay cambios pendientes, se borran las claves `finanzas360.*` de la cuenta (copia base, copia en la nube, cola de Apple Pay). Prueba: `remediacion-03.js` H-14 (antes 1 clave, después 0).

### Regresión propia corregida
La corrección de objetivos de 24 px de los puntos del wallet (fase anterior) hizo visibles cajas oscuras en Black. Se detectó al comparar capturas antes/después y se corrigió con `background-clip: content-box` y mayor especificidad.

## 3. Puntos que ya cumplían (la prueba lo confirmó, sin cambio de código)
| Punto | Resultado |
|---|---|
| ERR-01 mensajes de formulario anunciados | Los tres formularios medidos ya usan `aria-live` o `role="alert"` (la primera medición falló por un error de navegación del propio test, corregido) |
| MOV-01 movimiento reducido | 0 animaciones y 0 transiciones de más de 50 ms con la preferencia activa |
| UX-02b indicador de foco del buscador móvil | Ya visible |

## 4. Pruebas ejecutadas tras los cambios (todas en verde)
`experiencia-04` (9/9), `remediacion-03` (8/8), `flujos-ingresos` (69), `adversarial`, `smoke`, `csp`, `xss`, `rendimiento` (6), `vive-score` (39), `logica/run` (256 paridades, 65 correctas, 0 errores JS), `pantallas-sin-scroll` (390/768/1440), `auditoria-recorrido` (54 vistas sin errores ni desbordes).

## 5. Evidencias
`docs/auditoria/evidencias-04/`: 15 capturas «antes» y 16 «después» (Inicio, Ingresos, Wallet, Movimientos y Suscripciones; móvil Claro, móvil Black, escritorio) más la captura del aviso sin conexión. `tests/experiencia-04.js` imprime las métricas.

## 6. Qué no se cambió y por qué
| Punto | Decisión |
|---|---|
| UX-08 (3 toques para registrar un gasto) | No se alteró: el recorrido «Nueva operación → Pagar → Gasto» es parte del diseño aprobado; acortarlo sería un rediseño. Queda como propuesta de producto |
| UX-05 (14 radios, 45 alturas de botón) | No se unificaron: hacerlo sin un catálogo de diseño aprobado cambiaría la identidad visual de pantallas ya validadas |
| UX-03 nombre accesible en reposo | Sigue asignándose al recibir el foco (fase 03) |

## 7. Pendientes de las fases anteriores (estado real)
| Punto | Estado |
|---|---|
| H-03 contraseñas filtradas | **Manual**: activar «Leaked password protection» en Supabase Authentication → Policies; no es accesible desde el código ni desde las herramientas disponibles |
| `apple-pay-link` v9 | No desplegada: restringe CORS a `https://virgiliosmith.github.io` y el origen real no consta; basta con confirmarlo |
| H-18 integración continua | Se añadió `.github/workflows/ci.yml` (navegador, lógica, Edge Functions y pruebas SQL). **No se ha ejecutado en GitHub**: solo se verificó localmente cada comando |
| H-12 reconciliación del cliente | Sin prueba automática (requiere un Supabase simulado con revisiones) |
| H-02, H-08, H-10, H-11, H-16, H-17 | Sin cambios: centavos enteros, minificación, limpieza de capas CSS/JS, registro de errores silenciados y retirada de código heredado son refactorizaciones amplias que no caben en cambios pequeños y verificables |
