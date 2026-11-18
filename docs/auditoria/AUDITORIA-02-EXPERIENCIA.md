# AUDITORIA-02-EXPERIENCIA · vive el hoy

Fase dinámica: se recorrió la aplicación con Playwright (Chromium) sobre los datos de demostración en memoria. **No se modificó el código de la aplicación.** Se añadieron solo herramientas de auditoría (`tests/auditoria-exploracion.js`, `tests/auditoria-estados.js`), los datos crudos (`docs/auditoria/datos/`) y 52 capturas (`docs/auditoria/evidencias/`). Complementa a [AUDITORIA-01-TECNICA.md](AUDITORIA-01-TECNICA.md).

Marco: ISO 9241-210:2019 (eficacia, eficiencia, satisfacción, ciclo centrado en el usuario), ISO/IEC/IEEE 29119-4:2021 (técnicas de diseño de pruebas: particiones de equivalencia, valores límite, transiciones de estado, exploratoria, negativa), ISTQB, WCAG 2.2 AA.

## 1. Cobertura real (sin maquillar)
| Medida | Móvil 390×844 | Escritorio 1440×900 |
|---|---|---|
| Pantallas visitadas | 26 de 26 rutas | 26 de 26 rutas |
| Elementos interactivos detectados | 694 | 949 |
| Controles únicos (por acción + texto) | 381 | 385 |
| Controles pulsados | **276 (72 %)** | **233 (61 %)** |
| Modales abiertos y medidos | 44 | 24 |
| Formularios forzados | 35 | 0 (solo móvil) |
| Casos de prueba de formulario | 279 | 0 |
Además: 9 anchos de pantalla × 26 pantallas (234 mediciones), recorrido de teclado de 2 257 paradas de foco, prueba de modal con teclado, 120 cambios de pantalla seguidos, 30 aperturas de modal seguidas y 10 envíos simultáneos.
**Lo que NO se alcanzó al 100 %:** el 28 % (móvil) y 39 % (escritorio) de los controles únicos no se pulsaron (tope de 40 por pantalla, exclusión de acciones destructivas como cerrar sesión o restablecer, y controles que no se pudieron volver a localizar tras redibujar). La pantalla de Categorías tiene 184 controles (solo 40 probados). El fuzz de formularios no se ejecutó en escritorio.
Técnicas aplicadas en los formularios (9 particiones por formulario): vacío, hostil (HTML y SQL), 400 caracteres, cero, negativo, decimal fuera de paso (0,005), enorme (99 999 999 999), texto en campo numérico y valor típico; fechas inválidas (30 de febrero, año 0000, 1900, 9999) y selectores en primer y último valor.

## 2. Resultado de la exploración dinámica
* **0 errores de JavaScript, 0 errores de consola, 0 textos `NaN`/`undefined`, 0 invariantes financieros rotos** (montos finitos, ids únicos, saldos finitos), **0 XSS** y 0 registros creados con entradas inválidas en 279 casos de formulario y 509 pulsaciones.
* 32 avisos automáticos fueron **falsos positivos**: la palabra «Infinity» en la etiqueta legítima del nivel de tarjeta «Infinite / Infinity».
* Interacciones repetidas: 120 cambios de pantalla en 10,6 s (≈89 ms cada uno) sin errores; 30 aperturas/cierres de modal sin modales residuales; 10 envíos del mismo formulario de cuenta crearon **1** registro (idempotencia correcta).
* Desbordes: **0 desbordes horizontales de página** en 234 mediciones (320 a 1 440 px y 844×390 horizontal). Las tablas de Ingresos, Egresos y Recurrentes sí son más anchas que la pantalla móvil (547, 569 y 439 px) y se desplazan dentro de su contenedor (`overflow-x:auto`), por lo que no se cortan.
* Contenido final oculto tras la barra fija: **0** casos. Scroll innecesario (≤ 60 px): 3 casos (430 px Explorar +22 px; 768 px Préstamos +45 px y Certificados +24 px).

## 3. Hallazgos de experiencia
Escala: P2 error funcional o accesibilidad con efecto real · P3 inconsistencia o fricción · P4 mejora. «Verificado» = reproducido en esta fase.
| ID | Hallazgo | Sev. | Norma / criterio | Evidencia |
|---|---|---|---|---|
| UX-01 | **El modal no mueve el foco al abrirse y el teclado se escapa de él**: al abrir «Nueva cuenta» el foco no queda dentro, y 13 de 40 pulsaciones de Tab terminan fuera del modal. (Sí cierra con Escape y devuelve el foco a la pantalla.) | **P2** | WCAG 2.4.3 orden del foco, patrón ARIA de diálogo | `datos/estados.json` → `estados.modal` |
| UX-02 | **100 de 2 257 paradas de teclado (4,4 %) sin indicador de foco visible**, concentradas en Proyección (23 móvil, 22 escritorio), Patrimonio (19) e Inicio/Avanzado (11 cada una) | **P2** | WCAG 2.4.7 y 2.4.11 | `estados.json` → `teclado` |
| UX-03 | **51 paradas de foco sin nombre accesible** (controles sin texto ni `aria-label`) | **P2** | WCAG 4.1.2, 2.5.3 | `estados.json` → `teclado` |
| UX-04 | **Texto diminuto**: el 67 % de los textos de 14 pantallas móviles mide menos de 12 px y el 33 % mide 10 px o menos (69 tamaños de fuente distintos; los más frecuentes: 11 px, 10 px, 12 px) | P3 | ISO 9241-210 (legibilidad), WCAG 1.4.4 | medición en `tests/auditoria-estados.js` (consistencia) |
| UX-05 | **Inconsistencia de dimensiones**: 14 radios de tarjeta distintos (20, 21, 22, 24, 25, 26, 28 px…), 30 combinaciones de relleno, 45 alturas de botón distintas (44 px solo en 87 casos; hay botones de 16 px, 28 px y 32 px) | P3 | Consistencia visual / ISO 9241-110 | `estados.json` → `consistencia` |
| UX-06 | **Objetivos táctiles menores de 24 px** en pantallas de movimientos, Inicio y Avanzado (13 por pantalla en el arnés móvil; 93 en Movimientos de escritorio) | P3 | WCAG 2.5.8 | `auditoria-recorrido.js` (fase previa) |
| UX-07 | **Tablas de Ingresos, Egresos y Recurrentes exigen desplazamiento horizontal en móvil** (columnas fuera de vista sin indicación) | P3 | Eficiencia, WCAG 1.4.10 (reflow) | capturas `income-390.jpg`, `expenses-390.jpg` |
| UX-08 | **Registrar un gasto requiere 3 toques antes de ver el primer campo** (Nueva operación → Pagar → Gasto) y luego un flujo guiado | P3 | ISO 9241-210 (eficiencia) | recorrido verificado paso a paso |
| UX-09 | **Sin indicador visible de estado de conexión**: con el modo sin conexión activado no se encontró ningún aviso ni indicador de sincronización en pantalla | P3 | Visibilidad del estado del sistema | `estados.json` → `estados.offline` (resultado negativo; ver limitaciones) |
| UX-10 | Escritorio: la matriz anual, los paneles de lectura del patrimonio y las tablas avanzadas ya se corrigieron en la fase anterior (Black), sin regresión detectada | — | — | capturas `annual-*`, `projection-*` |

### Desviaciones respecto a los diseños aprobados (los cuatro flujos)
* El acento sale de Personalización, no el ciruela fijo de las imágenes.
* La fecha usa el calendario nativo del dispositivo, mostrada como «17 nov 2026» o «17/11/2026».
* En PC la pantalla es una columna centrada de 520 px, no una maqueta de teléfono.
* La cuenta destino del ingreso recurrente viene preseleccionada con la primera cuenta que no es efectivo.
Sin otras desviaciones detectadas en 7 pantallas × 5 anchos (prueba `pantallas-sin-scroll.js`).

## 4. Consolidación con la auditoría técnica (AUDITORIA-01)
| Tema | Técnica (H-xx) | Experiencia (UX-xx) | Lectura conjunta | Prioridad unificada |
|---|---|---|---|---|
| Integridad financiera en servidor | H-01 (sin validación), H-12 (sin pruebas de sincronización), H-20 | 0 invariantes rotos y 0 XSS en 509 pulsaciones/279 casos | El cliente resiste bien; el riesgo está en que el servidor acepta cualquier JSON | **P1** |
| Autenticación | H-03 (contraseñas filtradas) | No se pudo probar sesión expirada (ver limitaciones) | Brecha de verificación | **P1** |
| Accesibilidad | H-13 (contraste), H-15 (listeners) | UX-01 a UX-03, UX-06 | Faltan gestión del foco en modales, indicadores de foco y nombres accesibles; el contraste ya mejoró | **P2** |
| Precisión y fechas | H-07, H-08, H-09 | No reproducible desde la interfaz con importes límite (el campo `step=0,01` bloquea decimales a nivel de navegador) | Riesgo en cálculos internos, no en la captura | **P2** |
| Rendimiento | H-10 (LCP ≈ 6 s) | 89 ms por cambio de pantalla; INP escritorio 240 ms | Arranque lento, navegación aceptable | **P2** |
| Consistencia visual / mantenibilidad | H-11 (38 643 `!important`, overrides) | UX-04, UX-05 | La deuda CSS explica los 14 radios y 69 tamaños de fuente | **P3** |
| Errores silenciados | H-16 (≈160 `catch` vacíos) | UX-09 (sin aviso de conexión) | Los fallos de red no se comunican al usuario | **P3** |
| Fricción de uso | — | UX-07, UX-08 | Mejora de eficiencia sin riesgo financiero | **P3** |
Contradicciones: la auditoría técnica marcó riesgo en el redondeo y los saldos, pero la exploración no pudo provocarlo por la interfaz; se mantiene como riesgo técnico (H-07/H-08) sin evidencia de impacto visible.

## 5. Limitaciones y lo que no se pudo verificar
* **Sesión expirada:** el Supabase simulado del arnés no permite emitir un cierre de sesión por expiración; el cierre por inactividad (30 min) no se esperó. No verificado.
* **Red lenta:** los recursos se sirven con un interceptor local, así que no se pudo estrangular la red de forma representativa. No verificado. La desconexión sí se probó, pero con el Supabase simulado: el resultado (sin aviso visible, UX-09) es indicativo, no concluyente.
* **Operaciones concurrentes entre dispositivos:** requiere dos clientes contra un Supabase real. No verificado (ver H-12).
* **Valores límite en importes de movimientos:** el flujo guiado de «Gasto» se abre fuera de `#modal-root` y no se consiguió automatizar su formulario; los intentos sobre «Nueva cuenta» no llegaron a crear registros con el arnés, por lo que **no hay tabla de aceptación/rechazo de importes límite**. Lo comprobado: el navegador rechaza por `step` los decimales de más de 2 cifras (0,001, 0,005, 12,345) y los campos obligatorios vacíos.
* Cobertura de controles: 72 % (móvil) y 61 % (escritorio), ver sección 1. Sin pruebas con lector de pantalla real ni en dispositivos físicos (iOS).
* Las mediciones usan datos de demostración, no datos reales.

## 6. Evidencias
* `docs/auditoria/evidencias/<pantalla>-390.jpg` y `-1440.jpg`: captura de cada una de las 26 pantallas en móvil y escritorio.
* `docs/auditoria/datos/exploracion-movil.json`, `exploracion-escritorio.json`, `estados.json`: resultados crudos (controles, modales, casos, mediciones por ancho, teclado, consistencia).
* Herramientas: `tests/auditoria-exploracion.js`, `tests/auditoria-estados.js`.

## 7. Reproducción
```
W=390 H=844 FUZZ=1 CAP=40 OUT=/tmp/movil.json node tests/auditoria-exploracion.js
W=1440 H=900 FUZZ=0 CAP=40 OUT=/tmp/pc.json node tests/auditoria-exploracion.js
OUT=/tmp/estados.json node tests/auditoria-estados.js
```
Nota: la pantalla de Inicio y la de Avanzado no usan el contenedor `#page` estándar; para explorarlas se sustituyó el selector raíz por `#app main, #app .inner-view, #app section` (80 pulsaciones, 16 modales, 96 casos, 0 hallazgos).
